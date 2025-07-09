const db = require("../db");

module.exports = {
  findAll: (kunden_id = null) =>
    new Promise((resolve, reject) => {
      let sql = `SELECT f.*, k.name as kunde_name 
                 FROM fahrzeuge f 
                 LEFT JOIN kunden k ON f.kunden_id = k.id`;
      let params = [];
      if (kunden_id) {
        sql += " WHERE f.kunden_id = ?";
        params.push(kunden_id);
      }
      sql += " ORDER BY f.kennzeichen";
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    }),
  findById: (id) =>
    new Promise((resolve, reject) => {
      const sql = `SELECT f.*, k.name as kunde_name 
                 FROM fahrzeuge f 
                 LEFT JOIN kunden k ON f.kunden_id = k.id 
                 WHERE f.id = ?`;
      db.get(sql, [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    }),
  create: (data) =>
    new Promise((resolve, reject) => {
      const sql = `INSERT INTO fahrzeuge (kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(
        sql,
        [
          data.kunden_id,
          data.kennzeichen,
          data.marke,
          data.modell,
          data.vin,
          data.baujahr,
          data.farbe,
          data.farbcode,
        ],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    }),
  update: (id, data) =>
    new Promise((resolve, reject) => {
      const sql = `UPDATE fahrzeuge SET kunden_id=?, kennzeichen=?, marke=?, modell=?, vin=?, baujahr=?, farbe=?, farbcode=? WHERE id=?`;
      db.run(
        sql,
        [
          data.kunden_id,
          data.kennzeichen,
          data.marke,
          data.modell,
          data.vin,
          data.baujahr,
          data.farbe,
          data.farbcode,
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
      db.run("DELETE FROM fahrzeuge WHERE id=?", [id], function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    }),
};
