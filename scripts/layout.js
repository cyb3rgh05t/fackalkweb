#!/usr/bin/env node

/**
 * Migration Script: Auftrag-Positionen Spalten-Fix
 *
 * Behebt die Inkonsistenz in der auftrag_positionen Tabelle
 * - Ändert Spalte "kosten" zu "gesamt" falls nötig
 *
 * Ausführung: node scripts/fix-auftrag-positionen.js
 */

const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

// Pfad zur Datenbank
const dbPath = path.join(__dirname, "..", "data", "lackiererei.db");

console.log("🔧 Auftrag-Positionen Spalten-Migration");
console.log("======================================");
console.log(`📁 Datenbank: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error(
    "❌ Datenbank nicht gefunden! Führen Sie zuerst 'npm run setup' aus."
  );
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Fehler beim Öffnen der Datenbank:", err.message);
    process.exit(1);
  }

  console.log("✅ Datenbankverbindung hergestellt");
  runMigration();
});

async function runMigration() {
  try {
    console.log("\n🔍 Prüfe Tabellen-Struktur...");

    // Tabellen-Schema abrufen
    const tableInfo = await getTableInfo();

    const hasKostenColumn = tableInfo.some((col) => col.name === "kosten");
    const hasGesamtColumn = tableInfo.some((col) => col.name === "gesamt");

    console.log(
      `📊 Gefundene Spalten: ${tableInfo.map((col) => col.name).join(", ")}`
    );

    if (hasGesamtColumn && !hasKostenColumn) {
      console.log("✅ Tabelle ist bereits korrekt! Spalte 'gesamt' existiert.");
      db.close();
      return;
    }

    if (hasKostenColumn && !hasGesamtColumn) {
      console.log("🔄 Migration erforderlich: 'kosten' → 'gesamt'");
      await migrateKostenToGesamt();
    } else if (hasKostenColumn && hasGesamtColumn) {
      console.log(
        "⚠️  Beide Spalten existieren! Verwende 'gesamt' und entferne 'kosten'"
      );
      await removeKostenColumn();
    } else {
      console.log("❌ Weder 'kosten' noch 'gesamt' Spalte gefunden!");
      await addGesamtColumn();
    }
  } catch (error) {
    console.error("❌ Migration fehlgeschlagen:", error.message);
  } finally {
    db.close((err) => {
      if (err) {
        console.error("❌ Fehler beim Schließen der Datenbank:", err.message);
      } else {
        console.log("\n✅ Datenbankverbindung geschlossen");
        console.log("🚀 Migration abgeschlossen!");
      }
    });
  }
}

// Tabellen-Schema abrufen
function getTableInfo() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(auftrag_positionen)", (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Migration: kosten → gesamt
async function migrateKostenToGesamt() {
  console.log("📝 Erstelle Backup...");

  // Backup erstellen
  const backupPath = path.join(
    path.dirname(dbPath),
    `backup_before_column_fix_${Date.now()}.db`
  );
  fs.copyFileSync(dbPath, backupPath);
  console.log(`💾 Backup erstellt: ${backupPath}`);

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log("🔄 Beginne Spalten-Migration...");

      // 1. Neue Tabelle mit korrekter Struktur erstellen
      db.run(
        `
        CREATE TABLE auftrag_positionen_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          auftrag_id INTEGER,
          beschreibung TEXT NOT NULL,
          stundenpreis DECIMAL(10,2),
          zeit DECIMAL(10,2),
          einheit TEXT DEFAULT 'Std.',
          gesamt DECIMAL(10,2),
          reihenfolge INTEGER,
          FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE CASCADE
        )
      `,
        (err) => {
          if (err) {
            console.error(
              "❌ Fehler beim Erstellen der neuen Tabelle:",
              err.message
            );
            reject(err);
            return;
          }
          console.log("✅ Neue Tabelle erstellt");

          // 2. Daten kopieren (kosten → gesamt)
          db.run(
            `
          INSERT INTO auftrag_positionen_new 
          (id, auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge)
          SELECT id, auftrag_id, beschreibung, stundenpreis, zeit, einheit, kosten, reihenfolge 
          FROM auftrag_positionen
        `,
            (err) => {
              if (err) {
                console.error(
                  "❌ Fehler beim Kopieren der Daten:",
                  err.message
                );
                reject(err);
                return;
              }
              console.log("✅ Daten kopiert");

              // 3. Alte Tabelle löschen
              db.run("DROP TABLE auftrag_positionen", (err) => {
                if (err) {
                  console.error(
                    "❌ Fehler beim Löschen der alten Tabelle:",
                    err.message
                  );
                  reject(err);
                  return;
                }
                console.log("✅ Alte Tabelle entfernt");

                // 4. Neue Tabelle umbenennen
                db.run(
                  "ALTER TABLE auftrag_positionen_new RENAME TO auftrag_positionen",
                  (err) => {
                    if (err) {
                      console.error(
                        "❌ Fehler beim Umbenennen der Tabelle:",
                        err.message
                      );
                      reject(err);
                      return;
                    }
                    console.log("✅ Tabelle umbenannt");
                    console.log("🎉 Migration erfolgreich abgeschlossen!");
                    resolve();
                  }
                );
              });
            }
          );
        }
      );
    });
  });
}

// kosten-Spalte entfernen (falls beide existieren)
async function removeKostenColumn() {
  console.log("🧹 Entferne überflüssige 'kosten' Spalte...");

  return new Promise((resolve, reject) => {
    // SQLite unterstützt kein DROP COLUMN, daher Tabelle neu erstellen
    db.serialize(() => {
      // 1. Temporäre Tabelle erstellen
      db.run(
        `
        CREATE TABLE auftrag_positionen_temp AS 
        SELECT id, auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge 
        FROM auftrag_positionen
      `,
        (err) => {
          if (err) {
            reject(err);
            return;
          }

          // 2. Alte Tabelle löschen
          db.run("DROP TABLE auftrag_positionen", (err) => {
            if (err) {
              reject(err);
              return;
            }

            // 3. Tabelle mit korrekter Struktur erstellen
            db.run(
              `
            CREATE TABLE auftrag_positionen (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              auftrag_id INTEGER,
              beschreibung TEXT NOT NULL,
              stundenpreis DECIMAL(10,2),
              zeit DECIMAL(10,2),
              einheit TEXT DEFAULT 'Std.',
              gesamt DECIMAL(10,2),
              reihenfolge INTEGER,
              FOREIGN KEY (auftrag_id) REFERENCES auftraege (id) ON DELETE CASCADE
            )
          `,
              (err) => {
                if (err) {
                  reject(err);
                  return;
                }

                // 4. Daten zurückkopieren
                db.run(
                  `
              INSERT INTO auftrag_positionen 
              SELECT * FROM auftrag_positionen_temp
            `,
                  (err) => {
                    if (err) {
                      reject(err);
                      return;
                    }

                    // 5. Temporäre Tabelle löschen
                    db.run("DROP TABLE auftrag_positionen_temp", (err) => {
                      if (err) {
                        console.warn(
                          "⚠️  Konnte temporäre Tabelle nicht löschen:",
                          err.message
                        );
                      }
                      console.log("✅ Überflüssige 'kosten' Spalte entfernt");
                      resolve();
                    });
                  }
                );
              }
            );
          });
        }
      );
    });
  });
}

// gesamt-Spalte hinzufügen (falls keine existiert)
async function addGesamtColumn() {
  console.log("➕ Füge fehlende 'gesamt' Spalte hinzu...");

  return new Promise((resolve, reject) => {
    db.run(
      "ALTER TABLE auftrag_positionen ADD COLUMN gesamt DECIMAL(10,2) DEFAULT 0",
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        console.log("✅ 'gesamt' Spalte hinzugefügt");
        resolve();
      }
    );
  });
}

// Fehlerbehandlung
process.on("uncaughtException", (error) => {
  console.error("❌ Unbehandelter Fehler:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unbehandelte Promise-Ablehnung:", reason);
  process.exit(1);
});

// Graceful Exit
process.on("SIGINT", () => {
  console.log("\n⚠️  Migration unterbrochen durch Benutzer");
  db.close();
  process.exit(0);
});

console.log("⏳ Migration wird gestartet...\n");
