const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const MAX_USERS_PER_ROOM = 20;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

io.on('connection', (socket) => {
  socket.lastMessageAt = 0;

  socket.on('join-room', ({ room, username }, ack) => {
    room = String(room || 'chat');
    username = String(username || 'Anon');

    if (!rooms[room]) {
      rooms[room] = { users: new Map(), history: [] };
    }

    const roomObj = rooms[room];
    if (roomObj.users.size >= MAX_USERS_PER_ROOM) {
      return ack && ack({ ok: false, reason: 'room_full' });
    }

    roomObj.users.set(socket.id, username);
    socket.join(room);
    socket.roomName = room;
    socket.username = username;

    ack && ack({ ok: true, history: roomObj.history });

    io.to(room).emit('user-list', Array.from(roomObj.users.values()));
    io.to(room).emit('system-message', {
      text: `${escapeHtml(username)} se ha unido.`,
      time: Date.now()
    });
  });

  socket.on('send-message', (text, ack) => {
    const now = Date.now();
    if (now - (socket.lastMessageAt || 0) < 800) {
      return ack && ack({ ok: false, reason: 'rate_limited' });
    }
    socket.lastMessageAt = now;

    const room = socket.roomName;
    if (!room || !rooms[room]) return ack && ack({ ok: false, reason: 'not_in_room' });

    const username = socket.username || 'Anon';
    const safeText = escapeHtml(String(text));
    const msg = { user: username, text: safeText, time: now };

    rooms[room].history.push(msg);
    if (rooms[room].history.length > 50) rooms[room].history.shift();

    io.to(room).emit('new-message', msg);
    ack && ack({ ok: true });
  });

  socket.on('disconnect', () => {
    const room = socket.roomName;
    const username = socket.username;
    if (room && rooms[room]) {
      rooms[room].users.delete(socket.id);
      io.to(room).emit('user-list', Array.from(rooms[room].users.values()));
      io.to(room).emit('system-message', {
        text: `${escapeHtml(username || 'Alguien')} se ha ido.`,
        time: Date.now()
      });
      if (rooms[room].users.size === 0) {
        delete rooms[room];
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
