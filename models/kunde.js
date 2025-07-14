const db = require("../db");

module.exports = {
  findAll: () =>
    new Promise((resolve, reject) => {
      db.all("SELECT * FROM kunden ORDER BY name ASC", (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    }),
  findById: (id) =>
    new Promise((resolve, reject) => {
      db.get("SELECT * FROM kunden WHERE id = ?", [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    }),
  create: (data) =>
    new Promise((resolve, reject) => {
      const sql = `INSERT INTO kunden (kunden_nr, name, strasse, plz, ort, telefon, email) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.run(
        sql,
        [
          data.kunden_nr,
          data.name,
          data.strasse,
          data.plz,
          data.ort,
          data.telefon,
          data.email,
        ],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, kunden_nr: data.kunden_nr });
        }
      );
    }),
  update: (id, data) =>
    new Promise((resolve, reject) => {
      const sql = `UPDATE kunden SET name=?, strasse=?, plz=?, ort=?, telefon=?, email=?, aktualisiert_am=CURRENT_TIMESTAMP WHERE id=?`;
      db.run(
        sql,
        [
          data.name,
          data.strasse,
          data.plz,
          data.ort,
          data.telefon,
          data.email,
          id,
        ],
        function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        }
      );
    }),
  remove: (id) =>
    new Promise((resolve, reject) => {
      db.run("DELETE FROM kunden WHERE id=?", [id], function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    }),
};
