const socket = io();

const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");

socket.emit("join-room", { room: "chat", username, rol }, (res) => {
  if (!res.ok) {
    alert("No puedes entrar (baneado o sala llena)");
    location.href = "/login.html";
    return;
  }

  res.history.forEach(m => addMessage(m));
});

socket.on("new-message", addMessage);

socket.on("system-message", (m) => {
  addMessage({ user: "SYSTEM", text: m.text, time: m.time });
});

socket.on("clear-chat", () => {
  document.getElementById("messages").innerHTML = "";
});

function addMessage(m) {
  const box = document.getElementById("messages");
  const line = document.createElement("div");
  line.innerHTML = `<b>${m.user}:</b> ${m.text}`;
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
