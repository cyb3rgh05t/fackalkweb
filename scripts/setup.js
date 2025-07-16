#!/usr/bin/env node

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const { execSync, spawn } = require("child_process");
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

// Hilfsfunktionen
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

  // SQLite3 verfügbar prüfen
  try {
    require("sqlite3");
    success("SQLite3 Modul verfügbar ✓");
  } catch (err) {
    warning("SQLite3 Modul nicht gefunden - wird installiert");
  }
}

// Dependencies installieren
function installDependencies() {
  header("Abhängigkeiten installieren");

  if (!checkFileExists(path.join(__dirname, "..", "package.json"))) {
    error("package.json nicht gefunden!");
    process.exit(1);
  }

  return execCommand("npm install", "NPM Dependencies Installation");
}

// Datenbank komplett initialisieren
function initializeDatabase() {
  header("Datenbank initialisieren");

  const dataDir = path.join(__dirname, "..", "data");
  const dbPath = path.join(dataDir, "kfz.db");

  createDirectory(dataDir);

  // Backup erstellen falls DB existiert
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
    // Kunden-Tabelle
    `CREATE TABLE kunden (
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

    // Fahrzeuge-Tabelle
    `CREATE TABLE fahrzeuge (
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

    // Aufträge-Tabelle
    `CREATE TABLE auftraege (
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

    // Auftrags-Positionen
    `CREATE TABLE auftrag_positionen (
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

    // Rechnungen-Tabelle
    `CREATE TABLE rechnungen (
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

    // Rechnungs-Positionen
    `CREATE TABLE rechnung_positionen (
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

    // Templates-Tabelle
    `CREATE TABLE templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      typ TEXT NOT NULL,
      kategorie TEXT DEFAULT 'arbeitszeit',
      beschreibung TEXT,
      positions TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Einstellungen-Tabelle
    `CREATE TABLE einstellungen (
      key TEXT PRIMARY KEY,
      value TEXT,
      beschreibung TEXT,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  let completed = 0;

  // Erst alle Tabellen erstellen
  tables.forEach((sql, index) => {
    db.run(sql, (err) => {
      completed++;
      if (err) {
        error(`Fehler bei Tabelle ${index + 1}: ${err.message}`);
        reject(err);
        return;
      }

      success(`Tabelle ${completed}/${tables.length} erstellt`);

      if (completed === tables.length) {
        // Dann Indizes erstellen
        createIndexes(db, resolve, reject);
      }
    });
  });
}

function createIndexes(db, resolve, reject) {
  info("Erstelle Indizes für bessere Performance...");

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

      if (indexCompleted === indexes.length) {
        insertDefaultData(db, resolve, reject);
      }
    });
  });
}

function insertDefaultData(db, resolve, reject) {
  info("Füge Standard-Daten ein...");

  // Erweiterte Standard-Einstellungen
  const defaultSettings = [
    // Firmendaten
    ["firmenname", "Meine Firma", "Name der Firma"],
    ["firmen_strasse", "Musterstraße 123", "Firmen-Straße und Hausnummer"],
    ["firmen_plz", "12345", "Firmen-PLZ"],
    ["firmen_ort", "Musterstadt", "Firmen-Ort"],
    ["firmen_telefon", "+49 123 456789", "Firmen-Telefonnummer"],
    ["firmen_email", "info@meine-firma.de", "Firmen-E-Mail"],
    ["firmen_website", "www.meine-firma.de", "Firmen-Website"],
    ["firmen_logo", "", "Base64-kodiertes Firmenlogo"],

    // Geschäftsdaten
    ["geschaeftsfuehrer", "", "Name des Geschäftsführers"],
    ["rechtsform", "GmbH", "Rechtsform der Firma"],
    ["steuernummer", "", "Steuernummer der Firma"],
    ["umsatzsteuer_id", "", "Umsatzsteuer-Identifikationsnummer"],

    // Bankverbindung
    ["bank_name", "", "Name der Bank"],
    ["iban", "", "IBAN"],
    ["bic", "", "BIC/SWIFT-Code"],

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
    ["system_version", "2.0", "System-Version"],
    ["backup_auto", "true", "Automatische Backups aktiviert"],
    ["currency", "EUR", "Währung"],
    ["date_format", "DD.MM.YYYY", "Datumsformat"],

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
    [
      "layout_logo_position",
      "top-left",
      "Position des Firmenlogos (top-left, top-center, top-right, center)",
    ],
    ["layout_logo_max_width", "200px", "Maximale Logo-Breite"],
    ["layout_logo_max_height", "100px", "Maximale Logo-Höhe"],
    ["layout_logo_margin", "0 2rem 1rem 0", "Logo-Außenabstände"],

    // Layout-Editor Einstellungen - Header-Layout
    [
      "layout_header_alignment",
      "space-between",
      "Header-Ausrichtung (space-between, center, flex-start, flex-end)",
    ],
    ["layout_header_border", "2px solid", "Header-Unterkante Rahmen"],

    // Layout-Editor Einstellungen - Tabellen-Layout
    ["layout_table_border", "1px solid #ddd", "Tabellen-Rahmen"],
    [
      "layout_table_stripe",
      "disabled",
      "Tabellen-Zeilen abwechselnd färben (enabled/disabled)",
    ],
    ["layout_table_border_collapse", "collapse", "Tabellen-Rahmen-Verhalten"],

    // Layout-Editor Einstellungen - Footer-Layout
    [
      "layout_footer_enabled",
      "true",
      "Footer mit Bankdaten und Steuernummern anzeigen",
    ],
    ["layout_footer_position", "bottom", "Footer-Position"],
    ["layout_footer_border_top", "true", "Obere Trennlinie im Footer anzeigen"],
    ["layout_footer_font_size", "12px", "Footer-Schriftgröße"],
    [
      "layout_footer_alignment",
      "center",
      "Footer-Textausrichtung (left, center, right)",
    ],
    ["layout_footer_margin_top", "2rem", "Footer-Abstand von oben"],

    // Layout-Editor Einstellungen - Unterschriften-Bereich
    [
      "layout_signature_enabled",
      "true",
      "Unterschriften-Bereich in Aufträgen anzeigen",
    ],
    ["layout_signature_height", "4cm", "Höhe der Unterschriften-Boxen"],
    [
      "layout_signature_border",
      "1px solid #333",
      "Rahmen der Unterschriften-Boxen",
    ],
    [
      "layout_signature_margin_top",
      "3cm",
      "Abstand der Unterschriften-Sektion von oben",
    ],

    // Layout-Editor Einstellungen - Druckoptionen
    [
      "layout_print_page_size",
      "A4",
      "Papierformat für Druck (A4, A3, Letter, Legal)",
    ],
    [
      "layout_print_orientation",
      "portrait",
      "Druckausrichtung (portrait, landscape)",
    ],
    ["layout_print_scale", "100%", "Druckskalierung"],
    [
      "layout_auto_print",
      "false",
      "Automatisch drucken beim Öffnen des Druckfensters",
    ],
    [
      "layout_close_after_print",
      "false",
      "Druckfenster nach dem Drucken automatisch schließen",
    ],

    // Erweiterte Texte
    [
      "arbeitsbedingungen",
      "Alle Arbeiten werden nach bestem Wissen und Gewissen ausgeführt.",
      "Standard-Arbeitsbedingungen für Aufträge",
    ],
  ];

  // Demo-Daten
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

  // Einstellungen einfügen
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

  // Kunden einfügen
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

        // Fahrzeuge für diesen Kunden einfügen
        const kundenFahrzeuge = demoFahrzeuge.filter((f) => f[0] === index + 1);
        if (kundenFahrzeuge.length > 0) {
          const fahrzeugStmt = db.prepare(
            "INSERT INTO fahrzeuge (kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          );

          kundenFahrzeuge.forEach((fahrzeug) => {
            fahrzeug[0] = this.lastID; // Kunden-ID setzen
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

  // Layout-Statistiken anzeigen
  printLayoutStatistics(db);

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

// Layout-Statistiken ausgeben
function printLayoutStatistics(db) {
  db.get(
    `
    SELECT 
      COUNT(*) as total_settings,
      COUNT(CASE WHEN key LIKE 'layout_%' THEN 1 END) as layout_settings,
      COUNT(CASE WHEN key LIKE 'firmen_%' THEN 1 END) as company_settings,
      COUNT(CASE WHEN key LIKE 'mwst_%' THEN 1 END) as tax_settings
    FROM einstellungen
  `,
    (err, stats) => {
      if (err) {
        warning("Konnte Statistiken nicht abrufen");
        return;
      }

      log("\n📊 Datenbank-Statistiken:", "cyan");
      log(`   📝 Gesamt-Einstellungen: ${stats.total_settings}`, "white");
      log(`   🎨 Layout-Einstellungen: ${stats.layout_settings}`, "white");
      log(`   🏢 Firmen-Einstellungen: ${stats.company_settings}`, "white");
      log(`   💰 Steuer-Einstellungen: ${stats.tax_settings}`, "white");

      if (stats.layout_settings > 0) {
        log("\n🎨 Layout-Editor verfügbar!", "green");
        log("   → Öffnen Sie die Einstellungen im System", "white");
        log('   → Wechseln Sie zum "Layout-Design" Tab', "white");
        log("   → Passen Sie das Layout nach Ihren Wünschen an", "white");
      }
    }
  );
}

// Backup-System einrichten
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
const backupPath = path.join(backupDir, \`lackiererei_\${timestamp}.db\`);

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

// Konfiguration prüfen
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

// Development-Umgebung einrichten
function setupDevelopment() {
  header("Development-Umgebung einrichten");

  // .env.example erstellen
  const envExamplePath = path.join(__dirname, "..", ".env.example");
  if (!checkFileExists(envExamplePath)) {
    const envContent = `# KFZ Fac Pro System Environment Variables
NODE_ENV=development
PORT=3000
DB_PATH=./data/kfz.db

# Optional: Security Settings
SESSION_SECRET=your-secret-key-here
RATE_LIMIT_MAX=1000

# Backup Settings
BACKUP_INTERVAL=24
MAX_BACKUPS=30
`;
    fs.writeFileSync(envExamplePath, envContent);
    success(".env.example erstellt");
  }

  // Scripts zu package.json hinzufügen
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

// Server-Test
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

// Installations-Zusammenfassung
function showSummary() {
  header("Setup abgeschlossen");

  success("🎉 KFZ Fac Pro System erfolgreich eingerichtet!");

  log("\n📋 Übersicht:", "cyan");
  log("✅ Abhängigkeiten installiert", "green");
  log("✅ Datenbank initialisiert", "green");
  log("✅ Standard-Einstellungen konfiguriert", "green");
  log("✅ Demo-Daten eingefügt", "green");
  log("✅ Backup-System eingerichtet", "green");
  log("✅ Development-Tools konfiguriert", "green");

  log("\n🚀 Nächste Schritte:", "cyan");
  log("1. Server starten: npm start", "white");
  log("2. Browser öffnen: http://localhost:3000", "white");
  log("3. Einstellungen anpassen", "white");
  log("4. Firmendaten vervollständigen", "white");

  log("\n🛠️  Verfügbare Kommandos:", "magenta");
  log("• npm start          - Server starten", "white");
  log("• npm run dev        - Development Server", "white");
  log("• npm run setup      - Setup erneut ausführen", "white");
  log("• npm run backup     - Backup erstellen", "white");
  log("• npm run reset-db   - Datenbank zurücksetzen", "white");

  log("\n📊 Datenbank-Inhalt:", "blue");
  log("• 3 Demo-Kunden mit Fahrzeugen", "white");
  log("• Standard-Templates für Aufträge", "white");
  log("• Vorkonfigurierte Einstellungen", "white");
  log("• Vollständige Tabellenstruktur", "white");

  log("\n🎯 System-Features:", "yellow");
  log("• Kunden- und Fahrzeugverwaltung", "white");
  log("• Auftrags- und Rechnungssystem", "white");
  log("• Template-System für wiederkehrende Arbeiten", "white");
  log("• Automatische Backup-Funktionen", "white");
  log("• Flexible Einstellungen", "white");

  log("\n🔧 Wartung:", "cyan");
  log("• Backups werden in /backups gespeichert", "white");
  log("• Logs im Browser-Console für Debugging", "white");
  log("• Einstellungen über Web-Interface anpassbar", "white");

  log("\n✨ Viel Erfolg mit Ihrem KFZ Fac Pro System!", "green");
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

// Haupt-Setup-Funktion
async function runSetup() {
  log(
    `
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║    🎨 KFZ Fac Pro SYSTEM - KOMPLETTES SETUP V2.0           ║
║    Rechnungs- und Auftragssystem mit Datenbank-Integration      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
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

    // Datenbank-Setup nur wenn erforderlich
    if (userChoice === "new" || userChoice === "reset") {
      await initializeDatabase();
    } else {
      info("Bestehende Datenbank wird beibehalten");
    }

    // Server-Test (optional)
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
  runSetup();
}

module.exports = {
  runSetup,
  initializeDatabase,
  checkSystemRequirements,
  installDependencies,
  setupBackupSystem,
};
