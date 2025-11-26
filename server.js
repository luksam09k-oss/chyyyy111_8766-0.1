// =========================
// IMPORTS
// =========================
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// =========================
// MIDDLEWARE
// =========================
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/avatar", express.static("avatars"));

// =========================
// MONGO DB
// =========================
mongoose.connect(process.env.MONGO_URL || "mongodb://localhost/chatapp")
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.error("Error Mongo:", err));

// =========================
// SCHEMAS
// =========================
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  rol: String,
  avatarId: String
});

const messageSchema = new mongoose.Schema({
  room: String,
  user: String,
  rol: String,
  text: String,
  avatarId: String,
  time: Number,
  deleted: Boolean,
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// =========================
// AVATARS
// =========================
const multer = require("multer");
const fs = require("fs");

if (!fs.existsSync("avatars")) fs.mkdirSync("avatars");

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "avatars"),
  filename: (_, file, cb) => {
    const name = Date.now() + "_" + file.originalname;
    cb(null, name);
  }
});
const upload = multer({ storage });

// Upload avatar
app.post("/upload-avatar", upload.single("avatar"), async (req, res) => {
  if (!req.file) return res.json({ ok: false });

  await User.updateOne(
    { username: req.body.username },
    { $set: { avatarId: req.file.filename } }
  );

  res.json({ ok: true });
});

// =========================
// LOGIN ENDPOINT
// =========================
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const u = await User.findOne({ username });
  if (!u) return res.json({ ok: false, error: "Usuario no existe" });

  if (u.password !== password)
    return res.json({ ok: false, error: "Contraseña incorrecta" });

  res.json({ ok: true, user: u });
});

// =========================
// SOCKET.IO
// =========================
let connectedUsers = {}; // socket.id → { username, rol, avatarId }

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  // =========================
  // ENTRAR A LA SALA
  // =========================
  socket.on("join-room", async ({ room, username, rol }, callback) => {
    const user = await User.findOne({ username });
    if (!user) return callback({ ok: false });

    socket.join(room);

    connectedUsers[socket.id] = {
      username,
      rol,
      avatarId: user.avatarId || "default.png",
      room
    };

    // HISTORIAL
    const history = await Message.find({ room }).sort({ time: 1 }).limit(200);

    callback({ ok: true, history });

    updateUserList(room);
  });

  // =========================
  // ENVIAR MENSAJE
  // =========================
  socket.on("send-message", async (text) => {
    const u = connectedUsers[socket.id];
    if (!u) return;

    const msg = new Message({
      room: u.room,
      user: u.username,
      rol: u.rol,
      avatarId: u.avatarId,
      text,
      time: Date.now(),
      deleted: false
    });

    await msg.save();

    io.to(u.room).emit("new-message", {
      _id: msg._id,
      user: u.username,
      rol: u.rol,
      avatarId: u.avatarId,
      text,
      time: msg.time
    });
  });

  // =========================
  // ELIMINAR MENSAJE
  // =========================
  socket.on("delete-message", async (id) => {
    const u = connectedUsers[socket.id];
    if (!u) return;

    const msg = await Message.findById(id);
    if (!msg) return;

    if (msg.user !== u.username) return;

    await Message.updateOne({ _id: id }, { $set: { deleted: true } });

    io.to(u.room).emit("message-deleted", { _id: id });
  });

  // =========================
  // TYPING
  // =========================
  socket.on("typing", (typing) => {
    const u = connectedUsers[socket.id];
    if (!u) return;

    io.to(u.room).emit("user-typing", {
      user: u.username,
      typing
    });
  });

  // =========================
  // DESCONECTAR
  // =========================
  socket.on("disconnect", () => {
    const u = connectedUsers[socket.id];
    if (u) {
      const room = u.room;
      delete connectedUsers[socket.id];
      updateUserList(room);
    }
    console.log("Usuario desconectado:", socket.id);
  });
});

// =========================
// USUARIOS CONECTADOS POR SALA
// =========================
function updateUserList(room) {
  const users = Object.values(connectedUsers)
    .filter(u => u.room === room)
    .map(u => ({
      username: u.username,
      rol: u.rol,
      avatarId: u.avatarId
    }));

  io.to(room).emit("user-list", users);
}

// =========================
// SERVER LISTEN
// =========================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Servidor listo en puerto " + PORT));
