const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const MAX_USERS_PER_ROOM = 20;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());

// === cargar usuarios ===
const usuariosFile = path.join(__dirname, "users.json");
let usuarios = JSON.parse(fs.readFileSync(usuariosFile));

function saveUsers() {
  fs.writeFileSync(usuariosFile, JSON.stringify(usuarios, null, 2));
}

// === MongoDB connection ===
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://luksam09k_db_user:D7mcreChPJu9HFBt@cluster0.3bnnbke.mongodb.net/ChatDB";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const conn = mongoose.connection;

let gfs;
conn.once("open", () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: "avatars" });
  console.log("MongoDB conectado y GridFS listo");
});

// === GridFS Storage para multer ===
const storage = new GridFsStorage({
  url: MONGO_URI,
  file: (req, file) => {
    return {
      filename: file.originalname
    };
  }
});
const upload = multer({ storage });

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
  if (!usuarios.usuarios[user] || usuarios.usuarios[user].password !== pass) {
    return res.json({ ok: false });
  }
  const rol = usuarios.usuarios[user].rol || "user";
  return res.json({ ok: true, user, rol, avatarId: usuarios.usuarios[user].avatarId || null });
});

// ========= AVATAR ===========
app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  const username = req.body.username;
  if (!req.file || !username || !usuarios.usuarios[username]) {
    return res.status(400).send("Error al subir avatar");
  }

  // Guardar el ID de GridFS en el usuario
  usuarios.usuarios[username].avatarId = req.file.id;
  saveUsers();

  res.json({ ok: true, avatarId: req.file.id });
});

// Endpoint para servir avatars
app.get('/avatar/:id', async (req, res) => {
  try {
    const _id = new mongoose.Types.ObjectId(req.params.id);
    const cursor = gfs.find({ _id });
    const files = await cursor.toArray();
    if (!files || files.length === 0) return res.status(404).send("No file found");
    const readstream = gfs.openDownloadStream(_id);
    readstream.pipe(res);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
  socket.lastMessageAt = 0;

  socket.on('join-room', ({ room, username, rol }, ack) => {
    room = String(room || "chat");
    username = String(username || "Anon");

    if (usuarios.baneados.includes(username)) return ack && ack({ ok: false, reason: "banned" });

    if (!rooms[room]) rooms[room] = { users: new Map(), history: [] };
    const roomObj = rooms[room];

    if (roomObj.users.size >= MAX_USERS_PER_ROOM) return ack && ack({ ok: false, reason: 'room_full' });

    socket.join(room);
    socket.roomName = room;
    socket.username = username;
    socket.rol = rol || "user";

    roomObj.users.set(socket.id, username);

    // Obtener avatarId del usuario
    const avatarId = usuarios.usuarios[username]?.avatarId || null;

    // Enviar historial con avatarId
    ack && ack({ ok: true, history: roomObj.history, avatarId });

    io.to(room).emit('user-list', Array.from(roomObj.users.values()));
    io.to(room).emit('system-message', {
      text: `${escapeHtml(username)} se ha unido.`,
      time: Date.now()
    });
  });

  socket.on('send-message', (text, ack) => {
    const now = Date.now();
    if (now - (socket.lastMessageAt || 0) < 800) return ack && ack({ ok: false, reason: 'rate_limited' });
    socket.lastMessageAt = now;

    const room = socket.roomName;
    if (!room || !rooms[room]) return ack && ack({ ok: false, reason: 'not_in_room' });

    const avatarId = usuarios.usuarios[socket.username]?.avatarId || null;

    const msg = {
      user: socket.username + (socket.rol === "admin" ? " (ADMIN)" : ""),
      text: escapeHtml(String(text)),
      avatarId,
      time: now
    };

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
      if (rooms[room].users.size === 0) delete rooms[room];
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
