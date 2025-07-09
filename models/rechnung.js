const db = require("../db");

module.exports = {
  findAll: () =>
    new Promise((resolve, reject) => {
      const sql = `
      SELECT r.*, k.name as kunde_name, f.kennzeichen, f.marke, f.modell, a.auftrag_nr
      FROM rechnungen r
      LEFT JOIN kunden k ON r.kunden_id = k.id
      LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
      LEFT JOIN auftraege a ON r.auftrag_id = a.id
      ORDER BY r.rechnungsdatum DESC, r.rechnung_nr DESC`;
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    }),
  findById: (id) =>
    new Promise((resolve, reject) => {
      const sql = `
      SELECT r.*, k.name as kunde_name, k.strasse, k.plz, k.ort, k.telefon, f.kennzeichen, f.marke, f.modell, f.vin, a.auftrag_nr
      FROM rechnungen r
      LEFT JOIN kunden k ON r.kunden_id = k.id
      LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
      LEFT JOIN auftraege a ON r.auftrag_id = a.id
      WHERE r.id = ?`;
      db.get(sql, [id], (err, rechnung) => {
        if (err) return reject(err);
        if (!rechnung) return resolve(null);
        db.all(
          "SELECT * FROM rechnung_positionen WHERE rechnung_id = ? ORDER BY reihenfolge",
          [id],
          (err2, positionen) => {
            if (err2) return reject(err2);
            rechnung.positionen = positionen;
            resolve(rechnung);
          }
        );
      });
    }),
  create: (data) =>
    new Promise((resolve, reject) => {
      const sql = `INSERT INTO rechnungen (rechnung_nr, auftrag_id, kunden_id, fahrzeug_id, rechnungsdatum, auftragsdatum, zwischensumme, rabatt_prozent, rabatt_betrag, netto_nach_rabatt, mwst_19, mwst_7, gesamtbetrag, zahlungsbedingungen, gewaehrleistung, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(
        sql,
        [
          data.rechnung_nr,
          data.auftrag_id,
          data.kunden_id,
          data.fahrzeug_id,
          data.rechnungsdatum,
          data.auftragsdatum,
          data.zwischensumme,
          data.rabatt_prozent,
          data.rabatt_betrag,
          data.netto_nach_rabatt,
          data.mwst_19,
          data.mwst_7,
          data.gesamtbetrag,
          data.zahlungsbedingungen,
          data.gewaehrleistung,
          data.status,
        ],
        function (err) {
          if (err) return reject(err);
          const rechnungId = this.lastID;
          const stmt = db.prepare(
            `INSERT INTO rechnung_positionen (rechnung_id, kategorie, beschreibung, menge, einheit, einzelpreis, mwst_prozent, gesamt, reihenfolge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          (data.positionen || []).forEach((pos, idx) => {
            stmt.run([
              rechnungId,
              pos.kategorie,
              pos.beschreibung,
              pos.menge,
              pos.einheit,
              pos.einzelpreis,
              pos.mwst_prozent,
              pos.gesamt,
              idx,
            ]);
          });
          stmt.finalize();
          resolve({ id: rechnungId, rechnung_nr: data.rechnung_nr });
        }
      );
    }),
  update: (id, data) =>
    new Promise((resolve, reject) => {
      const sql = `UPDATE rechnungen SET auftrag_id=?, kunden_id=?, fahrzeug_id=?, rechnungsdatum=?, auftragsdatum=?, zwischensumme=?, rabatt_prozent=?, rabatt_betrag=?, netto_nach_rabatt=?, mwst_19=?, mwst_7=?, gesamtbetrag=?, zahlungsbedingungen=?, gewaehrleistung=?, status=? WHERE id=?`;
      db.run(
        sql,
        [
          data.auftrag_id,
          data.kunden_id,
          data.fahrzeug_id,
          data.rechnungsdatum,
          data.auftragsdatum,
          data.zwischensumme,
          data.rabatt_prozent,
          data.rabatt_betrag,
          data.netto_nach_rabatt,
          data.mwst_19,
          data.mwst_7,
          data.gesamtbetrag,
          data.zahlungsbedingungen,
          data.gewaehrleistung,
          data.status,
          id,
        ],
        function (err) {
          if (err) return reject(err);
          db.run(
            "DELETE FROM rechnung_positionen WHERE rechnung_id = ?",
            [id],
            (err2) => {
              if (err2) return reject(err2);
              const stmt = db.prepare(
                `INSERT INTO rechnung_positionen (rechnung_id, kategorie, beschreibung, menge, einheit, einzelpreis, mwst_prozent, gesamt, reihenfolge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
              );
              (data.positionen || []).forEach((pos, idx) => {
                stmt.run([
                  id,
                  pos.kategorie,
                  pos.beschreibung,
                  pos.menge,
                  pos.einheit,
                  pos.einzelpreis,
                  pos.mwst_prozent,
                  pos.gesamt,
                  idx,
                ]);
              });
              stmt.finalize();
              resolve({ changes: this.changes });
            }
          );
        }
      );
    }),
  remove: (id) =>
    new Promise((resolve, reject) => {
      db.run(
        "DELETE FROM rechnung_positionen WHERE rechnung_id = ?",
        [id],
        function (err) {
          if (err) return reject(err);
          db.run("DELETE FROM rechnungen WHERE id=?", [id], function (err2) {
            if (err2) return reject(err2);
            resolve({ changes: this.changes });
          });
        }
      );
    }),
};
