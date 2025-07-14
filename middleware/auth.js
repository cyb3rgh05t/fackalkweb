// middleware/auth.js
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

// Haupt-Auth-DB (für User-Management)
const authDbPath = path.join(__dirname, "..", "data", "auth.db");

// Auth-DB Connection
let authDb;

function initAuthDb() {
  if (!fs.existsSync(path.dirname(authDbPath))) {
    fs.mkdirSync(path.dirname(authDbPath), { recursive: true });
  }

  authDb = new sqlite3.Database(authDbPath, (err) => {
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

  authDb.exec(schema, (err) => {
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

    authDb.get(
      "SELECT COUNT(*) as count FROM users WHERE role = ?",
      ["admin"],
      (err, row) => {
        if (err || row.count > 0) return; // Admin existiert bereits

        authDb.run(
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

            // Admin-Lizenz erstellen
            const licenseKey = `ADMIN-LIFETIME-${Date.now()}`;
            const expiresAt = new Date("2099-12-31").toISOString();

            authDb.run(
              "INSERT INTO licenses (user_id, license_key, expires_at, max_customers, max_vehicles) VALUES (?, ?, ?, 9999, 9999)",
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
  if (dbName === "main_db") {
    return new sqlite3.Database(
      path.join(__dirname, "..", "data", "lackiererei.db")
    );
  }

  const userDbPath = path.join(
    __dirname,
    "..",
    "data",
    "users",
    `${dbName}.db`
  );

  // Fallback zur Haupt-DB wenn User-DB nicht existiert
  if (!fs.existsSync(userDbPath)) {
    console.log(`⚠️  User-DB nicht gefunden: ${dbName}, verwende Haupt-DB`);
    return new sqlite3.Database(
      path.join(__dirname, "..", "data", "lackiererei.db")
    );
  }

  return new sqlite3.Database(userDbPath);
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

    // Lizenz prüfen
    const license = await getLicense(user.id);
    if (!license || !license.is_active) {
      return res.status(403).json({
        error: "Keine gültige Lizenz gefunden",
        action: "contact_admin",
      });
    }

    if (new Date() > new Date(license.expires_at)) {
      return res.status(403).json({
        error: "Lizenz abgelaufen",
        expired_at: license.expires_at,
        action: "renew_license",
      });
    }

    // User-spezifische DB-Verbindung setzen
    req.user = user;
    req.license = license;
    req.userDb = getUserDatabase(user.database_name);

    next();
  } catch (error) {
    console.error("Auth-Fehler:", error);
    res.status(500).json({
      error: "Authentifizierung fehlgeschlagen",
      action: "retry",
    });
  }
}

// Admin-only Middleware
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      error: "Admin-Berechtigung erforderlich",
      action: "contact_admin",
    });
  }
  next();
}

// Helper-Funktionen
function getSession(sessionId) {
  return new Promise((resolve, reject) => {
    authDb.get(
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
    authDb.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getLicense(userId) {
  return new Promise((resolve, reject) => {
    authDb.get(
      "SELECT * FROM licenses WHERE user_id = ?",
      [userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

// Login-Funktion
async function login(username, password) {
  return new Promise(async (resolve, reject) => {
    try {
      // User finden
      authDb.get(
        "SELECT * FROM users WHERE username = ? OR email = ?",
        [username, username],
        async (err, user) => {
          if (err || !user) {
            return reject(new Error("User nicht gefunden"));
          }

          // Passwort prüfen
          const isValid = await bcrypt.compare(password, user.password_hash);
          if (!isValid) {
            return reject(new Error("Ungültiges Passwort"));
          }

          // Session erstellen
          const sessionId = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

          authDb.run(
            "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
            [sessionId, user.id, expiresAt.toISOString()],
            (err) => {
              if (err) {
                return reject(err);
              }

              resolve({
                sessionId,
                user: {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  role: user.role,
                },
                expiresAt,
              });
            }
          );
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

// User-DB automatisch erstellen
async function createUserDatabase(dbName) {
  const userDbDir = path.join(__dirname, "..", "data", "users");

  // Verzeichnis erstellen
  if (!fs.existsSync(userDbDir)) {
    fs.mkdirSync(userDbDir, { recursive: true });
  }

  const userDbPath = path.join(userDbDir, `${dbName}.db`);
  const userDb = new sqlite3.Database(userDbPath);

  // Minimales Schema direkt erstellen (statt aus Haupt-DB zu kopieren)
  const userSchema = `
    CREATE TABLE IF NOT EXISTS kunden (
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

    CREATE TABLE IF NOT EXISTS fahrzeuge (
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

    CREATE TABLE IF NOT EXISTS auftraege (
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

    CREATE TABLE IF NOT EXISTS auftrag_positionen (
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

    CREATE TABLE IF NOT EXISTS rechnungen (
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

    CREATE TABLE IF NOT EXISTS rechnung_positionen (
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

    CREATE TABLE IF NOT EXISTS einstellungen (
      key TEXT PRIMARY KEY,
      value TEXT,
      beschreibung TEXT,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      typ TEXT NOT NULL,
      kategorie TEXT DEFAULT 'arbeitszeit',
      beschreibung TEXT,
      positions TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Standard-Einstellungen
    INSERT OR IGNORE INTO einstellungen (key, value, beschreibung) VALUES 
    ('firmen_name', 'Meine Lackiererei', 'Name der Firma'),
    ('mwst_satz', '19', 'Mehrwertsteuersatz in Prozent'),
    ('basis_stundenpreis', '110.00', 'Standard-Stundenpreis');

    -- Indizes
    CREATE INDEX IF NOT EXISTS idx_kunden_name ON kunden(name);
    CREATE INDEX IF NOT EXISTS idx_fahrzeuge_kennzeichen ON fahrzeuge(kennzeichen);
    CREATE INDEX IF NOT EXISTS idx_auftraege_datum ON auftraege(datum);
    CREATE INDEX IF NOT EXISTS idx_auftraege_status ON auftraege(status);
    CREATE INDEX IF NOT EXISTS idx_rechnungen_datum ON rechnungen(rechnungsdatum);
    CREATE INDEX IF NOT EXISTS idx_rechnungen_status ON rechnungen(status);
  `;

  return new Promise((resolve, reject) => {
    userDb.exec(userSchema, (err) => {
      userDb.close();
      if (err) {
        console.error("Fehler beim Erstellen der User-DB:", err);
        reject(err);
      } else {
        console.log(`✅ User-DB erstellt: ${dbName}`);
        resolve(userDbPath);
      }
    });
  });
}

// Auth-DB beim Import initialisieren
initAuthDb();

module.exports = {
  requireAuth,
  requireAdmin,
  login,
  createUserDatabase,
  getUserDatabase,
  authDb: () => authDb,
};
