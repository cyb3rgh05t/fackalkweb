// models/einstellung.js
class Einstellung {
  constructor() {
    this.db = null;
  }

  // Multi-Tenant: DB-Verbindung setzen
  static setDb(userDb) {
    this.db = userDb;
  }

  // Standard-DB falls keine User-DB gesetzt
  static getDb() {
    return this.db || require("../db");
  }

  // Alle Einstellungen laden
  static findAll() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = "SELECT * FROM einstellungen ORDER BY key ASC";

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden aller Einstellungen:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Einzelne Einstellung laden
  static findByKey(key) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = "SELECT * FROM einstellungen WHERE key = ?";

      db.get(sql, [key], (err, row) => {
        if (err) {
          console.error("Fehler beim Laden der Einstellung:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Einstellungen als Key-Value Objekt
  static getAsObject() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = "SELECT key, value FROM einstellungen";

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Einstellungen als Objekt:", err);
          reject(err);
        } else {
          const settings = {};
          (rows || []).forEach((row) => {
            settings[row.key] = row.value;
          });
          resolve(settings);
        }
      });
    });
  }

  // Einzelne Einstellung erstellen oder aktualisieren
  static update(key, value, beschreibung = null) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      if (!key) {
        return reject(new Error("Schlüssel ist erforderlich"));
      }

      const sql = `
        INSERT OR REPLACE INTO einstellungen (key, value, beschreibung, aktualisiert_am)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `;

      db.run(sql, [key, value, beschreibung], function (err) {
        if (err) {
          console.error("Fehler beim Speichern der Einstellung:", err);
          reject(err);
        } else {
          resolve({
            key,
            value,
            beschreibung,
            changes: this.changes,
          });
        }
      });
    });
  }

  // Mehrere Einstellungen auf einmal aktualisieren
  static updateMultiple(settings) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      if (!settings || typeof settings !== "object") {
        return reject(new Error("Einstellungen müssen ein Objekt sein"));
      }

      const keys = Object.keys(settings);
      if (keys.length === 0) {
        return resolve({ updated: 0 });
      }

      // Transaktion starten
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const sql = `
          INSERT OR REPLACE INTO einstellungen (key, value, aktualisiert_am)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `;

        let completed = 0;
        let hasError = false;

        keys.forEach((key) => {
          if (hasError) return;

          db.run(sql, [key, settings[key]], (err) => {
            if (err && !hasError) {
              console.error("Fehler beim Aktualisieren der Einstellung:", err);
              hasError = true;
              db.run("ROLLBACK");
              return reject(err);
            }

            completed++;

            if (completed === keys.length) {
              db.run("COMMIT", (err) => {
                if (err) {
                  console.error("Fehler beim Commit:", err);
                  return reject(err);
                }

                resolve({
                  updated: keys.length,
                  keys: keys,
                });
              });
            }
          });
        });
      });
    });
  }

  // Einstellung löschen
  static remove(key) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = "DELETE FROM einstellungen WHERE key = ?";

      db.run(sql, [key], function (err) {
        if (err) {
          console.error("Fehler beim Löschen der Einstellung:", err);
          reject(err);
        } else {
          resolve({
            changes: this.changes,
            success: this.changes > 0,
          });
        }
      });
    });
  }

  // Einstellungen nach Präfix laden
  static findByPrefix(prefix) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql =
        "SELECT * FROM einstellungen WHERE key LIKE ? ORDER BY key ASC";

      db.all(sql, [`${prefix}%`], (err, rows) => {
        if (err) {
          console.error(
            "Fehler beim Laden der Einstellungen nach Präfix:",
            err
          );
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Standard-Einstellungen initialisieren
  static initializeDefaults() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const defaultSettings = [
        {
          key: "firmen_name",
          value: "FAF Lackiererei",
          beschreibung: "Name der Firma",
        },
        {
          key: "firmen_strasse",
          value: "",
          beschreibung: "Straße und Hausnummer",
        },
        {
          key: "firmen_plz",
          value: "",
          beschreibung: "Postleitzahl",
        },
        {
          key: "firmen_ort",
          value: "",
          beschreibung: "Ort",
        },
        {
          key: "firmen_telefon",
          value: "",
          beschreibung: "Telefonnummer",
        },
        {
          key: "firmen_email",
          value: "",
          beschreibung: "E-Mail-Adresse",
        },
        {
          key: "firmen_website",
          value: "",
          beschreibung: "Website",
        },
        {
          key: "firmen_logo",
          value: "",
          beschreibung: "Firmen-Logo (Base64)",
        },
        {
          key: "mwst_satz",
          value: "19",
          beschreibung: "Mehrwertsteuersatz in Prozent",
        },
        {
          key: "basis_stundenpreis",
          value: "110.00",
          beschreibung: "Standard-Stundenpreis",
        },
        {
          key: "waehrung",
          value: "EUR",
          beschreibung: "Währung",
        },
        {
          key: "zahlungsbedingungen",
          value: "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
          beschreibung: "Standard-Zahlungsbedingungen",
        },
        {
          key: "gewaehrleistung",
          value: "Auf alle Arbeiten gewähren wir 2 Jahre Gewährleistung.",
          beschreibung: "Standard-Gewährleistungstext",
        },
        {
          key: "layout_theme",
          value: "default",
          beschreibung: "Design-Theme",
        },
        {
          key: "layout_color_primary",
          value: "#2563eb",
          beschreibung: "Primärfarbe",
        },
        {
          key: "layout_color_secondary",
          value: "#64748b",
          beschreibung: "Sekundärfarbe",
        },
        {
          key: "layout_font_size_normal",
          value: "14px",
          beschreibung: "Standard-Schriftgröße",
        },
        {
          key: "backup_auto_enabled",
          value: "true",
          beschreibung: "Automatische Backups aktiviert",
        },
        {
          key: "backup_interval_days",
          value: "7",
          beschreibung: "Backup-Intervall in Tagen",
        },
      ];

      // Transaktion für alle Standard-Einstellungen
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const sql = `
          INSERT OR IGNORE INTO einstellungen (key, value, beschreibung)
          VALUES (?, ?, ?)
        `;

        let completed = 0;
        let hasError = false;

        defaultSettings.forEach((setting) => {
          if (hasError) return;

          db.run(
            sql,
            [setting.key, setting.value, setting.beschreibung],
            (err) => {
              if (err && !hasError) {
                console.error(
                  "Fehler beim Initialisieren der Standard-Einstellungen:",
                  err
                );
                hasError = true;
                db.run("ROLLBACK");
                return reject(err);
              }

              completed++;

              if (completed === defaultSettings.length) {
                db.run("COMMIT", (err) => {
                  if (err) {
                    console.error("Fehler beim Commit:", err);
                    return reject(err);
                  }

                  resolve({
                    initialized: defaultSettings.length,
                    settings: defaultSettings.map((s) => s.key),
                  });
                });
              }
            }
          );
        });
      });
    });
  }

  // Einstellungen exportieren
  static export() {
    return new Promise((resolve, reject) => {
      this.findAll()
        .then((settings) => {
          const exportData = {
            exported_at: new Date().toISOString(),
            version: "1.0",
            settings: {},
          };

          settings.forEach((setting) => {
            exportData.settings[setting.key] = {
              value: setting.value,
              beschreibung: setting.beschreibung,
            };
          });

          resolve(exportData);
        })
        .catch(reject);
    });
  }

  // Einstellungen importieren
  static import(importData) {
    return new Promise((resolve, reject) => {
      if (!importData || !importData.settings) {
        return reject(new Error("Ungültiges Import-Format"));
      }

      const settings = {};
      Object.keys(importData.settings).forEach((key) => {
        settings[key] = importData.settings[key].value;
      });

      this.updateMultiple(settings)
        .then((result) => {
          resolve({
            imported: result.updated,
            source_version: importData.version,
            imported_at: new Date().toISOString(),
          });
        })
        .catch(reject);
    });
  }

  // Einstellungen auf Standard zurücksetzen
  static reset() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Alle Einstellungen löschen
        db.run("DELETE FROM einstellungen", (err) => {
          if (err) {
            console.error("Fehler beim Löschen der Einstellungen:", err);
            db.run("ROLLBACK");
            return reject(err);
          }

          // Standard-Einstellungen neu erstellen
          this.initializeDefaults()
            .then(() => {
              db.run("COMMIT", (err) => {
                if (err) {
                  console.error("Fehler beim Commit:", err);
                  return reject(err);
                }

                resolve({
                  reset: true,
                  message: "Einstellungen auf Standard zurückgesetzt",
                });
              });
            })
            .catch((err) => {
              db.run("ROLLBACK");
              reject(err);
            });
        });
      });
    });
  }

  // Validierung für bestimmte Einstellungen
  static validate(key, value) {
    const validationRules = {
      mwst_satz: {
        type: "number",
        min: 0,
        max: 25,
        message: "MwSt-Satz muss zwischen 0 und 25% liegen",
      },
      basis_stundenpreis: {
        type: "number",
        min: 0,
        max: 1000,
        message: "Stundenpreis muss zwischen 0 und 1000 liegen",
      },
      layout_color_primary: {
        type: "color",
        message: "Muss eine gültige Hex-Farbe sein (#000000)",
      },
      layout_color_secondary: {
        type: "color",
        message: "Muss eine gültige Hex-Farbe sein (#000000)",
      },
      backup_interval_days: {
        type: "integer",
        min: 1,
        max: 365,
        message: "Backup-Intervall muss zwischen 1 und 365 Tagen liegen",
      },
    };

    const rule = validationRules[key];
    if (!rule) {
      return { valid: true };
    }

    switch (rule.type) {
      case "number":
      case "integer":
        const num = parseFloat(value);
        if (isNaN(num)) {
          return { valid: false, message: "Muss eine Zahl sein" };
        }
        if (rule.min !== undefined && num < rule.min) {
          return { valid: false, message: rule.message };
        }
        if (rule.max !== undefined && num > rule.max) {
          return { valid: false, message: rule.message };
        }
        if (rule.type === "integer" && !Number.isInteger(num)) {
          return { valid: false, message: "Muss eine ganze Zahl sein" };
        }
        break;

      case "color":
        if (!/^#[0-9A-F]{6}$/i.test(value)) {
          return { valid: false, message: rule.message };
        }
        break;
    }

    return { valid: true };
  }
}

module.exports = Einstellung;
