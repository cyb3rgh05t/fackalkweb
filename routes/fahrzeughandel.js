// routes/fahrzeughandel.js
// API-Route für Fahrzeug Ankauf/Verkauf Funktionalität

const express = require("express");
const router = express.Router();
const db = require("../db");

// Hilfsfunktionen
const generateHandelNr = () => {
  return new Promise((resolve, reject) => {
    // Höchste Handel-Nr finden und +1
    db.get(
      "SELECT handel_nr FROM fahrzeug_handel ORDER BY id DESC LIMIT 1",
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        let nextNr = 1;
        if (row && row.handel_nr) {
          // Extrahiere Nummer aus H000001 Format
          const match = row.handel_nr.match(/H(\d+)/);
          if (match) {
            nextNr = parseInt(match[1]) + 1;
          }
        }

        // Format: H000001
        const handelNr = `H${nextNr.toString().padStart(6, "0")}`;
        resolve(handelNr);
      }
    );
  });
};

const calculateProfit = (ankaufspreis, verkaufspreis) => {
  const ankauf = parseFloat(ankaufspreis) || 0;
  const verkauf = parseFloat(verkaufspreis) || 0;
  return verkauf - ankauf;
};

// GET /api/fahrzeughandel - Alle Handelsgeschäfte abrufen
router.get("/", (req, res) => {
  const { search, typ, status, limit = 50, offset = 0 } = req.query;

  let sql = `
    SELECT 
      fh.*,
      k.name as kunde_name,
      k.kunden_nr,
      f.kennzeichen as original_kennzeichen,
      f.marke as original_marke,
      f.modell as original_modell
    FROM fahrzeug_handel fh
    LEFT JOIN kunden k ON fh.kunden_id = k.id
    LEFT JOIN fahrzeuge f ON fh.fahrzeug_id = f.id
    WHERE 1=1
  `;

  const params = [];

  // Suchfilter
  if (search) {
    sql += ` AND (
      fh.handel_nr LIKE ? OR 
      fh.kennzeichen LIKE ? OR 
      fh.marke LIKE ? OR 
      fh.modell LIKE ? OR
      fh.verkauft_an LIKE ? OR
      k.name LIKE ?
    )`;
    const searchTerm = `%${search}%`;
    params.push(
      searchTerm,
      searchTerm,
      searchTerm,
      searchTerm,
      searchTerm,
      searchTerm
    );
  }

  // Typ-Filter
  if (typ && ["ankauf", "verkauf"].includes(typ)) {
    sql += ` AND fh.typ = ?`;
    params.push(typ);
  }

  // Status-Filter
  if (status && ["offen", "abgeschlossen", "storniert"].includes(status)) {
    sql += ` AND fh.status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY fh.datum DESC, fh.id DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Fehler beim Abrufen der Handelsgeschäfte:", err);
      res.status(500).json({ error: "Datenbankfehler" });
      return;
    }

    // Zusätzliche Statistiken abrufen
    const statsQuery = `
      SELECT 
        COUNT(*) as gesamt,
        COUNT(CASE WHEN typ = 'ankauf' THEN 1 END) as ankauf_count,
        COUNT(CASE WHEN typ = 'verkauf' THEN 1 END) as verkauf_count,
        COUNT(CASE WHEN status = 'offen' THEN 1 END) as offen_count,
        SUM(CASE WHEN typ = 'ankauf' AND status = 'abgeschlossen' THEN ankaufspreis ELSE 0 END) as gesamt_ankauf,
        SUM(CASE WHEN typ = 'verkauf' AND status = 'abgeschlossen' THEN verkaufspreis ELSE 0 END) as gesamt_verkauf,
        SUM(CASE WHEN status = 'abgeschlossen' THEN gewinn ELSE 0 END) as gesamt_gewinn
      FROM fahrzeug_handel
    `;

    db.get(statsQuery, (err, stats) => {
      if (err) {
        console.error("Fehler bei Statistiken:", err);
        stats = {};
      }

      res.json({
        handelsgeschaefte: rows,
        stats: stats || {},
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: rows.length,
        },
      });
    });
  });
});

// GET /api/fahrzeughandel/:id - Einzelnes Handelsgeschäft abrufen
router.get("/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      fh.*,
      k.name as kunde_name,
      k.kunden_nr,
      k.telefon as kunde_telefon,
      k.email as kunde_email,
      f.kennzeichen as original_kennzeichen,
      f.marke as original_marke,
      f.modell as original_modell,
      f.vin as original_vin
    FROM fahrzeug_handel fh
    LEFT JOIN kunden k ON fh.kunden_id = k.id
    LEFT JOIN fahrzeuge f ON fh.fahrzeug_id = f.id
    WHERE fh.id = ?
  `;

  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error("Fehler beim Abrufen des Handelsgeschäfts:", err);
      res.status(500).json({ error: "Datenbankfehler" });
      return;
    }

    if (!row) {
      res.status(404).json({ error: "Handelsgeschäft nicht gefunden" });
      return;
    }

    res.json(row);
  });
});

// POST /api/fahrzeughandel - Neues Handelsgeschäft erstellen
router.post("/", async (req, res) => {
  try {
    const {
      typ,
      kunden_id,
      fahrzeug_id,
      datum,
      kennzeichen,
      marke,
      modell,
      baujahr,
      kilometerstand,
      farbe,
      zustand,
      ankaufspreis,
      verkaufspreis,
      tuev_bis,
      au_bis,
      papiere_vollstaendig,
      bemerkungen,
      interne_notizen,
      verkauft_an,
    } = req.body;

    // Validierung
    if (!typ || !["ankauf", "verkauf"].includes(typ)) {
      return res
        .status(400)
        .json({ error: "Gültiger Typ (ankauf/verkauf) erforderlich" });
    }

    if (!kennzeichen || !marke || !modell) {
      return res
        .status(400)
        .json({ error: "Kennzeichen, Marke und Modell sind erforderlich" });
    }

    // Automatische Handel-Nr generieren
    const handelNr = await generateHandelNr();

    // Gewinn berechnen
    const gewinn = calculateProfit(ankaufspreis, verkaufspreis);

    const sql = `
      INSERT INTO fahrzeug_handel (
        handel_nr, typ, kunden_id, fahrzeug_id, datum, kennzeichen, marke, modell,
        baujahr, kilometerstand, farbe, zustand, ankaufspreis, verkaufspreis, gewinn,
        tuev_bis, au_bis, papiere_vollstaendig, bemerkungen, interne_notizen, verkauft_an
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      handelNr,
      typ,
      kunden_id,
      fahrzeug_id,
      datum || new Date().toISOString().split("T")[0],
      kennzeichen,
      marke,
      modell,
      baujahr,
      kilometerstand,
      farbe,
      zustand || "gut",
      parseFloat(ankaufspreis) || 0,
      parseFloat(verkaufspreis) || 0,
      gewinn,
      tuev_bis,
      au_bis,
      papiere_vollstaendig !== false,
      bemerkungen,
      interne_notizen,
      verkauft_an,
    ];

    db.run(sql, params, function (err) {
      if (err) {
        console.error("Fehler beim Erstellen des Handelsgeschäfts:", err);
        if (err.message.includes("UNIQUE constraint failed")) {
          res.status(400).json({ error: "Handel-Nr bereits vorhanden" });
        } else {
          res.status(500).json({ error: "Datenbankfehler" });
        }
        return;
      }

      // Neu erstelltes Handelsgeschäft abrufen
      db.get(
        "SELECT * FROM fahrzeug_handel WHERE id = ?",
        [this.lastID],
        (err, row) => {
          if (err) {
            console.error(
              "Fehler beim Abrufen des erstellten Handelsgeschäfts:",
              err
            );
            res
              .status(500)
              .json({
                error: "Handelsgeschäft erstellt, aber Abrufen fehlgeschlagen",
              });
            return;
          }

          res.status(201).json({
            message: "Handelsgeschäft erfolgreich erstellt",
            id: this.lastID,
            handel_nr: handelNr,
            handelsgeschaeft: row,
          });
        }
      );
    });
  } catch (error) {
    console.error("Fehler beim Erstellen des Handelsgeschäfts:", error);
    res.status(500).json({ error: "Server-Fehler" });
  }
});

// PUT /api/fahrzeughandel/:id - Handelsgeschäft aktualisieren
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const {
    typ,
    kunden_id,
    fahrzeug_id,
    datum,
    kennzeichen,
    marke,
    modell,
    baujahr,
    kilometerstand,
    farbe,
    zustand,
    ankaufspreis,
    verkaufspreis,
    status,
    tuev_bis,
    au_bis,
    papiere_vollstaendig,
    bemerkungen,
    interne_notizen,
    verkauft_an,
  } = req.body;

  // Gewinn neu berechnen
  const gewinn = calculateProfit(ankaufspreis, verkaufspreis);

  const sql = `
    UPDATE fahrzeug_handel SET
      typ = ?, kunden_id = ?, fahrzeug_id = ?, datum = ?, kennzeichen = ?,
      marke = ?, modell = ?, baujahr = ?, kilometerstand = ?, farbe = ?,
      zustand = ?, ankaufspreis = ?, verkaufspreis = ?, gewinn = ?, status = ?,
      tuev_bis = ?, au_bis = ?, papiere_vollstaendig = ?, bemerkungen = ?,
      interne_notizen = ?, verkauft_an = ?, aktualisiert_am = CURRENT_TIMESTAMP,
      abgeschlossen_am = CASE WHEN ? = 'abgeschlossen' AND status != 'abgeschlossen' 
                              THEN CURRENT_TIMESTAMP ELSE abgeschlossen_am END
    WHERE id = ?
  `;

  const params = [
    typ,
    kunden_id,
    fahrzeug_id,
    datum,
    kennzeichen,
    marke,
    modell,
    baujahr,
    kilometerstand,
    farbe,
    zustand,
    parseFloat(ankaufspreis) || 0,
    parseFloat(verkaufspreis) || 0,
    gewinn,
    status,
    tuev_bis,
    au_bis,
    papiere_vollstaendig !== false,
    bemerkungen,
    interne_notizen,
    verkauft_an,
    status,
    id,
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error("Fehler beim Aktualisieren des Handelsgeschäfts:", err);
      res.status(500).json({ error: "Datenbankfehler" });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: "Handelsgeschäft nicht gefunden" });
      return;
    }

    // Aktualisiertes Handelsgeschäft abrufen
    db.get("SELECT * FROM fahrzeug_handel WHERE id = ?", [id], (err, row) => {
      if (err) {
        console.error(
          "Fehler beim Abrufen des aktualisierten Handelsgeschäfts:",
          err
        );
        res
          .status(500)
          .json({
            error: "Aktualisierung erfolgreich, aber Abrufen fehlgeschlagen",
          });
        return;
      }

      res.json({
        message: "Handelsgeschäft erfolgreich aktualisiert",
        handelsgeschaeft: row,
      });
    });
  });
});

// DELETE /api/fahrzeughandel/:id - Handelsgeschäft löschen
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  // Erst prüfen ob existiert
  db.get(
    "SELECT handel_nr FROM fahrzeug_handel WHERE id = ?",
    [id],
    (err, row) => {
      if (err) {
        console.error("Fehler beim Prüfen des Handelsgeschäfts:", err);
        res.status(500).json({ error: "Datenbankfehler" });
        return;
      }

      if (!row) {
        res.status(404).json({ error: "Handelsgeschäft nicht gefunden" });
        return;
      }

      // Löschen
      db.run("DELETE FROM fahrzeug_handel WHERE id = ?", [id], function (err) {
        if (err) {
          console.error("Fehler beim Löschen des Handelsgeschäfts:", err);
          res.status(500).json({ error: "Datenbankfehler" });
          return;
        }

        res.json({
          message: "Handelsgeschäft erfolgreich gelöscht",
          handel_nr: row.handel_nr,
        });
      });
    }
  );
});

// GET /api/fahrzeughandel/stats/dashboard - Dashboard-Statistiken
router.get("/stats/dashboard", (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as gesamt_geschaefte,
      COUNT(CASE WHEN status = 'offen' THEN 1 END) as offene_geschaefte,
      COUNT(CASE WHEN typ = 'ankauf' AND status = 'abgeschlossen' THEN 1 END) as abgeschlossene_ankaeufe,
      COUNT(CASE WHEN typ = 'verkauf' AND status = 'abgeschlossen' THEN 1 END) as abgeschlossene_verkaeufe,
      SUM(CASE WHEN typ = 'ankauf' AND status = 'abgeschlossen' THEN ankaufspreis ELSE 0 END) as gesamt_ankaufsvolumen,
      SUM(CASE WHEN typ = 'verkauf' AND status = 'abgeschlossen' THEN verkaufspreis ELSE 0 END) as gesamt_verkaufsvolumen,
      SUM(CASE WHEN status = 'abgeschlossen' THEN gewinn ELSE 0 END) as gesamt_gewinn,
      AVG(CASE WHEN status = 'abgeschlossen' AND gewinn > 0 THEN gewinn ELSE NULL END) as durchschnittlicher_gewinn
    FROM fahrzeug_handel
  `;

  db.get(sql, (err, stats) => {
    if (err) {
      console.error("Fehler bei Dashboard-Statistiken:", err);
      res.status(500).json({ error: "Datenbankfehler" });
      return;
    }

    // Letzte 5 Geschäfte
    const recentSql = `
      SELECT handel_nr, typ, datum, marke, modell, kennzeichen, status, gewinn
      FROM fahrzeug_handel 
      ORDER BY datum DESC, id DESC 
      LIMIT 5
    `;

    db.all(recentSql, (err, recent) => {
      if (err) {
        console.error("Fehler bei letzten Geschäften:", err);
        recent = [];
      }

      res.json({
        stats: stats || {},
        recent_geschaefte: recent || [],
      });
    });
  });
});

// GET /api/fahrzeughandel/options/kunden - Kunden für Dropdown
router.get("/options/kunden", (req, res) => {
  db.all(
    "SELECT id, kunden_nr, name FROM kunden ORDER BY name",
    (err, rows) => {
      if (err) {
        console.error("Fehler beim Abrufen der Kunden:", err);
        res.status(500).json({ error: "Datenbankfehler" });
        return;
      }
      res.json(rows);
    }
  );
});

// GET /api/fahrzeughandel/options/fahrzeuge - Fahrzeuge für Dropdown
router.get("/options/fahrzeuge", (req, res) => {
  const sql = `
    SELECT f.id, f.kennzeichen, f.marke, f.modell, f.baujahr, k.name as besitzer
    FROM fahrzeuge f
    LEFT JOIN kunden k ON f.kunden_id = k.id
    ORDER BY f.kennzeichen
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      console.error("Fehler beim Abrufen der Fahrzeuge:", err);
      res.status(500).json({ error: "Datenbankfehler" });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;
