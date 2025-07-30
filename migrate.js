// migration-skonto-anfahrt.js
// Einmal ausführen mit: node migration-skonto-anfahrt.js

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "data", "kfz.db");
const db = new sqlite3.Database(dbPath);

console.log("🔄 Starte Migration für Skonto-Checkbox...");

// Migration ausführen
db.serialize(() => {
  // Felder hinzufügen
  const migrations = [
    "ALTER TABLE rechnungen ADD COLUMN skonto_aktiv BOOLEAN DEFAULT 0",
    "ALTER TABLE rechnungen ADD COLUMN skonto_betrag DECIMAL(10,2) DEFAULT 0",
  ];

  let completed = 0;
  let hasErrors = false;

  migrations.forEach((sql, index) => {
    db.run(sql, (err) => {
      completed++;

      if (err && !err.message.includes("duplicate column name")) {
        console.error(`❌ Migration ${index + 1} fehlgeschlagen:`, err.message);
        hasErrors = true;
      } else if (err && err.message.includes("duplicate column name")) {
        console.log(
          `✅ Migration ${index + 1} bereits vorhanden (übersprungen)`
        );
      } else {
        console.log(`✅ Migration ${index + 1} erfolgreich`);
      }

      // Wenn alle Migrationen abgeschlossen sind
      if (completed === migrations.length) {
        db.close((err) => {
          if (err) {
            console.error("❌ Fehler beim Schließen der DB:", err);
          } else {
            if (hasErrors) {
              console.log("⚠️ Migration mit Fehlern abgeschlossen!");
            } else {
              console.log(
                "✅ Migration erfolgreich abgeschlossen! Du kannst jetzt den Server neu starten."
              );
            }
          }
        });
      }
    });
  });
});
