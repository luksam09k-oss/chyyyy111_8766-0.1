// ===============================
// server.js ADMIN + AVATARES + ELIMINAR MENSAJES
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
const io = socketio(server);

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// ==================================================
// Mongo + GridFS
// ==================================================
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatroom";

const conn = mongoose.createConnection(mongoURI);
mongoose.connect(mongoURI);

let gfs;
conn.once("open", () => {
    gfs = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: "uploads" });
    console.log("MongoDB + GridFS listo");
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
        const found = await User.findOne({ username: user });
        if (!found) return res.json({ ok: false });
        if (found.password !== pass) return res.json({ ok: false });
        if (found.banned) return res.json({ ok: false, reason: "banned" });

        res.json({
            ok: true,
            user: found.username,
            rol: found.rol,
            avatarId: found.avatarId
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
        await User.findOneAndUpdate({ username }, { avatarId: req.file.filename });
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
        const file = await conn.db.collection("uploads.files").findOne({ filename: req.params.filename });
        if (!file) return res.sendFile(path.join(__dirname, "public", "default.png"));

        gfs.openDownloadStreamByName(req.params.filename).pipe(res);
    } catch (e) {
        return res.sendFile(path.join(__dirname, "public", "default.png"));
    }
});

// ==================================================
// SOCKET.IO CHAT
// ==================================================
let online = {}; // username → info

io.on("connection", (socket) => {
    console.log("Nuevo cliente conectado");

    // JOIN ROOM
    socket.on("join-room", async ({ room, username, rol }, cb = () => {}) => {
        try {
            const user = await User.findOne({ username });
            if (!user) return cb({ ok: false });
            if (user.banned) return cb({ ok: false, reason: "banned" });

            socket.join(room);
            socket.username = username;
            socket.rol = user.rol;
            socket.avatarId = user.avatarId;

            online[username] = { username, rol: user.rol, avatarId: user.avatarId };

            const history = await Message.find({ room })
                .sort({ time: 1 })
                .limit(100)
                .lean();

            cb({ ok: true, history });
            io.emit("user-list", Object.values(online));

        } catch {
            cb({ ok: false });
        }
    });

    // ENVIAR MENSAJE + COMANDOS
    socket.on("send-message", async (msg, cb) => {
        if (!socket.username) return cb?.({ ok: false });

        // COMANDOS
        if (msg.startsWith("/")) {
            if (socket.rol !== "admin") {
                socket.emit("system-message", { text: "No tienes permisos." });
                return cb?.({ ok: true });
            }

            const [cmd, target] = msg.split(" ");
            switch (cmd) {
                case "/clear":
                    await Message.deleteMany({ room: "chat" });
                    io.to("chat").emit("clear-chat");
                    break;
                case "/ban":
                    if (!target) break;
                    await User.updateOne({ username: target }, { banned: true });
                    io.emit("system-message", { text: `${target} fue baneado` });
                    break;
                case "/unban":
                    if (!target) break;
                    await User.updateOne({ username: target }, { banned: false });
                    io.emit("system-message", { text: `${target} fue desbaneado` });
                    break;
                default:
                    socket.emit("system-message", { text: "Comando desconocido" });
            }
            return cb?.({ ok: true });
        }

        // MENSAJE NORMAL
        const m = new Message({
            room: "chat",
            user: socket.username,
            text: msg,
            rol: socket.rol,
            avatarId: socket.avatarId
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
    });

    // ELIMINAR MENSAJE
    socket.on("delete-message", async (msgId) => {
        const msg = await Message.findById(msgId);
        if (!msg || msg.user !== socket.username) return;

        msg.deleted = true;
        await msg.save();

        io.to("chat").emit("message-deleted", { _id: msgId });
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
server.listen(PORT, () => console.log("Servidor corriendo en http://localhost:" + PORT));
