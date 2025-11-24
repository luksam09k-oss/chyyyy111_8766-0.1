const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const { GridFSBucket, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// === MongoDB ===
const mongoURL = "mongodb+srv://luksam09k_db_user:D7mcreChPJu9HFBt@cluster0.3bnnbke.mongodb.net/ChatDB?retryWrites=true&w=majority";
mongoose.connect(mongoURL);
const conn = mongoose.connection;

// === Schemas ===
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  rol: { type: String, default: "user" },
  avatarId: { type: String, default: null }
});
const User = mongoose.model("User", userSchema);

const messageSchema = new mongoose.Schema({
  user: String,
  text: String,
  time: Date
});
const Message = mongoose.model("Message", messageSchema);

// === GridFS para avatars ===
const storage = new GridFsStorage({ url: mongoURL, file: (req, file) => ({ filename: `${Date.now()}_${file.originalname}` }) });
const upload = multer({ storage });
let bucket;
conn.once('open', () => {
  console.log("MongoDB conectado");
  bucket = new GridFSBucket(conn.db, { bucketName: "avatars" });
});

app.use(express.static('public'));
app.use(express.json());

// === Login ===
app.post('/login', async (req, res) => {
  const { user, pass } = req.body;
  const u = await User.findOne({ username: user });
  if (!u || u.password !== pass) return res.json({ ok: false });
  res.json({ ok: true, user: u.username, rol: u.rol, avatarId: u.avatarId });
});

// === Upload avatar ===
app.post("/upload-avatar", upload.single("avatar"), async (req, res) => {
  const { username } = req.body;
  await User.updateOne({ username }, { avatarId: req.file.id });
  res.json({ ok: true, fileId: req.file.id });
});

// === Servir avatars ===
app.get("/avatar/:id", (req, res) => {
  const id = req.params.id;
  if (id === "default.png") return res.sendFile(path.join(__dirname, "public", "default.png"));
  try {
    bucket.openDownloadStream(ObjectId(id)).pipe(res);
  } catch {
    res.sendFile(path.join(__dirname, "public", "default.png"));
  }
});

// === Socket.IO ===
const rooms = {};
const MAX_USERS_PER_ROOM = 50;

io.on('connection', (socket) => {
  socket.lastMessageAt = 0;

  socket.on('join-room', async ({ room, username, rol }, ack) => {
    room = room || "chat";
    const user = await User.findOne({ username });
    if (!user) return ack && ack({ ok: false });

    socket.join(room);
    socket.username = user.username;
    socket.rol = user.rol; // rol correcto
    socket.avatarId = user.avatarId;

    if (!rooms[room]) rooms[room] = { users: new Map(), history: [] };
    rooms[room].users.set(socket.id, socket);

    // Enviar historial de mensajes
    const messages = await Message.find().sort({ time: 1 }).lean();
    rooms[room].history = messages;

    // Emitir lista de usuarios
    io.to(room).emit('user-list', Array.from(rooms[room].users.values()).map(u => ({
      username: u.username,
      rol: u.rol,
      avatarId: u.avatarId
    })));

    ack && ack({ ok: true, history: messages });
  });

  socket.on('send-message', async (text, ack) => {
    const now = new Date();
    if (now - (socket.lastMessageAt || 0) < 500) return ack && ack({ ok: false, reason: "rate_limited" });
    socket.lastMessageAt = now;

    // === Comandos admin ===
    if (socket.rol === "admin" && text.startsWith("/")) {
      const [cmd, arg] = text.trim().split(" ");
      const room = socket.roomName;

      if (cmd === "/kick") {
        for (const [id, u] of rooms[room].users.entries()) {
          if (u.username === arg) {
            io.to(id).emit("system-message", { text: "Has sido expulsado por un admin.", time: Date.now() });
            io.sockets.sockets.get(id)?.disconnect(true);
            break;
          }
        }
        return ack && ack({ ok: true });
      }

      if (cmd === "/ban") {
        await User.updateOne({ username: arg }, { banned: true });
        for (const [id, u] of rooms[room].users.entries()) {
          if (u.username === arg) {
            io.to(id).emit("system-message", { text: "Has sido baneado.", time: Date.now() });
            io.sockets.sockets.get(id)?.disconnect(true);
            break;
          }
        }
        return ack && ack({ ok: true });
      }

      if (cmd === "/unban") {
        await User.updateOne({ username: arg }, { banned: false });
        return ack && ack({ ok: true });
      }

      if (cmd === "/clear") {
        rooms[room].history = [];
        io.to(room).emit("clear-chat");
        return ack && ack({ ok: true });
      }

      if (cmd === "/announce") {
        const msgText = text.slice(9).trim();
        if (!msgText) return;
        io.to(socket.roomName).emit("system-message", { text: `[ANUNCIO] ${msgText}`, time: Date.now() });
        return ack && ack({ ok: true });
      }
    }

    // Mensaje normal
    const msg = { user: socket.username, text, time: now };
    rooms[socket.roomName].history.push(msg);
    await Message.create(msg);
    io.to(socket.roomName).emit('new-message', msg);
    ack && ack({ ok: true });
  });

  socket.on('disconnect', () => {
    const room = socket.roomName;
    if (room && rooms[room]) {
      rooms[room].users.delete(socket.id);
      io.to(room).emit('user-list', Array.from(rooms[room].users.values()).map(u => ({
        username: u.username,
        rol: u.rol,
        avatarId: u.avatarId
      })));
    }
  });
});

server.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
