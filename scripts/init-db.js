const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

console.log("🚀 Initialisiere FAF Lackiererei Datenbank...");

const dbPath = path.join(__dirname, "..", "data", "lackiererei.db");
const dataDir = path.dirname(dbPath);

// Erstelle data Verzeichnis falls es nicht existiert
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log("✅ Data-Verzeichnis erstellt");
}

// Lösche bestehende Datenbank für Clean Start
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log("🗑️  Alte Datenbank gelöscht");
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Fehler beim Erstellen der Datenbank:", err.message);
    process.exit(1);
  } else {
    console.log("✅ Datenbank-Datei erstellt");
    initializeDatabase();
  }
});

function initializeDatabase() {
  console.log("📋 Erstelle Tabellen...");

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

    // Einstellungen-Tabelle
    `CREATE TABLE einstellungen (
            key TEXT PRIMARY KEY,
            value TEXT,
            beschreibung TEXT,
            aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

    // Indizes für bessere Performance
    `CREATE INDEX idx_kunden_name ON kunden(name)`,
    `CREATE INDEX idx_fahrzeuge_kennzeichen ON fahrzeuge(kennzeichen)`,
    `CREATE INDEX idx_auftraege_datum ON auftraege(datum)`,
    `CREATE INDEX idx_auftraege_status ON auftraege(status)`,
    `CREATE INDEX idx_rechnungen_datum ON rechnungen(rechnungsdatum)`,
    `CREATE INDEX idx_rechnungen_status ON rechnungen(status)`,
  ];

  let completed = 0;
  const total = tables.length;

  tables.forEach((sql, index) => {
    db.run(sql, (err) => {
      completed++;
      if (err) {
        console.error(`❌ Fehler bei Tabelle ${index + 1}:`, err.message);
      } else {
        console.log(`✅ Tabelle/Index ${completed}/${total} erstellt`);
      }

      if (completed === total) {
        insertDefaultData();
      }
    });
  });
}

function insertDefaultData() {
  console.log("📊 Füge Standard-Daten ein...");

  // Standard-Einstellungen
  const defaultSettings = [
    ["basis_stundenpreis", "110.00", "Standard Stundenpreis in Euro"],
    ["mwst_standard", "19", "Standard MwSt-Satz in Prozent"],
    ["mwst_ermaessigt", "7", "Ermäßigter MwSt-Satz in Prozent"],
    [
      "zahlungsbedingungen",
      "Zahlbar innerhalb 14 Tagen netto. Bei Überschreitung der Zahlungsfrist werden Verzugszinsen in Höhe von 9% über dem Basiszinssatz berechnet.",
      "Standard Zahlungsbedingungen",
    ],
    [
      "gewaehrleistung",
      "3 Jahre auf Lackierarbeiten bei ordnungsgemäßer Behandlung.",
      "Standard Gewährleistung",
    ],
    ["firmenname", "FAF Lackiererei", "Name der Firma"],
    ["firmen_adresse", "Musterstraße 123\n12345 Musterstadt", "Firmenadresse"],
    ["firmen_telefon", "+49 123 456789", "Firmen-Telefonnummer"],
    ["firmen_email", "info@faf-lackiererei.de", "Firmen E-Mail"],
    ["next_auftrag_nr", "1", "Nächste Auftragsnummer"],
    ["next_rechnung_nr", "1", "Nächste Rechnungsnummer"],
    ["next_kunden_nr", "1", "Nächste Kundennummer"],
  ];

  const stmt = db.prepare(
    "INSERT INTO einstellungen (key, value, beschreibung) VALUES (?, ?, ?)"
  );

  let settingsCompleted = 0;
  defaultSettings.forEach((setting) => {
    stmt.run(setting, (err) => {
      settingsCompleted++;
      if (err) {
        console.error("❌ Fehler beim Einfügen der Einstellung:", err.message);
      } else {
        console.log(`✅ Einstellung eingefügt: ${setting[0]}`);
      }

      if (settingsCompleted === defaultSettings.length) {
        stmt.finalize();
        insertDemoData();
      }
    });
  });
}

function insertDemoData() {
  console.log("🎭 Füge Demo-Daten ein...");

  // Demo-Kunden
  const demoKunden = [
    [
      "K000001",
      "Max Mustermann",
      "Musterstraße 123",
      "12345",
      "Musterstadt",
      "+49 123 456789",
      "max@mustermann.de",
    ],
    [
      "K000002",
      "Anna Schmidt",
      "Hauptstraße 456",
      "67890",
      "Beispielstadt",
      "+49 987 654321",
      "anna@schmidt.de",
    ],
    [
      "K000003",
      "BMW Autohaus Müller",
      "Industriestraße 789",
      "54321",
      "Autostadt",
      "+49 555 123456",
      "info@bmw-mueller.de",
    ],
  ];

  const kundenStmt = db.prepare(
    "INSERT INTO kunden (kunden_nr, name, strasse, plz, ort, telefon, email) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  let kundenCompleted = 0;
  demoKunden.forEach((kunde, index) => {
    kundenStmt.run(kunde, function (err) {
      kundenCompleted++;
      if (err) {
        console.error("❌ Fehler beim Einfügen des Kunden:", err.message);
      } else {
        console.log(`✅ Demo-Kunde eingefügt: ${kunde[1]}`);

        // Demo-Fahrzeuge für jeden Kunden
        const kundenId = this.lastID;
        const demoFahrzeuge = [
          [
            kundenId,
            "M-AB-123",
            "BMW",
            "3er Touring",
            "WBABA12345TE67890",
            2020,
            "Schwarz Metallic",
            "A96",
          ],
          [
            kundenId,
            "M-CD-456",
            "Audi",
            "A4 Avant",
            "WAUZZZ8E45A123456",
            2019,
            "Weiß",
            "LY9C",
          ],
          [
            kundenId,
            "M-EF-789",
            "Mercedes",
            "C-Klasse",
            "WDD2050461A123456",
            2021,
            "Silber Metallic",
            "744",
          ],
        ];

        if (demoFahrzeuge[index]) {
          const fahrzeugStmt = db.prepare(
            "INSERT INTO fahrzeuge (kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          );
          fahrzeugStmt.run(demoFahrzeuge[index], (err) => {
            if (err) {
              console.error(
                "❌ Fehler beim Einfügen des Fahrzeugs:",
                err.message
              );
            } else {
              console.log(
                `✅ Demo-Fahrzeug eingefügt: ${demoFahrzeuge[index][1]}`
              );
            }
            fahrzeugStmt.finalize();
          });
        }
      }

      if (kundenCompleted === demoKunden.length) {
        kundenStmt.finalize();
        // Nächste Kundennummer aktualisieren
        db.run("UPDATE einstellungen SET value = ? WHERE key = ?", [
          demoKunden.length + 1,
          "next_kunden_nr",
        ]);
        finishInitialization();
      }
    });
  });
}

function finishInitialization() {
  console.log("🎉 Datenbank erfolgreich initialisiert!");
  console.log("");
  console.log("📋 Zusammenfassung:");
  console.log("   ✅ Alle Tabellen erstellt");
  console.log("   ✅ Indizes für Performance hinzugefügt");
  console.log("   ✅ Standard-Einstellungen konfiguriert");
  console.log("   ✅ Demo-Daten eingefügt");
  console.log("");
  console.log("🚀 Starten Sie jetzt den Server mit: npm start");
  console.log("");

  db.close((err) => {
    if (err) {
      console.error("❌ Fehler beim Schließen der Datenbank:", err.message);
    } else {
      console.log("✅ Datenbankverbindung geschlossen");
    }
    process.exit(0);
  });
}
