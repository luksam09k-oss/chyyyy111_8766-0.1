const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  room: String,
  user: String,
  text: String,
  rol: String,
  avatarId: String,
  time: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);
