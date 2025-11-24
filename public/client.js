const socket = io();
const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");

// Unirse a la sala
socket.emit("join-room", { room: "chat", username, rol }, (res) => {
  if (!res.ok) {
    if (res.reason === "banned") alert("Has sido baneado y no puedes entrar");
    else alert("No puedes entrar al chat");
    return;
  }
  res.history.forEach(addMessage);
});

// Escuchar eventos
socket.on("new-message", addMessage);
socket.on("system-message", addMessage);
socket.on("clear-chat", () => document.getElementById("messages").innerHTML = "");

// Render lista de usuarios (con highlight para mí)
socket.on("user-list", (users) => {
  const side = document.getElementById("user-list");
  side.innerHTML = "";
  users.forEach(u => {
    const div = document.createElement("div");
    div.classList.add("user-entry");

    if (u.username === username) {
      div.classList.add("meUser");
    }

    div.innerHTML = `
      <img src="/avatar/${u.avatarId || "default.png"}">
      <span>${u.username}</span>
    `;

    div.onclick = () => alert(`Perfil de ${u.username}`);
    side.appendChild(div);
  });
});

// Enviar mensaje con Enter
document.getElementById("msgBox").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMsg();
});

// Botón enviar
document.getElementById("sendBtn").addEventListener("click", sendMsg);

function sendMsg() {
  const box = document.getElementById("msgBox");
  const msg = box.value.trim();
  if (!msg) return;

  socket.emit("send-message", msg, (res) => {
    if (!res.ok) alert("Error enviando mensaje");
  });

  box.value = "";
}

// ----------------------------
// RENDER DE MENSAJES
// ----------------------------
function addMessage(m) {
  const box = document.getElementById("messages");
  const line = document.createElement("div");

  line.classList.add("message");

  // clasificar si es mío o del otro
  if (m.user === username) {
    line.classList.add("me");
  } else {
    line.classList.add("other");
  }

  if (!m.user) {
    line.innerHTML = `<div class="systemMsg">${m.text}</div>`;
  } else {
    line.innerHTML = `
      <div class="msgBubble">
        <img src="/avatar/${m.avatarId || "default.png"}">
        <div class="textBlock">
          <b>${m.user}</b>
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
    socket.emit("join-room", { room: "chat", username, rol }, () => {});
  } else {
    alert("Error al subir avatar");
  }
});
