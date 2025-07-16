// scripts/add-auth-tables.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "..", "data", "kfz.db");

async function createAuthTables() {
  const db = new sqlite3.Database(dbPath);

  console.log("🔐 Erstelle Authentifizierungs-Tabellen...");

  // Users-Tabelle erstellen
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME,
      is_active BOOLEAN DEFAULT 1
    )
  `;

  // Sessions-Tabelle für express-session (optional)
  const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS sessions (
      session_id VARCHAR(128) UNIQUE NOT NULL,
      expires INTEGER UNSIGNED NOT NULL,
      data MEDIUMTEXT,
      PRIMARY KEY (session_id)
    )
  `;

  try {
    // Tabellen erstellen
    await new Promise((resolve, reject) => {
      db.run(createUsersTable, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve, reject) => {
      db.run(createSessionsTable, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log("✅ Authentifizierungs-Tabellen erfolgreich erstellt!");

    // Prüfen ob bereits Benutzer existieren
    const userCount = await new Promise((resolve, reject) => {
      db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // Standard-Admin-Benutzer erstellen wenn keine Benutzer existieren
    if (userCount === 0) {
      console.log("📝 Erstelle Standard-Admin-Benutzer...");

      const adminUsername = "admin";
      const adminPassword = "admin123"; // In Produktion UNBEDINGT ändern!
      const saltRounds = 12;

      const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

      await new Promise((resolve, reject) => {
        const insertAdmin = `
          INSERT INTO users (username, password_hash, role, created_at, is_active)
          VALUES (?, ?, 'admin', datetime('now'), 1)
        `;

        db.run(insertAdmin, [adminUsername, passwordHash], function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });

      console.log("✅ Standard-Admin-Benutzer erstellt:");
      console.log(`   Username: ${adminUsername}`);
      console.log(`   Passwort: ${adminPassword}`);
      console.log("⚠️  WICHTIG: Passwort nach dem ersten Login ändern!");
    }

    console.log("🎉 Authentifizierung erfolgreich eingerichtet!");
  } catch (error) {
    console.error(
      "❌ Fehler beim Erstellen der Authentifizierungs-Tabellen:",
      error
    );
    process.exit(1);
  } finally {
    db.close();
  }
}

// Script direkt ausführen wenn aufgerufen
if (require.main === module) {
  createAuthTables();
}

module.exports = createAuthTables;
