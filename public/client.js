const socket = io();
const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");

let replyingTo = null;


socket.emit("join-room", { room: "chat", username, rol }, (res) => {
  if (!res.ok) { alert("No puedes entrar"); return; }
  res.history.forEach(addMessage);
});


socket.on("new-message", addMessage);
socket.on("system-message", addMessage);
socket.on("clear-chat", () => document.getElementById("messages").innerHTML = "");
socket.on("user-list", renderUserList);
socket.on("message-deleted", ({ _id }) => {
  const msg = document.querySelector(`.message[data-id="${_id}"]`);
  if (!msg) return;
  msg.querySelector(".msgText").innerHTML = `<i style="opacity:0.6">mensaje eliminado</i>`;
});


function renderUserList(users) {
  const side = document.getElementById("user-list");
  side.innerHTML = "";
  users.forEach(u => {
    const div = document.createElement("div");
    div.classList.add("user-entry");
    if (u.username === username) div.classList.add("meUser");
    
 
    div.innerHTML = `<img src="/avatar/${u.avatarId || "default.png"}" class="user-pfp-small">
                     <span style="color:${u.rol==="admin"?"#ff4444":"#c084ff"}">${u.username}</span>`;
    side.appendChild(div);
  });
}


document.getElementById("msgBox").addEventListener("keypress", e => {
  socket.emit("typing", e.key !== "Enter" && e.target.value.trim() !== "");
  if (e.key === "Enter") {
    e.preventDefault(); 
    sendMsg();
  }
});
document.getElementById("sendBtn").addEventListener("click", sendMsg);

function sendMsg() {
  const box = document.getElementById("msgBox");
  let msg = box.value.trim();
  if (!msg) return;

  if (replyingTo) {
    msg = `[responde a ${replyingTo}]: ${msg}`;
    replyingTo = null;
  }

  socket.emit("send-message", msg);
  box.value = "";
  socket.emit("typing", false);
}


function addMessage(m) {
  const box = document.getElementById("messages");
  const line = document.createElement("div");
  line.classList.add("message");
  line.dataset.id = m._id || "";

  const time = m.time ? new Date(m.time).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "";

  if (!m.user) {
    line.innerHTML = `<div class="systemMsg" style="white-space: pre-wrap;">${m.text}</div>`;
    if (m.imageUrl) {
      line.innerHTML += `<br><img src="${m.imageUrl}" style="max-width:200px; max-height:200px; border-radius:4px; border:1px solid #444; margin-top:5px;">`;
    }
  } else {
    const nameColor = m.rol==="admin"?"nameAdmin":"nameNormal";
 
    if (m.deleted) {
      line.innerHTML = `<div class="message-content"><i style="opacity:0.6">mensaje eliminado</i> <span class="timeStamp">${time}</span></div>`;
    } else {
      line.innerHTML = `
        <div class="message-content">
          <img src="/avatar/${m.avatarId||"default.png"}" class="msg-avatar">
          <b class="${nameColor}">${m.user}:</b>
          <span class="msgText">${m.text}</span>
          <span class="timeStamp" style="margin-left:8px; opacity:0.5; font-size:10px;">${time}</span>
          
          <span class="dots" style="cursor:pointer; margin-left:5px;">⋮</span>
          <div class="menu hidden">
            <button class="replyBtn">Rep</button>
            ${m.user===username?`<button class="deleteBtn">Del</button>`:""}
          </div>
        </div>`;

      const replyBtn = line.querySelector(".replyBtn");
      if (replyBtn) replyBtn.addEventListener("click", () => {
        replyingTo = m.user;
        const input = document.getElementById("msgBox");
        input.value = `@${m.user} `;
        input.focus();
      });
    }
  }

  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}


document.addEventListener("click", e => {
  if (e.target.classList.contains("dots")) {
    document.querySelectorAll(".menu").forEach(m => m.classList.add("hidden"));
    const menu = e.target.nextElementSibling;
    menu.classList.toggle("hidden");
  } else if (!e.target.closest(".menu")) {
    document.querySelectorAll(".menu").forEach(m => m.classList.add("hidden"));
  }
});

document.addEventListener("click", e => {
  if (e.target.classList.contains("deleteBtn")) {
    const msgDiv = e.target.closest(".message");
    const id = msgDiv.dataset.id;
    socket.emit("delete-message", id);
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("username");
  localStorage.removeItem("rol");
  location.href = "/login.html";
});

document.getElementById("changeAvatarBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("avatarInput");
  if (!fileInput.files.length) return alert("Selecciona una imagen");

  const formData = new FormData();
  formData.append("avatar", fileInput.files[0]);
  formData.append("username", username);

  const res = await fetch("/upload-avatar", { method:"POST", body:formData });
  const data = await res.json();

  if (data.ok) {
    alert("Avatar actualizado!");
  } else {
    alert("Error subiendo imagen");
  }
});
