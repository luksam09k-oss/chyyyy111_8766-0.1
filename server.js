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
mongoose.connect(
  "mongodb+srv://luksam09k_db_user:D7mcreChPJu9HFBt@cluster0.3bnnbke.mongodb.net/ChatDB?retryWrites=true&w=majority"
);
const conn = mongoose.connection;

// === Schemas ===
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  rol: String,
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
const storage = new GridFsStorage({
  url: "mongodb+srv://luksam09k_db_user:D7mcreChPJu9HFBt@cluster0.3bnnbke.mongodb.net/ChatDB",
  file: (req, file) => ({ filename: `${Date.now()}_${file.originalname}` })
});
const upload = multer({ storage });

let bucket;
conn.once('open', () => {
  console.log("MongoDB conectado");
  bucket = new GridFSBucket(conn.db, { bucketName: "avatars" });
});

// === Middleware ===
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
  const fileId = req.file.id;
  await User.updateOne({ username }, { avatarId: fileId });
  res.json({ ok: true, fileId });
});

// === Endpoint para servir avatars ===
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
io.on('connection', (socket) => {
  socket.lastMessageAt = 0;

  socket.on('join-room', async ({ room, username }, ack) => {
    room = room || "chat";
    const user = await User.findOne({ username });
    if (!user) return ack && ack({ ok: false });

    socket.join(room);
    socket.roomName = room;
    socket.username = username;

    if (!rooms[room]) rooms[room] = { users: new Map() };
    rooms[room].users.set(socket.id, user);

    const allMessages = await Message.find().sort({ time: 1 }).lean();

    io.to(room).emit('user-list', Array.from(rooms[room].users.values()).map(u => ({
      username: u.username,
      rol: u.rol,
      avatarId: u.avatarId
    })));

    ack && ack({ ok: true, history: allMessages });
  });

  socket.on('send-message', async (text, ack) => {
    const now = new Date();
    if (now - (socket.lastMessageAt || 0) < 800)
      return ack && ack({ ok: false, reason: 'rate_limited' });
    socket.lastMessageAt = now;

    const user = await User.findOne({ username: socket.username });
    if (!user) return ack && ack({ ok: false });

    const msg = { user: user.username, text, time: now };
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
