const socket = io();
const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");

// Unirse a la sala
socket.emit("join-room", { room: "chat", username, rol }, (res) => {
  if (!res.ok) {
    if(res.reason === "banned") alert("Has sido baneado y no puedes entrar");
    else alert("No puedes entrar al chat");
    return;
  }

  // Renderizar historial
  res.history.forEach(addMessage);
});

// Escuchar nuevos mensajes
socket.on("new-message", addMessage);
socket.on("system-message", addMessage);
socket.on("clear-chat", () => document.getElementById("messages").innerHTML = "");

// Render lateral de usuarios
socket.on("user-list", (users) => {
  const side = document.getElementById("user-list"); // CORREGIDO
  side.innerHTML = "";
  users.forEach(u => {
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.marginBottom = "5px";
    div.style.cursor = "pointer";
    div.innerHTML = `
      <img src="/avatar/${u.avatarId || 'default.png'}" width="30" style="border-radius:50%;margin-right:5px;">
      <b>${u.username}</b>
    `;
    div.onclick = () => alert(`Perfil de ${u.username}`);
    side.appendChild(div);
  });
});

// Enviar mensaje con Enter
document.getElementById("msgBox").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMsg();
});

// Enviar mensaje con botón
document.getElementById("sendBtn").addEventListener("click", sendMsg);

// Función para enviar mensaje
function sendMsg() {
  const msg = document.getElementById("msgBox").value.trim();
  if (!msg) return;

  socket.emit("send-message", msg, res => {
    if (!res.ok) alert("Error enviando mensaje");
  });

  document.getElementById("msgBox").value = "";
}

// Renderizar mensajes
function addMessage(m) {
  const box = document.getElementById("messages");
  const line = document.createElement("div");
  line.className = m.rol || "user"; // aplica clase admin/user
  line.style.display = "flex";
  line.style.alignItems = "center";
  line.style.marginBottom = "5px";

  // Mensaje del sistema
  if (!m.user) {
    line.innerHTML = `<b>SYSTEM:</b> ${m.text}`;
  } else {
    line.innerHTML = `
      <img src="/avatar/${m.avatarId || 'default.png'}" width="30" style="border-radius:50%;margin-right:5px;">
      <b>${m.user}:</b> ${m.text}
    `;
  }

  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

// Logout
function logout() {
  localStorage.removeItem("username");
  localStorage.removeItem("rol");
  location.href = "/login.html";
}
