#!/usr/bin/env node

// scripts/complete-setup.js
// Vollständiges Setup-Script für KFZFacPRO mit Auth-System

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const { execSync } = require("child_process");
const readline = require("readline");

// Farbige Konsolen-Ausgaben
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
  log(`\n${"=".repeat(70)}`, "cyan");
  log(`  ${title}`, "bright");
  log(`${"=".repeat(70)}`, "cyan");
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

// Hilfsfunktionen
function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function createDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    success(`Verzeichnis erstellt: ${dirPath}`);
  } else {
    info(`Verzeichnis existiert bereits: ${dirPath}`);
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

// System-Anforderungen prüfen
function checkSystemRequirements() {
  header("System-Anforderungen prüfen");

  // Node.js Version prüfen
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

  // NPM verfügbar prüfen
  try {
    execSync("npm --version", { stdio: "pipe" });
    success("NPM verfügbar ✓");
  } catch (err) {
    error("NPM nicht verfügbar");
    process.exit(1);
  }

  // Erforderliche Module prüfen
  const requiredModules = ["sqlite3", "bcrypt", "express", "express-session"];
  let missingModules = [];

  requiredModules.forEach((module) => {
    try {
      require(module);
      success(`Modul ${module} verfügbar ✓`);
    } catch (err) {
      warning(`Modul ${module} nicht gefunden`);
      missingModules.push(module);
    }
  });

  if (missingModules.length > 0) {
    info(
      `Fehlende Module werden mit npm install installiert: ${missingModules.join(
        ", "
      )}`
    );
  }
}

// Verzeichnisse erstellen
function createDirectories() {
  header("Verzeichnisse erstellen");

  const directories = [
    "./data",
    "./backups",
    "./logs",
    "./public/uploads",
    "./public/css",
    "./public/js",
  ];

  directories.forEach((dir) => {
    const dirPath = path.join(__dirname, "..", dir);
    createDirectory(dirPath);
  });
}

// Dependencies installieren
function installDependencies() {
  header("Abhängigkeiten installieren");

  const packagePath = path.join(__dirname, "..", "package.json");

  if (!checkFileExists(packagePath)) {
    error("package.json nicht gefunden!");
    process.exit(1);
  }

  return execCommand("npm install", "NPM Dependencies Installation");
}

// Vollständige Datenbank initialisieren
function initializeDatabase() {
  header("Datenbank vollständig initialisieren");

  const dataDir = path.join(__dirname, "..", "data");
  const dbPath = path.join(dataDir, "kfz.db");

  createDirectory(dataDir);

  // Backup erstellen falls DB existiert
  if (checkFileExists(dbPath)) {
    const backupPath = path.join(dataDir, `kfz_backup_${Date.now()}.db`);
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

      // WAL-Modus und Foreign Keys aktivieren
      db.serialize(() => {
        db.run("PRAGMA journal_mode=WAL");
        db.run("PRAGMA foreign_keys=ON");
        success("Datenbank-Einstellungen konfiguriert");

        createAllTables(db, resolve, reject);
      });
    });
  });
}

function createAllTables(db, resolve, reject) {
  info("Erstelle alle Tabellen...");

  const tables = [
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
        mwst_betrag DECIMAL(10,2) DEFAULT 0,
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

  let completed = 0;
  let hasError = false;

  // Alle Tabellen erstellen
  tables.forEach((table, index) => {
    db.run(table.sql, (err) => {
      completed++;
      if (err) {
        error(`Fehler bei Tabelle ${table.name}: ${err.message}`);
        hasError = true;
        reject(err);
        return;
      }

      success(`Tabelle ${table.name} erstellt (${completed}/${tables.length})`);

      if (completed === tables.length && !hasError) {
        createIndexes(db, resolve, reject);
      }
    });
  });
}

function createIndexes(db, resolve, reject) {
  info("Erstelle Indizes für bessere Performance...");

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

  let indexCompleted = 0;
  let hasError = false;

  indexes.forEach((sql, index) => {
    db.run(sql, (err) => {
      indexCompleted++;
      if (err) {
        error(`Fehler bei Index ${index + 1}: ${err.message}`);
        hasError = true;
        reject(err);
        return;
      }

      success(`Index ${indexCompleted}/${indexes.length} erstellt`);

      if (indexCompleted === indexes.length && !hasError) {
        insertDefaultSettings(db, resolve, reject);
      }
    });
  });
}

function insertDefaultSettings(db, resolve, reject) {
  info("Füge Standard-Einstellungen ein...");

  const defaultSettings = [
    // Firmendaten
    ["firmenname", "KFZFacPRO Beispiel GmbH", "Name der Firma"],
    ["firmen_strasse", "Musterstraße 123", "Firmen-Straße und Hausnummer"],
    ["firmen_plz", "12345", "Firmen-PLZ"],
    ["firmen_ort", "Musterstadt", "Firmen-Ort"],
    ["firmen_telefon", "+49 123 456789", "Firmen-Telefonnummer"],
    ["firmen_email", "info@kfzfacpro.de", "Firmen-E-Mail"],
    ["firmen_website", "www.kfzfacpro.de", "Firmen-Website"],
    ["firmen_logo", "", "Base64-kodiertes Firmenlogo"],

    // Geschäftsdaten
    ["geschaeftsfuehrer", "Max Mustermann", "Name des Geschäftsführers"],
    ["rechtsform", "GmbH", "Rechtsform der Firma"],
    ["steuernummer", "123/456/78901", "Steuernummer der Firma"],
    ["umsatzsteuer_id", "DE123456789", "Umsatzsteuer-Identifikationsnummer"],

    // Bankverbindung
    ["bank_name", "Musterbank AG", "Name der Bank"],
    ["iban", "DE89 3704 0044 0532 0130 00", "IBAN"],
    ["bic", "COBADEFFXXX", "BIC/SWIFT-Code"],

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
      "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
      "Zahlungstext für Rechnungen",
    ],
    [
      "gewaehrleistung",
      "12 Monate Gewährleistung auf alle Arbeiten.",
      "Gewährleistungstext",
    ],

    // System-Einstellungen
    ["system_version", "2.1.0", "System-Version"],
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
    ["layout_font_size_h3", "18px", "Schriftgröße für kleinere Überschriften"],
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
    ["layout_footer_border_top", "true", "Obere Trennlinie im Footer anzeigen"],
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
    ["layout_close_after_print", "false", "Druckfenster automatisch schließen"],

    // Erweiterte Texte
    [
      "arbeitsbedingungen",
      "Alle Arbeiten werden nach bestem Wissen und Gewissen ausgeführt.",
      "Standard-Arbeitsbedingungen",
    ],
  ];

  // Einstellungen einfügen
  const settingsStmt = db.prepare(
    "INSERT INTO einstellungen (key, value, beschreibung) VALUES (?, ?, ?)"
  );
  let settingsCompleted = 0;
  let hasError = false;

  defaultSettings.forEach((setting, index) => {
    settingsStmt.run(setting, (err) => {
      settingsCompleted++;
      if (err) {
        error(`Fehler bei Einstellung ${setting[0]}: ${err.message}`);
        hasError = true;
        reject(err);
        return;
      }

      success(
        `Einstellung ${settingsCompleted}/${defaultSettings.length}: ${setting[0]}`
      );

      if (settingsCompleted === defaultSettings.length && !hasError) {
        settingsStmt.finalize();
        insertDemoData(db, resolve, reject);
      }
    });
  });
}

function insertDemoData(db, resolve, reject) {
  info("Füge Demo-Daten ein...");

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
    [4, "UV-WX 678", "Opel", "Corsa", "W0L0XCF6814123456", 2020, "Grau", "GAR"],
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

  // Default-Templates
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

  // Demo-Aufträge
  const demoAuftraege = [
    [
      "A001",
      1,
      1,
      "2024-01-15",
      "abgeschlossen",
      110.0,
      8.0,
      880.0,
      167.2,
      "Vollständige Lackierung BMW X5",
    ],
    [
      "A002",
      2,
      3,
      "2024-01-20",
      "in_bearbeitung",
      110.0,
      3.5,
      385.0,
      73.15,
      "Smart Repair Audi A4",
    ],
    [
      "A003",
      3,
      4,
      "2024-01-25",
      "offen",
      110.0,
      0,
      0,
      0,
      "Stoßstangen-Reparatur VW Golf",
    ],
  ];

  // Demo-Rechnungen
  const demoRechnungen = [
    [
      "R001",
      1,
      1,
      1,
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

  // Kunden einfügen
  const kundenStmt = db.prepare(
    "INSERT INTO kunden (kunden_nr, name, strasse, plz, ort, telefon, email) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  let kundenCompleted = 0;
  let hasError = false;
  const kundenIds = [];

  demoKunden.forEach((kunde, index) => {
    kundenStmt.run(kunde, function (err) {
      kundenCompleted++;
      if (err) {
        error(`Fehler bei Kunde ${kunde[0]}: ${err.message}`);
        hasError = true;
        reject(err);
        return;
      }

      kundenIds[index] = this.lastID;
      success(
        `Demo-Kunde ${kundenCompleted}/${demoKunden.length}: ${kunde[1]}`
      );

      if (kundenCompleted === demoKunden.length && !hasError) {
        kundenStmt.finalize();
        insertFahrzeuge(db, demoFahrzeuge, kundenIds, resolve, reject);
      }
    });
  });
}

function insertFahrzeuge(db, demoFahrzeuge, kundenIds, resolve, reject) {
  info("Füge Demo-Fahrzeuge ein...");

  const fahrzeugStmt = db.prepare(
    "INSERT INTO fahrzeuge (kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  let fahrzeugCompleted = 0;
  let hasError = false;
  const fahrzeugIds = [];

  demoFahrzeuge.forEach((fahrzeug, index) => {
    // Kunden-ID korrekt zuweisen
    fahrzeug[0] = kundenIds[fahrzeug[0] - 1];

    fahrzeugStmt.run(fahrzeug, function (err) {
      fahrzeugCompleted++;
      if (err) {
        error(`Fehler bei Fahrzeug ${fahrzeug[1]}: ${err.message}`);
        hasError = true;
        reject(err);
        return;
      }

      fahrzeugIds[index] = this.lastID;
      success(
        `Demo-Fahrzeug ${fahrzeugCompleted}/${demoFahrzeuge.length}: ${fahrzeug[1]} (${fahrzeug[2]} ${fahrzeug[3]})`
      );

      if (fahrzeugCompleted === demoFahrzeuge.length && !hasError) {
        fahrzeugStmt.finalize();
        insertTemplates(db, resolve, reject);
      }
    });
  });
}

function insertTemplates(db, resolve, reject) {
  info("Füge Standard-Templates ein...");

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

  const templateStmt = db.prepare(
    "INSERT INTO templates (name, typ, kategorie, beschreibung, positions) VALUES (?, ?, ?, ?, ?)"
  );
  let templateCompleted = 0;
  let hasError = false;

  defaultTemplates.forEach((template, index) => {
    templateStmt.run(template, (err) => {
      templateCompleted++;
      if (err) {
        error(`Fehler bei Template ${template[0]}: ${err.message}`);
        hasError = true;
        reject(err);
        return;
      }

      success(
        `Template ${templateCompleted}/${defaultTemplates.length}: ${template[0]}`
      );

      if (templateCompleted === defaultTemplates.length && !hasError) {
        templateStmt.finalize();
        createAuthUser(db, resolve, reject);
      }
    });
  });
}

function createAuthUser(db, resolve, reject) {
  header("Authentifizierung einrichten");

  info("Erstelle Admin-Benutzer...");

  const adminUsername = "admin";
  const adminPassword = "admin123";
  const saltRounds = 12;

  // Passwort hashen
  bcrypt.hash(adminPassword, saltRounds, (err, hash) => {
    if (err) {
      error("Fehler beim Hashen des Passworts: " + err.message);
      reject(err);
      return;
    }

    // Admin-Benutzer einfügen
    const insertAdmin =
      "INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, 'admin', 1)";

    db.run(insertAdmin, [adminUsername, hash], function (err) {
      if (err) {
        error("Fehler beim Erstellen des Admin-Benutzers: " + err.message);
        reject(err);
        return;
      }

      success("Admin-Benutzer erfolgreich erstellt");
      info(`   Username: ${adminUsername}`);
      info(`   Passwort: ${adminPassword}`);
      warning("WICHTIG: Passwort nach dem ersten Login ändern!");

      finishDatabaseSetup(db, resolve, reject);
    });
  });
}

function finishDatabaseSetup(db, resolve, reject) {
  success("Datenbank vollständig initialisiert!");

  // Statistiken anzeigen
  printDatabaseStatistics(db);

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

function printDatabaseStatistics(db) {
  info("Sammle Datenbank-Statistiken...");

  const queries = [
    "SELECT COUNT(*) as count FROM kunden",
    "SELECT COUNT(*) as count FROM fahrzeuge",
    "SELECT COUNT(*) as count FROM templates",
    "SELECT COUNT(*) as count FROM einstellungen",
    "SELECT COUNT(*) as count FROM users",
  ];

  let completed = 0;
  const stats = {};

  queries.forEach((query, index) => {
    db.get(query, (err, result) => {
      completed++;
      if (!err) {
        const tableName = query.split(" FROM ")[1];
        stats[tableName] = result.count;
      }

      if (completed === queries.length) {
        displayStatistics(stats);
      }
    });
  });
}

function displayStatistics(stats) {
  log("\n📊 Datenbank-Statistiken:", "cyan");
  log(`   👥 Kunden: ${stats.kunden || 0}`, "white");
  log(`   🚗 Fahrzeuge: ${stats.fahrzeuge || 0}`, "white");
  log(`   📋 Templates: ${stats.templates || 0}`, "white");
  log(`   ⚙️  Einstellungen: ${stats.einstellungen || 0}`, "white");
  log(`   🔐 Benutzer: ${stats.users || 0}`, "white");

  if (stats.einstellungen > 50) {
    log("\n🎨 Layout-Editor verfügbar!", "green");
    log("   → Öffnen Sie die Einstellungen im System", "white");
    log('   → Wechseln Sie zum "Layout-Design" Tab', "white");
    log("   → Passen Sie das Layout nach Ihren Wünschen an", "white");
  }
}

function setupBackupSystem() {
  header("Backup-System einrichten");

  const backupDir = path.join(__dirname, "..", "backups");
  createDirectory(backupDir);

  // .gitignore für Backups
  const gitignorePath = path.join(backupDir, ".gitignore");
  if (!checkFileExists(gitignorePath)) {
    fs.writeFileSync(gitignorePath, "# Backup files\n*.db\n*.json\n*.sql\n");
    success("Backup .gitignore erstellt");
  }

  // Backup-Script erstellen
  const backupScriptPath = path.join(__dirname, "backup.js");
  if (!checkFileExists(backupScriptPath)) {
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
}
`;
    fs.writeFileSync(backupScriptPath, backupScript);
    success("Backup-Script erstellt");
  }
}

function checkConfiguration() {
  header("Konfiguration prüfen");

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

  let allFilesExist = true;
  let foundFiles = 0;

  requiredFiles.forEach((file) => {
    const filePath = path.join(__dirname, "..", file);
    if (checkFileExists(filePath)) {
      success(`${file} ✓`);
      foundFiles++;
    } else {
      warning(`${file} ❌ (optional)`);
    }
  });

  if (foundFiles >= 3) {
    success(
      `${foundFiles}/${requiredFiles.length} Dateien gefunden - Setup kann fortgesetzt werden`
    );
  } else {
    warning("Wenige Dateien gefunden - prüfen Sie die Projektstruktur");
  }

  return foundFiles >= 3;
}

function setupDevelopment() {
  header("Development-Umgebung einrichten");

  // .env.example erstellen
  const envExamplePath = path.join(__dirname, "..", ".env.example");
  if (!checkFileExists(envExamplePath)) {
    const envContent = `# KFZFacPRO Environment Variables
NODE_ENV=development
PORT=3000
DB_PATH=./data/kfz.db

# Sicherheit
SESSION_SECRET=your-secret-key-here-${Math.random().toString(36).substring(7)}
RATE_LIMIT_MAX=1000

# Backup Settings
BACKUP_INTERVAL=24
MAX_BACKUPS=30

# Auth Settings
LOGIN_RATE_LIMIT=5
SESSION_TIMEOUT=24
`;
    fs.writeFileSync(envExamplePath, envContent);
    success(".env.example erstellt");
  }

  // Scripts zu package.json hinzufügen
  try {
    const packagePath = path.join(__dirname, "..", "package.json");
    if (checkFileExists(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));

      const additionalScripts = {
        setup: "node scripts/complete-setup.js",
        "setup-reset": "node scripts/complete-setup.js --reset",
        backup: "node scripts/backup.js",
        "debug-db": "node scripts/debug-db.js",
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
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        success("NPM Scripts hinzugefügt");
      }
    }
  } catch (err) {
    warning("Konnte package.json nicht erweitern");
  }

  // README erstellen
  const readmePath = path.join(__dirname, "..", "SETUP_README.md");
  const readmeContent = `# KFZFacPRO - Setup erfolgreich abgeschlossen

## 🔐 Standard-Anmeldedaten
- **Benutzername:** admin
- **Passwort:** admin123

⚠️ **WICHTIG:** Passwort nach dem ersten Login ändern!

## 🚀 Server starten
\`\`\`bash
npm start
\`\`\`

## 📱 Zugriff
- **URL:** http://localhost:3000
- **Login:** http://localhost:3000/login

## 🛠️ Verfügbare Befehle
- \`npm start\` - Server starten
- \`npm run setup\` - Setup erneut ausführen
- \`npm run setup-reset\` - Datenbank zurücksetzen
- \`npm run backup\` - Backup erstellen
- \`npm run debug-db\` - Datenbank-Debug

## 📊 Enthaltene Demo-Daten
- 5 Demo-Kunden
- 7 Demo-Fahrzeuge  
- 4 Arbeits-Templates
- 60+ Einstellungen
- Admin-Benutzer für Authentifizierung

## ✨ System-Features
- Vollständige Authentifizierung
- Kunden- und Fahrzeugverwaltung
- Auftrags- und Rechnungssystem
- Template-System
- Layout-Editor
- Backup-System
- User-Management (Admin)

Viel Erfolg mit KFZFacPRO!
`;
  fs.writeFileSync(readmePath, readmeContent);
  success("SETUP_README.md erstellt");
}

// Interaktiver Setup-Modus
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

// Installations-Zusammenfassung
function showSummary() {
  header("Setup erfolgreich abgeschlossen");

  success("🎉 KFZFacPRO mit Authentifizierung erfolgreich eingerichtet!");

  log("\n✅ Setup-Schritte:", "cyan");
  log("✅ System-Anforderungen geprüft", "green");
  log("✅ Verzeichnisse erstellt", "green");
  log("✅ Abhängigkeiten installiert", "green");
  log("✅ Datenbank initialisiert", "green");
  log("✅ Alle Tabellen erstellt", "green");
  log("✅ Standard-Einstellungen konfiguriert", "green");
  log("✅ Demo-Daten eingefügt", "green");
  log("✅ Auth-System eingerichtet", "green");
  log("✅ Backup-System eingerichtet", "green");
  log("✅ Development-Tools konfiguriert", "green");

  log("\n🔐 Authentifizierung:", "cyan");
  log("Username: admin", "white");
  log("Passwort: admin123", "white");
  warning("Passwort nach dem ersten Login ändern!");

  log("\n🚀 Nächste Schritte:", "cyan");
  log("1. Server starten: npm start", "white");
  log("2. Browser öffnen: http://localhost:3000", "white");
  log("3. Mit admin/admin123 anmelden", "white");
  log("4. Passwort ändern", "white");
  log("5. Firmendaten vervollständigen", "white");

  log("\n🛠️ Verfügbare Kommandos:", "magenta");
  log("• npm start              - Server starten", "white");
  log("• npm run setup          - Setup erneut ausführen", "white");
  log("• npm run setup-reset    - Datenbank zurücksetzen", "white");
  log("• npm run backup         - Backup erstellen", "white");
  log("• npm run debug-db       - Datenbank-Debug", "white");

  log("\n📊 Datenbank-Inhalt:", "blue");
  log("• Authentifizierungs-Tabellen", "white");
  log("• 5 Demo-Kunden mit Fahrzeugen", "white");
  log("• 4 Standard-Templates", "white");
  log("• 60+ Einstellungen inkl. Layout-Editor", "white");
  log("• Admin-Benutzer für User-Management", "white");

  log("\n🎯 System-Features:", "yellow");
  log("• Vollständige Benutzerauthentifizierung", "white");
  log("• Rollen-basierte Zugriffskontrolle", "white");
  log("• Kunden- und Fahrzeugverwaltung", "white");
  log("• Auftrags- und Rechnungssystem", "white");
  log("• Template-System", "white");
  log("• Layout-Editor für individuelle Designs", "white");
  log("• Automatische Backup-Funktionen", "white");
  log("• User-Management-Interface", "white");

  log("\n🔧 Wartung:", "cyan");
  log("• Backups in /backups", "white");
  log("• Logs in /logs", "white");
  log("• Einstellungen über Web-Interface", "white");
  log("• Session-Daten in /data/sessions.db", "white");

  log("\n✨ Viel Erfolg mit KFZFacPRO!", "green");
}

// Haupt-Setup-Funktion
async function runCompleteSetup() {
  log(
    `
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║    🎨 KFZFacPRO - KOMPLETTES SETUP V2.1 MIT AUTHENTIFIZIERUNG      ║
║    Rechnungs- und Auftragssystem mit vollständiger Datenbank            ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
`,
    "cyan"
  );

  try {
    // Kommandozeilen-Argument prüfen
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

    // Setup-Schritte ausführen
    checkSystemRequirements();
    createDirectories();

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

    // Datenbank-Setup
    if (userChoice === "new" || userChoice === "reset") {
      await initializeDatabase();
    } else {
      info("Bestehende Datenbank wird beibehalten");
    }

    showSummary();
  } catch (err) {
    error("Setup fehlgeschlagen");
    error(err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Fehlerbehandlung
process.on("SIGINT", () => {
  log("\n\n🛑 Setup abgebrochen...", "yellow");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  error("Unbehandelter Fehler:");
  console.error(err);
  process.exit(1);
});

// Setup starten wenn direkt ausgeführt
if (require.main === module) {
  runCompleteSetup();
}

module.exports = {
  runCompleteSetup,
  initializeDatabase,
  checkSystemRequirements,
  installDependencies,
  setupBackupSystem,
  checkConfiguration,
  setupDevelopment,
};
