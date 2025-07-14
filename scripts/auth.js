// scripts/setup-auth.js - Neues Setup-Script
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

console.log("🔐 Setting up Multi-Tenant Authentication System...");

const authDbPath = path.join(__dirname, "..", "data", "auth.db");

// Auth-DB erstellen
const authDb = new sqlite3.Database(authDbPath, async (err) => {
  if (err) {
    console.error("❌ Fehler beim Erstellen der Auth-DB:", err.message);
    process.exit(1);
  }

  console.log("✅ Auth-Datenbank erstellt");
  await setupAuthTables();
});

async function setupAuthTables() {
  const schema = `
    -- Users Tabelle
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

    -- Lizenzen Tabelle
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

    -- Sessions Tabelle
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- Indizes
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id);
    CREATE INDEX IF NOT EXISTS idx_licenses_expires ON licenses(expires_at);
  `;

  authDb.exec(schema, async (err) => {
    if (err) {
      console.error("❌ Fehler beim Erstellen der Tabellen:", err.message);
      process.exit(1);
    }

    console.log("✅ Auth-Tabellen erstellt");
    await createDefaultAdmin();
  });
}

async function createDefaultAdmin() {
  try {
    // Admin-Passwort hashen
    const adminPassword = "admin123"; // ÄNDERN IN PRODUKTION!
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    authDb.run(
      `INSERT OR IGNORE INTO users (username, email, password_hash, role, database_name) 
       VALUES (?, ?, ?, ?, ?)`,
      ["admin", "admin@faf-lackiererei.de", passwordHash, "admin", "main_db"],
      function (err) {
        if (err && !err.message.includes("UNIQUE constraint")) {
          console.error(
            "❌ Fehler beim Erstellen des Admin-Users:",
            err.message
          );
          return;
        }

        if (this.lastID || this.changes === 0) {
          console.log("✅ Admin-User erstellt (admin/admin123)");

          // Admin-Lizenz erstellen
          const licenseKey = `ADMIN-LIFETIME-${Date.now()}`;
          const expiresAt = new Date("2099-12-31").toISOString();

          authDb.run(
            `INSERT OR IGNORE INTO licenses (user_id, license_key, expires_at, max_customers, max_vehicles) 
             VALUES (1, ?, ?, 9999, 9999)`,
            [licenseKey, expiresAt],
            () => {
              console.log("✅ Admin-Lizenz erstellt");
              console.log("🎉 Auth-System bereit!");
              console.log("\n📋 Next Steps:");
              console.log("1. npm install bcrypt cookie-parser");
              console.log("2. Server neu starten");
              console.log("3. Login: admin / admin123");
              authDb.close();
            }
          );
        }
      }
    );
  } catch (error) {
    console.error("❌ Setup fehlgeschlagen:", error);
  }
}

// ===========================================
// User-DB Schema Template
// ===========================================

const userDbSchema = `
-- Standard-Tabellen für jeden User (Kopie der Haupt-DB)
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

-- Standard-Einstellungen einfügen
INSERT INTO einstellungen (key, value, beschreibung) VALUES 
('firmen_name', 'Meine Lackiererei', 'Name der Firma'),
('mwst_satz', '19', 'Mehrwertsteuersatz in Prozent'),
('basis_stundenpreis', '110.00', 'Standard-Stundenpreis');
`;

// Schema-Datei speichern
fs.writeFileSync(path.join(__dirname, "user_db_schema.sql"), userDbSchema);

console.log("✅ User-DB Schema gespeichert");
