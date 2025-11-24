const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const multer = require("multer");

const PORT = process.env.PORT || 3000;
const MAX_USERS_PER_ROOM = 20;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());

// === MongoDB ===
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://luksam09k_db_user:D7mcreChPJu9HFBt@cluster0.3bnnbke.mongodb.net/ChatDB";
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB conectado"))
  .catch(err => console.error(err));

const messageSchema = new mongoose.Schema({
  room: String,
  user: String,
  text: String,
  time: Date
});
const Message = mongoose.model("Message", messageSchema);

// === Usuarios ===
const usuariosFile = path.join(__dirname, "users.json");
let usuarios = JSON.parse(fs.readFileSync(usuariosFile));
function saveUsers() {
  fs.writeFileSync(usuariosFile, JSON.stringify(usuarios, null, 2));
}

const rooms = {};
function escapeHtml(text) { if(!text) return ''; return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }

// ===== Login =====
app.post('/login', (req,res)=>{
  const {user,pass}=req.body;
  if(!usuarios.usuarios[user]) return res.json({ok:false});
  if(usuarios.usuarios[user].password!==pass) return res.json({ok:false});
  const rol = usuarios.usuarios[user].rol || "user";
  return res.json({ok:true,user,rol});
});

// ===== Upload Avatar =====
const upload = multer({ dest:"public/avatars/" });
app.post("/upload-avatar", upload.single("avatar"), (req,res)=>{
  const {username}=req.body;
  const file=req.file;
  if(!usuarios.usuarios[username]) return res.json({ok:false});

  const newPath=`/avatars/${file.originalname}`;
  fs.renameSync(file.path, path.join(__dirname,"public","avatars",file.originalname));
  usuarios.usuarios[username].avatar=newPath;
  saveUsers();

  res.json({ok:true,avatar:newPath});
});

// ===== Socket.io =====
io.on('connection', socket=>{
  socket.lastMessageAt=0;

  socket.on('join-room', async ({room,username,rol}, ack)=>{
    room=String(room||"chat");
    username=String(username||"Anon");
    if(usuarios.baneados.includes(username)) return ack && ack({ok:false,reason:"banned"});

    if(!rooms[room]) rooms[room]={users:new Map()};
    socket.join(room);
    socket.roomName=room;
    socket.username=username;
    socket.rol=rol||"user";
    rooms[room].users.set(socket.id, username);

    const history=await Message.find({room}).sort({time:1}).limit(50);
    ack && ack({ok:true,history});

    io.to(room).emit('user-list', Array.from(rooms[room].users.values()));
    io.to(room).emit('system-message', {text:`${escapeHtml(username)} se ha unido.`,time:Date.now()});
  });

  socket.on('send-message', async (text, ack)=>{
    const now=Date.now();
    if(now-(socket.lastMessageAt||0)<800) return ack && ack({ok:false,reason:'rate_limited'});
    socket.lastMessageAt=now;

    const room=socket.roomName;
    if(!room || !rooms[room]) return ack && ack({ok:false,reason:'not_in_room'});

    // admin commands
    if(socket.rol==="admin" && text.startsWith("/")){
      const parts=text.trim().split(" ");
      const cmd=parts[0].toLowerCase();
      const arg=parts[1];

      if(cmd==="/kick"){ if(!arg) return; for(const [id,name] of rooms[room].users.entries()){ if(name===arg){ io.to(id).emit("system-message",{text:"Has sido expulsado por un administrador.",time:Date.now()}); io.sockets.sockets.get(id)?.disconnect(true); break; } } return ack && ack({ok:true}); }
      if(cmd==="/ban"){ if(!arg) return; if(!usuarios.baneados.includes(arg)) usuarios.baneados.push(arg); saveUsers(); for(const [id,name] of rooms[room].users.entries()){ if(name===arg){ io.to(id).emit("system-message",{text:"Has sido baneado por un administrador.",time:Date.now()}); io.sockets.sockets.get(id)?.disconnect(true); break; } } return ack && ack({ok:true}); }
      if(cmd==="/unban"){ usuarios.baneados=usuarios.baneados.filter(u=>u!==arg); saveUsers(); return ack && ack({ok:true}); }
      if(cmd==="/clear"){ await Message.deleteMany({room}); io.to(room).emit("clear-chat"); return ack && ack({ok:true}); }
      if(cmd==="/announce"){ const msgText=text.slice(9).trim(); if(!msgText) return; io.to(room).emit("system-message",{text:`[ANUNCIO] ${escapeHtml(msgText)}`,time:Date.now()}); return ack && ack({ok:true}); }

      return;
    }

    const safeText=escapeHtml(String(text));
    const msg={user:socket.username+(socket.rol==="admin"?" (ADMIN)":""),text:safeText,time:now,room};
    await Message.create(msg);
    io.to(room).emit('new-message',msg);
    ack && ack({ok:true});
  });

  socket.on('disconnect', ()=>{
    const room=socket.roomName;
    const username=socket.username;

    if(room && rooms[room]){
      rooms[room].users.delete(socket.id);
      io.to(room).emit('user-list', Array.from(rooms[room].users.values()));
      io.to(room).emit('system-message',{text:`${escapeHtml(username||'Alguien')} se ha ido.`,time:Date.now()});
      if(rooms[room].users.size===0) delete rooms[room];
    }
  });
});

server.listen(PORT,()=>console.log(`Servidor escuchando en http://localhost:${PORT}`));
