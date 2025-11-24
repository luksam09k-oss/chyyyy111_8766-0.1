const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");
let avatarId = localStorage.getItem("avatarId") || null;

const socket = io("/", { query: { username } });

socket.emit("join-room", { room: "chat", username, rol }, (res) => {
  if (!res.ok) { alert("No puedes entrar"); location.href = "/login.html"; return; }
  avatarId = res.avatarId || null;
  res.history.forEach(addMessage);
});

socket.on("user-list", (users) => {
  const list = document.getElementById("user-list");
  list.innerHTML = "";
  users.forEach(u => {
    const avatar = u.avatarId ? `/avatar/${u.avatarId}` : "/default-avatar.png";
    const div = document.createElement("div");
    div.innerHTML = `<img src="${avatar}" class="avatar"> ${u.username}`;
    div.onclick = () => openProfile(u);
    list.appendChild(div);
  });
});

socket.on("update-user", (u) => {
  if (u.username === username) avatarId = u.avatarId;
  socket.emit("join-room", { room: "chat", username, rol }, () => {});
});

socket.on("new-message", (m) => addMessage(m));

function addMessage(m) {
  const box = document.getElementById("messages");
  const avatar = m.avatarId ? `/avatar/${m.avatarId}` : "/default-avatar.png";
  const div = document.createElement("div");
  div.classList.add("message");
  div.innerHTML = `<img src="${avatar}" class="avatar"> <b>${m.user}:</b> ${m.text}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function sendMsg() {
  const msg = document.getElementById("msgBox").value.trim();
  if (!msg) return;
  socket.emit("send-message", msg, (res) => { if (!res.ok) alert("Error"); });
  document.getElementById("msgBox").value = "";
}

document.getElementById("msgBox").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMsg();
});

function logout() {
  localStorage.clear();
  location.href = "/login.html";
}

function openProfile(u) {
  const avatar = u.avatarId ? `/avatar/${u.avatarId}` : "/default-avatar.png";
  const modal = document.createElement("div");
  modal.id = "modal";
  modal.style = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#202225;padding:20px;border-radius:10px;color:white;z-index:1000;";
  modal.innerHTML = `<h3>${u.username}</h3>
                     <img src="${avatar}" style="width:80px;height:80px;border-radius:50%;"><br>
                     ${u.username===username?`<input type="file" id="fileUpload"><button onclick="uploadAvatar()">Subir</button>`:""}
                     <button onclick="closeModal()">Cerrar</button>`;
  document.body.appendChild(modal);
}

function closeModal() { document.getElementById("modal")?.remove(); }

function uploadAvatar() {
  const file = document.getElementById("fileUpload").files[0];
  if (!file) return alert("Selecciona una imagen");
  const data = new FormData();
  data.append("avatar", file);
  data.append("username", username);
  fetch("/upload-avatar", { method: "POST", body: data })
    .then(res => res.json())
    .then(res => { if(res.ok){ avatarId = res.avatarId; localStorage.setItem("avatarId", avatarId); closeModal(); } });
}
