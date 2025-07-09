const db = require("../db");

module.exports = {
  findAll: () =>
    new Promise((resolve, reject) => {
      db.all("SELECT * FROM einstellungen ORDER BY key", (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    }),
  update: (key, value) =>
    new Promise((resolve, reject) => {
      db.run(
        "UPDATE einstellungen SET value=? WHERE key=?",
        [value, key],
        function (err) {
          if (err) return reject(err);
          resolve({ success: true });
        }
      );
    }),
};
