const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: String,               // si tienes login local
  rol: { type: String, default: "user" },
  avatarId: { type: String, default: null }
});

module.exports = mongoose.model("User", userSchema);
