const socket = io();

const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const usersDiv = document.getElementById('users');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

function appendMessage(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim() || 'Anon';
  const room = roomInput.value.trim() || 'chat';

  socket.emit('join-room', { room, username }, (res) => {
    if (!res || !res.ok) {
      alert('No se pudo unir a la sala.');
      return;
    }

    messageInput.disabled = false;
    sendBtn.disabled = false;
    joinBtn.disabled = true;
    roomInput.disabled = true;
    usernameInput.disabled = true;

    appendMessage(`<div class='sys'>Conectado a ${room}. (${res.history.length} mensajes previos)</div>`);
    res.history.forEach(m => appendMessage(`<b>${m.user}</b>: ${m.text}`));
  });
});

sendBtn.addEventListener('click', () => {
  const txt = messageInput.value.trim();
  if (!txt) return;

  socket.emit('send-message', txt, (ack) => {
    if (!ack || !ack.ok) return console.log('Error o rate limit');
    messageInput.value = '';
  });
});

socket.on('new-message', (m) => appendMessage(`<b>${m.user}</b>: ${m.text}`));
socket.on('system-message', (m) => appendMessage(`<div class='sys'>${m.text}</div>`));

socket.on('user-list', (list) => {
  usersDiv.innerHTML = '<strong>Usuarios:</strong><br>' + list.join('<br>');
});
