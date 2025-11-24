const socket = io();

const username = localStorage.getItem("username");

socket.emit("join-room", { room: "chat", username }, (res) => {
  if (!res.ok) return alert("No puedes entrar");
  res.history.forEach(addMessage);
});

socket.on("new-message", addMessage);

socket.on("user-list", (users) => {
  const side = document.getElementById("users");
  side.innerHTML = "";
  users.forEach(u => {
    const div = document.createElement("div");
    div.innerHTML = `<img src="/avatar/${u.avatarId || 'default.png'}" width="30"> ${u.username}`;
    div.onclick = () => alert(`Perfil de ${u.username}`);
    side.appendChild(div);
  });
});

function addMessage(m) {
  const box = document.getElementById("messages");
  const line = document.createElement("div");
  line.innerHTML = `<b>${m.user}:</b> ${m.text}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

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
