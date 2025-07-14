// models/auftrag.js
class Auftrag {
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

  // Alle Aufträge laden
  static findAll() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT a.*, 
               k.name as kunde_name,
               k.kunden_nr,
               f.kennzeichen,
               f.marke,
               f.modell,
               COUNT(p.id) as positionen_count
        FROM auftraege a
        LEFT JOIN kunden k ON a.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON a.fahrzeug_id = f.id
        LEFT JOIN auftrag_positionen p ON a.id = p.auftrag_id
        GROUP BY a.id
        ORDER BY a.datum DESC, a.auftrag_nr DESC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden aller Aufträge:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Auftrag per ID laden (mit Positionen)
  static findById(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT a.*, 
               k.name as kunde_name,
               k.kunden_nr,
               k.strasse,
               k.plz,
               k.ort,
               k.telefon,
               k.email,
               f.kennzeichen,
               f.marke,
               f.modell,
               f.vin,
               f.baujahr,
               f.farbe,
               f.farbcode
        FROM auftraege a
        LEFT JOIN kunden k ON a.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON a.fahrzeug_id = f.id
        WHERE a.id = ?
      `;

      db.get(sql, [id], (err, auftrag) => {
        if (err) {
          console.error("Fehler beim Laden des Auftrags:", err);
          return reject(err);
        }

        if (!auftrag) {
          return resolve(null);
        }

        // Positionen laden
        const positionenSql = `
          SELECT * FROM auftrag_positionen 
          WHERE auftrag_id = ? 
          ORDER BY reihenfolge ASC, id ASC
        `;

        db.all(positionenSql, [id], (err2, positionen) => {
          if (err2) {
            console.error("Fehler beim Laden der Auftragspositionen:", err2);
            return reject(err2);
          }

          auftrag.positionen = positionen || [];
          resolve(auftrag);
        });
      });
    });
  }

  // Neuen Auftrag erstellen (mit Positionen)
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const {
        auftrag_nr,
        kunden_id,
        fahrzeug_id,
        datum,
        status = "offen",
        basis_stundenpreis = 110.0,
        bemerkungen = "",
        positionen = [],
      } = data;

      // Validierung
      if (!auftrag_nr || !kunden_id || !datum) {
        return reject(
          new Error("Auftrag-Nr., Kunden-ID und Datum sind erforderlich")
        );
      }

      // Beträge berechnen
      let gesamt_zeit = 0;
      let gesamt_kosten = 0;

      positionen.forEach((pos) => {
        const zeit = parseFloat(pos.zeit || 0);
        const gesamt = parseFloat(pos.gesamt || 0);
        gesamt_zeit += zeit;
        gesamt_kosten += gesamt;
      });

      const mwst_betrag = gesamt_kosten * 0.19;

      // Transaktion starten
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Auftrag erstellen
        const auftragSql = `
          INSERT INTO auftraege (
            auftrag_nr, kunden_id, fahrzeug_id, datum, status, 
            basis_stundenpreis, gesamt_zeit, gesamt_kosten, mwst_betrag, bemerkungen
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(
          auftragSql,
          [
            auftrag_nr,
            kunden_id,
            fahrzeug_id,
            datum,
            status,
            basis_stundenpreis,
            gesamt_zeit,
            gesamt_kosten,
            mwst_betrag,
            bemerkungen,
          ],
          function (err) {
            if (err) {
              console.error("Fehler beim Erstellen des Auftrags:", err);
              db.run("ROLLBACK");
              return reject(err);
            }

            const auftragId = this.lastID;

            // Positionen erstellen
            if (positionen.length > 0) {
              const positionSql = `
              INSERT INTO auftrag_positionen (
                auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

              let positionenCompleted = 0;
              let hasError = false;

              positionen.forEach((pos, index) => {
                if (hasError) return;

                db.run(
                  positionSql,
                  [
                    auftragId,
                    pos.beschreibung,
                    pos.stundenpreis || basis_stundenpreis,
                    pos.zeit || 0,
                    pos.einheit || "Std.",
                    pos.gesamt || 0,
                    pos.reihenfolge || index + 1,
                  ],
                  (err) => {
                    if (err && !hasError) {
                      console.error("Fehler beim Erstellen der Position:", err);
                      hasError = true;
                      db.run("ROLLBACK");
                      return reject(err);
                    }

                    positionenCompleted++;

                    if (positionenCompleted === positionen.length) {
                      db.run("COMMIT", (err) => {
                        if (err) {
                          console.error("Fehler beim Commit:", err);
                          return reject(err);
                        }

                        resolve({
                          id: auftragId,
                          auftrag_nr,
                          kunden_id,
                          fahrzeug_id,
                          datum,
                          status,
                          gesamt_zeit,
                          gesamt_kosten,
                          mwst_betrag,
                        });
                      });
                    }
                  }
                );
              });
            } else {
              // Keine Positionen - direkt committen
              db.run("COMMIT", (err) => {
                if (err) {
                  console.error("Fehler beim Commit:", err);
                  return reject(err);
                }

                resolve({
                  id: auftragId,
                  auftrag_nr,
                  kunden_id,
                  fahrzeug_id,
                  datum,
                  status,
                  gesamt_zeit: 0,
                  gesamt_kosten: 0,
                  mwst_betrag: 0,
                });
              });
            }
          }
        );
      });
    });
  }

  // Auftrag aktualisieren
  static update(id, data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const {
        kunden_id,
        fahrzeug_id,
        datum,
        status,
        basis_stundenpreis,
        bemerkungen,
        positionen = [],
      } = data;

      // Beträge neu berechnen
      let gesamt_zeit = 0;
      let gesamt_kosten = 0;

      positionen.forEach((pos) => {
        const zeit = parseFloat(pos.zeit || 0);
        const gesamt = parseFloat(pos.gesamt || 0);
        gesamt_zeit += zeit;
        gesamt_kosten += gesamt;
      });

      const mwst_betrag = gesamt_kosten * 0.19;

      // Transaktion starten
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Auftrag aktualisieren
        const auftragSql = `
          UPDATE auftraege 
          SET kunden_id = ?, fahrzeug_id = ?, datum = ?, status = ?, 
              basis_stundenpreis = ?, gesamt_zeit = ?, gesamt_kosten = ?, 
              mwst_betrag = ?, bemerkungen = ?, aktualisiert_am = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        db.run(
          auftragSql,
          [
            kunden_id,
            fahrzeug_id,
            datum,
            status,
            basis_stundenpreis,
            gesamt_zeit,
            gesamt_kosten,
            mwst_betrag,
            bemerkungen,
            id,
          ],
          function (err) {
            if (err) {
              console.error("Fehler beim Aktualisieren des Auftrags:", err);
              db.run("ROLLBACK");
              return reject(err);
            }

            if (this.changes === 0) {
              db.run("ROLLBACK");
              return reject(new Error("Auftrag nicht gefunden"));
            }

            // Alte Positionen löschen
            db.run(
              "DELETE FROM auftrag_positionen WHERE auftrag_id = ?",
              [id],
              (err) => {
                if (err) {
                  console.error("Fehler beim Löschen der Positionen:", err);
                  db.run("ROLLBACK");
                  return reject(err);
                }

                // Neue Positionen erstellen
                if (positionen.length > 0) {
                  const positionSql = `
                INSERT INTO auftrag_positionen (
                  auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
              `;

                  let positionenCompleted = 0;
                  let hasError = false;

                  positionen.forEach((pos, index) => {
                    if (hasError) return;

                    db.run(
                      positionSql,
                      [
                        id,
                        pos.beschreibung,
                        pos.stundenpreis || basis_stundenpreis,
                        pos.zeit || 0,
                        pos.einheit || "Std.",
                        pos.gesamt || 0,
                        pos.reihenfolge || index + 1,
                      ],
                      (err) => {
                        if (err && !hasError) {
                          console.error(
                            "Fehler beim Erstellen der Position:",
                            err
                          );
                          hasError = true;
                          db.run("ROLLBACK");
                          return reject(err);
                        }

                        positionenCompleted++;

                        if (positionenCompleted === positionen.length) {
                          db.run("COMMIT", (err) => {
                            if (err) {
                              console.error("Fehler beim Commit:", err);
                              return reject(err);
                            }

                            resolve({ changes: 1, success: true });
                          });
                        }
                      }
                    );
                  });
                } else {
                  // Keine Positionen - direkt committen
                  db.run("COMMIT", (err) => {
                    if (err) {
                      console.error("Fehler beim Commit:", err);
                      return reject(err);
                    }

                    resolve({ changes: 1, success: true });
                  });
                }
              }
            );
          }
        );
      });
    });
  }

  // Auftrag löschen
  static remove(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      // Prüfen ob Auftrag eine Rechnung hat
      const checkSql =
        "SELECT COUNT(*) as rechnungen FROM rechnungen WHERE auftrag_id = ?";

      db.get(checkSql, [id], (err, counts) => {
        if (err) {
          console.error("Fehler beim Prüfen der Abhängigkeiten:", err);
          return reject(err);
        }

        if (counts.rechnungen > 0) {
          return reject(
            new Error(
              `Auftrag kann nicht gelöscht werden. ${counts.rechnungen} Rechnungen vorhanden.`
            )
          );
        }

        // Transaktion für Löschen
        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          // Erst Positionen löschen
          db.run(
            "DELETE FROM auftrag_positionen WHERE auftrag_id = ?",
            [id],
            (err) => {
              if (err) {
                console.error("Fehler beim Löschen der Positionen:", err);
                db.run("ROLLBACK");
                return reject(err);
              }

              // Dann Auftrag löschen
              db.run(
                "DELETE FROM auftraege WHERE id = ?",
                [id],
                function (err) {
                  if (err) {
                    console.error("Fehler beim Löschen des Auftrags:", err);
                    db.run("ROLLBACK");
                    return reject(err);
                  }

                  db.run("COMMIT", (err) => {
                    if (err) {
                      console.error("Fehler beim Commit:", err);
                      return reject(err);
                    }

                    resolve({
                      changes: this.changes,
                      success: this.changes > 0,
                    });
                  });
                }
              );
            }
          );
        });
      });
    });
  }

  // Aufträge suchen
  static search(searchTerm) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT a.*, 
               k.name as kunde_name,
               k.kunden_nr,
               f.kennzeichen,
               f.marke,
               f.modell
        FROM auftraege a
        LEFT JOIN kunden k ON a.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON a.fahrzeug_id = f.id
        WHERE a.auftrag_nr LIKE ? OR k.name LIKE ? OR f.kennzeichen LIKE ?
        ORDER BY a.datum DESC, a.auftrag_nr DESC
      `;

      const searchPattern = `%${searchTerm}%`;

      db.all(
        sql,
        [searchPattern, searchPattern, searchPattern],
        (err, rows) => {
          if (err) {
            console.error("Fehler bei der Auftragssuche:", err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // Anzahl Aufträge (für Lizenz-Limit)
  static count() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      db.get("SELECT COUNT(*) as count FROM auftraege", (err, row) => {
        if (err) {
          console.error("Fehler beim Zählen der Aufträge:", err);
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  // Nächste Auftrag-Nummer generieren
  static getNextAuftragNr() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const currentYear = new Date().getFullYear();
      const yearSuffix = currentYear.toString().slice(-2);

      const sql = `
        SELECT MAX(CAST(SUBSTR(auftrag_nr, 1, LENGTH(auftrag_nr) - 2) AS INTEGER)) as max_nr 
        FROM auftraege 
        WHERE auftrag_nr LIKE '%${yearSuffix}'
      `;

      db.get(sql, (err, row) => {
        if (err) {
          console.error("Fehler beim Generieren der Auftrag-Nummer:", err);
          reject(err);
        } else {
          const nextNr = (row.max_nr || 0) + 1;
          const auftragNr = `${nextNr
            .toString()
            .padStart(4, "0")}${yearSuffix}`;
          resolve(auftragNr);
        }
      });
    });
  }

  // Aufträge nach Status
  static findByStatus(status) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT a.*, 
               k.name as kunde_name,
               f.kennzeichen
        FROM auftraege a
        LEFT JOIN kunden k ON a.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON a.fahrzeug_id = f.id
        WHERE a.status = ?
        ORDER BY a.datum DESC
      `;

      db.all(sql, [status], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Aufträge nach Status:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

module.exports = Auftrag;
