// models/fahrzeug.js
class Fahrzeug {
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

  // Alle Fahrzeuge laden (optional nach Kunde filtern)
  static findAll(kundenId = null) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      let sql = `
        SELECT f.*, 
               k.name as kunde_name,
               k.kunden_nr,
               COUNT(a.id) as auftraege_count
        FROM fahrzeuge f
        LEFT JOIN kunden k ON f.kunden_id = k.id
        LEFT JOIN auftraege a ON f.id = a.fahrzeug_id
      `;

      const params = [];

      if (kundenId) {
        sql += " WHERE f.kunden_id = ?";
        params.push(kundenId);
      }

      sql += " GROUP BY f.id ORDER BY k.name ASC, f.kennzeichen ASC";

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Fahrzeuge:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Fahrzeug per ID laden
  static findById(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT f.*, 
               k.name as kunde_name,
               k.kunden_nr,
               k.strasse,
               k.plz,
               k.ort,
               k.telefon,
               COUNT(a.id) as auftraege_count
        FROM fahrzeuge f
        LEFT JOIN kunden k ON f.kunden_id = k.id
        LEFT JOIN auftraege a ON f.id = a.fahrzeug_id
        WHERE f.id = ?
        GROUP BY f.id
      `;

      db.get(sql, [id], (err, row) => {
        if (err) {
          console.error("Fehler beim Laden des Fahrzeugs:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Neues Fahrzeug erstellen
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const {
        kunden_id,
        kennzeichen,
        marke = "",
        modell = "",
        vin = "",
        baujahr = null,
        farbe = "",
        farbcode = "",
      } = data;

      // Validierung
      if (!kunden_id || !kennzeichen) {
        return reject(new Error("Kunden-ID und Kennzeichen sind erforderlich"));
      }

      // Prüfen ob Kunde existiert
      db.get(
        "SELECT id FROM kunden WHERE id = ?",
        [kunden_id],
        (err, kunde) => {
          if (err) {
            console.error("Fehler beim Prüfen des Kunden:", err);
            return reject(err);
          }

          if (!kunde) {
            return reject(new Error("Kunde nicht gefunden"));
          }

          const sql = `
          INSERT INTO fahrzeuge (kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

          db.run(
            sql,
            [
              kunden_id,
              kennzeichen,
              marke,
              modell,
              vin,
              baujahr,
              farbe,
              farbcode,
            ],
            function (err) {
              if (err) {
                console.error("Fehler beim Erstellen des Fahrzeugs:", err);

                if (err.message.includes("UNIQUE constraint failed")) {
                  reject(new Error("Kennzeichen bereits vergeben"));
                } else {
                  reject(err);
                }
              } else {
                const newFahrzeug = {
                  id: this.lastID,
                  kunden_id,
                  kennzeichen,
                  marke,
                  modell,
                  vin,
                  baujahr,
                  farbe,
                  farbcode,
                  auftraege_count: 0,
                };

                resolve(newFahrzeug);
              }
            }
          );
        }
      );
    });
  }

  // Fahrzeug aktualisieren
  static update(id, data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const {
        kunden_id,
        kennzeichen,
        marke = "",
        modell = "",
        vin = "",
        baujahr = null,
        farbe = "",
        farbcode = "",
      } = data;

      if (!kennzeichen) {
        return reject(new Error("Kennzeichen ist erforderlich"));
      }

      // Prüfen ob neuer Kunde existiert (falls geändert)
      if (kunden_id) {
        db.get(
          "SELECT id FROM kunden WHERE id = ?",
          [kunden_id],
          (err, kunde) => {
            if (err) {
              console.error("Fehler beim Prüfen des Kunden:", err);
              return reject(err);
            }

            if (!kunde) {
              return reject(new Error("Kunde nicht gefunden"));
            }

            updateFahrzeug();
          }
        );
      } else {
        updateFahrzeug();
      }

      function updateFahrzeug() {
        let sql = `
          UPDATE fahrzeuge 
          SET kennzeichen = ?, marke = ?, modell = ?, vin = ?, baujahr = ?, farbe = ?, farbcode = ?
        `;

        const params = [
          kennzeichen,
          marke,
          modell,
          vin,
          baujahr,
          farbe,
          farbcode,
        ];

        if (kunden_id) {
          sql += ", kunden_id = ?";
          params.push(kunden_id);
        }

        sql += " WHERE id = ?";
        params.push(id);

        db.run(sql, params, function (err) {
          if (err) {
            console.error("Fehler beim Aktualisieren des Fahrzeugs:", err);
            reject(err);
          } else {
            resolve({
              changes: this.changes,
              success: this.changes > 0,
            });
          }
        });
      }
    });
  }

  // Fahrzeug löschen
  static remove(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      // Prüfen ob Fahrzeug Aufträge hat
      const checkSql =
        "SELECT COUNT(*) as auftraege FROM auftraege WHERE fahrzeug_id = ?";

      db.get(checkSql, [id], (err, counts) => {
        if (err) {
          console.error("Fehler beim Prüfen der Abhängigkeiten:", err);
          return reject(err);
        }

        if (counts.auftraege > 0) {
          return reject(
            new Error(
              `Fahrzeug kann nicht gelöscht werden. ${counts.auftraege} Aufträge vorhanden.`
            )
          );
        }

        // Fahrzeug löschen
        const deleteSql = "DELETE FROM fahrzeuge WHERE id = ?";

        db.run(deleteSql, [id], function (err) {
          if (err) {
            console.error("Fehler beim Löschen des Fahrzeugs:", err);
            reject(err);
          } else {
            resolve({
              changes: this.changes,
              success: this.changes > 0,
            });
          }
        });
      });
    });
  }

  // Fahrzeuge suchen
  static search(searchTerm) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT f.*, 
               k.name as kunde_name,
               k.kunden_nr,
               COUNT(a.id) as auftraege_count
        FROM fahrzeuge f
        LEFT JOIN kunden k ON f.kunden_id = k.id
        LEFT JOIN auftraege a ON f.id = a.fahrzeug_id
        WHERE f.kennzeichen LIKE ? OR f.marke LIKE ? OR f.modell LIKE ? OR k.name LIKE ?
        GROUP BY f.id
        ORDER BY k.name ASC, f.kennzeichen ASC
      `;

      const searchPattern = `%${searchTerm}%`;

      db.all(
        sql,
        [searchPattern, searchPattern, searchPattern, searchPattern],
        (err, rows) => {
          if (err) {
            console.error("Fehler bei der Fahrzeugsuche:", err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // Fahrzeuge nach Kennzeichen suchen
  static findByKennzeichen(kennzeichen) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT f.*, 
               k.name as kunde_name,
               k.kunden_nr
        FROM fahrzeuge f
        LEFT JOIN kunden k ON f.kunden_id = k.id
        WHERE f.kennzeichen = ?
      `;

      db.get(sql, [kennzeichen], (err, row) => {
        if (err) {
          console.error("Fehler beim Suchen nach Kennzeichen:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Anzahl Fahrzeuge (für Lizenz-Limit)
  static count() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      db.get("SELECT COUNT(*) as count FROM fahrzeuge", (err, row) => {
        if (err) {
          console.error("Fehler beim Zählen der Fahrzeuge:", err);
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  // Fahrzeuge nach Kunde
  static findByKunde(kundenId) {
    return this.findAll(kundenId);
  }

  // Fahrzeug-Historie (letzte Aufträge)
  static getHistory(id, limit = 5) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT a.*, k.name as kunde_name
        FROM auftraege a
        LEFT JOIN kunden k ON a.kunden_id = k.id
        WHERE a.fahrzeug_id = ?
        ORDER BY a.datum DESC
        LIMIT ?
      `;

      db.all(sql, [id, limit], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Fahrzeug-Historie:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

module.exports = Fahrzeug;
