// User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String },               // si tienes login local
  rol: { type: String, default: "user" },
  avatarId: { type: String, default: "default.png" },
  banned: { type: Boolean, default: false }
});

module.exports = mongoose.model("User", userSchema);
