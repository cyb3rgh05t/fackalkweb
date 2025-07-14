const db = require("../db");

module.exports = {
  findAll: () =>
    new Promise((resolve, reject) => {
      const sql = `
      SELECT a.*, k.name as kunde_name, f.kennzeichen, f.marke, f.modell
      FROM auftraege a
      LEFT JOIN kunden k ON a.kunden_id = k.id
      LEFT JOIN fahrzeuge f ON a.fahrzeug_id = f.id
      ORDER BY a.datum DESC, a.auftrag_nr DESC`;
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    }),
  findById: (id) =>
    new Promise((resolve, reject) => {
      const sql = `
      SELECT a.*, k.*, f.kennzeichen, f.marke, f.modell, f.vin, f.farbe, f.farbcode
      FROM auftraege a
      LEFT JOIN kunden k ON a.kunden_id = k.id
      LEFT JOIN fahrzeuge f ON a.fahrzeug_id = f.id
      WHERE a.id = ?`;
      db.get(sql, [id], (err, auftrag) => {
        if (err) return reject(err);
        if (!auftrag) return resolve(null);
        db.all(
          "SELECT * FROM auftrag_positionen WHERE auftrag_id = ? ORDER BY reihenfolge",
          [id],
          (err2, positionen) => {
            if (err2) return reject(err2);
            auftrag.positionen = positionen;
            resolve(auftrag);
          }
        );
      });
    }),
  create: (data) =>
    new Promise((resolve, reject) => {
      const sql = `INSERT INTO auftraege (auftrag_nr, kunden_id, fahrzeug_id, datum, basis_stundenpreis, gesamt_zeit, gesamt_kosten, mwst_betrag, bemerkungen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(
        sql,
        [
          data.auftrag_nr,
          data.kunden_id,
          data.fahrzeug_id,
          data.datum,
          data.basis_stundenpreis,
          data.gesamt_zeit,
          data.gesamt_kosten,
          data.mwst_betrag,
          data.bemerkungen,
        ],
        function (err) {
          if (err) return reject(err);
          const auftragId = this.lastID;
          // Positionen einfügen
          const stmt = db.prepare(
            `INSERT INTO auftrag_positionen (auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge) VALUES (?, ?, ?, ?, ?, ?, ?)`
          );
          (data.positionen || []).forEach((pos, idx) => {
            stmt.run([
              auftragId,
              pos.beschreibung,
              pos.stundenpreis,
              pos.zeit,
              pos.einheit,
              pos.gesamt,
              idx,
            ]);
          });
          stmt.finalize();
          resolve({ id: auftragId, auftrag_nr: data.auftrag_nr });
        }
      );
    }),
  update: (id, data) =>
    new Promise((resolve, reject) => {
      const sql = `UPDATE auftraege SET kunden_id=?, fahrzeug_id=?, datum=?, basis_stundenpreis=?, gesamt_zeit=?, gesamt_kosten=?, mwst_betrag=?, bemerkungen=?, status=? WHERE id=?`;
      db.run(
        sql,
        [
          data.kunden_id,
          data.fahrzeug_id,
          data.datum,
          data.basis_stundenpreis,
          data.gesamt_zeit,
          data.gesamt_kosten,
          data.mwst_betrag,
          data.bemerkungen,
          data.status,
          id,
        ],
        function (err) {
          if (err) return reject(err);
          // Positionen neu schreiben
          db.run(
            "DELETE FROM auftrag_positionen WHERE auftrag_id = ?",
            [id],
            (err2) => {
              if (err2) return reject(err2);
              const stmt = db.prepare(
                `INSERT INTO auftrag_positionen (auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge) VALUES (?, ?, ?, ?, ?, ?, ?)`
              );
              (data.positionen || []).forEach((pos, idx) => {
                stmt.run([
                  id,
                  pos.beschreibung,
                  pos.stundenpreis,
                  pos.zeit,
                  pos.einheit,
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
        "DELETE FROM auftrag_positionen WHERE auftrag_id = ?",
        [id],
        function (err) {
          if (err) return reject(err);
          db.run("DELETE FROM auftraege WHERE id=?", [id], function (err2) {
            if (err2) return reject(err2);
            resolve({ changes: this.changes });
          });
        }
      );
    }),
};
