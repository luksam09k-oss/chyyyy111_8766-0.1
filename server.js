const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const crypto = require("crypto");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));
app.use(cors());

// ===== MongoDB =====
mongoose.connect("mongodb+srv://luksam09k_db_user:D7mcreChPJu9HFBt@cluster0.3bnnbke.mongodb.net/ChatDB?retryWrites=true&w=majority");

const conn = mongoose.connection;
let gfs;

conn.once("open", () => {
  console.log("MongoDB conectado");
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "avatars"
  });
});

// ===== Multer GridFS Storage =====
const storage = new GridFsStorage({
  url: "mongodb+srv://luksam09k_db_user:D7mcreChPJu9HFBt@cluster0.3bnnbke.mongodb.net/ChatDB",
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) return reject(err);
        const filename = buf.toString("hex") + path.extname(file.originalname);
        resolve({ filename, bucketName: "avatars" });
      });
    });
  }
});
const upload = multer({ storage });

// ===== Schemas =====
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  rol: String,
  avatarId: String
});
const User = mongoose.model("User", userSchema);

const messageSchema = new mongoose.Schema({
  user: String,
  text: String,
  time: Date,
  avatarId: String
});
const Message = mongoose.model("Message", messageSchema);

// ===== Rutas =====

// Login
app.post("/login", async (req, res) => {
  const { user, pass } = req.body;
  const dbUser = await User.findOne({ username: user });
  if (!dbUser || dbUser.password !== pass) return res.json({ ok: false });
  res.json({ ok: true, user: dbUser.username, rol: dbUser.rol, avatarId: dbUser.avatarId });
});

// Subir avatar
app.post("/upload-avatar", upload.single("avatar"), async (req, res) => {
  const username = req.body.username;
  const file = req.file;
  if (!username || !file) return res.status(400).json({ ok: false });

  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ ok: false });

  user.avatarId = file.id.toString();
  await user.save();

  io.emit("update-user", { username, avatarId: user.avatarId }); // actualizar lateral
  res.json({ ok: true, avatarId: user.avatarId });
});

// Obtener avatar
app.get("/avatar/:id", async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    gfs.find({ _id: fileId }).toArray((err, files) => {
      if (!files || files.length === 0) return res.status(404).send("No file found");
      gfs.openDownloadStream(fileId).pipe(res);
    });
  } catch {
    res.status(400).send("Invalid ID");
  }
});

// ===== Socket.io =====
io.on("connection", async (socket) => {
  socket.on("join-room", async ({ room, username, rol }, ack) => {
    room = room || "chat";
    socket.join(room);

    // cargar historial
    const history = await Message.find().sort({ time: 1 }).limit(50).lean();
    ack && ack({ ok: true, history });

    // enviar lista de usuarios conectados
    const users = await User.find().lean();
    io.to(room).emit("user-list", users);
  });

  socket.on("send-message", async (text, ack) => {
    const username = socket.handshake.query.username;
    const user = await User.findOne({ username });
    if (!user) return ack && ack({ ok: false });

    const msg = new Message({
      user: username,
      text,
      time: new Date(),
      avatarId: user.avatarId
    });
    await msg.save();

    io.emit("new-message", msg);
    ack && ack({ ok: true });
  });
});

server.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
