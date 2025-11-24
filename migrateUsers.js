const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

// === MongoDB ===
mongoose.connect(
  "mongodb+srv://luksam09k_db_user:D7mcreChPJu9HFBt@cluster0.3bnnbke.mongodb.net/ChatDB?retryWrites=true&w=majority"
);

const conn = mongoose.connection;

conn.once("open", async () => {
  console.log("MongoDB conectado");

  // === Schema ===
  const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    rol: String,
    avatarId: { type: String, default: null }
  });
  const User = mongoose.model("User", userSchema);

  // === Leer users.json ===
  const usersFile = path.join(__dirname, "users.json");
  const data = JSON.parse(fs.readFileSync(usersFile));

  const users = Object.entries(data.usuarios).map(([username, info]) => ({
    username,
    password: info.password,
    rol: info.rol,
    avatarId: null
  }));

  try {
    for (const u of users) {
      const exists = await User.findOne({ username: u.username });
      if (!exists) {
        await User.create(u);
        console.log(`Usuario creado: ${u.username}`);
      } else {
        console.log(`Usuario ya existe: ${u.username}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
});
