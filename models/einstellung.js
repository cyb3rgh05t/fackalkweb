const db = require("../db");

module.exports = {
  findAll: () =>
    new Promise((resolve, reject) => {
      db.all("SELECT * FROM einstellungen ORDER BY key", (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    }),

  upsert: (key, value) =>
    new Promise((resolve, reject) => {
      // Prüfen ob Key existiert
      db.get(
        "SELECT key FROM einstellungen WHERE key = ?",
        [key],
        (err, row) => {
          if (err) return reject(err);

          if (row) {
            // Key existiert -> UPDATE
            db.run(
              "UPDATE einstellungen SET value = ?, aktualisiert_am = CURRENT_TIMESTAMP WHERE key = ?",
              [value, key],
              function (err) {
                if (err) return reject(err);
                console.log(
                  `✅ UPDATED: ${key} = ${
                    value.length > 50 ? "[Base64-Data]" : value
                  }`
                );
                resolve({ success: true, action: "updated" });
              }
            );
          } else {
            // Key existiert nicht -> INSERT
            db.run(
              "INSERT INTO einstellungen (key, value, beschreibung, aktualisiert_am) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
              [key, value, `Automatisch erstellt: ${key}`],
              function (err) {
                if (err) return reject(err);
                console.log(
                  `✅ INSERTED: ${key} = ${
                    value.length > 50 ? "[Base64-Data]" : value
                  }`
                );
                resolve({ success: true, action: "inserted" });
              }
            );
          }
        }
      );
    }),

  update: (key, value) =>
    new Promise((resolve, reject) => {
      db.run(
        "UPDATE einstellungen SET value=? WHERE key=?",
        [value, key],
        function (err) {
          if (err) return reject(err);

          // **WICHTIG:** Prüfen ob wirklich etwas geändert wurde
          if (this.changes === 0) {
            console.warn(
              `⚠️ UPDATE von ${key} hatte keine Auswirkung - Key existiert vermutlich nicht!`
            );

            // Fallback: Versuche INSERT
            db.run(
              "INSERT INTO einstellungen (key, value, beschreibung) VALUES (?, ?, ?)",
              [key, value, `Auto-Insert: ${key}`],
              function (insertErr) {
                if (insertErr) {
                  console.error(
                    `❌ INSERT-Fallback fehlgeschlagen für ${key}:`,
                    insertErr
                  );
                  return reject(insertErr);
                }
                console.log(`✅ INSERT-Fallback erfolgreich für ${key}`);
                resolve({ success: true, action: "inserted" });
              }
            );
          } else {
            resolve({ success: true, action: "updated" });
          }
        }
      );
    }),
};
