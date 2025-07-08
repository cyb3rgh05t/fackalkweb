const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Sicherheits-Middleware mit relaxierter CSP für inline handlers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(compression());
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Max 100 Requests pro IP
});
app.use("/api/", limiter);

// Statische Dateien
app.use(express.static("public"));

// Datenbank initialisieren
const dbPath = path.join(__dirname, "data", "lackiererei.db");
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Fehler beim Öffnen der Datenbank:", err.message);
  } else {
    console.log("Verbindung zur SQLite-Datenbank hergestellt.");
    initializeDatabase();
  }
});

// Datenbank-Schema
function initializeDatabase() {
  const tables = [
    // Kunden-Tabelle
    `CREATE TABLE IF NOT EXISTS kunden (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kunden_nr TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            strasse TEXT,
            plz TEXT,
            ort TEXT,
            telefon TEXT,
            email TEXT,
            erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
            aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

    // Fahrzeuge-Tabelle
    `CREATE TABLE IF NOT EXISTS fahrzeuge (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kunden_id INTEGER,
            kennzeichen TEXT NOT NULL,
            marke TEXT,
            modell TEXT,
            vin TEXT,
            baujahr INTEGER,
            farbe TEXT,
            farbcode TEXT,
            FOREIGN KEY (kunden_id) REFERENCES kunden (id)
        )`,

    // Aufträge-Tabelle
    `CREATE TABLE IF NOT EXISTS auftraege (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            auftrag_nr TEXT UNIQUE NOT NULL,
            kunden_id INTEGER,
            fahrzeug_id INTEGER,
            datum DATE NOT NULL,
            status TEXT DEFAULT 'offen',
            basis_stundenpreis DECIMAL(10,2) DEFAULT 110.00,
            gesamt_zeit DECIMAL(10,2) DEFAULT 0,
            gesamt_kosten DECIMAL(10,2) DEFAULT 0,
            mwst_betrag DECIMAL(10,2) DEFAULT 0,
            bemerkungen TEXT,
            erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (kunden_id) REFERENCES kunden (id),
            FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id)
        )`,

    // Auftrags-Positionen
    `CREATE TABLE IF NOT EXISTS auftrag_positionen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            auftrag_id INTEGER,
            beschreibung TEXT NOT NULL,
            stundenpreis DECIMAL(10,2),
            zeit DECIMAL(10,2),
            einheit TEXT DEFAULT 'Std.',
            gesamt DECIMAL(10,2),
            reihenfolge INTEGER,
            FOREIGN KEY (auftrag_id) REFERENCES auftraege (id)
        )`,

    // Rechnungen-Tabelle
    `CREATE TABLE IF NOT EXISTS rechnungen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rechnung_nr TEXT UNIQUE NOT NULL,
            auftrag_id INTEGER,
            kunden_id INTEGER,
            fahrzeug_id INTEGER,
            rechnungsdatum DATE NOT NULL,
            auftragsdatum DATE,
            status TEXT DEFAULT 'offen',
            zwischensumme DECIMAL(10,2) DEFAULT 0,
            rabatt_prozent DECIMAL(5,2) DEFAULT 0,
            rabatt_betrag DECIMAL(10,2) DEFAULT 0,
            netto_nach_rabatt DECIMAL(10,2) DEFAULT 0,
            mwst_19 DECIMAL(10,2) DEFAULT 0,
            mwst_7 DECIMAL(10,2) DEFAULT 0,
            gesamtbetrag DECIMAL(10,2) DEFAULT 0,
            zahlungsbedingungen TEXT,
            gewaehrleistung TEXT,
            erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (auftrag_id) REFERENCES auftraege (id),
            FOREIGN KEY (kunden_id) REFERENCES kunden (id),
            FOREIGN KEY (fahrzeug_id) REFERENCES fahrzeuge (id)
        )`,

    // Rechnungs-Positionen
    `CREATE TABLE IF NOT EXISTS rechnung_positionen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rechnung_id INTEGER,
            kategorie TEXT NOT NULL,
            beschreibung TEXT NOT NULL,
            menge DECIMAL(10,2),
            einheit TEXT,
            einzelpreis DECIMAL(10,2),
            mwst_prozent DECIMAL(5,2),
            gesamt DECIMAL(10,2),
            reihenfolge INTEGER,
            FOREIGN KEY (rechnung_id) REFERENCES rechnungen (id)
        )`,

    // Einstellungen-Tabelle
    `CREATE TABLE IF NOT EXISTS einstellungen (
            key TEXT PRIMARY KEY,
            value TEXT,
            beschreibung TEXT
        )`,
  ];

  tables.forEach((table) => {
    db.run(table, (err) => {
      if (err) {
        console.error("Fehler beim Erstellen der Tabelle:", err.message);
      }
    });
  });

  // Standard-Einstellungen
  const defaultSettings = [
    ["basis_stundenpreis", "110.00", "Standard Stundenpreis"],
    ["mwst_standard", "19", "Standard MwSt-Satz"],
    ["mwst_ermaessigt", "7", "Ermäßigter MwSt-Satz"],
    [
      "zahlungsbedingungen",
      "Zahlbar innerhalb 14 Tagen netto. Bei Überschreitung der Zahlungsfrist werden Verzugszinsen in Höhe von 9% über dem Basiszinssatz berechnet.",
      "Standard Zahlungsbedingungen",
    ],
    [
      "gewaehrleistung",
      "3 Jahre auf Lackierarbeiten bei ordnungsgemäßer Behandlung.",
      "Standard Gewährleistung",
    ],
    ["firmenname", "FAF Lackiererei", "Firmenname"],
    ["next_auftrag_nr", "1", "Nächste Auftragsnummer"],
    ["next_rechnung_nr", "1", "Nächste Rechnungsnummer"],
  ];

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO einstellungen (key, value, beschreibung) VALUES (?, ?, ?)"
  );
  defaultSettings.forEach((setting) => {
    stmt.run(setting);
  });
  stmt.finalize();
}

// Helper-Funktionen
function generateNextNumber(type, callback) {
  const key = `next_${type}_nr`;
  db.get("SELECT value FROM einstellungen WHERE key = ?", [key], (err, row) => {
    if (err) {
      callback(err, null);
      return;
    }

    const nextNumber = parseInt(row?.value || "1");
    const formattedNumber = `${type.charAt(0).toUpperCase()}${nextNumber
      .toString()
      .padStart(6, "0")}`;

    // Nummer in DB aktualisieren
    db.run(
      "UPDATE einstellungen SET value = ? WHERE key = ?",
      [nextNumber + 1, key],
      (updateErr) => {
        if (updateErr) {
          callback(updateErr, null);
        } else {
          callback(null, formattedNumber);
        }
      }
    );
  });
}

// API Routes

// === KUNDEN API ===
app.get("/api/kunden", (req, res) => {
  db.all("SELECT * FROM kunden ORDER BY name ASC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get("/api/kunden/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM kunden WHERE id = ?", [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: "Kunde nicht gefunden" });
      return;
    }
    res.json(row);
  });
});

app.post("/api/kunden", (req, res) => {
  const { name, strasse, plz, ort, telefon, email } = req.body;

  // Kunden-Nr generieren
  generateNextNumber("kunden", (err, kundenNr) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const sql = `INSERT INTO kunden (kunden_nr, name, strasse, plz, ort, telefon, email) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(
      sql,
      [kundenNr, name, strasse, plz, ort, telefon, email],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ id: this.lastID, kunden_nr: kundenNr });
      }
    );
  });
});

app.put("/api/kunden/:id", (req, res) => {
  const { id } = req.params;
  const { name, strasse, plz, ort, telefon, email } = req.body;

  const sql = `UPDATE kunden 
               SET name = ?, strasse = ?, plz = ?, ort = ?, telefon = ?, email = ?, 
                   aktualisiert_am = CURRENT_TIMESTAMP 
               WHERE id = ?`;

  db.run(sql, [name, strasse, plz, ort, telefon, email, id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: "Kunde nicht gefunden" });
      return;
    }
    res.json({ success: true, changes: this.changes });
  });
});

app.delete("/api/kunden/:id", (req, res) => {
  const { id } = req.params;

  // Prüfen ob Kunde noch Fahrzeuge oder Aufträge hat
  db.get(
    "SELECT COUNT(*) as count FROM fahrzeuge WHERE kunden_id = ?",
    [id],
    (err, fahrzeugRow) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.get(
        "SELECT COUNT(*) as count FROM auftraege WHERE kunden_id = ?",
        [id],
        (err, auftragRow) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          if (fahrzeugRow.count > 0 || auftragRow.count > 0) {
            res.status(400).json({
              error:
                "Kunde kann nicht gelöscht werden. Es existieren noch zugehörige Fahrzeuge oder Aufträge.",
            });
            return;
          }

          // Kunde löschen
          db.run("DELETE FROM kunden WHERE id = ?", [id], function (err) {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            if (this.changes === 0) {
              res.status(404).json({ error: "Kunde nicht gefunden" });
              return;
            }
            res.json({ success: true, changes: this.changes });
          });
        }
      );
    }
  );
});

// === FAHRZEUGE API ===
app.get("/api/fahrzeuge", (req, res) => {
  const { kunden_id } = req.query;
  let sql = `SELECT f.*, k.name as kunde_name 
               FROM fahrzeuge f 
               LEFT JOIN kunden k ON f.kunden_id = k.id`;
  const params = [];

  if (kunden_id) {
    sql += " WHERE f.kunden_id = ?";
    params.push(kunden_id);
  }

  sql += " ORDER BY f.kennzeichen";

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get("/api/fahrzeuge/:id", (req, res) => {
  const { id } = req.params;
  const sql = `SELECT f.*, k.name as kunde_name 
               FROM fahrzeuge f 
               LEFT JOIN kunden k ON f.kunden_id = k.id 
               WHERE f.id = ?`;

  db.get(sql, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: "Fahrzeug nicht gefunden" });
      return;
    }
    res.json(row);
  });
});

app.post("/api/fahrzeuge", (req, res) => {
  const {
    kunden_id,
    kennzeichen,
    marke,
    modell,
    vin,
    baujahr,
    farbe,
    farbcode,
  } = req.body;

  const sql = `INSERT INTO fahrzeuge (kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(
    sql,
    [kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID });
    }
  );
});

app.put("/api/fahrzeuge/:id", (req, res) => {
  const { id } = req.params;
  const {
    kunden_id,
    kennzeichen,
    marke,
    modell,
    vin,
    baujahr,
    farbe,
    farbcode,
  } = req.body;

  const sql = `UPDATE fahrzeuge 
               SET kunden_id = ?, kennzeichen = ?, marke = ?, modell = ?, 
                   vin = ?, baujahr = ?, farbe = ?, farbcode = ? 
               WHERE id = ?`;

  db.run(
    sql,
    [kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode, id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: "Fahrzeug nicht gefunden" });
        return;
      }
      res.json({ success: true, changes: this.changes });
    }
  );
});

app.delete("/api/fahrzeuge/:id", (req, res) => {
  const { id } = req.params;

  // Prüfen ob Fahrzeug noch Aufträge hat
  db.get(
    "SELECT COUNT(*) as count FROM auftraege WHERE fahrzeug_id = ?",
    [id],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (row.count > 0) {
        res.status(400).json({
          error:
            "Fahrzeug kann nicht gelöscht werden. Es existieren noch zugehörige Aufträge.",
        });
        return;
      }

      // Fahrzeug löschen
      db.run("DELETE FROM fahrzeuge WHERE id = ?", [id], function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: "Fahrzeug nicht gefunden" });
          return;
        }
        res.json({ success: true, changes: this.changes });
      });
    }
  );
});

// === AUFTRÄGE API ===
app.get("/api/auftraege", (req, res) => {
  const sql = `
        SELECT a.*, k.name as kunde_name, f.kennzeichen, f.marke, f.modell
        FROM auftraege a
        LEFT JOIN kunden k ON a.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON a.fahrzeug_id = f.id
        ORDER BY a.datum DESC, a.auftrag_nr DESC
    `;

  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get("/api/auftraege/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
        SELECT a.*, k.*, f.kennzeichen, f.marke, f.modell, f.vin, f.farbe, f.farbcode
        FROM auftraege a
        LEFT JOIN kunden k ON a.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON a.fahrzeug_id = f.id
        WHERE a.id = ?
    `;

  db.get(sql, [id], (err, auftrag) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!auftrag) {
      res.status(404).json({ error: "Auftrag nicht gefunden" });
      return;
    }

    // Positionen laden
    db.all(
      "SELECT * FROM auftrag_positionen WHERE auftrag_id = ? ORDER BY reihenfolge",
      [id],
      (err, positionen) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        auftrag.positionen = positionen;
        res.json(auftrag);
      }
    );
  });
});

app.post("/api/auftraege", (req, res) => {
  const { kunden_id, fahrzeug_id, datum, positionen, bemerkungen } = req.body;

  generateNextNumber("auftrag", (err, auftragNr) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Basis-Stundenpreis aus Einstellungen holen
    db.get(
      'SELECT value FROM einstellungen WHERE key = "basis_stundenpreis"',
      (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const basisStundenpreis = parseFloat(row?.value || 110);

        // Gesamtzeiten und -kosten berechnen
        let gesamtZeit = 0;
        let gesamtKosten = 0;

        positionen.forEach((pos) => {
          gesamtZeit += parseFloat(pos.zeit || 0);
          gesamtKosten += parseFloat(pos.gesamt || 0);
        });

        const mwstBetrag = gesamtKosten * 0.19;

        const sql = `INSERT INTO auftraege (auftrag_nr, kunden_id, fahrzeug_id, datum, basis_stundenpreis, 
                                               gesamt_zeit, gesamt_kosten, mwst_betrag, bemerkungen) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(
          sql,
          [
            auftragNr,
            kunden_id,
            fahrzeug_id,
            datum,
            basisStundenpreis,
            gesamtZeit,
            gesamtKosten,
            mwstBetrag,
            bemerkungen,
          ],
          function (err) {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            const auftragId = this.lastID;

            // Positionen speichern
            const stmt =
              db.prepare(`INSERT INTO auftrag_positionen (auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?)`);

            positionen.forEach((pos, index) => {
              stmt.run([
                auftragId,
                pos.beschreibung,
                pos.stundenpreis,
                pos.zeit,
                pos.einheit,
                pos.gesamt,
                index,
              ]);
            });

            stmt.finalize();

            res.json({ id: auftragId, auftrag_nr: auftragNr });
          }
        );
      }
    );
  });
});

app.put("/api/auftraege/:id", (req, res) => {
  const { id } = req.params;
  const { kunden_id, fahrzeug_id, datum, positionen, bemerkungen, status } =
    req.body;

  // Basis-Stundenpreis aus Einstellungen holen
  db.get(
    'SELECT value FROM einstellungen WHERE key = "basis_stundenpreis"',
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const basisStundenpreis = parseFloat(row?.value || 110);

      // Gesamtzeiten und -kosten berechnen
      let gesamtZeit = 0;
      let gesamtKosten = 0;

      positionen.forEach((pos) => {
        gesamtZeit += parseFloat(pos.zeit || 0);
        gesamtKosten += parseFloat(pos.gesamt || 0);
      });

      const mwstBetrag = gesamtKosten * 0.19;

      const sql = `UPDATE auftraege 
                   SET kunden_id = ?, fahrzeug_id = ?, datum = ?, basis_stundenpreis = ?,
                       gesamt_zeit = ?, gesamt_kosten = ?, mwst_betrag = ?, bemerkungen = ?, status = ?
                   WHERE id = ?`;

      db.run(
        sql,
        [
          kunden_id,
          fahrzeug_id,
          datum,
          basisStundenpreis,
          gesamtZeit,
          gesamtKosten,
          mwstBetrag,
          bemerkungen,
          status || "offen",
          id,
        ],
        function (err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          if (this.changes === 0) {
            res.status(404).json({ error: "Auftrag nicht gefunden" });
            return;
          }

          // Alte Positionen löschen
          db.run(
            "DELETE FROM auftrag_positionen WHERE auftrag_id = ?",
            [id],
            (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }

              // Neue Positionen speichern
              const stmt =
                db.prepare(`INSERT INTO auftrag_positionen (auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge) 
                                    VALUES (?, ?, ?, ?, ?, ?, ?)`);

              positionen.forEach((pos, index) => {
                stmt.run([
                  id,
                  pos.beschreibung,
                  pos.stundenpreis,
                  pos.zeit,
                  pos.einheit,
                  pos.gesamt,
                  index,
                ]);
              });

              stmt.finalize();
              res.json({ success: true, changes: this.changes });
            }
          );
        }
      );
    }
  );
});

app.delete("/api/auftraege/:id", (req, res) => {
  const { id } = req.params;

  // Prüfen ob Auftrag bereits eine Rechnung hat
  db.get(
    "SELECT COUNT(*) as count FROM rechnungen WHERE auftrag_id = ?",
    [id],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (row.count > 0) {
        res.status(400).json({
          error:
            "Auftrag kann nicht gelöscht werden. Es existiert bereits eine zugehörige Rechnung.",
        });
        return;
      }

      // Erst Positionen löschen
      db.run(
        "DELETE FROM auftrag_positionen WHERE auftrag_id = ?",
        [id],
        (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          // Dann Auftrag löschen
          db.run("DELETE FROM auftraege WHERE id = ?", [id], function (err) {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            if (this.changes === 0) {
              res.status(404).json({ error: "Auftrag nicht gefunden" });
              return;
            }
            res.json({ success: true, changes: this.changes });
          });
        }
      );
    }
  );
});

// === RECHNUNGEN API ===
app.get("/api/rechnungen", (req, res) => {
  const sql = `
        SELECT r.*, k.name as kunde_name, f.kennzeichen, f.marke, f.modell, a.auftrag_nr
        FROM rechnungen r
        LEFT JOIN kunden k ON r.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
        LEFT JOIN auftraege a ON r.auftrag_id = a.id
        ORDER BY r.rechnungsdatum DESC, r.rechnung_nr DESC
    `;

  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get("/api/rechnungen/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
        SELECT r.*, k.name as kunde_name, k.strasse, k.plz, k.ort, k.telefon,
               f.kennzeichen, f.marke, f.modell, f.vin, a.auftrag_nr
        FROM rechnungen r
        LEFT JOIN kunden k ON r.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
        LEFT JOIN auftraege a ON r.auftrag_id = a.id
        WHERE r.id = ?
    `;

  db.get(sql, [id], (err, rechnung) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!rechnung) {
      res.status(404).json({ error: "Rechnung nicht gefunden" });
      return;
    }

    // Positionen laden
    db.all(
      "SELECT * FROM rechnung_positionen WHERE rechnung_id = ? ORDER BY reihenfolge",
      [id],
      (err, positionen) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        rechnung.positionen = positionen;
        res.json(rechnung);
      }
    );
  });
});

app.post("/api/rechnungen", (req, res) => {
  const {
    auftrag_id,
    kunden_id,
    fahrzeug_id,
    rechnungsdatum,
    auftragsdatum,
    positionen,
    rabatt_prozent,
  } = req.body;

  generateNextNumber("rechnung", (err, rechnungNr) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
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

    const rabattProzent = parseFloat(rabatt_prozent || 0);
    const rabattBetrag = zwischensumme * (rabattProzent / 100);
    const nettoNachRabatt = zwischensumme - rabattBetrag;

    const mwst19 = mwst19Basis * (1 - rabattProzent / 100) * 0.19;
    const mwst7 = mwst7Basis * (1 - rabattProzent / 100) * 0.07;
    const gesamtbetrag = nettoNachRabatt + mwst19 + mwst7;

    // Standard-Texte aus Einstellungen holen
    db.all(
      'SELECT key, value FROM einstellungen WHERE key IN ("zahlungsbedingungen", "gewaehrleistung")',
      (err, settings) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const zahlungsbedingungen =
          settings.find((s) => s.key === "zahlungsbedingungen")?.value || "";
        const gewaehrleistung =
          settings.find((s) => s.key === "gewaehrleistung")?.value || "";

        const sql = `INSERT INTO rechnungen (rechnung_nr, auftrag_id, kunden_id, fahrzeug_id, rechnungsdatum, auftragsdatum,
                                               zwischensumme, rabatt_prozent, rabatt_betrag, netto_nach_rabatt,
                                               mwst_19, mwst_7, gesamtbetrag, zahlungsbedingungen, gewaehrleistung) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(
          sql,
          [
            rechnungNr,
            auftrag_id,
            kunden_id,
            fahrzeug_id,
            rechnungsdatum,
            auftragsdatum,
            zwischensumme,
            rabattProzent,
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
              res.status(500).json({ error: err.message });
              return;
            }

            const rechnungId = this.lastID;

            // Positionen speichern
            const stmt =
              db.prepare(`INSERT INTO rechnung_positionen (rechnung_id, kategorie, beschreibung, menge, einheit, einzelpreis, mwst_prozent, gesamt, reihenfolge) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            positionen.forEach((pos, index) => {
              stmt.run([
                rechnungId,
                pos.kategorie,
                pos.beschreibung,
                pos.menge,
                pos.einheit,
                pos.einzelpreis,
                pos.mwst_prozent,
                pos.gesamt,
                index,
              ]);
            });

            stmt.finalize();

            res.json({ id: rechnungId, rechnung_nr: rechnungNr });
          }
        );
      }
    );
  });
});

app.put("/api/rechnungen/:id", (req, res) => {
  const { id } = req.params;
  const {
    auftrag_id,
    kunden_id,
    fahrzeug_id,
    rechnungsdatum,
    auftragsdatum,
    positionen,
    rabatt_prozent,
    status,
  } = req.body;

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

  const rabattProzent = parseFloat(rabatt_prozent || 0);
  const rabattBetrag = zwischensumme * (rabattProzent / 100);
  const nettoNachRabatt = zwischensumme - rabattBetrag;

  const mwst19 = mwst19Basis * (1 - rabattProzent / 100) * 0.19;
  const mwst7 = mwst7Basis * (1 - rabattProzent / 100) * 0.07;
  const gesamtbetrag = nettoNachRabatt + mwst19 + mwst7;

  // Standard-Texte aus Einstellungen holen
  db.all(
    'SELECT key, value FROM einstellungen WHERE key IN ("zahlungsbedingungen", "gewaehrleistung")',
    (err, settings) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const zahlungsbedingungen =
        settings.find((s) => s.key === "zahlungsbedingungen")?.value || "";
      const gewaehrleistung =
        settings.find((s) => s.key === "gewaehrleistung")?.value || "";

      const sql = `UPDATE rechnungen 
                   SET auftrag_id = ?, kunden_id = ?, fahrzeug_id = ?, rechnungsdatum = ?, auftragsdatum = ?,
                       zwischensumme = ?, rabatt_prozent = ?, rabatt_betrag = ?, netto_nach_rabatt = ?,
                       mwst_19 = ?, mwst_7 = ?, gesamtbetrag = ?, zahlungsbedingungen = ?, gewaehrleistung = ?, status = ?
                   WHERE id = ?`;

      db.run(
        sql,
        [
          auftrag_id,
          kunden_id,
          fahrzeug_id,
          rechnungsdatum,
          auftragsdatum,
          zwischensumme,
          rabattProzent,
          rabattBetrag,
          nettoNachRabatt,
          mwst19,
          mwst7,
          gesamtbetrag,
          zahlungsbedingungen,
          gewaehrleistung,
          status || "offen",
          id,
        ],
        function (err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          if (this.changes === 0) {
            res.status(404).json({ error: "Rechnung nicht gefunden" });
            return;
          }

          // Alte Positionen löschen
          db.run(
            "DELETE FROM rechnung_positionen WHERE rechnung_id = ?",
            [id],
            (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }

              // Neue Positionen speichern
              const stmt =
                db.prepare(`INSERT INTO rechnung_positionen (rechnung_id, kategorie, beschreibung, menge, einheit, einzelpreis, mwst_prozent, gesamt, reihenfolge) 
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

              positionen.forEach((pos, index) => {
                stmt.run([
                  id,
                  pos.kategorie,
                  pos.beschreibung,
                  pos.menge,
                  pos.einheit,
                  pos.einzelpreis,
                  pos.mwst_prozent,
                  pos.gesamt,
                  index,
                ]);
              });

              stmt.finalize();
              res.json({ success: true, changes: this.changes });
            }
          );
        }
      );
    }
  );
});

app.delete("/api/rechnungen/:id", (req, res) => {
  const { id } = req.params;

  // Erst Positionen löschen
  db.run(
    "DELETE FROM rechnung_positionen WHERE rechnung_id = ?",
    [id],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Dann Rechnung löschen
      db.run("DELETE FROM rechnungen WHERE id = ?", [id], function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: "Rechnung nicht gefunden" });
          return;
        }
        res.json({ success: true, changes: this.changes });
      });
    }
  );
});

// === EINSTELLUNGEN API ===
app.get("/api/einstellungen", (req, res) => {
  db.all("SELECT * FROM einstellungen ORDER BY key", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.put("/api/einstellungen/:key", (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  db.run(
    "UPDATE einstellungen SET value = ? WHERE key = ?",
    [value, key],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    }
  );
});

// Hauptroute - Frontend ausliefern
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Fehlerbehandlung
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Interner Serverfehler" });
});

// Server starten
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`Öffnen Sie http://localhost:${PORT} in Ihrem Browser`);
});

// Graceful Shutdown
process.on("SIGINT", () => {
  console.log("Server wird heruntergefahren...");
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Datenbankverbindung geschlossen.");
    process.exit(0);
  });
});
