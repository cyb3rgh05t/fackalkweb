// scripts/migrations/add_fahrzeughandel_table.js
// Migration für Fahrzeug Ankauf/Verkauf Funktionalität

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

class FahrzeughandelMigration {
  constructor() {
    const dbPath = path.join(__dirname, "data", "kfz.db");
    this.db = new sqlite3.Database(dbPath);
  }

  async execute() {
    console.log("🚗 Erstelle Fahrzeughandel-Tabelle...");

    try {
      // Haupttabelle für Fahrzeughandel
      await this.createFahrzeughandelTable();

      // Zusätzliche Indizes für Performance
      await this.createIndexes();

      // Standard-Einstellungen hinzufügen
      await this.addDefaultSettings();

      console.log("✅ Fahrzeughandel-Migration erfolgreich abgeschlossen!");
    } catch (error) {
      console.error("❌ Migration fehlgeschlagen:", error);
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
          console.log("✅ Tabelle 'fahrzeug_handel' erstellt");
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
            console.log("✅ Alle Fahrzeughandel-Indizes erstellt");
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
            console.log("✅ Fahrzeughandel-Einstellungen hinzugefügt");
            resolve();
          }
        });
      });
    });
  }

  // Trigger für automatische Gewinnberechnung
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
          console.log("✅ Gewinnberechnung-Trigger erstellt");
          resolve();
        }
      });
    });
  }

  // Demo-Daten einfügen (optional für Tests)
  async insertDemoData() {
    console.log("📝 Füge Demo-Daten für Fahrzeughandel ein...");

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
              console.log(`✅ ${total} Demo-Datensätze eingefügt`);
              resolve();
            }
          }
        );
      });
    });
  }

  close() {
    this.db.close();
  }
}

// Migration ausführen wenn direkt aufgerufen
if (require.main === module) {
  const migration = new FahrzeughandelMigration();

  migration
    .execute()
    .then(() => {
      console.log("🎉 Migration abgeschlossen!");

      // Optional: Demo-Daten einfügen
      const args = process.argv.slice(2);
      if (args.includes("--demo")) {
        return migration.insertDemoData();
      }
    })
    .then(() => {
      migration.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Migration fehlgeschlagen:", error);
      migration.close();
      process.exit(1);
    });
}

module.exports = FahrzeughandelMigration;
