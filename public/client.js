const socket = io();
const username = localStorage.getItem("username");

socket.emit("join-room", { room: "chat", username }, (res) => {
  if (!res.ok) return alert("No puedes entrar");
  res.history.forEach(addMessage);
});

socket.on("new-message", addMessage);

// Render lateral de usuarios
socket.on("user-list", (users) => {
  const side = document.getElementById("users");
  side.innerHTML = "";
  users.forEach(u => {
    const div = document.createElement("div");
    div.style.cursor = "pointer";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.marginBottom = "5px";
    div.innerHTML = `<img src="/avatar/${u.avatarId || 'default.png'}" width="30" style="border-radius:50%;margin-right:5px;"> <b>${u.username}</b>`;
    div.onclick = () => alert(`Perfil de ${u.username}`);
    side.appendChild(div);
  });
});

// Mensajes
function addMessage(m) {
  const box = document.getElementById("messages");
  const line = document.createElement("div");
  line.style.marginBottom = "5px";
  line.innerHTML = `<b>${m.user}:</b> ${m.text}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

// Enter para enviar
document.getElementById("msgBox").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMsg();
});

function sendMsg() {
  const msg = document.getElementById("msgBox").value.trim();
  if (!msg) return;
  socket.emit("send-message", msg, res => {
    if (!res.ok) alert("Error enviando mensaje");
  });
  document.getElementById("msgBox").value = "";
}
