#!/usr/bin/env node

const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const { execSync, spawn } = require("child_process");
const readline = require("readline");

// ======== Helpers ========
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};
function log(message, color = "white") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}
function header(title) {
  log(`\n${"=".repeat(60)}`, "cyan");
  log(`  ${title}`, "cyan");
  log(`${"=".repeat(60)}`, "cyan");
}
function success(message) {
  log(`✅ ${message}`, "green");
}
function error(message) {
  log(`❌ ${message}`, "red");
}
function warning(message) {
  log(`⚠️  ${message}`, "yellow");
}
function info(message) {
  log(`ℹ️  ${message}`, "blue");
}
function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}
function createDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    success(`Verzeichnis erstellt: ${dirPath}`);
  }
}
function execCommand(command, description) {
  try {
    info(`${description}...`);
    execSync(command, { stdio: "pipe" });
    success(`${description} erfolgreich`);
    return true;
  } catch (err) {
    error(`${description} fehlgeschlagen: ${err.message}`);
    return false;
  }
}

// ======== System Requirements & Dependencies ========
function checkSystemRequirements() {
  header("System-Anforderungen prüfen");
  const nodeVersion = process.version;
  const requiredNodeVersion = "16.0.0";
  if (parseInt(nodeVersion.slice(1)) >= parseInt(requiredNodeVersion)) {
    success(`Node.js Version: ${nodeVersion} ✓`);
  } else {
    error(
      `Node.js ${requiredNodeVersion}+ erforderlich, gefunden: ${nodeVersion}`
    );
    process.exit(1);
  }
  try {
    execSync("npm --version", { stdio: "pipe" });
    success("NPM verfügbar ✓");
  } catch (err) {
    error("NPM nicht verfügbar");
    process.exit(1);
  }
  try {
    require("sqlite3");
    success("SQLite3 Modul verfügbar ✓");
  } catch (err) {
    warning("SQLite3 Modul nicht gefunden - wird installiert");
  }
}
function installDependencies() {
  header("Abhängigkeiten installieren");
  if (!checkFileExists(path.join(__dirname, "..", "package.json"))) {
    error("package.json nicht gefunden!");
    process.exit(1);
  }
  return execCommand("npm install", "NPM Dependencies Installation");
}

// ======== MAIN DB-SETUP ========
function initializeDatabase() {
  header("Datenbank initialisieren");
  const dataDir = path.join(__dirname, "..", "data");
  const dbPath = path.join(dataDir, "kfz.db");
  createDirectory(dataDir);
  // Backup falls DB existiert
  if (checkFileExists(dbPath)) {
    const backupPath = path.join(
      dataDir,
      `lackiererei_backup_${Date.now()}.db`
    );
    fs.copyFileSync(dbPath, backupPath);
    success(`Backup erstellt: ${backupPath}`);
    fs.unlinkSync(dbPath);
    info("Alte Datenbank entfernt");
  }
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        error(`Fehler beim Erstellen der Datenbank: ${err.message}`);
        reject(err);
        return;
      }
      success("Datenbank-Datei erstellt");
      createTables(db, resolve, reject);
    });
  });
}
function createTables(db, resolve, reject) {
  info("Erstelle Tabellen...");
  const tables = [
    `CREATE TABLE kunden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kunden_nr TEXT UNIQUE NOT NULL, name TEXT NOT NULL, strasse TEXT, plz TEXT,
      ort TEXT, telefon TEXT, email TEXT, erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP )`,
    `CREATE TABLE fahrzeuge (
      id INTEGER PRIMARY KEY AUTOINCREMENT, kunden_id INTEGER, kennzeichen TEXT NOT NULL,
      marke TEXT, modell TEXT, vin TEXT, baujahr INTEGER, farbe TEXT, farbcode TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE CASCADE )`,
    `CREATE TABLE auftraege (
      id INTEGER PRIMARY KEY AUTOINCREMENT, auftrag_nr TEXT UNIQUE NOT NULL,
      kunden_id INTEGER, fahrzeug_id INTEGER, datum DATE NOT NULL, status TEXT DEFAULT 'offen',
      basis_stundenpreis DECIMAL(10,2) DEFAULT 110.00, gesamt_zeit DECIMAL(10,2) DEFAULT 0,
      gesamt_kosten DECIMAL(10,2) DEFAULT 0, mwst_betrag DECIMAL(10,2) DEFAULT 0,
      bemerkungen TEXT, erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL,
      FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL )`,
    `CREATE TABLE auftrag_positionen (
      id INTEGER PRIMARY KEY AUTOINCREMENT, auftrag_id INTEGER, beschreibung TEXT NOT NULL,
      stundenpreis DECIMAL(10,2), zeit DECIMAL(10,2), einheit TEXT DEFAULT 'Std.',
      gesamt DECIMAL(10,2), reihenfolge INTEGER,
      FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE CASCADE )`,
    `CREATE TABLE rechnungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT, rechnung_nr TEXT UNIQUE NOT NULL,
      auftrag_id INTEGER, kunden_id INTEGER, fahrzeug_id INTEGER,
      rechnungsdatum DATE NOT NULL, auftragsdatum DATE, status TEXT DEFAULT 'offen',
      zwischensumme DECIMAL(10,2) DEFAULT 0, rabatt_prozent DECIMAL(5,2) DEFAULT 0,
      rabatt_betrag DECIMAL(10,2) DEFAULT 0, netto_nach_rabatt DECIMAL(10,2) DEFAULT 0,
      mwst_19 DECIMAL(10,2) DEFAULT 0, mwst_7 DECIMAL(10,2) DEFAULT 0,
      gesamtbetrag DECIMAL(10,2) DEFAULT 0, zahlungsbedingungen TEXT, gewaehrleistung TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE SET NULL,
      FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL,
      FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL )`,
    `CREATE TABLE rechnung_positionen (
      id INTEGER PRIMARY KEY AUTOINCREMENT, rechnung_id INTEGER,
      kategorie TEXT NOT NULL, beschreibung TEXT NOT NULL, menge DECIMAL(10,2),
      einheit TEXT, einzelpreis DECIMAL(10,2), mwst_prozent DECIMAL(5,2),
      gesamt DECIMAL(10,2), reihenfolge INTEGER,
      FOREIGN KEY (rechnung_id) REFERENCES rechnungen (id) ON DELETE CASCADE )`,
    `CREATE TABLE templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, typ TEXT NOT NULL,
      kategorie TEXT DEFAULT 'arbeitszeit', beschreibung TEXT, positions TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP, aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP )`,
    `CREATE TABLE einstellungen (
      key TEXT PRIMARY KEY, value TEXT, beschreibung TEXT,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP )`,
  ];
  let completed = 0;
  tables.forEach((sql, idx) => {
    db.run(sql, (err) => {
      completed++;
      if (err) {
        error(`Fehler bei Tabelle ${idx + 1}: ${err.message}`);
        reject(err);
        return;
      }
      success(`Tabelle ${completed}/${tables.length} erstellt`);
      if (completed === tables.length) createIndexes(db, resolve, reject);
    });
  });
}
function createIndexes(db, resolve, reject) {
  info("Erstelle Indizes...");
  const indexes = [
    `CREATE INDEX idx_kunden_name ON kunden(name)`,
    `CREATE INDEX idx_fahrzeuge_kennzeichen ON fahrzeuge(kennzeichen)`,
    `CREATE INDEX idx_auftraege_datum ON auftraege(datum)`,
    `CREATE INDEX idx_auftraege_status ON auftraege(status)`,
    `CREATE INDEX idx_rechnungen_datum ON rechnungen(rechnungsdatum)`,
    `CREATE INDEX idx_rechnungen_status ON rechnungen(status)`,
    `CREATE INDEX idx_templates_typ ON templates(typ)`,
  ];
  let indexCompleted = 0;
  indexes.forEach((sql, index) => {
    db.run(sql, (err) => {
      indexCompleted++;
      if (err) {
        error(`Fehler bei Index ${index + 1}: ${err.message}`);
        reject(err);
        return;
      }
      success(`Index ${indexCompleted}/${indexes.length} erstellt`);
      if (indexCompleted === indexes.length)
        insertDefaultData(db, resolve, reject);
    });
  });
}
function insertDefaultData(db, resolve, reject) {
  info("Füge Standard-Daten ein...");
  // --- Einstellungen, Demo-Kunden, Demo-Fahrzeuge, Templates ---
  const defaultSettings = [
    ["firmenname", "FAF Lackiererei", "Name der Firma"],
    ["basis_stundenpreis", "110.00", "Basis-Stundenpreis in Euro"],
    ["mwst_satz", "19.00", "Mehrwertsteuersatz in Prozent"],
    ["system_version", "2.0", "System-Version"],
    ["layout_font_family", "Arial, sans-serif", "Schriftart für Rechnungen"],
    ["layout_color_primary", "#007bff", "Primärfarbe"],
    // ... weitere Standard-Settings nach Belieben ergänzen ...
  ];
  const demoKunden = [
    [
      "K001",
      "Max Mustermann",
      "Beispielstraße 1",
      "12345",
      "Musterstadt",
      "+49 123 456789",
      "max@example.com",
    ],
    [
      "K002",
      "Maria Musterfrau",
      "Testweg 15",
      "54321",
      "Teststadt",
      "+49 987 654321",
      "maria@test.de",
    ],
    [
      "K003",
      "Firma ABC GmbH",
      "Industriestraße 10",
      "11111",
      "Businesscity",
      "+49 555 123456",
      "kontakt@abc-gmbh.de",
    ],
  ];
  const demoFahrzeuge = [
    [
      1,
      "AB-CD 123",
      "BMW",
      "X5",
      "WBAXYZ123456789",
      2020,
      "Schwarz Metallic",
      "C41",
    ],
    [
      1,
      "EF-GH 456",
      "Mercedes",
      "E-Klasse",
      "WDB2345678901234",
      2019,
      "Silber",
      "744U",
    ],
    [2, "IJ-KL 789", "Audi", "A4", "WAUZZZ8E1234567", 2021, "Weiß", "LY9C"],
    [
      3,
      "MN-OP 012",
      "Volkswagen",
      "Golf",
      "WVWZZZ1JZAW123456",
      2018,
      "Blau Metallic",
      "LD5Q",
    ],
  ];
  const defaultTemplates = [
    [
      "Standardlackierung",
      "auftrag",
      "arbeitszeit",
      "Standard-Lackierarbeiten",
      JSON.stringify([
        {
          kategorie: "arbeitszeit",
          beschreibung: "Fahrzeug vorbereiten und abkleben",
          zeit: 2.0,
          stundenpreis: 110.0,
        },
        {
          kategorie: "arbeitszeit",
          beschreibung: "Grundierung auftragen",
          zeit: 1.5,
          stundenpreis: 110.0,
        },
        {
          kategorie: "arbeitszeit",
          beschreibung: "Basislack auftragen",
          zeit: 2.0,
          stundenpreis: 110.0,
        },
        {
          kategorie: "arbeitszeit",
          beschreibung: "Klarlack auftragen",
          zeit: 1.5,
          stundenpreis: 110.0,
        },
        {
          kategorie: "arbeitszeit",
          beschreibung: "Polieren und Nachbearbeitung",
          zeit: 1.0,
          stundenpreis: 110.0,
        },
      ]),
    ],
    [
      "Smart Repair",
      "auftrag",
      "arbeitszeit",
      "Kleine Reparaturen",
      JSON.stringify([
        {
          kategorie: "arbeitszeit",
          beschreibung: "Schadensbegutachtung",
          zeit: 0.5,
          stundenpreis: 110.0,
        },
        {
          kategorie: "arbeitszeit",
          beschreibung: "Spachteln und Schleifen",
          zeit: 1.0,
          stundenpreis: 110.0,
        },
        {
          kategorie: "arbeitszeit",
          beschreibung: "Grundierung partiell",
          zeit: 0.5,
          stundenpreis: 110.0,
        },
        {
          kategorie: "arbeitszeit",
          beschreibung: "Lackierung mit Verblendung",
          zeit: 1.5,
          stundenpreis: 110.0,
        },
      ]),
    ],
  ];
  // Einstellungen
  const settingsStmt = db.prepare(
    "INSERT INTO einstellungen (key, value, beschreibung) VALUES (?, ?, ?)"
  );
  let settingsCompleted = 0;
  defaultSettings.forEach((setting, index) => {
    settingsStmt.run(setting, (err) => {
      settingsCompleted++;
      if (err) {
        error(`Fehler bei Einstellung ${setting[0]}: ${err.message}`);
      } else {
        success(
          `Einstellung ${settingsCompleted}/${defaultSettings.length}: ${setting[0]}`
        );
      }
      if (settingsCompleted === defaultSettings.length) {
        settingsStmt.finalize();
        insertDemoData(
          db,
          demoKunden,
          demoFahrzeuge,
          defaultTemplates,
          resolve,
          reject
        );
      }
    });
  });
}
function insertDemoData(
  db,
  demoKunden,
  demoFahrzeuge,
  defaultTemplates,
  resolve,
  reject
) {
  info("Füge Demo-Daten ein...");
  const kundenStmt = db.prepare(
    "INSERT INTO kunden (kunden_nr, name, strasse, plz, ort, telefon, email) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  let kundenCompleted = 0;
  demoKunden.forEach((kunde, index) => {
    kundenStmt.run(kunde, function (err) {
      kundenCompleted++;
      if (err) {
        error(`Fehler bei Kunde ${kunde[0]}: ${err.message}`);
      } else {
        success(
          `Demo-Kunde ${kundenCompleted}/${demoKunden.length}: ${kunde[1]}`
        );
        const kundenFahrzeuge = demoFahrzeuge.filter((f) => f[0] === index + 1);
        if (kundenFahrzeuge.length > 0) {
          const fahrzeugStmt = db.prepare(
            "INSERT INTO fahrzeuge (kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          );
          kundenFahrzeuge.forEach((fahrzeug) => {
            fahrzeug[0] = this.lastID;
            fahrzeugStmt.run(fahrzeug, (err) => {
              if (err) {
                error(`Fehler bei Fahrzeug ${fahrzeug[1]}: ${err.message}`);
              } else {
                success(
                  `Demo-Fahrzeug: ${fahrzeug[1]} (${fahrzeug[2]} ${fahrzeug[3]})`
                );
              }
            });
          });
          fahrzeugStmt.finalize();
        }
      }
      if (kundenCompleted === demoKunden.length) {
        kundenStmt.finalize();
        insertTemplates(db, defaultTemplates, resolve, reject);
      }
    });
  });
}
function insertTemplates(db, defaultTemplates, resolve, reject) {
  info("Füge Standard-Templates ein...");
  const templateStmt = db.prepare(
    "INSERT INTO templates (name, typ, kategorie, beschreibung, positions) VALUES (?, ?, ?, ?, ?)"
  );
  let templateCompleted = 0;
  defaultTemplates.forEach((template, index) => {
    templateStmt.run(template, (err) => {
      templateCompleted++;
      if (err) {
        error(`Fehler bei Template ${template[0]}: ${err.message}`);
      } else {
        success(
          `Template ${templateCompleted}/${defaultTemplates.length}: ${template[0]}`
        );
      }
      if (templateCompleted === defaultTemplates.length) {
        templateStmt.finalize();
        finishDatabaseSetup(db, resolve, reject);
      }
    });
  });
}
function finishDatabaseSetup(db, resolve, reject) {
  success("Datenbank erfolgreich initialisiert!");
  db.close((err) => {
    if (err) {
      error(`Fehler beim Schließen der Datenbank: ${err.message}`);
      reject(err);
    } else {
      success("Datenbankverbindung geschlossen");
      resolve();
    }
  });
}

// ======== AUTH-DB & USER-DB-SCHEMA ========
function setupAuthDatabase() {
  header("Authentifizierungs-System einrichten");
  const authDbPath = path.join(__dirname, "..", "data", "auth.db");
  const authDb = new sqlite3.Database(authDbPath, async (err) => {
    if (err) {
      error("Fehler beim Erstellen der Auth-DB: " + err.message);
      process.exit(1);
    }
    success("Auth-Datenbank erstellt");
    await setupAuthTables(authDb, authDbPath);
  });
}
async function setupAuthTables(authDb, authDbPath) {
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
  authDb.exec(schema, async (err) => {
    if (err) {
      error("Fehler beim Erstellen der Auth-Tabellen: " + err.message);
      process.exit(1);
    }
    success("Auth-Tabellen erstellt");
    await createDefaultAdmin(authDb, authDbPath);
  });
}
async function createDefaultAdmin(authDb, authDbPath) {
  try {
    const adminPassword = "admin123"; // In Produktion ändern!
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    authDb.run(
      `INSERT OR IGNORE INTO users (username, email, password_hash, role, database_name) VALUES (?, ?, ?, ?, ?)`,
      ["admin", "admin@faf-lackiererei.de", passwordHash, "admin", "main_db"],
      function (err) {
        if (err && !err.message.includes("UNIQUE constraint")) {
          error("Fehler beim Erstellen des Admin-Users: " + err.message);
          return;
        }
        if (this.lastID || this.changes === 0) {
          success("Admin-User erstellt (admin/admin123)");
          const licenseKey = `ADMIN-LIFETIME-${Date.now()}`;
          const expiresAt = new Date("2099-12-31").toISOString();
          authDb.run(
            `INSERT OR IGNORE INTO licenses (user_id, license_key, expires_at, max_customers, max_vehicles) VALUES (1, ?, ?, 9999, 9999)`,
            [licenseKey, expiresAt],
            () => {
              success("Admin-Lizenz erstellt");
              createUserDbSchemaFile();
              authDb.close();
            }
          );
        }
      }
    );
  } catch (error) {
    error("Setup Auth fehlgeschlagen: " + error);
  }
}
function createUserDbSchemaFile() {
  const userDbSchema = `
CREATE TABLE kunden (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kunden_nr TEXT UNIQUE NOT NULL, name TEXT NOT NULL, strasse TEXT, plz TEXT, ort TEXT, telefon TEXT, email TEXT, erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP, aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE fahrzeuge (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kunden_id INTEGER, kennzeichen TEXT NOT NULL, marke TEXT, modell TEXT, vin TEXT, baujahr INTEGER, farbe TEXT, farbcode TEXT, erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE CASCADE
);
CREATE TABLE auftraege (
  id INTEGER PRIMARY KEY AUTOINCREMENT, auftrag_nr TEXT UNIQUE NOT NULL, kunden_id INTEGER, fahrzeug_id INTEGER, datum DATE NOT NULL, status TEXT DEFAULT 'offen', basis_stundenpreis DECIMAL(10,2) DEFAULT 110.00, gesamt_zeit DECIMAL(10,2) DEFAULT 0, gesamt_kosten DECIMAL(10,2) DEFAULT 0, mwst_betrag DECIMAL(10,2) DEFAULT 0, bemerkungen TEXT, erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP, aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL, FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL
);
CREATE TABLE auftrag_positionen (
  id INTEGER PRIMARY KEY AUTOINCREMENT, auftrag_id INTEGER, beschreibung TEXT NOT NULL, stundenpreis DECIMAL(10,2), zeit DECIMAL(10,2), einheit TEXT DEFAULT 'Std.', gesamt DECIMAL(10,2), reihenfolge INTEGER, FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE CASCADE
);
CREATE TABLE rechnungen (
  id INTEGER PRIMARY KEY AUTOINCREMENT, rechnung_nr TEXT UNIQUE NOT NULL, auftrag_id INTEGER, kunden_id INTEGER, fahrzeug_id INTEGER, rechnungsdatum DATE NOT NULL, auftragsdatum DATE, status TEXT DEFAULT 'offen', zwischensumme DECIMAL(10,2) DEFAULT 0, rabatt_prozent DECIMAL(5,2) DEFAULT 0, rabatt_betrag DECIMAL(10,2) DEFAULT 0, netto_nach_rabatt DECIMAL(10,2) DEFAULT 0, mwst_19 DECIMAL(10,2) DEFAULT 0, mwst_7 DECIMAL(10,2) DEFAULT 0, gesamtbetrag DECIMAL(10,2) DEFAULT 0, zahlungsbedingungen TEXT, gewaehrleistung TEXT, erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP, aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE SET NULL, FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL, FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL
);
CREATE TABLE rechnung_positionen (
  id INTEGER PRIMARY KEY AUTOINCREMENT, rechnung_id INTEGER, kategorie TEXT NOT NULL, beschreibung TEXT NOT NULL, menge DECIMAL(10,2), einheit TEXT, einzelpreis DECIMAL(10,2), mwst_prozent DECIMAL(5,2), gesamt DECIMAL(10,2), reihenfolge INTEGER, FOREIGN KEY (rechnung_id) REFERENCES rechnungen (id) ON DELETE CASCADE
);
CREATE TABLE einstellungen (
  key TEXT PRIMARY KEY, value TEXT, beschreibung TEXT, aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO einstellungen (key, value, beschreibung) VALUES 
('firmen_name', 'Meine Lackiererei', 'Name der Firma'),
('mwst_satz', '19', 'Mehrwertsteuersatz in Prozent'),
('basis_stundenpreis', '110.00', 'Standard-Stundenpreis');
`;
  fs.writeFileSync(path.join(__dirname, "user_db_schema.sql"), userDbSchema);
  success("User-DB-Schema als Datei gespeichert");
}

// ======== LAYOUT-MIGRATION (kosten→gesamt) ========
function migrateAuftragPositionenColumns() {
  header("Auftrag-Positionen Tabellenmigration (kosten → gesamt)");
  const dbPath = path.join(__dirname, "..", "data", "kfz.db");
  if (!fs.existsSync(dbPath)) {
    warning("Datenbank nicht gefunden! Migration übersprungen.");
    return;
  }
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      error("Fehler beim Öffnen der Datenbank: " + err.message);
      return;
    }
    db.all("PRAGMA table_info(auftrag_positionen)", (err, rows) => {
      if (err) {
        error("Fehler beim Abrufen des Tabellen-Schemas: " + err.message);
        db.close();
        return;
      }
      const hasKosten = rows.some((col) => col.name === "kosten");
      const hasGesamt = rows.some((col) => col.name === "gesamt");
      if (hasGesamt && !hasKosten) {
        success("Spalte 'gesamt' bereits vorhanden.");
        db.close();
        return;
      }
      if (hasKosten && !hasGesamt) {
        info("Migration 'kosten' → 'gesamt' erforderlich.");
        const backupPath = path.join(
          path.dirname(dbPath),
          `backup_before_column_fix_${Date.now()}.db`
        );
        fs.copyFileSync(dbPath, backupPath);
        success(`Backup erstellt: ${backupPath}`);
        db.serialize(() => {
          db.run(
            `CREATE TABLE auftrag_positionen_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT, auftrag_id INTEGER, beschreibung TEXT NOT NULL,
              stundenpreis DECIMAL(10,2), zeit DECIMAL(10,2), einheit TEXT DEFAULT 'Std.',
              gesamt DECIMAL(10,2), reihenfolge INTEGER,
              FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE CASCADE )`,
            (err) => {
              if (err) {
                error("Fehler neue Tabelle: " + err.message);
                db.close();
                return;
              }
              db.run(
                `INSERT INTO auftrag_positionen_new (id, auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge)
                 SELECT id, auftrag_id, beschreibung, stundenpreis, zeit, einheit, kosten, reihenfolge FROM auftrag_positionen`,
                (err) => {
                  if (err) {
                    error("Fehler beim Kopieren: " + err.message);
                    db.close();
                    return;
                  }
                  db.run("DROP TABLE auftrag_positionen", (err) => {
                    if (err) {
                      error(
                        "Fehler beim Löschen der alten Tabelle: " + err.message
                      );
                      db.close();
                      return;
                    }
                    db.run(
                      "ALTER TABLE auftrag_positionen_new RENAME TO auftrag_positionen",
                      (err) => {
                        if (err) {
                          error("Fehler beim Umbenennen: " + err.message);
                        } else {
                          success("Migration erfolgreich abgeschlossen.");
                        }
                        db.close();
                      }
                    );
                  });
                }
              );
            }
          );
        });
      } else if (hasKosten && hasGesamt) {
        warning(
          "Beide Spalten existieren – nur 'gesamt' wird verwendet, 'kosten' ignoriert."
        );
        db.close();
      } else {
        info("Weder 'kosten' noch 'gesamt' – keine Migration nötig.");
        db.close();
      }
    });
  });
}

// ======== Backup & Dev-Tools ========
function setupBackupSystem() {
  header("Backup-System einrichten");
  const backupDir = path.join(__dirname, "..", "backups");
  createDirectory(backupDir);
  const gitignorePath = path.join(backupDir, ".gitignore");
  if (!checkFileExists(gitignorePath)) {
    fs.writeFileSync(gitignorePath, "# Backup files\n*.db\n*.json\n*.sql\n");
    success("Backup .gitignore erstellt");
  }
  const backupScriptPath = path.join(__dirname, "backup.js");
  if (!checkFileExists(backupScriptPath)) {
    const backupScript = `#!/usr/bin/env node
const fs = require('fs'); const path = require('path');
const sourceDb = path.join(__dirname, '..', 'data', 'kfz.db');
const backupDir = path.join(__dirname, '..', 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, \`kfz_\${timestamp}.db\`);
if (fs.existsSync(sourceDb)) {
  fs.copyFileSync(sourceDb, backupPath);
  console.log(\`✅ Backup erstellt: \${backupPath}\`);
} else { console.error('❌ Datenbank nicht gefunden'); }
`;
    fs.writeFileSync(backupScriptPath, backupScript);
    success("Backup-Script erstellt");
  }
}
function setupDevelopment() {
  header("Development-Umgebung einrichten");
  const envExamplePath = path.join(__dirname, "..", ".env.example");
  if (!checkFileExists(envExamplePath)) {
    const envContent = `# KFZ System Environment Variables
NODE_ENV=development
PORT=3000
DB_PATH=./data/kfz.db
SESSION_SECRET=your-secret-key-here
RATE_LIMIT_MAX=1000
BACKUP_INTERVAL=24
MAX_BACKUPS=30
`;
    fs.writeFileSync(envExamplePath, envContent);
    success(".env.example erstellt");
  }
  try {
    const packagePath = path.join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    const additionalScripts = {
      setup: "node scripts/setup.js",
      backup: "node scripts/backup.js",
      "reset-db": "node scripts/setup.js --reset",
    };
    let scriptsAdded = false;
    Object.entries(additionalScripts).forEach(([key, value]) => {
      if (!packageJson.scripts[key]) {
        packageJson.scripts[key] = value;
        scriptsAdded = true;
      }
    });
    if (scriptsAdded) {
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
      success("Zusätzliche NPM Scripts hinzugefügt");
    }
  } catch (err) {
    warning("Konnte package.json nicht erweitern");
  }
}
function checkConfiguration() {
  header("Konfiguration prüfen");
  const requiredFiles = ["server.js", "package.json", "public/index.html"];
  let allFilesExist = true;
  requiredFiles.forEach((file) => {
    const filePath = path.join(__dirname, "..", file);
    if (checkFileExists(filePath)) {
      success(`${file} ✓`);
    } else {
      error(`${file} ❌`);
      allFilesExist = false;
    }
  });
  if (!allFilesExist) {
    warning("Nicht alle erforderlichen Dateien gefunden");
  }
  return allFilesExist;
}

// ======== Server-Test ========
function testServer() {
  header("Server-Test");
  return new Promise((resolve) => {
    info("Starte Server zum Testen...");
    const server = spawn("node", ["server.js"], {
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "test" },
    });
    let serverStarted = false;
    const timeout = setTimeout(() => {
      if (!serverStarted) {
        server.kill();
        warning("Server-Start-Timeout - Test übersprungen");
        resolve(false);
      }
    }, 10000);
    server.stdout.on("data", (data) => {
      if (
        data.toString().includes("läuft auf Port") ||
        data.toString().includes("listening on")
      ) {
        serverStarted = true;
        clearTimeout(timeout);
        success("Server erfolgreich gestartet");
        setTimeout(() => {
          server.kill();
          success("Server-Test erfolgreich");
          resolve(true);
        }, 2000);
      }
    });
    server.stderr.on("data", (data) => {
      if (!serverStarted) {
        warning(`Server-Warnung: ${data.toString().trim()}`);
      }
    });
    server.on("error", (err) => {
      clearTimeout(timeout);
      warning(`Server-Test fehlgeschlagen: ${err.message}`);
      resolve(false);
    });
  });
}

// ======== Zusammenfassung ========
function showSummary() {
  header("Setup abgeschlossen");
  success("🎉 KFZ System erfolgreich eingerichtet!");
  log("\n🚀 Nächste Schritte:", "cyan");
  log("1. Server starten: npm start", "white");
  log("2. Browser öffnen: http://localhost:3000", "white");
  log("3. Einstellungen anpassen / Firmendaten vervollständigen", "white");
  log("\n🛠️  Verfügbare Kommandos:", "magenta");
  log("• npm start          - Server starten", "white");
  log("• npm run dev        - Development Server", "white");
  log("• npm run setup      - Setup erneut ausführen", "white");
  log("• npm run backup     - Backup erstellen", "white");
  log("• npm run reset-db   - Datenbank zurücksetzen", "white");
  log("\n✨ Viel Erfolg mit Ihrem KFZ System!", "green");
}

// ======== Interaktives Setup ========
async function promptUserChoices() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    const dbPath = path.join(__dirname, "..", "data", "kfz.db");
    if (checkFileExists(dbPath)) {
      rl.question(
        "\n🔄 Datenbank existiert bereits. Was möchten Sie tun?\n" +
          "  [1] Backup erstellen und neu initialisieren\n" +
          "  [2] Bestehende Datenbank behalten\n" +
          "  [3] Abbrechen\n" +
          "Ihre Wahl [1-3]: ",
        (answer) => {
          rl.close();
          switch (answer.trim()) {
            case "1":
              resolve("reset");
              break;
            case "2":
              resolve("keep");
              break;
            case "3":
              resolve("cancel");
              break;
            default:
              warning("Ungültige Eingabe - behalte bestehende Datenbank");
              resolve("keep");
          }
        }
      );
    } else {
      rl.close();
      resolve("new");
    }
  });
}

// ======== Haupt-Setup ========
async function runSetup() {
  log(
    `
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║    🎨 KFZ Fac Pro SYSTEM - KOMPLETTES SETUP                 ║
║    Rechnungs- und Auftragssystem mit Datenbank-Integration      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`,
    "cyan"
  );
  try {
    const args = process.argv.slice(2);
    const resetMode = args.includes("--reset") || args.includes("-r");
    let userChoice = "new";
    if (!resetMode) {
      userChoice = await promptUserChoices();
    } else {
      userChoice = "reset";
    }
    if (userChoice === "cancel") {
      log("\n👋 Setup abgebrochen", "yellow");
      process.exit(0);
    }
    checkSystemRequirements();
    if (!installDependencies()) {
      error("Installation der Abhängigkeiten fehlgeschlagen");
      process.exit(1);
    }
    const configValid = checkConfiguration();
    if (!configValid) {
      warning("Konfiguration unvollständig - Setup wird fortgesetzt");
    }
    setupBackupSystem();
    setupDevelopment();
    if (userChoice === "new" || userChoice === "reset") {
      await initializeDatabase();
      await setupAuthDatabase();
      migrateAuftragPositionenColumns();
    } else {
      info("Bestehende Datenbank wird beibehalten");
      migrateAuftragPositionenColumns();
    }
    const serverWorks = await testServer();
    if (!serverWorks) {
      warning("Server-Test fehlgeschlagen - prüfen Sie die Konfiguration");
    }
    showSummary();
  } catch (err) {
    error("Setup fehlgeschlagen");
    error(err.message);
    console.error(err.stack);
    process.exit(1);
  }
}
process.on("SIGINT", () => {
  log("\n\n🛑 Setup abgebrochen...", "yellow");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  error("Unbehandelter Fehler:");
  console.error(err);
  process.exit(1);
});
if (require.main === module) {
  runSetup();
}
