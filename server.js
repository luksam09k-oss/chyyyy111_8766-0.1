const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Message = require("./Message"); // modelo de mensajes

const PORT = process.env.PORT || 3000;
const MAX_USERS_PER_ROOM = 20;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());

// === conectar MongoDB ===
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB conectado"))
.catch(err => console.error("Error conectando a MongoDB:", err));

// === cargar usuarios ===
const usuariosFile = path.join(__dirname, "users.json");
let usuarios = JSON.parse(fs.readFileSync(usuariosFile));

function saveUsers() {
  fs.writeFileSync(usuariosFile, JSON.stringify(usuarios, null, 2));
}

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

// ========= LOGIN ===========
app.post('/login', (req, res) => {
  const { user, pass } = req.body;

  if (!usuarios.usuarios[user]) return res.json({ ok: false });
  if (usuarios.usuarios[user].password !== pass) return res.json({ ok: false });

  const rol = usuarios.usuarios[user].rol || "user";

  return res.json({ ok: true, user, rol });
});

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
  socket.lastMessageAt = 0;

  socket.on('join-room', async ({ room, username, rol }, ack) => {
    room = String(room || "chat");
    username = String(username || "Anon");

    if (usuarios.baneados.includes(username)) {
      return ack && ack({ ok: false, reason: "banned" });
    }

    if (!rooms[room]) {
      rooms[room] = { users: new Map() };
    }

    const roomObj = rooms[room];

    if (roomObj.users.size >= MAX_USERS_PER_ROOM) {
      return ack && ack({ ok: false, reason: 'room_full' });
    }

    socket.join(room);
    socket.roomName = room;
    socket.username = username;
    socket.rol = rol || "user";

    roomObj.users.set(socket.id, username);

    // cargar historial desde MongoDB (últimos 50 mensajes de esta sala)
    const history = await Message.find({ room }).sort({ time: 1 }).limit(50);
    ack && ack({ ok: true, history });

    io.to(room).emit('user-list', Array.from(roomObj.users.values()));
    io.to(room).emit('system-message', {
      text: `${escapeHtml(username)} se ha unido.`,
      time: Date.now()
    });
  });

  // ========= MENSAJES ===========
  socket.on('send-message', async (text, ack) => {
    const now = Date.now();
    if (now - (socket.lastMessageAt || 0) < 800) {
      return ack && ack({ ok: false, reason: 'rate_limited' });
    }
    socket.lastMessageAt = now;

    const room = socket.roomName;
    if (!room || !rooms[room]) {
      return ack && ack({ ok: false, reason: 'not_in_room' });
    }

    // ===================== COMANDOS ADMIN =====================
    if (socket.rol === "admin" && text.startsWith("/")) {
      const parts = text.trim().split(" ");
      const cmd = parts[0].toLowerCase();
      const arg = parts[1];

      if (cmd === "/kick") {
        if (!arg) return;
        for (const [id, name] of rooms[room].users.entries()) {
          if (name === arg) {
            io.to(id).emit("system-message", {
              text: "Has sido expulsado por un administrador.",
              time: Date.now()
            });
            io.sockets.sockets.get(id)?.disconnect(true);
            break;
          }
        }
        return ack && ack({ ok: true });
      }

      if (cmd === "/ban") {
        if (!arg) return;
        if (!usuarios.baneados.includes(arg)) {
          usuarios.baneados.push(arg);
          saveUsers();
        }
        for (const [id, name] of rooms[room].users.entries()) {
          if (name === arg) {
            io.to(id).emit("system-message", {
              text: "Has sido baneado por un administrador.",
              time: Date.now()
            });
            io.sockets.sockets.get(id)?.disconnect(true);
            break;
          }
        }
        return ack && ack({ ok: true });
      }

      if (cmd === "/unban") {
        usuarios.baneados = usuarios.baneados.filter(u => u !== arg);
        saveUsers();
        return ack && ack({ ok: true });
      }

      if (cmd === "/clear") {
        // borrar de MongoDB
        await Message.deleteMany({ room });
        io.to(room).emit("clear-chat");
        return ack && ack({ ok: true });
      }

      if (cmd === "/announce") {
        const msgText = text.slice(9).trim();
        if (!msgText) return;
        io.to(room).emit("system-message", {
          text: `[ANUNCIO] ${escapeHtml(msgText)}`,
          time: Date.now()
        });
        return ack && ack({ ok: true });
      }

      return;
    }

    // mensaje normal
    const safeText = escapeHtml(String(text));

    const msg = {
      room,
      user: socket.username + (socket.rol === "admin" ? " (ADMIN)" : ""),
      text: safeText,
      time: now
    };

    // guardar en MongoDB
    const newMsg = new Message(msg);
    await newMsg.save();

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
