const socket = io();
const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");

if (!username) location.href="/login.html";

const room="chat";
document.getElementById("roomName").textContent="Sala: "+room;

let avatars = {}; // mapa username -> avatar
function getAvatar(user){ return avatars[user] || "/avatars/default.png"; }

socket.emit("join-room",{room,username,rol},(res)=>{
  if(!res.ok){ alert("No puedes entrar (baneado o sala llena)"); location.href="/login.html"; return; }
  res.history.forEach(m=>addMessage(m));
});

socket.on("new-message",addMessage);
socket.on("system-message",m=>addMessage({...m,system:true}));
socket.on("clear-chat",()=>document.getElementById("messages").innerHTML="");
socket.on("user-list",updateUserList);

function addMessage(m){
  const box=document.getElementById("messages");
  const line=document.createElement("div");
  line.classList.add("message");
  if(m.system) line.classList.add("system");
  else if(m.user.includes("(ADMIN)")) line.classList.add("admin");
  else line.classList.add("user");

  const img=document.createElement("img");
  img.src=getAvatar(m.user.replace(" (ADMIN)",""));
  line.appendChild(img);
  line.appendChild(document.createTextNode(`${m.user}: ${m.text}`));

  box.appendChild(line);
  box.scrollTop=box.scrollHeight;
}

function updateUserList(users){
  const list=document.getElementById("userList");
  list.innerHTML="";
  users.forEach(u=>{
    const div=document.createElement("div");
    div.classList.add("user");
    const img=document.createElement("img");
    img.src=getAvatar(u);
    div.appendChild(img);
    div.appendChild(document.createTextNode(u));
    div.addEventListener("click",()=>openProfile(u));
    list.appendChild(div);
  });
}

function sendMsg(){
  const input=document.getElementById("msgBox");
  const msg=input.value.trim();
  if(!msg) return;
  socket.emit("send-message",msg,res=>{ if(!res.ok) alert("Error enviando mensaje"); });
  input.value="";
}
document.getElementById("msgBox").addEventListener("keypress",e=>{ if(e.key==="Enter") sendMsg(); });

function logout(){ localStorage.removeItem("username"); localStorage.removeItem("rol"); socket.disconnect(); location.href="/login.html"; }

// ==== Perfil ====
let currentProfile="";
function openProfile(u){
  currentProfile=u;
  document.getElementById("profileName").textContent=u;
  document.getElementById("profileAvatar").src=getAvatar(u);
  document.getElementById("profileModal").style.display="flex";
}
function closeProfile(){ document.getElementById("profileModal").style.display="none"; }
function saveAvatar(){
  const file=document.getElementById("avatarInput").files[0];
  if(!file) return;
  const fd=new FormData();
  fd.append("avatar",file);
  fd.append("username",currentProfile);
  fetch("/upload-avatar",{method:"POST",body:fd})
    .then(res=>res.json())
    .then(data=>{
      if(data.ok){
        avatars[currentProfile]=data.avatar;
        alert("Avatar actualizado!");
        closeProfile();
      }
    });
}
