const socket = io();

const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");

if (!username) location.href = "/login.html";

socket.emit("join-room", { room: "chat", username, rol }, (res) => {
  if (!res.ok) {
    alert("No puedes entrar (baneado o sala llena)");
    location.href = "/login.html";
    return;
  }
  res.history.forEach(addMessage);
});

socket.on("new-message", addMessage);
socket.on("system-message", m => addMessage({ ...m, system: true }));
socket.on("clear-chat", () => document.getElementById("messages").innerHTML = "");

function addMessage(m) {
  const box = document.getElementById("messages");
  const line = document.createElement("div");
  line.classList.add("message");
  
  if (m.system) line.classList.add("system");
  else if (m.user.includes("(ADMIN)")) line.classList.add("admin");
  else line.classList.add("user");
  
  line.textContent = `${m.user}: ${m.text}`;
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

function logout() {
  localStorage.removeItem("username");
  localStorage.removeItem("rol");
  socket.disconnect();
  location.href = "/login.html";
}
