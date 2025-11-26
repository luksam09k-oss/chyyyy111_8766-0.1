// server.js
// ===============================
// server.js ADMIN + AVATARES + ELIMINAR MENSAJES + RESPONDER + PANEL ADMIN
// ===============================
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const socketio = require("socket.io");
const path = require("path");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const cors = require("cors");

const User = require("./User");
const Message = require("./Message");

const app = express();
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// ==================================================
// Mongo + GridFS
// ==================================================
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatroom";

const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("Mongoose conectado"))
  .catch((err) => console.error("Error mongoose:", err));

let gfs;
conn.once("open", () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads"
  });
  console.log("MongoDB + GridFS listo (conn abierta)");
});

// GridFS Storage
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => ({
    filename: Date.now() + "_" + file.originalname,
    bucketName: "uploads"
  })
});
const upload = multer({ storage });

// ==================================================
// LOGIN
// ==================================================
app.post("/login", async (req, res) => {
  try {
    const { user, pass } = req.body;
    if (!user || !pass) return res.json({ ok: false });

    const found = await User.findOne({ username: user }).lean();
    if (!found) return res.json({ ok: false });
    if (found.password !== pass) return res.json({ ok: false });
    if (found.banned) return res.json({ ok: false, reason: "banned" });

    res.json({
      ok: true,
      user: found.username,
      rol: found.rol,
      avatarId: found.avatarId || "default.png"
    });
  } catch (e) {
    console.error(e);
    res.json({ ok: false });
  }
});

// ==================================================
// SUBIR AVATAR
// ==================================================
app.post("/upload-avatar", upload.single("avatar"), async (req, res) => {
  try {
    const username = req.body.username;
    if (!username || !req.file) return res.json({ ok: false });

    await User.findOneAndUpdate(
      { username },
      { avatarId: req.file.filename }
    );

    io.emit("user-list", Object.values(online));
    res.json({ ok: true, avatarId: req.file.filename });
  } catch (e) {
    console.log(e);
    res.json({ ok: false });
  }
});

// ==================================================
// SERVIR AVATAR
// ==================================================
app.get("/avatar/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const file = await conn
      .db
      .collection("uploads.files")
      .findOne({ filename });

    if (!file) {
      return res.sendFile(path.join(__dirname, "public", "default.png"));
    }

    gfs.openDownloadStreamByName(filename).pipe(res);
  } catch (e) {
    return res.sendFile(path.join(__dirname, "public", "default.png"));
  }
});

// ==================================================
// SOCKET.IO CHAT
// ==================================================
let online = {}; // username → info

io.on("connection", (socket) => {
  console.log("Nuevo cliente conectado:", socket.id);

  // TYPING
  socket.on("typing", (isTyping) => {
    if (socket.username) {
      socket
        .to("chat")
        .emit("user-typing", { user: socket.username, typing: isTyping });
    }
  });

  // JOIN ROOM
  socket.on("join-room", async ({ room, username }, cb = () => {}) => {
    try {
      if (!username) return cb({ ok: false });
      const user = await User.findOne({ username }).lean();
      if (!user) return cb({ ok: false });
      if (user.banned) return cb({ ok: false, reason: "banned" });

      socket.join(room);
      socket.username = username;
      socket.rol = user.rol;
      socket.avatarId = user.avatarId || "default.png";

      online[username] = {
        username,
        rol: user.rol,
        avatarId: socket.avatarId
      };

      // **ARREGLADO: EL HISTORIAL AHORA VIENE ORDENADO Y COMPLETO**
      const history = await Message.find({ room })
        .sort({ time: 1 })
        .limit(200)
        .lean();

      cb({ ok: true, history });

      io.emit("user-list", Object.values(online));
    } catch (err) {
      console.error("join-room error:", err);
      cb({ ok: false });
    }
  });

  // ENVIAR MENSAJE + COMANDOS
  socket.on("send-message", async (msg, cb) => {
    try {
      if (!socket.username) return cb?.({ ok: false });

      // ------------------------------------------------------
      // *** ARREGLO CRÍTICO ***
      // LA BASE DE DATOS NO TENÍA time → ahora se guarda SIEMPRE
      // ------------------------------------------------------

      // MENSAJE NORMAL
      const m = new Message({
        room: "chat",
        user: socket.username,
        text: msg,
        rol: socket.rol,
        avatarId: socket.avatarId,
        deleted: false,
        time: Date.now() // 🔥🔥🔥 FIX IMPORTANTE
      });

      await m.save();

      io.to("chat").emit("new-message", {
        _id: m._id,
        room: "chat",
        user: socket.username,
        text: msg,
        rol: socket.rol,
        avatarId: socket.avatarId,
        time: m.time,
        deleted: false
      });

      cb?.({ ok: true });
    } catch (err) {
      console.error("send-message error:", err);
      cb?.({ ok: false });
    }
  });

  // ELIMINAR MENSAJE
  socket.on("delete-message", async (msgId) => {
    try {
      const msg = await Message.findById(msgId);
      if (!msg) return;
      if (msg.user !== socket.username && socket.rol !== "admin") return;

      msg.deleted = true;
      await msg.save();

      io.to("chat").emit("message-deleted", { _id: msgId });
    } catch (err) {
      console.error("delete-message error:", err);
    }
  });

  // DESCONECTAR
  socket.on("disconnect", () => {
    if (socket.username) {
      delete online[socket.username];
      io.emit("user-list", Object.values(online));
    }
  });
});

// ==================================================
// SERVIDOR
// ==================================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () =>
  console.log("Servidor corriendo en http://localhost:" + PORT)
);
