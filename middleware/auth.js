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
          [
            "admin",
            "admin@faf-lackiererei.de",
            passwordHash,
            "admin",
            "main_db",
          ],
          function (err) {
            if (err) return;

            // Admin-Lizenz erstellen (läuft nicht ab)
            const licenseKey = `ADMIN-LIFETIME-${Date.now()}`;
            const expiresAt = new Date("2099-12-31").toISOString();

            authDatabase.run(
              "INSERT INTO licenses (user_id, license_key, expires_at) VALUES (?, ?, ?)",
              [this.lastID, licenseKey, expiresAt],
              () => {
                console.log("✅ Standard-Admin erstellt (admin/admin123)");
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error("❌ Admin-Erstellung fehlgeschlagen:", error);
  }
}

// Dynamische DB-Verbindung pro User
function getUserDatabase(dbName) {
  // Admin verwendet die Haupt-DB
  if (dbName === "main_db" || !dbName) {
    return new sqlite3.Database(path.join(__dirname, "..", "data", "kfz.db"));
  }

  const userDbPath = path.join(
    __dirname,
    "..",
    "data",
    "users",
    `${dbName}.db`
  );

  // User-DB erstellen falls nicht existiert
  if (!fs.existsSync(userDbPath)) {
    console.log(`🔧 Erstelle User-DB: ${dbName}`);
    createUserDatabase(dbName);
  }

  return new sqlite3.Database(userDbPath);
}

// User-DB erstellen mit Schema
function createUserDatabase(dbName) {
  const userDbDir = path.join(__dirname, "..", "data", "users");

  if (!fs.existsSync(userDbDir)) {
    fs.mkdirSync(userDbDir, { recursive: true });
  }

  const userDbPath = path.join(userDbDir, `${dbName}.db`);
  const userDb = new sqlite3.Database(userDbPath);

  const schema = `
    CREATE TABLE kunden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kunden_nr TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      strasse TEXT,
      plz TEXT,
      ort TEXT,
      telefon TEXT,
      email TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE fahrzeuge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kunden_id INTEGER,
      kennzeichen TEXT NOT NULL,
      marke TEXT,
      modell TEXT,
      vin TEXT,
      baujahr INTEGER,
      farbe TEXT,
      farbcode TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE CASCADE
    );

    CREATE TABLE auftraege (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auftrag_nr TEXT UNIQUE NOT NULL,
      kunden_id INTEGER,
      fahrzeug_id INTEGER,
      datum DATE NOT NULL,
      status TEXT DEFAULT 'offen',
      basis_stundenpreis DECIMAL(10,2) DEFAULT 110.00,
      gesamt_zeit DECIMAL(10,2) DEFAULT 0,
      gesamt_kosten DECIMAL(10,2) DEFAULT 0,
      mwst_betrag DECIMAL(10,2) DEFAULT 0,
      bemerkungen TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL,
      FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL
    );

    CREATE TABLE auftrag_positionen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auftrag_id INTEGER,
      beschreibung TEXT NOT NULL,
      stundenpreis DECIMAL(10,2),
      zeit DECIMAL(10,2),
      einheit TEXT DEFAULT 'Std.',
      gesamt DECIMAL(10,2),
      reihenfolge INTEGER,
      FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE CASCADE
    );

    CREATE TABLE rechnungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rechnung_nr TEXT UNIQUE NOT NULL,
      auftrag_id INTEGER,
      kunden_id INTEGER,
      fahrzeug_id INTEGER,
      rechnungsdatum DATE NOT NULL,
      auftragsdatum DATE,
      status TEXT DEFAULT 'offen',
      zwischensumme DECIMAL(10,2) DEFAULT 0,
      rabatt_prozent DECIMAL(5,2) DEFAULT 0,
      rabatt_betrag DECIMAL(10,2) DEFAULT 0,
      netto_nach_rabatt DECIMAL(10,2) DEFAULT 0,
      mwst_19 DECIMAL(10,2) DEFAULT 0,
      mwst_7 DECIMAL(10,2) DEFAULT 0,
      gesamtbetrag DECIMAL(10,2) DEFAULT 0,
      zahlungsbedingungen TEXT,
      gewaehrleistung TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE SET NULL,
      FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL,
      FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL
    );

    CREATE TABLE rechnung_positionen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rechnung_id INTEGER,
      kategorie TEXT NOT NULL,
      beschreibung TEXT NOT NULL,
      menge DECIMAL(10,2),
      einheit TEXT,
      einzelpreis DECIMAL(10,2),
      mwst_prozent DECIMAL(5,2),
      gesamt DECIMAL(10,2),
      reihenfolge INTEGER,
      FOREIGN KEY (rechnung_id) REFERENCES rechnungen (id) ON DELETE CASCADE
    );

    CREATE TABLE einstellungen (
      key TEXT PRIMARY KEY,
      value TEXT,
      beschreibung TEXT,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO einstellungen (key, value, beschreibung) VALUES 
    ('firmen_name', 'Meine Lackiererei', 'Name der Firma'),
    ('mwst_satz', '19', 'Mehrwertsteuersatz in Prozent'),
    ('basis_stundenpreis', '110.00', 'Standard-Stundenpreis');
  `;

  userDb.exec(schema, (err) => {
    if (err) {
      console.error(
        `❌ Fehler beim Erstellen der User-DB ${dbName}:`,
        err.message
      );
    } else {
      console.log(`✅ User-DB ${dbName} erstellt`);
    }
    userDb.close();
  });
}

// Session-basierte Authentifizierung
async function requireAuth(req, res, next) {
  try {
    const sessionId =
      req.headers.authorization?.replace("Bearer ", "") ||
      req.cookies?.session_id;

    if (!sessionId) {
      return res.status(401).json({
        error: "Nicht autorisiert",
        action: "login_required",
      });
    }

    // Session validieren
    const session = await getSession(sessionId);
    if (!session || new Date() > new Date(session.expires_at)) {
      return res.status(401).json({
        error: "Session abgelaufen",
        action: "login_required",
      });
    }

    // User-Daten laden
    const user = await getUser(session.user_id);
    if (!user || !user.is_active) {
      return res.status(401).json({
        error: "User nicht aktiv",
        action: "contact_admin",
      });
    }

    // Lizenz-Check (nur für normale User)
    if (user.role !== "admin") {
      const license = await getLicense(user.id);
      if (!license || new Date() > new Date(license.expires_at)) {
        return res.status(403).json({
          error: "Lizenz abgelaufen",
          action: "renew_license",
          expires_at: license?.expires_at,
        });
      }
    }

    // User-spezifische DB-Verbindung setzen
    req.user = user;
    req.userDb = getUserDatabase(user.database_name);

    next();
  } catch (error) {
    console.error("Auth-Middleware Fehler:", error);
    res.status(500).json({
      error: "Server-Fehler bei Authentifizierung",
    });
  }
}

// Admin-Auth Middleware
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        error: "Admin-Berechtigung erforderlich",
      });
    }
    next();
  });
}

// Login-Funktion
async function login(username, password) {
  return new Promise((resolve, reject) => {
    authDatabase.get(
      "SELECT * FROM users WHERE username = ? AND is_active = 1",
      [username],
      async (err, user) => {
        if (err) {
          reject(new Error("Datenbankfehler"));
          return;
        }

        if (!user) {
          reject(new Error("Ungültige Anmeldedaten"));
          return;
        }

        // Passwort prüfen
        const passwordValid = await bcrypt.compare(
          password,
          user.password_hash
        );
        if (!passwordValid) {
          reject(new Error("Ungültige Anmeldedaten"));
          return;
        }

        // Lizenz-Check für normale User
        if (user.role !== "admin") {
          const license = await getLicense(user.id);
          if (!license || new Date() > new Date(license.expires_at)) {
            reject(new Error("Lizenz abgelaufen - bitte Admin kontaktieren"));
            return;
          }
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
      }
    );
  });
}

// Helper-Funktionen
function getSession(sessionId) {
  return new Promise((resolve, reject) => {
    authDatabase.get(
      "SELECT * FROM sessions WHERE id = ?",
      [sessionId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function getUser(userId) {
  return new Promise((resolve, reject) => {
    authDatabase.get(
      "SELECT * FROM users WHERE id = ?",
      [userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function getLicense(userId) {
  return new Promise((resolve, reject) => {
    authDatabase.get(
      "SELECT * FROM licenses WHERE user_id = ? AND is_active = 1",
      [userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

// Auth-DB für Admin-Routen exportieren
function authDb() {
  return authDatabase;
}

// DB-Initialisierung beim Import
initAuthDb();

module.exports = {
  requireAuth,
  requireAdmin,
  login,
  getUserDatabase,
  authDb: () => authDb,
  initAuthDb,
};
