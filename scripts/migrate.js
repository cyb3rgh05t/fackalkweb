// scripts/migrate-auftraege-zuschlaege.js
// Migration um Zuschlag-Felder zur auftraege Tabelle hinzuzufügen

const Database = require("better-sqlite3");
const path = require("path");

function log(message, color = "white") {
  const colors = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    reset: "\x1b[0m",
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function migrateAuftraegeZuschlaege() {
  const dbPath = path.join(__dirname, "..", "data", "kfz.db");

  try {
    const db = new Database(dbPath);

    log("🔄 Starte Migration: Zuschlag-Felder zu Aufträgen...", "cyan");

    // Prüfen ob Migration bereits durchgeführt wurde
    const existingColumns = db.prepare("PRAGMA table_info(auftraege)").all();
    const columnNames = existingColumns.map((col) => col.name);

    if (columnNames.includes("anfahrt_aktiv")) {
      log(
        "ℹ️ Migration bereits durchgeführt - Zuschlag-Felder existieren bereits",
        "yellow"
      );
      db.close();
      return;
    }

    // Neue Spalten hinzufügen
    const newColumns = [
      "ADD COLUMN anfahrt_aktiv BOOLEAN DEFAULT 0",
      "ADD COLUMN express_aktiv BOOLEAN DEFAULT 0",
      "ADD COLUMN wochenend_aktiv BOOLEAN DEFAULT 0",
      "ADD COLUMN anfahrt_betrag DECIMAL(10,2) DEFAULT 0",
      "ADD COLUMN express_betrag DECIMAL(10,2) DEFAULT 0",
      "ADD COLUMN wochenend_betrag DECIMAL(10,2) DEFAULT 0",
      "ADD COLUMN arbeitszeiten_kosten DECIMAL(10,2) DEFAULT 0",
    ];

    let addedColumns = 0;

    newColumns.forEach((columnDef) => {
      try {
        db.prepare(`ALTER TABLE auftraege ${columnDef}`).run();
        addedColumns++;
        log(`✅ Spalte hinzugefügt: ${columnDef}`, "green");
      } catch (error) {
        if (error.message.includes("duplicate column name")) {
          log(`⚠️ Spalte existiert bereits: ${columnDef}`, "yellow");
        } else {
          log(`❌ Fehler bei Spalte: ${columnDef} - ${error.message}`, "red");
          throw error;
        }
      }
    });

    // Bestehende Aufträge aktualisieren - arbeitszeiten_kosten setzen
    const updateQuery = `
      UPDATE auftraege 
      SET arbeitszeiten_kosten = gesamt_kosten 
      WHERE arbeitszeiten_kosten = 0 OR arbeitszeiten_kosten IS NULL
    `;

    const updateResult = db.prepare(updateQuery).run();
    log(`✅ ${updateResult.changes} bestehende Aufträge aktualisiert`, "green");

    db.close();

    log(`🎉 Migration erfolgreich abgeschlossen!`, "green");
    log(`📊 ${addedColumns} neue Spalten hinzugefügt`, "cyan");
    log(`📝 ${updateResult.changes} Aufträge aktualisiert`, "cyan");
  } catch (error) {
    log(`❌ Migration fehlgeschlagen: ${error.message}`, "red");
    process.exit(1);
  }
}

// Script direkt ausführen wenn aufgerufen
if (require.main === module) {
  migrateAuftraegeZuschlaege();
}

module.exports = migrateAuftraegeZuschlaege;
