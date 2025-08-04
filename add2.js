// =======================================================================================
// MIGRATION: KILOMETERSTAND-SPALTE ZUR FAHRZEUGE-TABELLE HINZUFÜGEN
// Datei: scripts/migration-add-kilometerstand.js
// =======================================================================================

const Database = require("better-sqlite3");
const path = require("path");

async function addKilometerstandToFahrzeuge() {
  console.log("🔄 Starte Kilometerstand-Migration für fahrzeuge-Tabelle...");

  try {
    // Datenbankverbindung
    const dbPath = path.join(__dirname, "data", "kfz.db");
    console.log("📁 Datenbank-Pfad:", dbPath);

    const db = new Database(dbPath);

    // 1. Prüfen ob Tabelle existiert
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='fahrzeuge'"
      )
      .get();

    if (!tableExists) {
      console.error('❌ Tabelle "fahrzeuge" nicht gefunden!');
      process.exit(1);
    }

    console.log('✅ Tabelle "fahrzeuge" gefunden');

    // 2. Aktuelle Spalten auflisten
    const currentColumns = db.prepare("PRAGMA table_info(fahrzeuge)").all();
    console.log("📋 Aktuelle Spalten:");
    currentColumns.forEach((col) => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    // 3. Prüfen ob kilometerstand-Spalte bereits existiert
    const hasKilometerstand = currentColumns.some(
      (col) => col.name === "kilometerstand"
    );

    if (hasKilometerstand) {
      console.log(
        "⏭️ Spalte 'kilometerstand' existiert bereits - Migration übersprungen"
      );
      return;
    }

    // 4. Kilometerstand-Spalte hinzufügen
    console.log("\n🔧 Füge kilometerstand-Spalte hinzu...");

    const addColumnSql = `ALTER TABLE fahrzeuge ADD COLUMN kilometerstand INTEGER DEFAULT 0`;
    console.log(`🔄 Führe aus: ${addColumnSql}`);

    db.exec(addColumnSql);
    console.log("✅ Spalte 'kilometerstand' erfolgreich hinzugefügt");

    // 5. Daten aus fahrzeug_handel übertragen (falls vorhanden)
    console.log(
      "\n📊 Übertrage vorhandene Kilometerstand-Daten aus fahrzeug_handel..."
    );

    const transferSql = `
      UPDATE fahrzeuge 
      SET kilometerstand = (
        SELECT fh.kilometerstand 
        FROM fahrzeug_handel fh 
        WHERE fh.fahrzeug_id = fahrzeuge.id 
        AND fh.kilometerstand IS NOT NULL 
        ORDER BY fh.datum DESC, fh.id DESC 
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1 FROM fahrzeug_handel fh 
        WHERE fh.fahrzeug_id = fahrzeuge.id 
        AND fh.kilometerstand IS NOT NULL
      )
    `;

    const result = db.prepare(transferSql).run();
    console.log(
      `✅ ${result.changes} Fahrzeuge mit Kilometerstand-Daten aktualisiert`
    );

    // 6. Index für bessere Performance (optional)
    try {
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_fahrzeuge_kilometerstand ON fahrzeuge(kilometerstand)"
      );
      console.log("✅ Index für kilometerstand erstellt");
    } catch (error) {
      console.log("⚠️ Index konnte nicht erstellt werden:", error.message);
    }

    // 7. Finale Überprüfung
    console.log("\n🔍 Migration abgeschlossen - finale Überprüfung:");
    const finalColumns = db.prepare("PRAGMA table_info(fahrzeuge)").all();

    const kilometerstandColumn = finalColumns.find(
      (col) => col.name === "kilometerstand"
    );
    if (kilometerstandColumn) {
      console.log(
        `✅ Spalte 'kilometerstand' erfolgreich hinzugefügt (${kilometerstandColumn.type})`
      );
    } else {
      console.error(
        "❌ Spalte 'kilometerstand' nicht gefunden nach Migration!"
      );
      process.exit(1);
    }

    // 8. Beispiel-Daten anzeigen
    const sampleData = db
      .prepare(
        "SELECT id, kennzeichen, marke, modell, kilometerstand FROM fahrzeuge LIMIT 5"
      )
      .all();
    console.log("\n📋 Beispiel-Daten nach Migration:");
    sampleData.forEach((row) => {
      console.log(
        `  - ${row.kennzeichen} (${row.marke} ${row.modell}): ${
          row.kilometerstand || 0
        } km`
      );
    });

    db.close();
    console.log("\n🎉 Migration erfolgreich abgeschlossen!");
  } catch (error) {
    console.error("❌ Migration fehlgeschlagen:", error);
    process.exit(1);
  }
}

// Migration ausführen wenn direkt aufgerufen
if (require.main === module) {
  addKilometerstandToFahrzeuge();
}

module.exports = { addKilometerstandToFahrzeuge };

// =======================================================================================
// ANWEISUNGEN:
// =======================================================================================

/*
1. Diese Datei speichern als: scripts/migration-add-kilometerstand.js

2. Migration ausführen:
   cd your-project-folder
   node scripts/migration-add-kilometerstand.js

3. Die Migration wird:
   ✅ kilometerstand-Spalte zur fahrzeuge-Tabelle hinzufügen
   ✅ Vorhandene Daten aus fahrzeug_handel übertragen 
   ✅ Index für bessere Performance erstellen
   ✅ Vollständige Validierung durchführen

4. Nach erfolgreicher Migration können Sie die erweiterte PUT-Route verwenden!
*/

console.log("📝 Kilometerstand-Migration bereit zur Ausführung!");
