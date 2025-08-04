// =======================================================================================
// MIGRATION: KÄUFER-ID SPALTE ZUR FAHRZEUGHANDEL-TABELLE HINZUFÜGEN
// Datei: scripts/migration-add-kaeufer-id.js
// =======================================================================================

const Database = require("better-sqlite3");
const path = require("path");

async function addKaeuferIdToFahrzeughandel() {
  console.log("🔄 Starte Käufer-ID-Migration für fahrzeug_handel-Tabelle...");

  try {
    // Datenbankverbindung
    const dbPath = path.join(__dirname, "data", "kfz.db");
    console.log("📁 Datenbank-Pfad:", dbPath);

    const db = new Database(dbPath);

    // 1. Prüfen ob Tabelle existiert
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='fahrzeug_handel'"
      )
      .get();

    if (!tableExists) {
      console.error('❌ Tabelle "fahrzeug_handel" nicht gefunden!');
      process.exit(1);
    }

    console.log('✅ Tabelle "fahrzeug_handel" gefunden');

    // 2. Aktuelle Spalten auflisten
    const currentColumns = db
      .prepare("PRAGMA table_info(fahrzeug_handel)")
      .all();
    console.log("📋 Aktuelle Spalten:");
    currentColumns.forEach((col) => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    // 3. Prüfen ob kaeufer_id-Spalte bereits existiert
    const hasKaeuferId = currentColumns.some(
      (col) => col.name === "kaeufer_id"
    );

    if (hasKaeuferId) {
      console.log(
        "⏭️ Spalte 'kaeufer_id' existiert bereits - Migration übersprungen"
      );
      return;
    }

    // 4. Käufer-ID-Spalte hinzufügen
    console.log("\n🔧 Füge kaeufer_id-Spalte hinzu...");

    const addColumnSql = `ALTER TABLE fahrzeug_handel ADD COLUMN kaeufer_id INTEGER REFERENCES kunden(id)`;
    console.log(`🔄 Führe aus: ${addColumnSql}`);

    db.exec(addColumnSql);
    console.log("✅ Spalte 'kaeufer_id' erfolgreich hinzugefügt");

    // 5. Vorhandene verkauft_an-Daten migrieren (nur numerische IDs)
    console.log("\n📊 Migriere vorhandene verkauft_an-Daten zu kaeufer_id...");

    const migrateSql = `
      UPDATE fahrzeug_handel 
      SET kaeufer_id = CAST(verkauft_an AS INTEGER)
      WHERE verkauft_an IS NOT NULL 
      AND verkauft_an != ''
      AND verkauft_an GLOB '[0-9]*'
      AND EXISTS (SELECT 1 FROM kunden WHERE id = CAST(verkauft_an AS INTEGER))
    `;

    const result = db.prepare(migrateSql).run();
    console.log(
      `✅ ${result.changes} Handelsgeschäfte mit Käufer-ID aktualisiert`
    );

    // 6. Index für bessere Performance
    try {
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_fahrzeug_handel_kaeufer ON fahrzeug_handel(kaeufer_id)"
      );
      console.log("✅ Index für kaeufer_id erstellt");
    } catch (error) {
      console.log("⚠️ Index konnte nicht erstellt werden:", error.message);
    }

    // 7. Finale Überprüfung
    console.log("\n🔍 Migration abgeschlossen - finale Überprüfung:");
    const finalColumns = db.prepare("PRAGMA table_info(fahrzeug_handel)").all();

    const kaeuferIdColumn = finalColumns.find(
      (col) => col.name === "kaeufer_id"
    );
    if (kaeuferIdColumn) {
      console.log(
        `✅ Spalte 'kaeufer_id' erfolgreich hinzugefügt (${kaeuferIdColumn.type})`
      );
    } else {
      console.error("❌ Spalte 'kaeufer_id' nicht gefunden nach Migration!");
      process.exit(1);
    }

    // 8. Beispiel-Daten anzeigen
    const sampleData = db
      .prepare(
        `
      SELECT 
        fh.handel_nr,
        fh.typ,
        fh.kennzeichen,
        fh.verkauft_an,
        fh.kaeufer_id,
        k.name as kaeufer_name
      FROM fahrzeug_handel fh
      LEFT JOIN kunden k ON fh.kaeufer_id = k.id
      WHERE fh.typ = 'verkauf'
      LIMIT 5
    `
      )
      .all();

    console.log("\n📋 Beispiel-Daten nach Migration:");
    sampleData.forEach((row) => {
      console.log(
        `  - ${row.handel_nr} (${row.kennzeichen}): verkauft_an="${
          row.verkauft_an
        }" → kaeufer_id=${row.kaeufer_id} (${row.kaeufer_name || "Unbekannt"})`
      );
    });

    // 9. Statistiken
    const stats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as gesamt_verkaufte,
        COUNT(kaeufer_id) as mit_kaeufer_id,
        COUNT(*) - COUNT(kaeufer_id) as ohne_kaeufer_id
      FROM fahrzeug_handel 
      WHERE typ = 'verkauf' AND status = 'abgeschlossen'
    `
      )
      .get();

    console.log("\n📊 Migration-Statistiken:");
    console.log(`  - Gesamt verkaufte Fahrzeuge: ${stats.gesamt_verkaufte}`);
    console.log(`  - Mit Käufer-ID verlinkt: ${stats.mit_kaeufer_id}`);
    console.log(`  - Ohne Käufer-ID: ${stats.ohne_kaeufer_id}`);

    db.close();
    console.log("\n🎉 Käufer-ID-Migration erfolgreich abgeschlossen!");
  } catch (error) {
    console.error("❌ Migration fehlgeschlagen:", error);
    process.exit(1);
  }
}

// Migration ausführen wenn direkt aufgerufen
if (require.main === module) {
  addKaeuferIdToFahrzeughandel();
}

module.exports = { addKaeuferIdToFahrzeughandel };

// =======================================================================================
// ANWEISUNGEN:
// =======================================================================================

/*
1. Diese Datei speichern als: scripts/migration-add-kaeufer-id.js

2. Migration ausführen:
   cd your-project-folder
   node scripts/migration-add-kaeufer-id.js

3. Die Migration wird:
   ✅ kaeufer_id-Spalte zur fahrzeug_handel-Tabelle hinzufügen
   ✅ Vorhandene verkauft_an-Daten (numerische IDs) zu kaeufer_id migrieren
   ✅ Index für bessere Performance erstellen
   ✅ Foreign Key Referenz zu kunden-Tabelle erstellen
   ✅ Vollständige Validierung und Statistiken

4. Nach Migration können Sie:
   - Explizite Käufer-Queries ausführen
   - Bessere Berichte erstellen
   - Konsistente Käufer-Verwaltung nutzen

VORTEILE:
- verkauft_an kann weiterhin Text enthalten (für externe Käufer)
- kaeufer_id ist explizit für Kunden in der Datenbank
- Bessere Datenkonsistenz und Queries
- Einfachere Berichte und Auswertungen
*/

console.log("📝 Käufer-ID-Migration bereit zur Ausführung!");
