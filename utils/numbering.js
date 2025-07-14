const db = require("../db");

exports.generateNextNumber = (type) =>
  new Promise((resolve, reject) => {
    const key = `next_${type}_nr`;
    db.get(
      "SELECT value FROM einstellungen WHERE key = ?",
      [key],
      (err, row) => {
        if (err) return reject(err);
        const nextNumber = parseInt(row?.value || "1");
        let prefix = "X";
        if (type === "auftrag") prefix = "A";
        if (type === "rechnung") prefix = "R";
        if (type === "kunden") prefix = "K";
        const formatted = `${prefix}${nextNumber.toString().padStart(6, "0")}`;
        db.run(
          "UPDATE einstellungen SET value = ? WHERE key = ?",
          [nextNumber + 1, key],
          (updateErr) => {
            if (updateErr) return reject(updateErr);
            resolve(formatted);
          }
        );
      }
    );
  });
