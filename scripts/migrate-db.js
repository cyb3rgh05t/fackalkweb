const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

console.log("🔄 Starte Migration zu erweiterten Einstellungen...");

const dbPath = path.join(__dirname, "..", "data", "lackiererei.db");

if (!fs.existsSync(dbPath)) {
  console.error(
    "❌ Keine bestehende Datenbank gefunden. Führen Sie 'npm run init-db' aus."
  );
  process.exit(1);
}

// Backup erstellen
const backupPath = path.join(
  __dirname,
  "..",
  "data",
  `lackiererei_backup_${Date.now()}.db`
);
fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Backup erstellt: ${backupPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Fehler beim Öffnen der Datenbank:", err.message);
    process.exit(1);
  } else {
    console.log("✅ Datenbankverbindung hergestellt");
    startMigration();
  }
});

function startMigration() {
  console.log("📋 Prüfe bestehende Einstellungen...");

  // Bestehende Einstellungen laden
  db.all(
    "SELECT key, value FROM einstellungen",
    [],
    (err, existingSettings) => {
      if (err) {
        console.error(
          "❌ Fehler beim Laden bestehender Einstellungen:",
          err.message
        );
        process.exit(1);
      }

      const existing = {};
      existingSettings.forEach((setting) => {
        existing[setting.key] = setting.value;
      });

      console.log(
        `📊 ${existingSettings.length} bestehende Einstellungen gefunden`
      );

      // Neue Einstellungen definieren
      const newSettings = [
        // Firmendaten (erweitert)
        ["rechtsform", "", "Rechtsform der Firma"],
        ["geschaeftsfuehrer", "", "Name des Geschäftsführers"],
        [
          "firmen_strasse",
          existing.firmen_adresse?.split("\n")[0] || "",
          "Firmen-Straße und Hausnummer",
        ],
        ["firmen_plz", "12345", "Firmen-PLZ"],
        ["firmen_ort", "Musterstadt", "Firmen-Ort"],
        ["firmen_fax", "", "Firmen-Faxnummer"],
        ["firmen_website", "", "Firmen-Website"],
        ["steuernummer", "", "Steuernummer der Firma"],
        ["umsatzsteuer_id", "", "Umsatzsteuer-Identifikationsnummer"],
        ["firmen_logo", "", "Base64-kodiertes Firmenlogo"],

        // Bankverbindung
        ["bank_name", "", "Name der Bank"],
        ["bank_iban", "", "IBAN"],
        ["bank_bic", "", "BIC"],

        // Leistungen & Preise (migriere basis_stundenpreis)
        ["anfahrtspauschale", "0.00", "Anfahrtspauschale in Euro"],
        ["mindestauftragswert", "0.00", "Mindestauftragswert in Euro"],
        [
          "standard_arbeitszeit",
          "8.0",
          "Standard Arbeitszeit pro Tag in Stunden",
        ],
        ["express_zuschlag", "20", "Express-Zuschlag in Prozent"],
        ["wochenend_zuschlag", "30", "Wochenend-Zuschlag in Prozent"],

        // Rechnungseinstellungen (konsolidiere MwSt)
        [
          "mwst_satz",
          existing.mwst_standard || "19",
          "Mehrwertsteuersatz in Prozent",
        ],
        ["skonto_tage", "10", "Skonto-Tage"],
        ["skonto_prozent", "2.0", "Skonto-Prozentsatz"],
        ["zahlungsziel_tage", "14", "Zahlungsziel in Tagen"],
        ["rechnungshinweise", "", "Zusätzliche Hinweise für Rechnungen"],

        // Auftragseinstellungen
        [
          "standard_bearbeitungszeit",
          "5",
          "Standard Bearbeitungszeit in Tagen",
        ],
        [
          "auto_status_update",
          "0",
          "Automatische Status-Aktualisierung (0=aus, 1=an)",
        ],
        [
          "email_benachrichtigung",
          "0",
          "E-Mail-Benachrichtigung bei neuen Aufträgen (0=aus, 1=an)",
        ],
        [
          "benachrichtigung_email",
          existing.firmen_email || "",
          "E-Mail-Adresse für Benachrichtigungen",
        ],
        [
          "standard_arbeitsschritte",
          "Demontage/Vorbereitung\nSchleifen/Spachteln\nGrundierung\nZwischenschliff\nBasislack\nKlarlack\nPolieren/Finish\nMontage",
          "Standard Arbeitsschritte",
        ],
      ];

      // Spezielle Migrationen
      const migrations = [
        // Firmenadresse aufteilen
        {
          check: () => existing.firmen_adresse,
          migrate: () => {
            const adressParts = existing.firmen_adresse.split("\n");
            return [
              [
                "firmen_strasse",
                adressParts[0] || "",
                "Firmen-Straße und Hausnummer",
              ],
              ["firmen_plz", adressParts[1]?.split(" ")[0] || "", "Firmen-PLZ"],
              [
                "firmen_ort",
                adressParts[1]?.split(" ").slice(1).join(" ") || "",
                "Firmen-Ort",
              ],
            ];
          },
        },

        // MwSt-Sätze konsolidieren
        {
          check: () => existing.mwst_standard,
          migrate: () => [
            [
              "mwst_satz",
              existing.mwst_standard,
              "Mehrwertsteuersatz in Prozent",
            ],
          ],
        },
      ];

      // Führe Migrationen aus
      console.log("🔄 Führe spezielle Migrationen aus...");
      let additionalSettings = [];

      migrations.forEach((migration) => {
        if (migration.check()) {
          additionalSettings = additionalSettings.concat(migration.migrate());
          console.log(
            `✅ Migration ausgeführt: ${migration
              .migrate()
              .map((s) => s[0])
              .join(", ")}`
          );
        }
      });

      // Alle neuen Einstellungen kombinieren
      const allNewSettings = [...newSettings, ...additionalSettings];

      // Füge nur nicht-existierende Einstellungen hinzu
      const settingsToAdd = allNewSettings.filter(
        ([key]) => !existing.hasOwnProperty(key)
      );

      console.log(
        `📥 ${settingsToAdd.length} neue Einstellungen werden hinzugefügt...`
      );

      if (settingsToAdd.length === 0) {
        console.log(
          "✅ Alle Einstellungen bereits vorhanden. Migration abgeschlossen."
        );
        db.close();
        return;
      }

      // Neue Einstellungen einfügen
      const stmt = db.prepare(
        "INSERT INTO einstellungen (key, value, beschreibung) VALUES (?, ?, ?)"
      );

      let addedCount = 0;
      settingsToAdd.forEach((setting, index) => {
        stmt.run(setting, (err) => {
          addedCount++;
          if (err) {
            console.error(
              `❌ Fehler bei Einstellung ${setting[0]}:`,
              err.message
            );
          } else {
            console.log(`✅ Hinzugefügt: ${setting[0]} = ${setting[1]}`);
          }

          if (addedCount === settingsToAdd.length) {
            stmt.finalize();

            // Veraltete Einstellungen als deprecated markieren
            markDeprecatedSettings(existing);
          }
        });
      });
    }
  );
}

function markDeprecatedSettings(existing) {
  console.log("🗑️  Markiere veraltete Einstellungen...");

  const deprecatedSettings = [
    "mwst_ermaessigt", // Ersetzt durch einheitlichen mwst_satz
    "firmen_adresse", // Aufgeteilt in einzelne Felder
  ];

  let deprecatedCount = 0;
  const updateStmt = db.prepare(
    "UPDATE einstellungen SET beschreibung = ? WHERE key = ?"
  );

  deprecatedSettings.forEach((key) => {
    if (existing.hasOwnProperty(key)) {
      updateStmt.run(
        [
          `[DEPRECATED] ${existing[key]} - Ersetzt durch neue Einstellungsstruktur`,
          key,
        ],
        (err) => {
          deprecatedCount++;
          if (!err) {
            console.log(`⚠️  Markiert als deprecated: ${key}`);
          }

          if (
            deprecatedCount ===
            deprecatedSettings.filter((k) => existing.hasOwnProperty(k)).length
          ) {
            updateStmt.finalize();
            validateMigration();
          }
        }
      );
    }
  });

  if (
    deprecatedSettings.filter((k) => existing.hasOwnProperty(k)).length === 0
  ) {
    validateMigration();
  }
}

function validateMigration() {
  console.log("🔍 Validiere Migration...");

  db.all("SELECT COUNT(*) as count FROM einstellungen", [], (err, result) => {
    if (err) {
      console.error("❌ Fehler bei Validierung:", err.message);
      process.exit(1);
    }

    const totalSettings = result[0].count;
    console.log(`📊 Gesamtzahl Einstellungen nach Migration: ${totalSettings}`);

    // Prüfe kritische Einstellungen
    const criticalSettings = ["firmenname", "basis_stundenpreis", "mwst_satz"];

    db.all(
      "SELECT key, value FROM einstellungen WHERE key IN ('" +
        criticalSettings.join("','") +
        "')",
      [],
      (err, critical) => {
        if (err) {
          console.error("❌ Fehler bei kritischen Einstellungen:", err.message);
          process.exit(1);
        }

        console.log("🔧 Kritische Einstellungen:");
        critical.forEach((setting) => {
          console.log(`   ${setting.key}: ${setting.value}`);
        });

        if (critical.length === criticalSettings.length) {
          console.log("✅ Alle kritischen Einstellungen vorhanden");
        } else {
          console.warn(
            "⚠️  Einige kritische Einstellungen fehlen möglicherweise"
          );
        }

        finishMigration();
      }
    );
  });
}

function finishMigration() {
  console.log("🎉 Migration erfolgreich abgeschlossen!");
  console.log("");
  console.log("📋 Nächste Schritte:");
  console.log("   1. Starten Sie den Server: npm start");
  console.log("   2. Öffnen Sie die Einstellungen im Browser");
  console.log("   3. Überprüfen und vervollständigen Sie Ihre Firmendaten");
  console.log("   4. Laden Sie Ihr Firmenlogo hoch");
  console.log(
    "   5. Testen Sie die automatische Integration in Aufträgen und Rechnungen"
  );
  console.log("");
  console.log(`💾 Backup verfügbar unter: ${backupPath}`);
  console.log("⚠️  Bei Problemen können Sie das Backup wiederherstellen");

  db.close((err) => {
    if (err) {
      console.error("❌ Fehler beim Schließen der Datenbank:", err.message);
    } else {
      console.log("✅ Datenbankverbindung geschlossen");
    }
    process.exit(0);
  });
}

// Fehlerbehandlung
process.on("SIGINT", () => {
  console.log("\n🛑 Migration abgebrochen...");
  db.close();
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Unbehandelter Fehler:", err.message);
  db.close();
  process.exit(1);
});
