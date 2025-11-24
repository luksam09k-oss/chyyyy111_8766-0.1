const socket = io();
const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");
let avatarId = localStorage.getItem("avatarId") || null;

// Usuarios conectados
const usuarios = {}; // Guardaremos avatarId de cada usuario

socket.emit("join-room", { room: "chat", username, rol }, (res) => {
  if (!res.ok) {
    alert("No puedes entrar (baneado o sala llena)");
    location.href = "/login.html";
    return;
  }

  avatarId = res.avatarId || null;
  localStorage.setItem("avatarId", avatarId);
  usuarios[username] = { avatarId, rol };

  res.history.forEach(m => addMessage(m));
});

// ======= SOCKETS =======
socket.on("new-message", addMessage);

socket.on("system-message", (m) => {
  addMessage({ user: "SYSTEM", text: m.text, avatarId: null, time: m.time, rol: "system" });
});

socket.on("clear-chat", () => {
  document.getElementById("messages").innerHTML = "";
});

socket.on("user-list", (users) => {
  const list = document.getElementById("user-list");
  list.innerHTML = "";
  users.forEach(u => {
    const avatar = usuarios[u]?.avatarId ? `/avatar/${usuarios[u].avatarId}` : '/default-avatar.png';
    const rol = usuarios[u]?.rol || "user";
    const div = document.createElement("div");
    div.innerHTML = `<img src="${avatar}"> ${u}`;
    div.onclick = () => openProfile(u);
    list.appendChild(div);
  });
});

// ======= FUNCIONES =======
function addMessage(m) {
  const box = document.getElementById("messages");
  const avatarUrl = m.avatarId ? `/avatar/${m.avatarId}` : '/default-avatar.png';
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(m.user.includes("(ADMIN)") ? "admin" : "user");

  div.innerHTML = `
    <img src="${avatarUrl}" onclick="openProfile('${m.user}')">
    <b>${m.user}:</b> ${m.text}
  `;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;

  // Guardar avatarId
  if (!usuarios[m.user] && m.avatarId) usuarios[m.user] = { avatarId: m.avatarId, rol: m.user.includes("(ADMIN)") ? "admin" : "user" };
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
  const data = usuarios[user];
  if (!data) return alert("Usuario no encontrado");
  const avatarUrl = data.avatarId ? `/avatar/${data.avatarId}` : "/default-avatar.png";
  alert(`Perfil de ${user}\nAvatar: ${avatarUrl}`);
}
