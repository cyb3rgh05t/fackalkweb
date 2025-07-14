// middleware/auth.js
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

// Haupt-Auth-DB (für User-Management)
const authDbPath = path.join(__dirname, "..", "data", "auth.db");

// Auth-DB Connection
let authDatabase;

function initAuthDb() {
  if (!fs.existsSync(path.dirname(authDbPath))) {
    fs.mkdirSync(path.dirname(authDbPath), { recursive: true });
  }

  authDatabase = new sqlite3.Database(authDbPath, (err) => {
    if (err) {
      console.error("❌ Auth-DB Fehler:", err.message);
    } else {
      console.log("✅ Auth-DB verbunden");
      createAuthTables();
    }
  });
}

// Auth-Tabellen erstellen falls nicht vorhanden
function createAuthTables() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      is_active BOOLEAN DEFAULT 1,
      database_name TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      license_key TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      max_customers INTEGER DEFAULT 100,
      max_vehicles INTEGER DEFAULT 500,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id);
    CREATE INDEX IF NOT EXISTS idx_licenses_expires ON licenses(expires_at);
  `;

  authDatabase.exec(schema, (err) => {
    if (err) {
      console.error("❌ Fehler beim Erstellen der Auth-Tabellen:", err.message);
    } else {
      console.log("✅ Auth-Tabellen bereit");
      createDefaultAdmin();
    }
  });
}

// Standard-Admin erstellen
async function createDefaultAdmin() {
  try {
    const adminPassword = "admin123"; // ÄNDERN IN PRODUKTION!
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    authDatabase.get(
      "SELECT COUNT(*) as count FROM users WHERE role = ?",
      ["admin"],
      (err, row) => {
        if (err || row.count > 0) return; // Admin existiert bereits

        authDatabase.run(
          "INSERT INTO users (username, email, password_hash, role, database_name) VALUES (?, ?, ?, ?, ?)",
          ["admin", "admin@localhost", passwordHash, "admin", "admin_db"],
          function (err) {
            if (err) {
              console.error(
                "❌ Fehler beim Erstellen des Standard-Admins:",
                err.message
              );
            } else {
              console.log("✅ Standard-Admin erstellt (admin/admin123)");
            }
          }
        );
      }
    );
  } catch (error) {
    console.error("❌ Fehler beim Hashen des Admin-Passworts:", error);
  }
}

// Auth-Middleware
function requireAuth(req, res, next) {
  const sessionId = req.cookies?.session_id;

  if (!sessionId) {
    return res.status(401).json({ error: "Nicht authentifiziert" });
  }

  authDatabase.get(
    "SELECT s.*, u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime('now')",
    [sessionId],
    (err, session) => {
      if (err) {
        console.error("Session-Fehler:", err);
        return res.status(500).json({ error: "Server-Fehler" });
      }

      if (!session || !session.is_active) {
        return res.status(401).json({ error: "Ungültige Session" });
      }

      req.user = {
        id: session.user_id,
        username: session.username,
        email: session.email,
        role: session.role,
        database_name: session.database_name,
      };

      next();
    }
  );
}

// Admin-Middleware
function requireAdmin(req, res, next) {
  const sessionId = req.cookies?.session_id;

  if (!sessionId) {
    return res.status(401).json({ error: "Nicht authentifiziert" });
  }

  authDatabase.get(
    "SELECT s.*, u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime('now')",
    [sessionId],
    (err, session) => {
      if (err) {
        console.error("Admin-Session-Fehler:", err);
        return res.status(500).json({ error: "Server-Fehler" });
      }

      if (!session || !session.is_active) {
        return res.status(401).json({ error: "Ungültige Session" });
      }

      if (session.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Admin-Berechtigung erforderlich" });
      }

      req.user = {
        id: session.user_id,
        username: session.username,
        email: session.email,
        role: session.role,
        database_name: session.database_name,
      };

      next();
    }
  );
}

// Login-Funktion
function login(username, password) {
  return new Promise((resolve, reject) => {
    authDatabase.get(
      "SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1",
      [username, username],
      async (err, user) => {
        if (err) {
          reject(new Error("Datenbankfehler"));
          return;
        }

        if (!user) {
          reject(new Error("Ungültige Anmeldedaten"));
          return;
        }

        try {
          const isPasswordValid = await bcrypt.compare(
            password,
            user.password_hash
          );
          if (!isPasswordValid) {
            reject(new Error("Ungültige Anmeldedaten"));
            return;
          }

          // Session erstellen
          const sessionId = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

          authDatabase.run(
            "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
            [sessionId, user.id, expiresAt.toISOString()],
            (err) => {
              if (err) {
                reject(new Error("Session-Fehler"));
                return;
              }

              resolve({
                user: {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  role: user.role,
                  database_name: user.database_name,
                },
                sessionId,
              });
            }
          );
        } catch (bcryptError) {
          reject(new Error("Passwort-Verifikation fehlgeschlagen"));
        }
      }
    );
  });
}

// User-spezifische Datenbank ermitteln
function getUserDatabase(userId) {
  return new Promise((resolve, reject) => {
    authDatabase.get(
      "SELECT database_name FROM users WHERE id = ?",
      [userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row?.database_name);
      }
    );
  });
}

// ✅ KORRIGIERTE EXPORT-FUNKTION
function getAuthDb() {
  if (!authDatabase) {
    throw new Error("Auth-Datenbank nicht initialisiert");
  }
  return authDatabase;
}

// DB-Initialisierung beim Import
initAuthDb();

module.exports = {
  requireAuth,
  requireAdmin,
  login,
  getUserDatabase,
  authDb: getAuthDb, // ✅ Direkte Funktion exportieren, nicht () => authDb
  initAuthDb,
};
