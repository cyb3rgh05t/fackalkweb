// models/kunde.js
class Kunde {
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

  // Alle Kunden laden
  static findAll() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT k.*, 
               COUNT(f.id) as fahrzeuge_count,
               COUNT(a.id) as auftraege_count
        FROM kunden k
        LEFT JOIN fahrzeuge f ON k.id = f.kunden_id
        LEFT JOIN auftraege a ON k.id = a.kunden_id
        GROUP BY k.id
        ORDER BY k.name ASC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden aller Kunden:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Kunde per ID laden
  static findById(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT k.*,
               COUNT(f.id) as fahrzeuge_count,
               COUNT(a.id) as auftraege_count
        FROM kunden k
        LEFT JOIN fahrzeuge f ON k.id = f.kunden_id
        LEFT JOIN auftraege a ON k.id = a.kunden_id
        WHERE k.id = ?
        GROUP BY k.id
      `;

      db.get(sql, [id], (err, row) => {
        if (err) {
          console.error("Fehler beim Laden des Kunden:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Neuen Kunden erstellen
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const {
        kunden_nr,
        name,
        strasse = "",
        plz = "",
        ort = "",
        telefon = "",
        email = "",
      } = data;

      // Validierung
      if (!name || !kunden_nr) {
        return reject(new Error("Name und Kunden-Nummer sind erforderlich"));
      }

      const sql = `
        INSERT INTO kunden (kunden_nr, name, strasse, plz, ort, telefon, email)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(
        sql,
        [kunden_nr, name, strasse, plz, ort, telefon, email],
        function (err) {
          if (err) {
            console.error("Fehler beim Erstellen des Kunden:", err);

            if (err.message.includes("UNIQUE constraint failed")) {
              reject(new Error("Kunden-Nummer bereits vergeben"));
            } else {
              reject(err);
            }
          } else {
            const newKunde = {
              id: this.lastID,
              kunden_nr,
              name,
              strasse,
              plz,
              ort,
              telefon,
              email,
              fahrzeuge_count: 0,
              auftraege_count: 0,
            };

            resolve(newKunde);
          }
        }
      );
    });
  }

  // Kunde aktualisieren
  static update(id, data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const {
        name,
        strasse = "",
        plz = "",
        ort = "",
        telefon = "",
        email = "",
      } = data;

      if (!name) {
        return reject(new Error("Name ist erforderlich"));
      }

      const sql = `
        UPDATE kunden 
        SET name = ?, strasse = ?, plz = ?, ort = ?, telefon = ?, email = ?,
            aktualisiert_am = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.run(
        sql,
        [name, strasse, plz, ort, telefon, email, id],
        function (err) {
          if (err) {
            console.error("Fehler beim Aktualisieren des Kunden:", err);
            reject(err);
          } else {
            resolve({
              changes: this.changes,
              success: this.changes > 0,
            });
          }
        }
      );
    });
  }

  // Kunde löschen
  static remove(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      // Prüfen ob Kunde Fahrzeuge oder Aufträge hat
      const checkSql = `
        SELECT 
          (SELECT COUNT(*) FROM fahrzeuge WHERE kunden_id = ?) as fahrzeuge,
          (SELECT COUNT(*) FROM auftraege WHERE kunden_id = ?) as auftraege
      `;

      db.get(checkSql, [id, id], (err, counts) => {
        if (err) {
          console.error("Fehler beim Prüfen der Abhängigkeiten:", err);
          return reject(err);
        }

        if (counts.fahrzeuge > 0 || counts.auftraege > 0) {
          return reject(
            new Error(
              `Kunde kann nicht gelöscht werden. ${counts.fahrzeuge} Fahrzeuge und ${counts.auftraege} Aufträge vorhanden.`
            )
          );
        }

        // Kunde löschen
        const deleteSql = "DELETE FROM kunden WHERE id = ?";

        db.run(deleteSql, [id], function (err) {
          if (err) {
            console.error("Fehler beim Löschen des Kunden:", err);
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

  // Kunde suchen
  static search(searchTerm) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT k.*, 
               COUNT(f.id) as fahrzeuge_count,
               COUNT(a.id) as auftraege_count
        FROM kunden k
        LEFT JOIN fahrzeuge f ON k.id = f.kunden_id
        LEFT JOIN auftraege a ON k.id = a.kunden_id
        WHERE k.name LIKE ? OR k.kunden_nr LIKE ? OR k.ort LIKE ? OR k.telefon LIKE ?
        GROUP BY k.id
        ORDER BY k.name ASC
      `;

      const searchPattern = `%${searchTerm}%`;

      db.all(
        sql,
        [searchPattern, searchPattern, searchPattern, searchPattern],
        (err, rows) => {
          if (err) {
            console.error("Fehler bei der Kundensuche:", err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // Anzahl Kunden (für Lizenz-Limit)
  static count() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      db.get("SELECT COUNT(*) as count FROM kunden", (err, row) => {
        if (err) {
          console.error("Fehler beim Zählen der Kunden:", err);
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  // Nächste Kunden-Nummer generieren
  static getNextKundenNr() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT MAX(CAST(SUBSTR(kunden_nr, 2) AS INTEGER)) as max_nr 
        FROM kunden 
        WHERE kunden_nr LIKE 'K%' AND LENGTH(kunden_nr) > 1
      `;

      db.get(sql, (err, row) => {
        if (err) {
          console.error("Fehler beim Generieren der Kunden-Nummer:", err);
          reject(err);
        } else {
          const nextNr = (row.max_nr || 0) + 1;
          const kundenNr = `K${nextNr.toString().padStart(4, "0")}`;
          resolve(kundenNr);
        }
      });
    });
  }
}

module.exports = Kunde;
