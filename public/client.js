const socket = io();
const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");

// Unirse al chat
socket.emit("join-room", { room: "chat", username, rol }, (res) => {
  if (!res.ok) {
    alert("No puedes entrar");
    return;
  }
  res.history.forEach(addMessage);
});

// Eventos
socket.on("new-message", addMessage);
socket.on("system-message", addMessage);
socket.on("clear-chat", () => document.getElementById("messages").innerHTML = "");
socket.on("user-list", renderUserList);

// Render usuarios conectados
function renderUserList(users) {
  const side = document.getElementById("user-list");
  side.innerHTML = "";

  users.forEach(u => {
    const div = document.createElement("div");
    div.classList.add("user-entry");

    if (u.username === username) div.classList.add("meUser");

    div.innerHTML = `
      <img src="/avatar/${u.avatarId || "default.png"}">
      <span style="color:${u.rol === "admin" ? "#ff4444" : "#c084ff"}">
        ${u.username}
      </span>
    `;

    side.appendChild(div);
  });
}

// Enviar con Enter
document.getElementById("msgBox").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMsg();
});

// Botón enviar
document.getElementById("sendBtn").addEventListener("click", sendMsg);

function sendMsg() {
  const box = document.getElementById("msgBox");
  const msg = box.value.trim();
  if (!msg) return;

  socket.emit("send-message", msg);
  box.value = "";
}

// Render mensajes
function addMessage(m) {
  const box = document.getElementById("messages");
  const line = document.createElement("div");

  line.classList.add("message");

  if (m.user === username) line.classList.add("me");
  else line.classList.add("other");

  if (!m.user) {
    line.innerHTML = `<div class="systemMsg">${m.text}</div>`;
  } else {
    const colorClass = m.rol === "admin" ? "nameAdmin" : "nameNormal";

    line.innerHTML = `
      <div class="msgBubble">
        <img src="/avatar/${m.avatarId || "default.png"}">
        <div class="textBlock">
          <b class="${colorClass}">${m.user}</b>
          <span>${m.text}</span>
        </div>
      </div>
    `;
  }

  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("username");
  localStorage.removeItem("rol");
  location.href = "/login.html";
});

// Cambiar avatar
document.getElementById("changeAvatarBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("avatarInput");
  if (!fileInput.files.length) return alert("Selecciona una imagen");

  const formData = new FormData();
  formData.append("avatar", fileInput.files[0]);
  formData.append("username", username);

  const res = await fetch("/upload-avatar", { method: "POST", body: formData });
  const data = await res.json();

  if (data.ok) {
    alert("Avatar actualizado!");
    socket.emit("request-userlist");
  } else {
    alert("Error subiendo imagen");
  }
});
