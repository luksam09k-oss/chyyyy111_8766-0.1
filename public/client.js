const socket = io();

const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");
let avatarId = localStorage.getItem("avatarId") || null;

socket.emit("join-room", { room: "chat", username, rol }, (res) => {
  if (!res.ok) {
    alert("No puedes entrar (baneado o sala llena)");
    location.href = "/login.html";
    return;
  }
  avatarId = res.avatarId || null;
  localStorage.setItem("avatarId", avatarId);

  res.history.forEach(m => addMessage(m));
});

socket.on("new-message", addMessage);

socket.on("system-message", (m) => {
  addMessage({ user: "SYSTEM", text: m.text, avatarId: null, time: m.time });
});

socket.on("clear-chat", () => {
  document.getElementById("messages").innerHTML = "";
});

function addMessage(m) {
  const box = document.getElementById("messages");
  const avatarUrl = m.avatarId ? `/avatar/${m.avatarId}` : "/default-avatar.png";

  const line = document.createElement("div");
  line.style.display = "flex";
  line.style.alignItems = "center";
  line.style.marginBottom = "5px";

  line.innerHTML = `
    <img src="${avatarUrl}" style="width:30px;height:30px;border-radius:50%;margin-right:5px;cursor:pointer;" onclick="openProfile('${m.user}')">
    <b>${m.user}:</b> ${m.text}
  `;

  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function sendMsg() {
  const msg = document.getElementById("msgBox").value.trim();
  if (!msg) return;

  socket.emit("send-message", msg, (res) => {
    if (!res.ok) alert("Error enviando mensaje");
  });

  document.getElementById("msgBox").value = "";
}

// Enter para enviar
document.getElementById("msgBox").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMsg();
});

function logout() {
  localStorage.removeItem("username");
  localStorage.removeItem("rol");
  localStorage.removeItem("avatarId");
  socket.disconnect();
  location.href = "/login.html";
}

// Abrir perfil
function openProfile(user) {
  const userData = usuarios.usuarios[user]; // necesitas pasar usuarios del servidor o fetch
  if (!userData) return alert("Usuario no encontrado");
  const avatarUrl = userData.avatarId ? `/avatar/${userData.avatarId}` : "/default-avatar.png";
  alert(`${user}\nAvatar: ${avatarUrl}`);
}
