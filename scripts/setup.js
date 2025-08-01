#!/usr/bin/env node

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const bcrypt = require("bcrypt");
const { execSync } = require("child_process");
const readline = require("readline");

// =============================================================================
// KONFIGURATION UND KONSTANTEN
// =============================================================================

const CONFIG = {
  APP_NAME: "KFZFacPRO",
  VERSION: "3.0.0",
  NODE_MIN_VERSION: "16.0.0",
  SALT_ROUNDS: 12,
  DEFAULT_ADMIN: {
    username: "admin",
    password: "admin123",
    role: "admin",
  },
  PATHS: {
    root: path.join(__dirname, ".."),
    data: path.join(__dirname, "..", "data"),
    backups: path.join(__dirname, "..", "backups"),
    logs: path.join(__dirname, "..", "logs"),
    uploads: path.join(__dirname, "..", "public", "uploads"),
    db: path.join(__dirname, "..", "data", "kfz.db"),
  },
  DIRECTORIES: [
    "./data",
    "./backups",
    "./logs",
    "./public/uploads",
    "./public/css",
    "./public/js",
  ],
  REQUIRED_MODULES: [
    "sqlite3",
    "bcrypt",
    "express",
    "express-session",
    "better-sqlite3",
  ],
};

// =============================================================================
// LOGGING UND UTILITIES
// =============================================================================

class Logger {
  static colors = {
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

  static log(message, color = "white") {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`);
  }

  static header(title) {
    this.log(`\n${"=".repeat(80)}`, "cyan");
    this.log(`  ${title}`, "bright");
    this.log(`${"=".repeat(80)}`, "cyan");
  }

  static success(message) {
    this.log(`✅ ${message}`, "green");
  }

  static error(message) {
    this.log(`❌ ${message}`, "red");
  }

  static warning(message) {
    this.log(`⚠️  ${message}`, "yellow");
  }

  static info(message) {
    this.log(`ℹ️  ${message}`, "blue");
  }

  static progress(current, total, description) {
    const percent = Math.round((current / total) * 100);
    const bar =
      "█".repeat(Math.round(percent / 5)) +
      "░".repeat(20 - Math.round(percent / 5));
    this.log(
      `${description}: [${bar}] ${percent}% (${current}/${total})`,
      "cyan"
    );
  }
}

class Utils {
  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async createDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      Logger.success(`Verzeichnis erstellt: ${dirPath}`);
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
      Logger.info(`Verzeichnis existiert bereits: ${dirPath}`);
    }
  }

  static async execCommand(command, description) {
    try {
      Logger.info(`${description}...`);
      execSync(command, { stdio: "pipe" });
      Logger.success(`${description} erfolgreich`);
      return true;
    } catch (error) {
      Logger.error(`${description} fehlgeschlagen: ${error.message}`);
      return false;
    }
  }

  static async createBackup(sourcePath, backupDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `kfz_backup_${timestamp}.db`);

    try {
      await Utils.createDirectory(backupDir);
      await fs.copyFile(sourcePath, backupPath);
      Logger.success(`Backup erstellt: ${backupPath}`);
      return backupPath;
    } catch (error) {
      Logger.error(`Backup fehlgeschlagen: ${error.message}`);
      throw error;
    }
  }
}

// =============================================================================
// SYSTEM VALIDIERUNG
// =============================================================================

class SystemValidator {
  static async checkRequirements() {
    Logger.header("System-Anforderungen prüfen");

    // Node.js Version
    const nodeVersion = process.version;
    const requiredVersion = CONFIG.NODE_MIN_VERSION;

    if (this.compareVersions(nodeVersion.slice(1), requiredVersion) >= 0) {
      Logger.success(`Node.js Version: ${nodeVersion} ✓`);
    } else {
      Logger.error(
        `Node.js ${requiredVersion}+ erforderlich, gefunden: ${nodeVersion}`
      );
      process.exit(1);
    }

    // NPM verfügbar
    if (
      !(await Utils.execCommand("npm --version", "NPM-Verfügbarkeit prüfen"))
    ) {
      Logger.error("NPM nicht verfügbar");
      process.exit(1);
    }

    // Module prüfen
    await this.checkModules();
  }

  static async checkModules() {
    Logger.info("Prüfe erforderliche Module...");

    const missingModules = [];

    for (const module of CONFIG.REQUIRED_MODULES) {
      try {
        require.resolve(module);
        Logger.success(`Modul ${module} ✓`);
      } catch {
        Logger.warning(`Modul ${module} fehlt`);
        missingModules.push(module);
      }
    }

    if (missingModules.length > 0) {
      Logger.info(
        `Fehlende Module werden installiert: ${missingModules.join(", ")}`
      );
    }

    return missingModules;
  }

  static compareVersions(version1, version2) {
    const v1Parts = version1.split(".").map(Number);
    const v2Parts = version2.split(".").map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }
}

// =============================================================================
// FAHRZEUGHANDEL MIGRATION
// =============================================================================

class FahrzeughandelMigration {
  constructor(db) {
    this.db = db;
  }

  async execute() {
    Logger.header("Fahrzeughandel-Tabelle erstellen");
    Logger.info("🚗 Erstelle Fahrzeughandel-Tabelle...");

    try {
      // Haupttabelle für Fahrzeughandel
      await this.createFahrzeughandelTable();

      // Zusätzliche Indizes für Performance
      await this.createIndexes();

      // Standard-Einstellungen hinzufügen
      await this.addDefaultSettings();

      // Trigger für automatische Gewinnberechnung
      await this.createTriggers();

      Logger.success("✅ Fahrzeughandel-Migration erfolgreich abgeschlossen!");
    } catch (error) {
      Logger.error("❌ Migration fehlgeschlagen: " + error.message);
      throw error;
    }
  }

  createFahrzeughandelTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS fahrzeug_handel (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          handel_nr TEXT UNIQUE NOT NULL,
          typ TEXT NOT NULL CHECK (typ IN ('ankauf', 'verkauf')),
          kunden_id INTEGER,
          fahrzeug_id INTEGER,
          datum DATE NOT NULL DEFAULT (date('now')),
          status TEXT DEFAULT 'offen' CHECK (status IN ('offen', 'abgeschlossen', 'storniert')),
          
          -- Preise und Kosten
          ankaufspreis DECIMAL(10,2) DEFAULT 0,
          verkaufspreis DECIMAL(10,2) DEFAULT 0,
          gewinn DECIMAL(10,2) DEFAULT 0,
          
          -- Fahrzeugdetails (zum Zeitpunkt des Handels)
          kennzeichen TEXT,
          marke TEXT,
          modell TEXT,
          baujahr INTEGER,
          kilometerstand INTEGER,
          farbe TEXT,
          vin TEXT,
          zustand TEXT DEFAULT 'gut' CHECK (zustand IN ('sehr gut', 'gut', 'befriedigend', 'mangelhaft')),
          
          -- TÜV und Papiere
          tuev_bis DATE,
          au_bis DATE,
          papiere_vollstaendig BOOLEAN DEFAULT 1,
          
          -- Zusatzinformationen
          bemerkungen TEXT,
          interne_notizen TEXT,
          verkauft_an TEXT, -- Käufer-Info falls nicht in Kunden-DB
          
          -- Timestamps
          erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
          aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
          abgeschlossen_am DATETIME,
          
          -- Foreign Keys
          FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL,
          FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL
        )
      `;

      this.db.run(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          Logger.success("✅ Tabelle 'fahrzeug_handel' erstellt");
          resolve();
        }
      });
    });
  }

  createIndexes() {
    return new Promise((resolve, reject) => {
      const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_fahrzeug_handel_nr ON fahrzeug_handel(handel_nr)",
        "CREATE INDEX IF NOT EXISTS idx_fahrzeug_handel_typ ON fahrzeug_handel(typ)",
        "CREATE INDEX IF NOT EXISTS idx_fahrzeug_handel_datum ON fahrzeug_handel(datum)",
        "CREATE INDEX IF NOT EXISTS idx_fahrzeug_handel_status ON fahrzeug_handel(status)",
        "CREATE INDEX IF NOT EXISTS idx_fahrzeug_handel_kunden_id ON fahrzeug_handel(kunden_id)",
        "CREATE INDEX IF NOT EXISTS idx_fahrzeug_handel_fahrzeug_id ON fahrzeug_handel(fahrzeug_id)",
        "CREATE INDEX IF NOT EXISTS idx_fahrzeug_handel_kennzeichen ON fahrzeug_handel(kennzeichen)",
      ];

      let completed = 0;
      const total = indexes.length;

      indexes.forEach((sql) => {
        this.db.run(sql, (err) => {
          completed++;

          if (err) {
            console.error(`❌ Fehler bei Index: ${err.message}`);
            reject(err);
            return;
          }

          if (completed === total) {
            Logger.success("✅ Alle Fahrzeughandel-Indizes erstellt");
            resolve();
          }
        });
      });
    });
  }

  addDefaultSettings() {
    return new Promise((resolve, reject) => {
      const settings = [
        ["fahrzeughandel_aktiv", "true", "Fahrzeughandel-Modul aktiviert"],
        [
          "fahrzeughandel_nummerierung_start",
          "1",
          "Startnummer für Handel-Nummern",
        ],
        [
          "fahrzeughandel_nummerierung_format",
          "H{number:6}",
          "Format für Handel-Nummern (H000001)",
        ],
        [
          "fahrzeughandel_standard_zustand",
          "gut",
          "Standard-Zustand für neue Fahrzeuge",
        ],
        [
          "fahrzeughandel_gewinn_berechnung",
          "automatisch",
          "Automatische Gewinnberechnung aktiviert",
        ],
      ];

      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO einstellungen (key, value, beschreibung, aktualisiert_am) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);

      let completed = 0;
      const total = settings.length;

      settings.forEach(([key, value, beschreibung]) => {
        stmt.run(key, value, beschreibung, (err) => {
          completed++;

          if (err) {
            console.error(`❌ Fehler bei Einstellung ${key}:`, err.message);
            reject(err);
            return;
          }

          if (completed === total) {
            stmt.finalize();
            Logger.success("✅ Fahrzeughandel-Einstellungen hinzugefügt");
            resolve();
          }
        });
      });
    });
  }

  createTriggers() {
    return new Promise((resolve, reject) => {
      const triggerSql = `
        CREATE TRIGGER IF NOT EXISTS update_fahrzeug_handel_gewinn
        AFTER UPDATE OF ankaufspreis, verkaufspreis ON fahrzeug_handel
        FOR EACH ROW
        WHEN NEW.typ = 'verkauf' AND NEW.ankaufspreis > 0 AND NEW.verkaufspreis > 0
        BEGIN
          UPDATE fahrzeug_handel 
          SET gewinn = NEW.verkaufspreis - NEW.ankaufspreis,
              aktualisiert_am = CURRENT_TIMESTAMP
          WHERE id = NEW.id;
        END;
      `;

      this.db.run(triggerSql, (err) => {
        if (err) {
          reject(err);
        } else {
          Logger.success("✅ Gewinnberechnung-Trigger erstellt");
          resolve();
        }
      });
    });
  }

  async insertDemoData() {
    Logger.info("📝 Füge Demo-Daten für Fahrzeughandel ein...");

    const demoData = [
      {
        handel_nr: "H000001",
        typ: "ankauf",
        datum: "2024-01-15",
        kennzeichen: "DO-AB-123",
        marke: "Volkswagen",
        modell: "Golf 7",
        baujahr: 2018,
        kilometerstand: 45000,
        farbe: "Silber",
        zustand: "gut",
        ankaufspreis: 12500.0,
        status: "abgeschlossen",
        bemerkungen: "Gepflegtes Fahrzeug, kleine Kratzer am Kotflügel",
      },
      {
        handel_nr: "H000002",
        typ: "verkauf",
        datum: "2024-01-20",
        kennzeichen: "DO-AB-123",
        marke: "Volkswagen",
        modell: "Golf 7",
        baujahr: 2018,
        kilometerstand: 45000,
        farbe: "Silber",
        zustand: "gut",
        ankaufspreis: 12500.0,
        verkaufspreis: 15800.0,
        gewinn: 3300.0,
        status: "offen",
        verkauft_an: "Max Mustermann",
        bemerkungen: "Kratzer repariert, TÜV neu gemacht",
      },
    ];

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO fahrzeug_handel (
          handel_nr, typ, datum, kennzeichen, marke, modell, baujahr, 
          kilometerstand, farbe, zustand, ankaufspreis, verkaufspreis, 
          gewinn, status, verkauft_an, bemerkungen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let completed = 0;
      const total = demoData.length;

      demoData.forEach((data) => {
        stmt.run(
          data.handel_nr,
          data.typ,
          data.datum,
          data.kennzeichen,
          data.marke,
          data.modell,
          data.baujahr,
          data.kilometerstand,
          data.farbe,
          data.zustand,
          data.ankaufspreis,
          data.verkaufspreis,
          data.gewinn,
          data.status,
          data.verkauft_an,
          data.bemerkungen,
          (err) => {
            completed++;

            if (err) {
              console.error(`❌ Fehler bei Demo-Daten:`, err.message);
              reject(err);
              return;
            }

            if (completed === total) {
              stmt.finalize();
              Logger.success(`✅ ${total} Demo-Datensätze eingefügt`);
              resolve();
            }
          }
        );
      });
    });
  }
}

// =============================================================================
// DATENBANK MANAGEMENT
// =============================================================================

class DatabaseManager {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize(includeDemoData = false) {
    Logger.header("Datenbank vollständig initialisieren");
    this.includeDemoData = includeDemoData;

    // Backup falls vorhanden
    if (await Utils.fileExists(this.dbPath)) {
      await Utils.createBackup(this.dbPath, CONFIG.PATHS.backups);
      await fs.unlink(this.dbPath);
      Logger.info("Alte Datenbank entfernt");
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          Logger.error(`Fehler beim Erstellen der Datenbank: ${err.message}`);
          reject(err);
          return;
        }

        Logger.success("Datenbank-Datei erstellt");
        this.configureDatabase()
          .then(() => this.createTables())
          .then(() => this.createIndexes())
          .then(() => this.insertDefaultSettings())
          .then(() => {
            if (this.includeDemoData) {
              return this.insertDemoData();
            }
            return Promise.resolve();
          })
          .then(() => this.insertTemplates())
          .then(() => this.createAuthUser())
          .then(() => this.runSkontoMigration())
          .then(() => {
            const fahrzeughandelMigration = new FahrzeughandelMigration(
              this.db
            );
            return fahrzeughandelMigration.execute();
          })
          .then(() => {
            if (this.includeDemoData) {
              const fahrzeughandelMigration = new FahrzeughandelMigration(
                this.db
              );
              return fahrzeughandelMigration.insertDemoData();
            }
            return Promise.resolve();
          })
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  async configureDatabase() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run("PRAGMA journal_mode=WAL");
        this.db.run("PRAGMA foreign_keys=ON");
        this.db.run("PRAGMA synchronous=NORMAL");
        this.db.run("PRAGMA cache_size=10000");
        Logger.success("Datenbank-Einstellungen konfiguriert");
        resolve();
      });
    });
  }

  async runSkontoMigration() {
    Logger.header("Skonto-Migration ausführen");
    Logger.info("🔄 Starte Migration für Skonto-Checkbox...");

    const migrations = [
      "ALTER TABLE rechnungen ADD COLUMN skonto_aktiv BOOLEAN DEFAULT 0",
      "ALTER TABLE rechnungen ADD COLUMN skonto_betrag DECIMAL(10,2) DEFAULT 0",
    ];

    return new Promise((resolve, reject) => {
      let completed = 0;
      let hasErrors = false;

      migrations.forEach((sql, index) => {
        this.db.run(sql, (err) => {
          completed++;

          if (err && !err.message.includes("duplicate column name")) {
            Logger.error(
              `❌ Migration ${index + 1} fehlgeschlagen: ${err.message}`
            );
            hasErrors = true;
          } else if (err && err.message.includes("duplicate column name")) {
            Logger.info(
              `✅ Migration ${index + 1} bereits vorhanden (übersprungen)`
            );
          } else {
            Logger.success(`✅ Migration ${index + 1} erfolgreich`);
          }

          if (completed === migrations.length) {
            if (hasErrors) {
              Logger.warning("⚠️ Migration mit Fehlern abgeschlossen!");
              reject(new Error("Migration mit Fehlern"));
            } else {
              Logger.success("✅ Skonto-Migration erfolgreich abgeschlossen!");
              resolve();
            }
          }
        });
      });
    });
  }

  async createTables() {
    Logger.info("Erstelle alle Tabellen...");

    const tables = this.getTableDefinitions();
    let completed = 0;

    return new Promise((resolve, reject) => {
      tables.forEach((table, index) => {
        this.db.run(table.sql, (err) => {
          completed++;

          if (err) {
            Logger.error(`Fehler bei Tabelle ${table.name}: ${err.message}`);
            reject(err);
            return;
          }

          Logger.success(
            `Tabelle ${table.name} erstellt (${completed}/${tables.length})`
          );

          if (completed === tables.length) {
            Logger.success("Alle Tabellen erstellt");
            resolve();
          }
        });
      });
    });
  }

  getTableDefinitions() {
    return [
      // 1. AUTH-TABELLEN (zuerst erstellen)
      {
        name: "users",
        sql: `CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login_at DATETIME,
          is_active BOOLEAN DEFAULT 1
        )`,
      },

      {
        name: "sessions",
        sql: `CREATE TABLE sessions (
          session_id VARCHAR(128) UNIQUE NOT NULL,
          expires INTEGER UNSIGNED NOT NULL,
          data MEDIUMTEXT,
          PRIMARY KEY (session_id)
        )`,
      },

      // 2. HAUPTTABELLEN
      {
        name: "kunden",
        sql: `CREATE TABLE kunden (
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
        )`,
      },

      {
        name: "fahrzeuge",
        sql: `CREATE TABLE fahrzeuge (
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
          aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE CASCADE
        )`,
      },

      {
        name: "auftraege",
        sql: `CREATE TABLE auftraege (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          auftrag_nr TEXT UNIQUE NOT NULL,
          kunden_id INTEGER,
          fahrzeug_id INTEGER,
          datum DATE NOT NULL,
          status TEXT DEFAULT 'offen',
          basis_stundenpreis DECIMAL(10,2) DEFAULT 110.00,
          gesamt_zeit DECIMAL(10,2) DEFAULT 0,
          gesamt_kosten DECIMAL(10,2) DEFAULT 0,
          arbeitszeiten_kosten DECIMAL(10,2) DEFAULT 0,
          mwst_betrag DECIMAL(10,2) DEFAULT 0,
          anfahrt_aktiv BOOLEAN DEFAULT 0,
          express_aktiv BOOLEAN DEFAULT 0,
          wochenend_aktiv BOOLEAN DEFAULT 0,
          anfahrt_betrag DECIMAL(10,2) DEFAULT 0,
          express_betrag DECIMAL(10,2) DEFAULT 0,
          wochenend_betrag DECIMAL(10,2) DEFAULT 0,
          bemerkungen TEXT,
          erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
          aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL,
          FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL
        )`,
      },

      {
        name: "auftrag_positionen",
        sql: `CREATE TABLE auftrag_positionen (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          auftrag_id INTEGER,
          beschreibung TEXT NOT NULL,
          stundenpreis DECIMAL(10,2),
          zeit DECIMAL(10,2),
          einheit TEXT DEFAULT 'Std.',
          gesamt DECIMAL(10,2),
          reihenfolge INTEGER,
          FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE CASCADE
        )`,
      },

      {
        name: "rechnungen",
        sql: `CREATE TABLE rechnungen (
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
          rechnungshinweise TEXT DEFAULT '',
          erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
          aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE SET NULL,
          FOREIGN KEY (kunden_id) REFERENCES kunden (id) ON DELETE SET NULL,
          FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id) ON DELETE SET NULL
        )`,
      },

      {
        name: "rechnung_positionen",
        sql: `CREATE TABLE rechnung_positionen (
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
        )`,
      },

      {
        name: "templates",
        sql: `CREATE TABLE templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          typ TEXT NOT NULL,
          kategorie TEXT DEFAULT 'arbeitszeit',
          beschreibung TEXT,
          positions TEXT,
          erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
          aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      },

      {
        name: "einstellungen",
        sql: `CREATE TABLE einstellungen (
          key TEXT PRIMARY KEY,
          value TEXT,
          beschreibung TEXT,
          aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      },
    ];
  }

  async createIndexes() {
    Logger.info("Erstelle Indizes für bessere Performance...");

    const indexes = [
      // Auth-Indizes
      "CREATE INDEX idx_users_username ON users(username)",
      "CREATE INDEX idx_users_role ON users(role)",
      "CREATE INDEX idx_users_active ON users(is_active)",
      "CREATE INDEX idx_sessions_expires ON sessions(expires)",

      // Haupttabellen-Indizes
      "CREATE INDEX idx_kunden_name ON kunden(name)",
      "CREATE INDEX idx_kunden_nr ON kunden(kunden_nr)",
      "CREATE INDEX idx_fahrzeuge_kennzeichen ON fahrzeuge(kennzeichen)",
      "CREATE INDEX idx_fahrzeuge_kunden_id ON fahrzeuge(kunden_id)",
      "CREATE INDEX idx_auftraege_datum ON auftraege(datum)",
      "CREATE INDEX idx_auftraege_status ON auftraege(status)",
      "CREATE INDEX idx_auftraege_kunden_id ON auftraege(kunden_id)",
      "CREATE INDEX idx_auftrag_positionen_auftrag_id ON auftrag_positionen(auftrag_id)",
      "CREATE INDEX idx_rechnungen_datum ON rechnungen(rechnungsdatum)",
      "CREATE INDEX idx_rechnungen_status ON rechnungen(status)",
      "CREATE INDEX idx_rechnungen_kunden_id ON rechnungen(kunden_id)",
      "CREATE INDEX idx_rechnung_positionen_rechnung_id ON rechnung_positionen(rechnung_id)",
      "CREATE INDEX idx_templates_typ ON templates(typ)",
      "CREATE INDEX idx_einstellungen_key ON einstellungen(key)",
    ];

    let completed = 0;

    return new Promise((resolve, reject) => {
      indexes.forEach((sql) => {
        this.db.run(sql, (err) => {
          completed++;

          if (err) {
            Logger.error(`Fehler bei Index: ${err.message}`);
            reject(err);
            return;
          }

          Logger.success(`Index ${completed}/${indexes.length} erstellt`);

          if (completed === indexes.length) {
            Logger.success("Alle Indizes erstellt");
            resolve();
          }
        });
      });
    });
  }

  async insertDefaultSettings() {
    Logger.info("Füge Standard-Einstellungen ein...");

    const settings = this.getDefaultSettings();
    const stmt = this.db.prepare(
      "INSERT INTO einstellungen (key, value, beschreibung) VALUES (?, ?, ?)"
    );

    let completed = 0;

    return new Promise((resolve, reject) => {
      settings.forEach((setting) => {
        stmt.run(setting, (err) => {
          completed++;

          if (err) {
            Logger.error(
              `Fehler bei Einstellung ${setting[0]}: ${err.message}`
            );
            reject(err);
            return;
          }

          Logger.success(
            `Einstellung ${completed}/${settings.length}: ${setting[0]}`
          );

          if (completed === settings.length) {
            stmt.finalize();
            Logger.success("Standard-Einstellungen eingefügt");
            resolve();
          }
        });
      });
    });
  }

  getDefaultSettings() {
    return [
      // Firmendaten
      ["firmenname", "Meine Firma", "Name der Firma"],
      ["firmen_strasse", "Musterstraße 123", "Firmen-Straße und Hausnummer"],
      ["firmen_plz", "12345", "Firmen-PLZ"],
      ["firmen_ort", "Musterstadt", "Firmen-Ort"],
      ["firmen_telefon", "+49 123 456789", "Firmen-Telefonnummer"],
      ["firmen_email", "info@meinfirma.de", "Firmen-E-Mail"],
      ["firmen_website", "www.meinefirma.de", "Firmen-Website"],
      ["firmen_logo", "", "Base64-kodiertes Firmenlogo"],

      // Geschäftsdaten
      ["geschaeftsfuehrer", "Max Mustermann", "Name des Geschäftsführers"],
      ["rechtsform", "GmbH", "Rechtsform der Firma"],
      ["steuernummer", "123/456/78901", "Steuernummer der Firma"],
      ["umsatzsteuer_id", "DE123456789", "Umsatzsteuer-Identifikationsnummer"],

      // Bankverbindung
      ["bank_name", "Musterbank AG", "Name der Bank"],
      ["bank_iban", "DE89 3704 0044 0532 0130 00", "IBAN"],
      ["bank_bic", "COBADEFFXXX", "BIC/SWIFT-Code"],

      // Preise und Steuern
      ["basis_stundenpreis", "110.00", "Basis-Stundenpreis in Euro"],
      ["mwst_satz", "19.00", "Mehrwertsteuersatz in Prozent"],
      ["mwst_ermaessigt", "7.00", "Ermäßigter Mehrwertsteuersatz"],

      // Dokumenten-Nummern
      ["next_auftrag_nr", "1", "Nächste Auftragsnummer"],
      ["next_rechnung_nr", "1", "Nächste Rechnungsnummer"],
      ["next_kunden_nr", "1", "Nächste Kundennummer"],
      ["auftrag_prefix", "A", "Präfix für Auftragsnummern"],
      ["rechnung_prefix", "R", "Präfix für Rechnungsnummern"],

      // Zahlungsbedingungen
      ["zahlungsziel", "14", "Zahlungsziel in Tagen"],
      [
        "zahlungstext",
        "Zahlbar innerhalb 14 Tagen netto. Bei Überschreitung der Zahlungsfrist werden Verzugszinsen in Höhe von 9% über dem Basiszinssatz berechnet",
        "Zahlungstext für Rechnungen",
      ],
      [
        "gewaehrleistung",
        "12 Monate Gewährleistung auf alle Arbeiten.",
        "Gewährleistungstext",
      ],
      ["skonto_tage", "10", "Skonto-Tage"],
      ["skonto_prozent", "2.0", "Skonto-Prozentsatz"],
      ["zahlungsziel_tage", "14", "Zahlungsziel in Tagen"],
      [
        "rechnungshinweise",
        "Bitte überweisen Sie den Betrag auf unser Konto. Vielen Dank für Ihr Vertrauen.",
        "Rechnungshinweise",
      ],

      // System-Einstellungen
      ["system_version", CONFIG.VERSION, "System-Version"],
      ["backup_auto", "true", "Automatische Backups aktiviert"],
      ["currency", "EUR", "Währung"],
      ["date_format", "DD.MM.YYYY", "Datumsformat"],

      // Auth-Einstellungen
      ["auth_enabled", "true", "Authentifizierung aktiviert"],
      ["session_timeout", "24", "Session-Timeout in Stunden"],
      ["password_min_length", "6", "Minimale Passwort-Länge"],
      ["max_login_attempts", "5", "Maximale Login-Versuche"],

      // Layout-Editor Einstellungen - Schrift und Typographie
      [
        "layout_font_family",
        "Arial, sans-serif",
        "Schriftart für Rechnungen und Aufträge",
      ],
      ["layout_font_size_normal", "14px", "Normale Schriftgröße"],
      ["layout_font_size_small", "12px", "Kleine Schriftgröße für Details"],
      ["layout_font_size_large", "16px", "Große Schriftgröße für Beträge"],
      ["layout_font_size_h1", "24px", "Schriftgröße für Hauptüberschriften"],
      ["layout_font_size_h2", "20px", "Schriftgröße für Unterüberschriften"],
      [
        "layout_font_size_h3",
        "18px",
        "Schriftgröße für kleinere Überschriften",
      ],
      ["layout_line_height", "1.5", "Zeilenhöhe für bessere Lesbarkeit"],
      ["layout_letter_spacing", "0px", "Zeichenabstand"],

      // Layout-Editor Einstellungen - Farben
      [
        "layout_color_primary",
        "#007bff",
        "Primärfarbe für Überschriften und Akzente",
      ],
      ["layout_color_text", "#333333", "Haupttextfarbe"],
      ["layout_color_muted", "#666666", "Farbe für sekundären Text"],
      ["layout_color_border", "#dddddd", "Rahmenfarbe für Tabellen und Linien"],
      ["layout_color_background", "#ffffff", "Hintergrundfarbe"],
      [
        "layout_table_header_bg",
        "#f5f5f5",
        "Hintergrundfarbe für Tabellen-Header",
      ],

      // Layout-Editor Einstellungen - Abstände und Margins
      ["layout_page_margin", "2cm", "Seitenabstand für normale Ansicht"],
      ["layout_print_margin", "1cm", "Seitenabstand beim Drucken"],
      ["layout_section_spacing", "2rem", "Abstand zwischen Hauptbereichen"],
      ["layout_paragraph_spacing", "1rem", "Abstand zwischen Absätzen"],
      ["layout_table_padding", "8px", "Innenabstand in Tabellenzellen"],
      ["layout_header_padding", "1rem", "Innenabstand im Header-Bereich"],

      // Layout-Editor Einstellungen - Logo-Einstellungen
      ["layout_logo_position", "top-left", "Position des Firmenlogos"],
      ["layout_logo_max_width", "200px", "Maximale Logo-Breite"],
      ["layout_logo_max_height", "100px", "Maximale Logo-Höhe"],
      ["layout_logo_margin", "0 2rem 1rem 0", "Logo-Außenabstände"],

      // Layout-Editor Einstellungen - Header-Layout
      ["layout_header_alignment", "space-between", "Header-Ausrichtung"],
      ["layout_header_border", "2px solid", "Header-Unterkante Rahmen"],

      // Layout-Editor Einstellungen - Tabellen-Layout
      ["layout_table_border", "1px solid #ddd", "Tabellen-Rahmen"],
      ["layout_table_stripe", "disabled", "Tabellen-Zeilen abwechselnd färben"],
      ["layout_table_border_collapse", "collapse", "Tabellen-Rahmen-Verhalten"],

      // Layout-Editor Einstellungen - Footer-Layout
      ["layout_footer_enabled", "true", "Footer mit Bankdaten anzeigen"],
      ["layout_footer_position", "bottom", "Footer-Position"],
      [
        "layout_footer_border_top",
        "true",
        "Obere Trennlinie im Footer anzeigen",
      ],
      ["layout_footer_font_size", "12px", "Footer-Schriftgröße"],
      ["layout_footer_alignment", "center", "Footer-Textausrichtung"],
      ["layout_footer_margin_top", "2rem", "Footer-Abstand von oben"],

      // Layout-Editor Einstellungen - Unterschriften-Bereich
      ["layout_signature_enabled", "true", "Unterschriften-Bereich anzeigen"],
      ["layout_signature_height", "4cm", "Höhe der Unterschriften-Boxen"],
      [
        "layout_signature_border",
        "1px solid #333",
        "Rahmen der Unterschriften-Boxen",
      ],
      [
        "layout_signature_margin_top",
        "3cm",
        "Abstand der Unterschriften-Sektion",
      ],

      // Layout-Editor Einstellungen - Druckoptionen
      ["layout_print_page_size", "A4", "Papierformat für Druck"],
      ["layout_print_orientation", "portrait", "Druckausrichtung"],
      ["layout_print_scale", "100%", "Druckskalierung"],
      ["layout_auto_print", "false", "Automatisch drucken"],
      [
        "layout_close_after_print",
        "false",
        "Druckfenster automatisch schließen",
      ],

      // Erweiterte Texte
      [
        "arbeitsbedingungen",
        "Alle Arbeiten werden nach bestem Wissen und Gewissen ausgeführt.",
        "Standard-Arbeitsbedingungen",
      ],
    ];
  }

  async insertDemoData() {
    Logger.info("Füge Demo-Daten ein...");

    try {
      const kundenIds = await this.insertKunden();
      const fahrzeugIds = await this.insertFahrzeuge(kundenIds);
      await this.insertAuftraege(kundenIds, fahrzeugIds);
      await this.insertRechnungen(kundenIds, fahrzeugIds);
      Logger.success("Alle Demo-Daten eingefügt");
    } catch (error) {
      Logger.error(`Fehler beim Einfügen der Demo-Daten: ${error.message}`);
      throw error;
    }
  }

  async insertKunden() {
    // Demo-Kunden
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
      [
        "K004",
        "Schmidt Automobile",
        "Hauptstraße 99",
        "67890",
        "Autostadt",
        "+49 444 777888",
        "info@schmidt-auto.de",
      ],
      [
        "K005",
        "Peter Werkstatt",
        "Mechatroniker Str. 5",
        "33333",
        "Technopark",
        "+49 666 999000",
        "peter@werkstatt.com",
      ],
    ];

    const kundenStmt = this.db.prepare(
      "INSERT INTO kunden (kunden_nr, name, strasse, plz, ort, telefon, email) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const kundenIds = [];
    let completed = 0;

    return new Promise((resolve, reject) => {
      demoKunden.forEach((kunde, index) => {
        kundenStmt.run(kunde, function (err) {
          completed++;

          if (err) {
            Logger.error(`Fehler bei Demo-Kunde: ${err.message}`);
            reject(err);
            return;
          }

          kundenIds[index] = this.lastID;
          Logger.success(
            `Demo-Kunde ${completed}/${demoKunden.length}: ${kunde[1]}`
          );

          if (completed === demoKunden.length) {
            kundenStmt.finalize();
            resolve(kundenIds);
          }
        });
      });
    });
  }

  async insertFahrzeuge(kundenIds) {
    Logger.info("Füge Demo-Fahrzeuge ein...");

    // Demo-Fahrzeuge
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
      [3, "QR-ST 345", "Ford", "Focus", "WF0DXXGCBDVW12345", 2022, "Rot", "RR"],
      [
        4,
        "UV-WX 678",
        "Opel",
        "Corsa",
        "W0L0XCF6814123456",
        2020,
        "Grau",
        "GAR",
      ],
      [
        5,
        "YZ-AB 901",
        "Skoda",
        "Octavia",
        "TMBJJ81U012345678",
        2019,
        "Grün Metallic",
        "9P",
      ],
    ];

    const fahrzeugStmt = this.db.prepare(
      "INSERT INTO fahrzeuge (kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const fahrzeugIds = [];
    let completed = 0;

    return new Promise((resolve, reject) => {
      demoFahrzeuge.forEach((fahrzeug, index) => {
        // Kunden-ID korrekt zuweisen
        fahrzeug[0] = kundenIds[fahrzeug[0] - 1];

        fahrzeugStmt.run(fahrzeug, function (err) {
          completed++;

          if (err) {
            Logger.error(`Fehler bei Fahrzeug ${fahrzeug[1]}: ${err.message}`);
            reject(err);
            return;
          }

          fahrzeugIds[index] = this.lastID;
          Logger.success(
            `Demo-Fahrzeug ${completed}/${demoFahrzeuge.length}: ${fahrzeug[1]} (${fahrzeug[2]} ${fahrzeug[3]})`
          );

          if (completed === demoFahrzeuge.length) {
            fahrzeugStmt.finalize();
            resolve(fahrzeugIds);
          }
        });
      });
    });
  }

  async insertAuftraege(kundenIds, fahrzeugIds) {
    Logger.info("Füge Demo-Aufträge ein...");

    // Demo-Aufträge
    const demoAuftraege = [
      [
        "A001",
        kundenIds[0],
        fahrzeugIds[0],
        "2024-01-15",
        "abgeschlossen",
        110.0,
        8.0,
        880.0,
        880.0,
        167.2,
        "Vollständige Lackierung BMW X5",
      ],
      [
        "A002",
        kundenIds[1],
        fahrzeugIds[2],
        "2024-01-20",
        "in_bearbeitung",
        110.0,
        3.5,
        385.0,
        385.0,
        73.15,
        "Smart Repair Audi A4",
      ],
      [
        "A003",
        kundenIds[2],
        fahrzeugIds[3],
        "2024-01-25",
        "offen",
        110.0,
        0,
        0,
        0,
        0,
        "Stoßstangen-Reparatur VW Golf",
      ],
    ];

    const auftragStmt = this.db.prepare(
      "INSERT INTO auftraege (auftrag_nr, kunden_id, fahrzeug_id, datum, status, basis_stundenpreis, gesamt_zeit, gesamt_kosten, arbeitszeiten_kosten, mwst_betrag, bemerkungen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    let completed = 0;

    return new Promise((resolve, reject) => {
      demoAuftraege.forEach((auftrag) => {
        auftragStmt.run(auftrag, (err) => {
          completed++;

          if (err) {
            Logger.error(`Fehler bei Demo-Auftrag: ${err.message}`);
            reject(err);
            return;
          }

          Logger.success(
            `Demo-Auftrag ${completed}/${demoAuftraege.length}: ${auftrag[0]}`
          );

          if (completed === demoAuftraege.length) {
            auftragStmt.finalize();
            resolve();
          }
        });
      });
    });
  }

  async insertRechnungen(kundenIds, fahrzeugIds) {
    Logger.info("Füge Demo-Rechnungen ein...");

    // Demo-Rechnungen
    const demoRechnungen = [
      [
        "R001",
        1,
        kundenIds[0],
        fahrzeugIds[0],
        "2024-01-25",
        "2024-01-15",
        "bezahlt",
        880.0,
        0,
        0,
        880.0,
        167.2,
        0,
        1047.2,
        "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
        "12 Monate Gewährleistung auf alle Arbeiten.",
      ],
    ];

    const rechnungStmt = this.db.prepare(
      "INSERT INTO rechnungen (rechnung_nr, auftrag_id, kunden_id, fahrzeug_id, rechnungsdatum, auftragsdatum, status, zwischensumme, rabatt_prozent, rabatt_betrag, netto_nach_rabatt, mwst_19, mwst_7, gesamtbetrag, zahlungsbedingungen, gewaehrleistung) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    let completed = 0;

    return new Promise((resolve, reject) => {
      demoRechnungen.forEach((rechnung) => {
        rechnungStmt.run(rechnung, (err) => {
          completed++;

          if (err) {
            Logger.error(`Fehler bei Demo-Rechnung: ${err.message}`);
            reject(err);
            return;
          }

          Logger.success(
            `Demo-Rechnung ${completed}/${demoRechnungen.length}: ${rechnung[0]}`
          );

          if (completed === demoRechnungen.length) {
            rechnungStmt.finalize();
            resolve();
          }
        });
      });
    });
  }

  async insertTemplates() {
    Logger.info("Füge Standard-Templates ein...");

    const defaultTemplates = [
      [
        "Vollständige Lackierung",
        "auftrag",
        "arbeitszeit",
        "Komplette Fahrzeug-Neulackierung",
        JSON.stringify([
          {
            kategorie: "arbeitszeit",
            beschreibung: "Fahrzeug vorbereiten und komplett abkleben",
            zeit: 3.0,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Alte Lackierung anschleifen",
            zeit: 4.0,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Grundierung auftragen",
            zeit: 2.0,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Basislack auftragen",
            zeit: 3.0,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Klarlack auftragen",
            zeit: 2.0,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Polieren und Nachbearbeitung",
            zeit: 2.0,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Montage und Endkontrolle",
            zeit: 1.0,
            stundenpreis: 110.0,
          },
        ]),
      ],

      [
        "Smart Repair",
        "auftrag",
        "arbeitszeit",
        "Kleine Reparaturen und Ausbesserungen",
        JSON.stringify([
          {
            kategorie: "arbeitszeit",
            beschreibung: "Schadensbegutachtung und Vorbereitung",
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
          {
            kategorie: "arbeitszeit",
            beschreibung: "Polieren und Finish",
            zeit: 0.5,
            stundenpreis: 110.0,
          },
        ]),
      ],

      [
        "Stoßstangen-Reparatur",
        "auftrag",
        "arbeitszeit",
        "Stoßstangen-Reparatur mit Neulackierung",
        JSON.stringify([
          {
            kategorie: "arbeitszeit",
            beschreibung: "Stoßstange demontieren",
            zeit: 0.5,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Schäden reparieren und spachteln",
            zeit: 1.5,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Grundierung auftragen",
            zeit: 0.5,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Lackierung",
            zeit: 1.0,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Montage",
            zeit: 0.5,
            stundenpreis: 110.0,
          },
        ]),
      ],

      [
        "Felgen-Aufbereitung",
        "auftrag",
        "arbeitszeit",
        "Felgen-Reparatur und Neulackierung",
        JSON.stringify([
          {
            kategorie: "arbeitszeit",
            beschreibung: "Felgen demontieren und reinigen",
            zeit: 1.0,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Beschädigungen reparieren",
            zeit: 2.0,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Grundierung auftragen",
            zeit: 0.5,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Lackierung",
            zeit: 1.5,
            stundenpreis: 110.0,
          },
          {
            kategorie: "arbeitszeit",
            beschreibung: "Montage und Auswuchten",
            zeit: 1.0,
            stundenpreis: 110.0,
          },
        ]),
      ],
    ];

    const templateStmt = this.db.prepare(
      "INSERT INTO templates (name, typ, kategorie, beschreibung, positions) VALUES (?, ?, ?, ?, ?)"
    );
    let completed = 0;

    return new Promise((resolve, reject) => {
      defaultTemplates.forEach((template) => {
        templateStmt.run(template, (err) => {
          completed++;

          if (err) {
            Logger.error(`Fehler bei Template ${template[0]}: ${err.message}`);
            reject(err);
            return;
          }

          Logger.success(
            `Template ${completed}/${defaultTemplates.length}: ${template[0]}`
          );

          if (completed === defaultTemplates.length) {
            templateStmt.finalize();
            Logger.success("Standard-Templates eingefügt");
            resolve();
          }
        });
      });
    });
  }

  async createAuthUser() {
    Logger.info("Erstelle Admin-Benutzer...");

    const { username, password, role } = CONFIG.DEFAULT_ADMIN;

    try {
      const hash = await bcrypt.hash(password, CONFIG.SALT_ROUNDS);

      return new Promise((resolve, reject) => {
        const sql =
          "INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)";

        this.db.run(sql, [username, hash, role], (err) => {
          if (err) {
            Logger.error(
              `Fehler beim Erstellen des Admin-Benutzers: ${err.message}`
            );
            reject(err);
            return;
          }

          Logger.success("Admin-Benutzer erstellt");
          Logger.info(`   Username: ${username}`);
          Logger.info(`   Passwort: ${password}`);
          Logger.warning("WICHTIG: Passwort nach dem ersten Login ändern!");
          resolve();
        });
      });
    } catch (error) {
      Logger.error(`Passwort-Hashing fehlgeschlagen: ${error.message}`);
      throw error;
    }
  }

  async getStatistics() {
    const queries = [
      "SELECT COUNT(*) as count FROM kunden",
      "SELECT COUNT(*) as count FROM fahrzeuge",
      "SELECT COUNT(*) as count FROM templates",
      "SELECT COUNT(*) as count FROM auftraege",
      "SELECT COUNT(*) as count FROM rechnungen",
      "SELECT COUNT(*) as count FROM users",
      "SELECT COUNT(*) as count FROM einstellungen",
    ];

    const stats = {};

    for (const query of queries) {
      try {
        const tableName = query.split(" FROM ")[1];
        const result = await new Promise((resolve, reject) => {
          this.db.get(query, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        stats[tableName] = result.count;
      } catch (error) {
        Logger.warning(`Statistik für ${query} fehlgeschlagen`);
      }
    }

    return stats;
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            Logger.error(`Fehler beim Schließen der Datenbank: ${err.message}`);
          } else {
            Logger.success("Datenbank geschlossen");
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// =============================================================================
// SETUP ORCHESTRATOR
// =============================================================================

class SetupOrchestrator {
  constructor() {
    this.dbManager = new DatabaseManager(CONFIG.PATHS.db);
  }

  async run() {
    try {
      this.showWelcome();

      const userChoice = await this.promptUserChoice();
      if (userChoice === "cancel") {
        Logger.log("\n👋 Setup abgebrochen", "yellow");
        process.exit(0);
      }

      // Check for demo flag
      const includeDemoData = process.argv.includes("--demo");

      await this.executeSetup(userChoice, includeDemoData);
      await this.showSummary();
    } catch (error) {
      Logger.error("Setup fehlgeschlagen");
      Logger.error(error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }

  showWelcome() {
    Logger.log(
      `
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║    🎨 ${CONFIG.APP_NAME} - KOMPLETTES SETUP V${CONFIG.VERSION}                     ║
║    Rechnungs- und Auftragssystem mit vollständiger Datenbank            ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
`,
      "cyan"
    );
  }

  async promptUserChoice() {
    const args = process.argv.slice(2);
    if (args.includes("--reset") || args.includes("-r")) {
      return "reset";
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      if (fsSync.existsSync(CONFIG.PATHS.db)) {
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
                Logger.warning("Ungültige Eingabe - Setup wird abgebrochen");
                resolve("cancel");
            }
          }
        );
      } else {
        rl.close();
        resolve("new");
      }
    });
  }

  async executeSetup(userChoice, includeDemoData) {
    // System-Anforderungen prüfen
    await SystemValidator.checkRequirements();

    // Verzeichnisse erstellen
    await this.createDirectories();

    // Dependencies installieren
    await this.installDependencies();

    // Konfiguration prüfen
    await this.checkConfiguration();

    // Backup-System einrichten
    await this.setupBackupSystem();

    // Development-Setup
    await this.setupDevelopment();

    // Datenbank-Setup
    if (userChoice === "new" || userChoice === "reset") {
      await this.dbManager.initialize(includeDemoData);
    } else {
      Logger.info("Bestehende Datenbank wird beibehalten");
    }
  }

  async createDirectories() {
    Logger.header("Verzeichnisse erstellen");

    for (const dir of CONFIG.DIRECTORIES) {
      const dirPath = path.join(CONFIG.PATHS.root, dir);
      await Utils.createDirectory(dirPath);
    }
  }

  async installDependencies() {
    Logger.header("Abhängigkeiten installieren");

    const packagePath = path.join(CONFIG.PATHS.root, "package.json");

    if (!(await Utils.fileExists(packagePath))) {
      Logger.error("package.json nicht gefunden!");
      process.exit(1);
    }

    return Utils.execCommand("npm install", "NPM Dependencies Installation");
  }

  async checkConfiguration() {
    Logger.header("Konfiguration prüfen");

    const requiredFiles = [
      "server.js",
      "package.json",
      "public/index.html",
      "public/login.html",
      "controllers/authController.js",
      "models/user.js",
      "routes/auth.js",
      "middleware/auth.js",
    ];

    let foundFiles = 0;

    for (const file of requiredFiles) {
      const filePath = path.join(CONFIG.PATHS.root, file);
      if (await Utils.fileExists(filePath)) {
        Logger.success(`${file} ✓`);
        foundFiles++;
      } else {
        Logger.warning(`${file} ❌ (optional)`);
      }
    }

    if (foundFiles >= 3) {
      Logger.success(
        `${foundFiles}/${requiredFiles.length} Dateien gefunden - Setup kann fortgesetzt werden`
      );
    } else {
      Logger.warning(
        "Wenige Dateien gefunden - prüfen Sie die Projektstruktur"
      );
    }

    return foundFiles >= 3;
  }

  async setupBackupSystem() {
    Logger.header("Backup-System einrichten");

    const backupDir = CONFIG.PATHS.backups;
    await Utils.createDirectory(backupDir);

    // .gitignore für Backups
    const gitignorePath = path.join(backupDir, ".gitignore");
    if (!(await Utils.fileExists(gitignorePath))) {
      await fs.writeFile(
        gitignorePath,
        "# Backup files\n*.db\n*.json\n*.sql\n"
      );
      Logger.success("Backup .gitignore erstellt");
    }

    // Backup-Script erstellen
    await this.createBackupScript();
  }

  async setupDevelopment() {
    Logger.header("Development-Umgebung einrichten");

    // .env.example erstellen
    const envPath = path.join(CONFIG.PATHS.root, ".env.example");
    if (!(await Utils.fileExists(envPath))) {
      const envContent = this.generateEnvTemplate();
      await fs.writeFile(envPath, envContent);
      Logger.success(".env.example erstellt");
    }

    // Scripts zu package.json hinzufügen
    await this.updatePackageJson();
  }

  generateEnvTemplate() {
    return `# ${CONFIG.APP_NAME} Environment Variables
NODE_ENV=development
PORT=3000
DB_PATH=./data/kfz.db

# Sicherheit
SESSION_SECRET=your-secret-key-${Math.random().toString(36).substring(7)}
RATE_LIMIT_MAX=1000

# Backup Settings
BACKUP_INTERVAL=24
MAX_BACKUPS=30

# Auth Settings
LOGIN_RATE_LIMIT=5
SESSION_TIMEOUT=24
`;
  }

  async createBackupScript() {
    const backupScriptPath = path.join(__dirname, "backup.js");

    if (!(await Utils.fileExists(backupScriptPath))) {
      const backupScript = `#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceDb = path.join(__dirname, '..', 'data', 'kfz.db');
const backupDir = path.join(__dirname, '..', 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, \`kfz_backup_\${timestamp}.db\`);

if (fs.existsSync(sourceDb)) {
  fs.copyFileSync(sourceDb, backupPath);
  console.log(\`✅ Backup erstellt: \${backupPath}\`);
} else {
  console.error('❌ Datenbank nicht gefunden');
  process.exit(1);
}
`;
      await fs.writeFile(backupScriptPath, backupScript);
      Logger.success("Backup-Script erstellt");
    }
  }

  async updatePackageJson() {
    try {
      const packagePath = path.join(CONFIG.PATHS.root, "package.json");
      if (await Utils.fileExists(packagePath)) {
        const packageContent = await fs.readFile(packagePath, "utf8");
        const packageJson = JSON.parse(packageContent);

        const additionalScripts = {
          setup: "node scripts/setup.js",
          "setup-reset": "node scripts/setup.js --reset",
          "setup-demo": "node scripts/setup.js --demo",
          backup: "node scripts/backup.js",
        };

        let scriptsAdded = false;
        if (!packageJson.scripts) {
          packageJson.scripts = {};
        }

        Object.entries(additionalScripts).forEach(([key, value]) => {
          if (!packageJson.scripts[key]) {
            packageJson.scripts[key] = value;
            scriptsAdded = true;
          }
        });

        if (scriptsAdded) {
          await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
          Logger.success("NPM Scripts hinzugefügt");
        }
      }
    } catch (err) {
      Logger.warning("Konnte package.json nicht erweitern");
    }
  }

  async showSummary() {
    Logger.header("Setup erfolgreich abgeschlossen");

    Logger.success(
      `🎉 ${CONFIG.APP_NAME} mit Authentifizierung erfolgreich eingerichtet!`
    );

    // Statistiken anzeigen
    const stats = await this.dbManager.getStatistics();
    await this.dbManager.close();

    Logger.log("\n✅ Setup-Schritte:", "cyan");
    Logger.log("✅ System-Anforderungen geprüft", "green");
    Logger.log("✅ Verzeichnisse erstellt", "green");
    Logger.log("✅ Abhängigkeiten installiert", "green");
    Logger.log("✅ Datenbank initialisiert", "green");
    Logger.log("✅ Alle Tabellen erstellt", "green");
    Logger.log("✅ Standard-Einstellungen konfiguriert", "green");
    if (this.dbManager.includeDemoData) {
      Logger.log("✅ Demo-Daten eingefügt", "green");
    } else {
      Logger.log("⏭️ Demo-Daten übersprungen", "yellow");
    }
    Logger.log("✅ Auth-System eingerichtet", "green");
    Logger.log("✅ Backup-System eingerichtet", "green");
    Logger.log("✅ Development-Tools konfiguriert", "green");
    Logger.log("✅ Skonto-Migration durchgeführt", "green");
    Logger.log("✅ Fahrzeughandel-Tabelle erstellt", "green");

    Logger.log("\n📊 Datenbank-Inhalt:", "blue");
    Logger.log(`• 👥 Kunden: ${stats.kunden || 0}`, "white");
    Logger.log(`• 🚗 Fahrzeuge: ${stats.fahrzeuge || 0}`, "white");
    Logger.log(`• 📋 Templates: ${stats.templates || 0}`, "white");
    Logger.log(`• 📝 Aufträge: ${stats.auftraege || 0}`, "white");
    Logger.log(`• 🧾 Rechnungen: ${stats.rechnungen || 0}`, "white");
    Logger.log(`• 🔐 Benutzer: ${stats.users || 0}`, "white");
    Logger.log(`• ⚙️ Einstellungen: ${stats.einstellungen || 0}`, "white");

    if (stats.einstellungen > 50) {
      Logger.log("\n🎨 Layout-Editor verfügbar!", "green");
      Logger.log("   → Öffnen Sie die Einstellungen im System", "white");
      Logger.log('   → Wechseln Sie zum "Layout-Design" Tab', "white");
      Logger.log("   → Passen Sie das Layout nach Ihren Wünschen an", "white");
    }

    Logger.log("\n🔐 Authentifizierung:", "cyan");
    Logger.log(`Username: ${CONFIG.DEFAULT_ADMIN.username}`, "white");
    Logger.log(`Passwort: ${CONFIG.DEFAULT_ADMIN.password}`, "white");
    Logger.warning("Passwort nach dem ersten Login ändern!");

    Logger.log("\n🚀 Nächste Schritte:", "cyan");
    Logger.log("1. Server starten: npm start", "white");
    Logger.log("2. Browser öffnen: http://localhost:3000", "white");
    Logger.log("3. Mit admin/admin123 anmelden", "white");
    Logger.log("4. Passwort ändern", "white");
    Logger.log("5. Firmendaten vervollständigen", "white");

    Logger.log("\n🛠️ Verfügbare Kommandos:", "magenta");
    Logger.log("• npm start              - Server starten", "white");
    Logger.log("• npm run setup          - Setup erneut ausführen", "white");
    Logger.log("• npm run setup-reset    - Datenbank zurücksetzen", "white");
    Logger.log("• npm run setup-demo     - Setup mit Demo-Daten", "white");
    Logger.log("• npm run backup         - Backup erstellen", "white");

    Logger.log("\n🎯 System-Features:", "yellow");
    Logger.log("• Vollständige Benutzerauthentifizierung", "white");
    Logger.log("• Rollen-basierte Zugriffskontrolle", "white");
    Logger.log("• Kunden- und Fahrzeugverwaltung", "white");
    Logger.log("• Auftrags- und Rechnungssystem", "white");
    Logger.log("• Template-System", "white");
    Logger.log("• Layout-Editor für individuelle Designs", "white");
    Logger.log("• Automatische Backup-Funktionen", "white");
    Logger.log("• User-Management-Interface", "white");
    Logger.log("• Fahrzeughandel-Modul", "white");
    Logger.log("• Skonto-Funktionalität für Rechnungen", "white");

    Logger.log("\n🔧 Wartung:", "cyan");
    Logger.log("• Backups in /backups", "white");
    Logger.log("• Logs in /logs", "white");
    Logger.log("• Einstellungen über Web-Interface", "white");
    Logger.log("• Session-Daten in der Datenbank", "white");

    Logger.log("\n✨ Viel Erfolg mit KFZFacPRO!", "green");
  }
}

// =============================================================================
// FEHLERBEHANDLUNG UND STARTUP
// =============================================================================

// Graceful Shutdown
process.on("SIGINT", () => {
  Logger.log("\n\n🛑 Setup abgebrochen...", "yellow");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  Logger.error("Unbehandelter Fehler:");
  console.error(err);
  process.exit(1);
});

// Haupt-Setup ausführen
async function main() {
  if (require.main === module) {
    const setup = new SetupOrchestrator();
    await setup.run();
  }
}

// Export für Wiederverwendung
module.exports = {
  SetupOrchestrator,
  DatabaseManager,
  SystemValidator,
  Logger,
  Utils,
  CONFIG,
};

// Setup starten
main().catch((error) => {
  Logger.error("Kritischer Fehler:");
  console.error(error);
  process.exit(1);
});
