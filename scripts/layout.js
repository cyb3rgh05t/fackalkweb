#!/usr/bin/env node

/**
 * Migration Script: Layout-Editor Einstellungen hinzufügen
 *
 * Dieses Script fügt alle nötigen Layout-Einstellungen zur bestehenden
 * Datenbank hinzu, ohne die bestehenden Daten zu beeinträchtigen.
 *
 * Ausführung: node scripts/add-layout-settings.js
 */

const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// Pfad zur Datenbank
const dbPath = path.join(__dirname, "..", "data", "lackiererei.db");

console.log("🎨 Layout-Editor Einstellungen Migration");
console.log("=======================================");
console.log(`📁 Datenbank: ${dbPath}`);

// Layout-Einstellungen die hinzugefügt werden sollen
const LAYOUT_SETTINGS = [
  // Schrift und Typographie
  {
    key: "layout_font_family",
    value: "Arial, sans-serif",
    beschreibung: "Schriftart für Rechnungen und Aufträge",
  },
  {
    key: "layout_font_size_normal",
    value: "14px",
    beschreibung: "Normale Schriftgröße",
  },
  {
    key: "layout_font_size_small",
    value: "12px",
    beschreibung: "Kleine Schriftgröße für Details",
  },
  {
    key: "layout_font_size_large",
    value: "16px",
    beschreibung: "Große Schriftgröße für Beträge",
  },
  {
    key: "layout_font_size_h1",
    value: "24px",
    beschreibung: "Schriftgröße für Hauptüberschriften",
  },
  {
    key: "layout_font_size_h2",
    value: "20px",
    beschreibung: "Schriftgröße für Unterüberschriften",
  },
  {
    key: "layout_font_size_h3",
    value: "18px",
    beschreibung: "Schriftgröße für kleinere Überschriften",
  },
  {
    key: "layout_line_height",
    value: "1.5",
    beschreibung: "Zeilenhöhe für bessere Lesbarkeit",
  },
  {
    key: "layout_letter_spacing",
    value: "0px",
    beschreibung: "Zeichenabstand",
  },

  // Farben
  {
    key: "layout_color_primary",
    value: "#007bff",
    beschreibung: "Primärfarbe für Überschriften und Akzente",
  },
  {
    key: "layout_color_text",
    value: "#333333",
    beschreibung: "Haupttextfarbe",
  },
  {
    key: "layout_color_muted",
    value: "#666666",
    beschreibung: "Farbe für sekundären Text",
  },
  {
    key: "layout_color_border",
    value: "#dddddd",
    beschreibung: "Rahmenfarbe für Tabellen und Linien",
  },
  {
    key: "layout_color_background",
    value: "#ffffff",
    beschreibung: "Hintergrundfarbe",
  },
  {
    key: "layout_table_header_bg",
    value: "#f5f5f5",
    beschreibung: "Hintergrundfarbe für Tabellen-Header",
  },

  // Abstände und Margins
  {
    key: "layout_page_margin",
    value: "2cm",
    beschreibung: "Seitenabstand für normale Ansicht",
  },
  {
    key: "layout_print_margin",
    value: "1cm",
    beschreibung: "Seitenabstand beim Drucken",
  },
  {
    key: "layout_section_spacing",
    value: "2rem",
    beschreibung: "Abstand zwischen Hauptbereichen",
  },
  {
    key: "layout_paragraph_spacing",
    value: "1rem",
    beschreibung: "Abstand zwischen Absätzen",
  },
  {
    key: "layout_table_padding",
    value: "8px",
    beschreibung: "Innenabstand in Tabellenzellen",
  },
  {
    key: "layout_header_padding",
    value: "1rem",
    beschreibung: "Innenabstand im Header-Bereich",
  },

  // Logo-Einstellungen
  {
    key: "layout_logo_position",
    value: "top-left",
    beschreibung:
      "Position des Firmenlogos (top-left, top-center, top-right, center)",
  },
  {
    key: "layout_logo_max_width",
    value: "200px",
    beschreibung: "Maximale Logo-Breite",
  },
  {
    key: "layout_logo_max_height",
    value: "100px",
    beschreibung: "Maximale Logo-Höhe",
  },
  {
    key: "layout_logo_margin",
    value: "0 2rem 1rem 0",
    beschreibung: "Logo-Außenabstände",
  },

  // Header-Layout
  {
    key: "layout_header_alignment",
    value: "space-between",
    beschreibung:
      "Header-Ausrichtung (space-between, center, flex-start, flex-end)",
  },
  {
    key: "layout_header_border",
    value: "2px solid",
    beschreibung: "Header-Unterkante Rahmen",
  },

  // Tabellen-Layout
  {
    key: "layout_table_border",
    value: "1px solid #ddd",
    beschreibung: "Tabellen-Rahmen",
  },
  {
    key: "layout_table_stripe",
    value: "disabled",
    beschreibung: "Tabellen-Zeilen abwechselnd färben (enabled/disabled)",
  },
  {
    key: "layout_table_border_collapse",
    value: "collapse",
    beschreibung: "Tabellen-Rahmen-Verhalten",
  },

  // Footer-Layout
  {
    key: "layout_footer_enabled",
    value: "true",
    beschreibung: "Footer mit Bankdaten und Steuernummern anzeigen",
  },
  {
    key: "layout_footer_position",
    value: "bottom",
    beschreibung: "Footer-Position",
  },
  {
    key: "layout_footer_border_top",
    value: "true",
    beschreibung: "Obere Trennlinie im Footer anzeigen",
  },
  {
    key: "layout_footer_font_size",
    value: "12px",
    beschreibung: "Footer-Schriftgröße",
  },
  {
    key: "layout_footer_alignment",
    value: "center",
    beschreibung: "Footer-Textausrichtung (left, center, right)",
  },
  {
    key: "layout_footer_margin_top",
    value: "2rem",
    beschreibung: "Footer-Abstand von oben",
  },

  // Unterschriften-Bereich
  {
    key: "layout_signature_enabled",
    value: "true",
    beschreibung: "Unterschriften-Bereich in Aufträgen anzeigen",
  },
  {
    key: "layout_signature_height",
    value: "4cm",
    beschreibung: "Höhe der Unterschriften-Boxen",
  },
  {
    key: "layout_signature_border",
    value: "1px solid #333",
    beschreibung: "Rahmen der Unterschriften-Boxen",
  },
  {
    key: "layout_signature_margin_top",
    value: "3cm",
    beschreibung: "Abstand der Unterschriften-Sektion von oben",
  },

  // Druckoptionen
  {
    key: "layout_print_page_size",
    value: "A4",
    beschreibung: "Papierformat für Druck (A4, A3, Letter, Legal)",
  },
  {
    key: "layout_print_orientation",
    value: "portrait",
    beschreibung: "Druckausrichtung (portrait, landscape)",
  },
  {
    key: "layout_print_scale",
    value: "100%",
    beschreibung: "Druckskalierung",
  },

  // Erweiterte Druckoptionen
  {
    key: "layout_auto_print",
    value: "false",
    beschreibung: "Automatisch drucken beim Öffnen des Druckfensters",
  },
  {
    key: "layout_close_after_print",
    value: "false",
    beschreibung: "Druckfenster nach dem Drucken automatisch schließen",
  },

  // Zahlungs- und Arbeitsbedingungen
  {
    key: "zahlungsbedingungen",
    value: "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
    beschreibung: "Standard-Zahlungsbedingungen für Rechnungen",
  },
  {
    key: "gewaehrleistung",
    value: "Gewährleistung nach gesetzlichen Bestimmungen.",
    beschreibung: "Standard-Gewährleistungstext",
  },
  {
    key: "arbeitsbedingungen",
    value: "Alle Arbeiten werden nach bestem Wissen und Gewissen ausgeführt.",
    beschreibung: "Standard-Arbeitsbedingungen für Aufträge",
  },
];

// Datenbank öffnen und Migration ausführen
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
    console.log("\n🔍 Prüfe bestehende Einstellungen...");

    // Bestehende Einstellungen laden
    const existingSettings = await getExistingSettings();
    console.log(
      `📊 ${existingSettings.length} bestehende Einstellungen gefunden`
    );

    // Neue Einstellungen identifizieren
    const newSettings = LAYOUT_SETTINGS.filter(
      (setting) => !existingSettings.includes(setting.key)
    );

    console.log(
      `🆕 ${newSettings.length} neue Layout-Einstellungen werden hinzugefügt`
    );

    if (newSettings.length === 0) {
      console.log("✅ Alle Layout-Einstellungen sind bereits vorhanden");
      db.close();
      return;
    }

    // Neue Einstellungen hinzufügen
    console.log("\n📝 Füge neue Einstellungen hinzu...");

    const stmt = db.prepare(`
      INSERT INTO einstellungen (key, value, beschreibung, aktualisiert_am) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);

    let addedCount = 0;
    let errorCount = 0;

    for (const setting of newSettings) {
      try {
        await new Promise((resolve, reject) => {
          stmt.run(
            [setting.key, setting.value, setting.beschreibung],
            function (err) {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            }
          );
        });

        addedCount++;
        console.log(`✅ ${setting.key} = ${setting.value}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Fehler bei ${setting.key}:`, error.message);
      }
    }

    stmt.finalize();

    // Migration-Log erstellen
    console.log("\n📋 Migrations-Zusammenfassung:");
    console.log(`   ✅ Erfolgreich hinzugefügt: ${addedCount}`);
    console.log(`   ❌ Fehler: ${errorCount}`);
    console.log(`   📊 Gesamt verarbeitet: ${newSettings.length}`);

    if (addedCount > 0) {
      console.log("\n🎨 Layout-Editor ist jetzt verfügbar!");
      console.log("   → Öffnen Sie die Einstellungen im System");
      console.log('   → Wechseln Sie zum "Layout-Design" Tab');
      console.log("   → Passen Sie das Layout nach Ihren Wünschen an");
    }

    // Tabellen-Statistiken ausgeben
    await printDatabaseStats();
  } catch (error) {
    console.error("❌ Migration fehlgeschlagen:", error);
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

// Bestehende Einstellungs-Keys abrufen
function getExistingSettings() {
  return new Promise((resolve, reject) => {
    db.all("SELECT key FROM einstellungen", (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.map((row) => row.key));
      }
    });
  });
}

// Datenbank-Statistiken ausgeben
async function printDatabaseStats() {
  try {
    const stats = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          COUNT(*) as total_settings,
          COUNT(CASE WHEN key LIKE 'layout_%' THEN 1 END) as layout_settings,
          COUNT(CASE WHEN key LIKE 'firmen_%' THEN 1 END) as company_settings
        FROM einstellungen
      `,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    console.log("\n📊 Datenbank-Statistiken:");
    console.log(`   📝 Gesamt-Einstellungen: ${stats.total_settings}`);
    console.log(`   🎨 Layout-Einstellungen: ${stats.layout_settings}`);
    console.log(`   🏢 Firmen-Einstellungen: ${stats.company_settings}`);
  } catch (error) {
    console.error("⚠️  Fehler beim Abrufen der Statistiken:", error.message);
  }
}

// Backup-Funktion (optional)
async function createBackup() {
  const fs = require("fs");
  const backupDir = path.join(__dirname, "..", "backups");

  // Backup-Verzeichnis erstellen falls nicht vorhanden
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    `pre-layout-migration-${timestamp}.db`
  );

  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`💾 Backup erstellt: ${backupPath}`);
  } catch (error) {
    console.error("⚠️  Backup-Fehler:", error.message);
  }
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
