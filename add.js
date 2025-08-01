// migration-add-anzahlung.js - Script zum Hinzufügen der Anzahlungsfelder
// Dieses Script in den Root-Ordner des Projekts legen und ausführen mit: node migration-add-anzahlung.js

const Database = require("better-sqlite3");
const path = require("path");

async function runMigration() {
  console.log("🔄 Starte Anzahlungs-Migration...");

  try {
    // Datenbankverbindung
    const dbPath = path.join(__dirname, "data", "kfz.db");
    console.log("📁 Datenbank-Pfad:", dbPath);

    const db = new Database(dbPath);

    // Prüfen ob Tabelle existiert
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='rechnungen'"
      )
      .get();
    if (!tableExists) {
      console.error('❌ Tabelle "rechnungen" nicht gefunden!');
      process.exit(1);
    }

    console.log('✅ Tabelle "rechnungen" gefunden');

    // Aktuelle Spalten auflisten
    const currentColumns = db.prepare("PRAGMA table_info(rechnungen)").all();
    console.log("📋 Aktuelle Spalten:");
    currentColumns.forEach((col) => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    // Prüfen welche Spalten bereits existieren
    const existingColumns = currentColumns.map((col) => col.name);
    const newColumns = [
      { name: "anzahlung", type: "DECIMAL(10,2)", default: "0" },
      { name: "restbetrag", type: "DECIMAL(10,2)", default: "0" },
      { name: "anzahlung_aktiv", type: "BOOLEAN", default: "0" },
    ];

    // Migration ausführen
    console.log("\n🔧 Führe Migration aus...");

    for (const column of newColumns) {
      if (existingColumns.includes(column.name)) {
        console.log(
          `⏭️ Spalte "${column.name}" existiert bereits - überspringe`
        );
        continue;
      }

      try {
        const sql = `ALTER TABLE rechnungen ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default}`;
        console.log(`🔄 Führe aus: ${sql}`);

        db.exec(sql);
        console.log(`✅ Spalte "${column.name}" erfolgreich hinzugefügt`);
      } catch (error) {
        if (error.message.includes("duplicate column name")) {
          console.log(`⏭️ Spalte "${column.name}" existiert bereits`);
        } else {
          throw error;
        }
      }
    }

    // Index hinzufügen (optional, für bessere Performance)
    try {
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_rechnungen_anzahlung ON rechnungen(anzahlung_aktiv)"
      );
      console.log("✅ Index für anzahlung_aktiv erstellt");
    } catch (error) {
      console.log("⚠️ Index konnte nicht erstellt werden:", error.message);
    }

    // Finale Überprüfung
    console.log("\n🔍 Migration abgeschlossen - finale Überprüfung:");
    const finalColumns = db.prepare("PRAGMA table_info(rechnungen)").all();

    newColumns.forEach((col) => {
      const exists = finalColumns.find((dbCol) => dbCol.name === col.name);
      if (exists) {
        console.log(
          `✅ ${col.name}: ${exists.type} (Default: ${exists.dflt_value})`
        );
      } else {
        console.log(`❌ ${col.name}: NICHT GEFUNDEN!`);
      }
    });

    // Test-Daten für bestehende Rechnungen setzen (optional)
    const existingRechnungen = db
      .prepare("SELECT COUNT(*) as count FROM rechnungen")
      .get();
    if (existingRechnungen.count > 0) {
      console.log(
        `\n📊 ${existingRechnungen.count} bestehende Rechnungen gefunden`
      );

      // Für bestehende Rechnungen Restbetrag = Gesamtbetrag setzen
      const updateQuery = `
        UPDATE rechnungen 
        SET restbetrag = gesamtbetrag, 
            anzahlung = 0, 
            anzahlung_aktiv = 0 
        WHERE anzahlung IS NULL OR restbetrag IS NULL
      `;

      const result = db.prepare(updateQuery).run();
      console.log(
        `✅ ${result.changes} Rechnungen aktualisiert (Restbetrag = Gesamtbetrag)`
      );
    }

    db.close();

    console.log("\n🎉 MIGRATION ERFOLGREICH ABGESCHLOSSEN!");
    console.log("\n📋 Was wurde gemacht:");
    console.log(
      '  ✅ Spalte "anzahlung" hinzugefügt (DECIMAL(10,2), Default: 0)'
    );
    console.log(
      '  ✅ Spalte "restbetrag" hinzugefügt (DECIMAL(10,2), Default: 0)'
    );
    console.log(
      '  ✅ Spalte "anzahlung_aktiv" hinzugefügt (BOOLEAN, Default: 0)'
    );
    console.log("  ✅ Index für bessere Performance erstellt");
    console.log("  ✅ Bestehende Rechnungen aktualisiert");

    console.log("\n🔄 Als nächstes:");
    console.log("  1. Server neu starten: npm start");
    console.log("  2. Anzahlungsfelder im Frontend testen");
    console.log("  3. Neue Rechnung erstellen und Anzahlung eingeben");
  } catch (error) {
    console.error("❌ Migration fehlgeschlagen:", error);
    console.error("\n🔧 Mögliche Lösungen:");
    console.error("  1. Prüfen ob Datenbank-Datei existiert: data/kfz.db");
    console.error(
      "  2. Sicherstellen dass keine andere Anwendung die DB verwendet"
    );
    console.error("  3. Backup der Datenbank erstellen vor der Migration");
    process.exit(1);
  }
}

// Migration ausführen
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
