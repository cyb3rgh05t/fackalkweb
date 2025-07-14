const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const dbPath = path.join(__dirname, "..", "data", "lackiererei.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("DB-Fehler:", err.message);
  else console.log("Verbindung zur SQLite-Datenbank hergestellt.");
});

module.exports = db;
