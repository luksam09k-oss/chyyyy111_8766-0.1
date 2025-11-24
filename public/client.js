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
// Función de Logout agregada
function logout() {
  localStorage.removeItem("username");
  localStorage.removeItem("rol");
  socket.disconnect();  // Desconecta del servidor
  location.href = "/login.html";
}
