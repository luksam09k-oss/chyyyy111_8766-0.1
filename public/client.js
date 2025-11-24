const socket = io();

const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");

if (!username) location.href = "/login.html";

const room = "chat";
document.getElementById("roomName").textContent = "Sala: " + room;

socket.emit("join-room", { room, username, rol }, (res) => {
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
socket.on("user-list", updateUserList);

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

function updateUserList(users) {
  const list = document.getElementById("userList");
  list.innerHTML = "";
  users.forEach(u => {
    const div = document.createElement("div");
    div.classList.add("user");
    div.textContent = u;
    list.appendChild(div);
  });
}

function sendMsg() {
  const input = document.getElementById("msgBox");
  const msg = input.value.trim();
  if (!msg) return;

  socket.emit("send-message", msg, (res) => {
    if (!res.ok) alert("Error enviando mensaje");
  });

  input.value = "";
}

// Enviar con Enter
document.getElementById("msgBox").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMsg();
});

function logout() {
  localStorage.removeItem("username");
  localStorage.removeItem("rol");
  socket.disconnect();
  location.href = "/login.html";
}
