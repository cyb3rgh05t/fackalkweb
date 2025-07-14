// models/rechnung.js
class Rechnung {
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

  // Alle Rechnungen laden
  static findAll() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT r.*, 
               k.name as kunde_name,
               k.kunden_nr,
               f.kennzeichen,
               f.marke,
               f.modell,
               a.auftrag_nr,
               COUNT(p.id) as positionen_count
        FROM rechnungen r
        LEFT JOIN kunden k ON r.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
        LEFT JOIN auftraege a ON r.auftrag_id = a.id
        LEFT JOIN rechnung_positionen p ON r.id = p.rechnung_id
        GROUP BY r.id
        ORDER BY r.rechnungsdatum DESC, r.rechnung_nr DESC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden aller Rechnungen:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Rechnung per ID laden (mit Positionen)
  static findById(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT r.*, 
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
               f.farbcode,
               a.auftrag_nr,
               a.datum as auftragsdatum_original
        FROM rechnungen r
        LEFT JOIN kunden k ON r.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
        LEFT JOIN auftraege a ON r.auftrag_id = a.id
        WHERE r.id = ?
      `;

      db.get(sql, [id], (err, rechnung) => {
        if (err) {
          console.error("Fehler beim Laden der Rechnung:", err);
          return reject(err);
        }

        if (!rechnung) {
          return resolve(null);
        }

        // Positionen laden
        const positionenSql = `
          SELECT * FROM rechnung_positionen 
          WHERE rechnung_id = ? 
          ORDER BY reihenfolge ASC, id ASC
        `;

        db.all(positionenSql, [id], (err2, positionen) => {
          if (err2) {
            console.error("Fehler beim Laden der Rechnungspositionen:", err2);
            return reject(err2);
          }

          rechnung.positionen = positionen || [];
          resolve(rechnung);
        });
      });
    });
  }

  // Neue Rechnung erstellen (mit Positionen)
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const {
        rechnung_nr,
        auftrag_id = null,
        kunden_id,
        fahrzeug_id = null,
        rechnungsdatum,
        auftragsdatum = null,
        status = "offen",
        rabatt_prozent = 0,
        zahlungsbedingungen = "",
        gewaehrleistung = "",
        positionen = [],
      } = data;

      // Validierung
      if (!rechnung_nr || !kunden_id || !rechnungsdatum) {
        return reject(
          new Error(
            "Rechnung-Nr., Kunden-ID und Rechnungsdatum sind erforderlich"
          )
        );
      }

      // Beträge berechnen
      let zwischensumme = 0;
      let mwst19Basis = 0;
      let mwst7Basis = 0;

      positionen.forEach((pos) => {
        const gesamt = parseFloat(pos.gesamt || 0);
        zwischensumme += gesamt;

        if (pos.mwst_prozent === 19) {
          mwst19Basis += gesamt;
        } else if (pos.mwst_prozent === 7) {
          mwst7Basis += gesamt;
        }
      });

      const rabattBetrag = zwischensumme * (parseFloat(rabatt_prozent) / 100);
      const nettoNachRabatt = zwischensumme - rabattBetrag;
      const mwst19 =
        mwst19Basis * (1 - parseFloat(rabatt_prozent) / 100) * 0.19;
      const mwst7 = mwst7Basis * (1 - parseFloat(rabatt_prozent) / 100) * 0.07;
      const gesamtbetrag = nettoNachRabatt + mwst19 + mwst7;

      // Transaktion starten
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Rechnung erstellen
        const rechnungSql = `
          INSERT INTO rechnungen (
            rechnung_nr, auftrag_id, kunden_id, fahrzeug_id, rechnungsdatum, auftragsdatum,
            status, zwischensumme, rabatt_prozent, rabatt_betrag, netto_nach_rabatt,
            mwst_19, mwst_7, gesamtbetrag, zahlungsbedingungen, gewaehrleistung
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(
          rechnungSql,
          [
            rechnung_nr,
            auftrag_id,
            kunden_id,
            fahrzeug_id,
            rechnungsdatum,
            auftragsdatum,
            status,
            zwischensumme,
            rabatt_prozent,
            rabattBetrag,
            nettoNachRabatt,
            mwst19,
            mwst7,
            gesamtbetrag,
            zahlungsbedingungen,
            gewaehrleistung,
          ],
          function (err) {
            if (err) {
              console.error("Fehler beim Erstellen der Rechnung:", err);
              db.run("ROLLBACK");
              return reject(err);
            }

            const rechnungId = this.lastID;

            // Positionen erstellen
            if (positionen.length > 0) {
              const positionSql = `
              INSERT INTO rechnung_positionen (
                rechnung_id, kategorie, beschreibung, menge, einheit, 
                einzelpreis, mwst_prozent, gesamt, reihenfolge
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

              let positionenCompleted = 0;
              let hasError = false;

              positionen.forEach((pos, index) => {
                if (hasError) return;

                db.run(
                  positionSql,
                  [
                    rechnungId,
                    pos.kategorie || "Arbeitszeit",
                    pos.beschreibung,
                    pos.menge || 1,
                    pos.einheit || "Std.",
                    pos.einzelpreis || 0,
                    pos.mwst_prozent || 19,
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
                          id: rechnungId,
                          rechnung_nr,
                          kunden_id,
                          gesamtbetrag,
                          status,
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
                  id: rechnungId,
                  rechnung_nr,
                  kunden_id,
                  gesamtbetrag: 0,
                  status,
                });
              });
            }
          }
        );
      });
    });
  }

  // Rechnung aktualisieren
  static update(id, data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const {
        auftrag_id,
        kunden_id,
        fahrzeug_id,
        rechnungsdatum,
        auftragsdatum,
        status,
        rabatt_prozent,
        zahlungsbedingungen,
        gewaehrleistung,
        positionen = [],
      } = data;

      // Beträge neu berechnen
      let zwischensumme = 0;
      let mwst19Basis = 0;
      let mwst7Basis = 0;

      positionen.forEach((pos) => {
        const gesamt = parseFloat(pos.gesamt || 0);
        zwischensumme += gesamt;

        if (pos.mwst_prozent === 19) {
          mwst19Basis += gesamt;
        } else if (pos.mwst_prozent === 7) {
          mwst7Basis += gesamt;
        }
      });

      const rabattBetrag =
        zwischensumme * (parseFloat(rabatt_prozent || 0) / 100);
      const nettoNachRabatt = zwischensumme - rabattBetrag;
      const mwst19 =
        mwst19Basis * (1 - parseFloat(rabatt_prozent || 0) / 100) * 0.19;
      const mwst7 =
        mwst7Basis * (1 - parseFloat(rabatt_prozent || 0) / 100) * 0.07;
      const gesamtbetrag = nettoNachRabatt + mwst19 + mwst7;

      // Transaktion starten
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Rechnung aktualisieren
        const rechnungSql = `
          UPDATE rechnungen 
          SET auftrag_id = ?, kunden_id = ?, fahrzeug_id = ?, rechnungsdatum = ?, 
              auftragsdatum = ?, status = ?, zwischensumme = ?, rabatt_prozent = ?, 
              rabatt_betrag = ?, netto_nach_rabatt = ?, mwst_19 = ?, mwst_7 = ?, 
              gesamtbetrag = ?, zahlungsbedingungen = ?, gewaehrleistung = ?,
              aktualisiert_am = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        db.run(
          rechnungSql,
          [
            auftrag_id,
            kunden_id,
            fahrzeug_id,
            rechnungsdatum,
            auftragsdatum,
            status,
            zwischensumme,
            rabatt_prozent,
            rabattBetrag,
            nettoNachRabatt,
            mwst19,
            mwst7,
            gesamtbetrag,
            zahlungsbedingungen,
            gewaehrleistung,
            id,
          ],
          function (err) {
            if (err) {
              console.error("Fehler beim Aktualisieren der Rechnung:", err);
              db.run("ROLLBACK");
              return reject(err);
            }

            if (this.changes === 0) {
              db.run("ROLLBACK");
              return reject(new Error("Rechnung nicht gefunden"));
            }

            // Alte Positionen löschen
            db.run(
              "DELETE FROM rechnung_positionen WHERE rechnung_id = ?",
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
                INSERT INTO rechnung_positionen (
                  rechnung_id, kategorie, beschreibung, menge, einheit, 
                  einzelpreis, mwst_prozent, gesamt, reihenfolge
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;

                  let positionenCompleted = 0;
                  let hasError = false;

                  positionen.forEach((pos, index) => {
                    if (hasError) return;

                    db.run(
                      positionSql,
                      [
                        id,
                        pos.kategorie || "Arbeitszeit",
                        pos.beschreibung,
                        pos.menge || 1,
                        pos.einheit || "Std.",
                        pos.einzelpreis || 0,
                        pos.mwst_prozent || 19,
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

  // Rechnung löschen
  static remove(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      // Transaktion für Löschen
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Erst Positionen löschen
        db.run(
          "DELETE FROM rechnung_positionen WHERE rechnung_id = ?",
          [id],
          (err) => {
            if (err) {
              console.error("Fehler beim Löschen der Positionen:", err);
              db.run("ROLLBACK");
              return reject(err);
            }

            // Dann Rechnung löschen
            db.run("DELETE FROM rechnungen WHERE id = ?", [id], function (err) {
              if (err) {
                console.error("Fehler beim Löschen der Rechnung:", err);
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
            });
          }
        );
      });
    });
  }

  // Rechnungen suchen
  static search(searchTerm) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT r.*, 
               k.name as kunde_name,
               k.kunden_nr,
               f.kennzeichen,
               f.marke,
               f.modell,
               a.auftrag_nr
        FROM rechnungen r
        LEFT JOIN kunden k ON r.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
        LEFT JOIN auftraege a ON r.auftrag_id = a.id
        WHERE r.rechnung_nr LIKE ? OR k.name LIKE ? OR f.kennzeichen LIKE ? OR a.auftrag_nr LIKE ?
        ORDER BY r.rechnungsdatum DESC, r.rechnung_nr DESC
      `;

      const searchPattern = `%${searchTerm}%`;

      db.all(
        sql,
        [searchPattern, searchPattern, searchPattern, searchPattern],
        (err, rows) => {
          if (err) {
            console.error("Fehler bei der Rechnungssuche:", err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // Anzahl Rechnungen (für Statistiken)
  static count() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      db.get("SELECT COUNT(*) as count FROM rechnungen", (err, row) => {
        if (err) {
          console.error("Fehler beim Zählen der Rechnungen:", err);
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  // Nächste Rechnung-Nummer generieren
  static getNextRechnungNr() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const currentYear = new Date().getFullYear();

      const sql = `
        SELECT MAX(CAST(SUBSTR(rechnung_nr, 1, INSTR(rechnung_nr, '/') - 1) AS INTEGER)) as max_nr 
        FROM rechnungen 
        WHERE rechnung_nr LIKE '%/${currentYear}'
      `;

      db.get(sql, (err, row) => {
        if (err) {
          console.error("Fehler beim Generieren der Rechnung-Nummer:", err);
          reject(err);
        } else {
          const nextNr = (row.max_nr || 0) + 1;
          const rechnungNr = `${nextNr
            .toString()
            .padStart(4, "0")}/${currentYear}`;
          resolve(rechnungNr);
        }
      });
    });
  }

  // Rechnungen nach Status
  static findByStatus(status) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT r.*, 
               k.name as kunde_name,
               f.kennzeichen
        FROM rechnungen r
        LEFT JOIN kunden k ON r.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
        WHERE r.status = ?
        ORDER BY r.rechnungsdatum DESC
      `;

      db.all(sql, [status], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Rechnungen nach Status:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Rechnungs-Statistiken
  static getStats() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT 
          COUNT(*) as gesamt,
          COUNT(CASE WHEN status = 'offen' THEN 1 END) as offen,
          COUNT(CASE WHEN status = 'bezahlt' THEN 1 END) as bezahlt,
          COUNT(CASE WHEN status = 'storniert' THEN 1 END) as storniert,
          SUM(gesamtbetrag) as umsatz_gesamt,
          SUM(CASE WHEN status = 'bezahlt' THEN gesamtbetrag ELSE 0 END) as umsatz_bezahlt,
          SUM(CASE WHEN status = 'offen' THEN gesamtbetrag ELSE 0 END) as umsatz_offen
        FROM rechnungen
      `;

      db.get(sql, (err, row) => {
        if (err) {
          console.error("Fehler beim Laden der Rechnungsstatistiken:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

module.exports = Rechnung;
