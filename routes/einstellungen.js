// routes/einstellungen.js
const express = require("express");
const { getUserDatabase } = require("../middleware/auth");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const router = express.Router();

// Funktion um User-spezifische Datenbank zu bekommen
async function getUserDb(userId) {
  try {
    const dbName = await getUserDatabase(userId);
    if (!dbName) {
      throw new Error("Keine Datenbank für User gefunden");
    }

    const dbPath = path.join(__dirname, "..", "data", "users", `${dbName}.db`);
    return new sqlite3.Database(dbPath);
  } catch (error) {
    console.error("Fehler beim Laden der User-DB:", error);
    throw error;
  }
}

// GET - Alle Einstellungen laden
router.get("/", async (req, res) => {
  try {
    const db = await getUserDb(req.user.id);

    // Einstellungen-Tabelle erstellen falls nicht vorhanden
    db.run(
      `
      CREATE TABLE IF NOT EXISTS einstellungen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kategorie TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(kategorie, key)
      )
    `,
      (err) => {
        if (err) {
          console.error(
            "Fehler beim Erstellen der Einstellungen-Tabelle:",
            err
          );
        }
      }
    );

    // Alle Einstellungen laden
    db.all(
      "SELECT * FROM einstellungen ORDER BY kategorie, key",
      (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Einstellungen:", err);
          return res
            .status(500)
            .json({ error: "Fehler beim Laden der Einstellungen" });
        }

        // Als Object zurückgeben für einfachere Verwendung
        const settings = {};
        rows.forEach((row) => {
          settings[row.key] = row.value;
        });

        res.json({
          success: true,
          data: settings,
          raw: rows,
        });
      }
    );

    db.close();
  } catch (error) {
    console.error("Einstellungen GET Fehler:", error);
    res
      .status(500)
      .json({ error: "Server-Fehler beim Laden der Einstellungen" });
  }
});

// POST - Einstellungen speichern/aktualisieren
router.post("/", async (req, res) => {
  try {
    const db = await getUserDb(req.user.id);
    const data = req.body;

    // Einstellungen-Tabelle erstellen falls nicht vorhanden
    db.run(`
      CREATE TABLE IF NOT EXISTS einstellungen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kategorie TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(kategorie, key)
      )
    `);

    // Transaktion für alle Updates
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      const updatePromises = [];

      Object.keys(data).forEach((key) => {
        const value = data[key];
        let kategorie = "allgemein";

        // Kategorie basierend auf Key bestimmen
        if (
          key.startsWith("firmen_") ||
          key === "firmenname" ||
          key === "rechtsform" ||
          key === "geschaeftsfuehrer"
        ) {
          kategorie = "firma";
        } else if (
          key.startsWith("basis_") ||
          key.includes("stundenpreis") ||
          key.includes("zuschlag")
        ) {
          kategorie = "leistungen";
        } else if (
          key.startsWith("mwst_") ||
          key.includes("zahlung") ||
          key.includes("skonto") ||
          key === "gewaehrleistung"
        ) {
          kategorie = "rechnungen";
        } else if (
          key.startsWith("standard_") ||
          key.includes("bearbeitung") ||
          key.includes("email_")
        ) {
          kategorie = "auftraege";
        } else if (key.startsWith("bank_")) {
          kategorie = "bank";
        }

        updatePromises.push(
          new Promise((resolve, reject) => {
            db.run(
              `INSERT OR REPLACE INTO einstellungen (kategorie, key, value, updated_at) 
             VALUES (?, ?, ?, datetime('now'))`,
              [kategorie, key, value],
              function (err) {
                if (err) {
                  reject(err);
                } else {
                  resolve(this.changes);
                }
              }
            );
          })
        );
      });

      Promise.all(updatePromises)
        .then(() => {
          db.run("COMMIT", (err) => {
            if (err) {
              console.error("Commit-Fehler:", err);
              return res
                .status(500)
                .json({ error: "Fehler beim Speichern der Einstellungen" });
            }

            res.json({
              success: true,
              message: "Einstellungen erfolgreich gespeichert",
              count: Object.keys(data).length,
            });
          });
        })
        .catch((error) => {
          console.error("Update-Fehler:", error);
          db.run("ROLLBACK");
          res
            .status(500)
            .json({ error: "Fehler beim Aktualisieren der Einstellungen" });
        });
    });

    db.close();
  } catch (error) {
    console.error("Einstellungen POST Fehler:", error);
    res
      .status(500)
      .json({ error: "Server-Fehler beim Speichern der Einstellungen" });
  }
});

// GET - Einzelne Einstellung
router.get("/:key", async (req, res) => {
  try {
    const db = await getUserDb(req.user.id);
    const key = req.params.key;

    db.get("SELECT * FROM einstellungen WHERE key = ?", [key], (err, row) => {
      if (err) {
        console.error("Fehler beim Laden der Einstellung:", err);
        return res
          .status(500)
          .json({ error: "Fehler beim Laden der Einstellung" });
      }

      if (!row) {
        return res.status(404).json({ error: "Einstellung nicht gefunden" });
      }

      res.json({
        success: true,
        data: row,
      });
    });

    db.close();
  } catch (error) {
    console.error("Einzelne Einstellung GET Fehler:", error);
    res.status(500).json({ error: "Server-Fehler" });
  }
});

// PUT - Einzelne Einstellung aktualisieren
router.put("/:key", async (req, res) => {
  try {
    const db = await getUserDb(req.user.id);
    const key = req.params.key;
    const { value, kategorie = "allgemein" } = req.body;

    db.run(
      `INSERT OR REPLACE INTO einstellungen (kategorie, key, value, updated_at) 
       VALUES (?, ?, ?, datetime('now'))`,
      [kategorie, key, value],
      function (err) {
        if (err) {
          console.error("Fehler beim Aktualisieren der Einstellung:", err);
          return res
            .status(500)
            .json({ error: "Fehler beim Aktualisieren der Einstellung" });
        }

        res.json({
          success: true,
          message: "Einstellung erfolgreich aktualisiert",
          changes: this.changes,
        });
      }
    );

    db.close();
  } catch (error) {
    console.error("Einzelne Einstellung PUT Fehler:", error);
    res.status(500).json({ error: "Server-Fehler" });
  }
});

// DELETE - Einstellung löschen
router.delete("/:key", async (req, res) => {
  try {
    const db = await getUserDb(req.user.id);
    const key = req.params.key;

    db.run("DELETE FROM einstellungen WHERE key = ?", [key], function (err) {
      if (err) {
        console.error("Fehler beim Löschen der Einstellung:", err);
        return res
          .status(500)
          .json({ error: "Fehler beim Löschen der Einstellung" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Einstellung nicht gefunden" });
      }

      res.json({
        success: true,
        message: "Einstellung erfolgreich gelöscht",
        changes: this.changes,
      });
    });

    db.close();
  } catch (error) {
    console.error("Einstellung DELETE Fehler:", error);
    res.status(500).json({ error: "Server-Fehler" });
  }
});

module.exports = router;
