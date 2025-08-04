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

// ✅ Helper-Funktion (falls noch nicht vorhanden)
function calculateProfit(ankaufspreis, verkaufspreis) {
  const ankauf = parseFloat(ankaufspreis) || 0;
  const verkauf = parseFloat(verkaufspreis) || 0;
  return verkauf - ankauf;
}

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
      f.modell as original_modell,
      f.kilometerstand as fahrzeug_kilometerstand,
      -- 🆕 ERWEITERTE KÄUFER-INFO mit kaeufer_id
      k2.name as kaeufer_name,
      k2.kunden_nr as kaeufer_nr,
      k2.telefon as kaeufer_telefon,
      k2.email as kaeufer_email,
      -- 🆕 FALLBACK für verkauft_an ohne kaeufer_id
      k3.name as verkauft_an_kunde_name,
      k3.kunden_nr as verkauft_an_kunde_nr
    FROM fahrzeug_handel fh
    LEFT JOIN kunden k ON fh.kunden_id = k.id
    LEFT JOIN fahrzeuge f ON fh.fahrzeug_id = f.id
    -- 🆕 JOIN über kaeufer_id (preferred)
    LEFT JOIN kunden k2 ON fh.kaeufer_id = k2.id
    -- 🆕 FALLBACK JOIN über verkauft_an (legacy)
    LEFT JOIN kunden k3 ON (
      fh.kaeufer_id IS NULL 
      AND fh.verkauft_an GLOB '[0-9]*' 
      AND CAST(fh.verkauft_an AS INTEGER) = k3.id
    )
    WHERE 1=1
  `;

  const params = [];

  // Suchfilter (erweitert)
  if (search) {
    sql += ` AND (
      fh.handel_nr LIKE ? OR 
      fh.kennzeichen LIKE ? OR 
      fh.marke LIKE ? OR 
      fh.modell LIKE ? OR
      fh.verkauft_an LIKE ? OR
      k.name LIKE ? OR
      k2.name LIKE ? OR
      k3.name LIKE ?
    )`;
    const searchTerm = `%${search}%`;
    params.push(
      searchTerm,
      searchTerm,
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

  console.log(
    "📋 Erweiterte GET /api/fahrzeughandel - SQL:",
    sql.substring(0, 100) + "..."
  );

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ Fehler beim Abrufen der Handelsgeschäfte:", err);
      res.status(500).json({ error: "Datenbankfehler: " + err.message });
      return;
    }

    console.log(`✅ ${rows.length} Handelsgeschäfte gefunden`);

    // 🆕 ERWEITERTE Verkauft_an-Werte für Anzeige anreichern
    rows.forEach((row) => {
      // Priorität: kaeufer_id > verkauft_an als Kunden-ID > verkauft_an als Text
      if (row.kaeufer_name) {
        // Käufer über kaeufer_id gefunden (preferred)
        row.verkauft_an_display = `${row.kaeufer_name} (${row.kaeufer_nr})`;
        row.verkauft_an_type = "kunde_id";
        row.kaeufer_info = {
          id: row.kaeufer_id,
          name: row.kaeufer_name,
          kunden_nr: row.kaeufer_nr,
          telefon: row.kaeufer_telefon,
          email: row.kaeufer_email,
        };
      } else if (row.verkauft_an_kunde_name) {
        // Käufer über verkauft_an als ID gefunden (legacy)
        row.verkauft_an_display = `${row.verkauft_an_kunde_name} (${row.verkauft_an_kunde_nr})`;
        row.verkauft_an_type = "verkauft_an_id";
      } else if (row.verkauft_an) {
        // Verkauft_an als Text
        row.verkauft_an_display = row.verkauft_an;
        row.verkauft_an_type = "text";
      } else {
        // Kein Käufer angegeben
        row.verkauft_an_display = "<em>Nicht angegeben</em>";
        row.verkauft_an_type = "none";
      }
    });

    // Erweiterte Statistiken
    const statsQuery = `
      SELECT 
        COUNT(*) as gesamt,
        COUNT(CASE WHEN typ = 'ankauf' THEN 1 END) as ankauf_count,
        COUNT(CASE WHEN typ = 'verkauf' THEN 1 END) as verkauf_count,
        COUNT(CASE WHEN status = 'offen' THEN 1 END) as offen_count,
        COUNT(CASE WHEN typ = 'verkauf' AND kaeufer_id IS NOT NULL THEN 1 END) as verkauf_mit_kaeufer_id,
        SUM(CASE WHEN typ = 'ankauf' AND status = 'abgeschlossen' THEN ankaufspreis ELSE 0 END) as gesamt_ankauf,
        SUM(CASE WHEN typ = 'verkauf' AND status = 'abgeschlossen' THEN verkaufspreis ELSE 0 END) as gesamt_verkauf,
        SUM(CASE WHEN status = 'abgeschlossen' THEN gewinn ELSE 0 END) as gesamt_gewinn
      FROM fahrzeug_handel
    `;

    db.get(statsQuery, (err, stats) => {
      if (err) {
        console.error("⚠️ Fehler bei Statistiken:", err);
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
  SELECT fh.*,
    k.name as kunde_name,
    k.kunden_nr,
    k.telefon as kunde_telefon,
    k.email as kunde_email,
    f.kennzeichen as original_kennzeichen,
    f.marke as original_marke,
    f.modell as original_modell,
    f.kilometerstand as fahrzeug_kilometerstand,
    COALESCE(fh.vin, f.vin) as vin,
    f.vin as fahrzeug_vin,
    -- 🆕 ERWEITERTE KÄUFER-INFO
    k2.id as kaeufer_kunde_id,
    k2.name as kaeufer_name,
    k2.kunden_nr as kaeufer_nr,
    k2.telefon as kaeufer_telefon,
    k2.email as kaeufer_email,
    k2.strasse as kaeufer_strasse,
    k2.plz as kaeufer_plz,
    k2.ort as kaeufer_ort
  FROM fahrzeug_handel fh
  LEFT JOIN kunden k ON fh.kunden_id = k.id
  LEFT JOIN fahrzeuge f ON fh.fahrzeug_id = f.id
  LEFT JOIN kunden k2 ON fh.kaeufer_id = k2.id
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

    // 🆕 ERWEITERTE Verkauft_an-Werte anreichern
    if (row.kaeufer_name) {
      row.verkauft_an_display = `${row.kaeufer_name} (${row.kaeufer_nr})`;
      row.verkauft_an_type = "kunde_id";
      row.kaeufer_info = {
        id: row.kaeufer_kunde_id,
        name: row.kaeufer_name,
        kunden_nr: row.kaeufer_nr,
        telefon: row.kaeufer_telefon,
        email: row.kaeufer_email,
        adresse: {
          strasse: row.kaeufer_strasse,
          plz: row.kaeufer_plz,
          ort: row.kaeufer_ort,
        },
      };
    } else if (row.verkauft_an) {
      // Fallback: Versuche verkauft_an als Kunden-ID zu interpretieren
      const verkauftAnId = parseInt(row.verkauft_an);
      if (!isNaN(verkauftAnId)) {
        row.verkauft_an_display = `Kunde ID ${verkauftAnId} (nicht verlinkt)`;
        row.verkauft_an_type = "unlinked_id";
      } else {
        row.verkauft_an_display = row.verkauft_an;
        row.verkauft_an_type = "text";
      }
    }

    res.json(row);
  });
});

// ✅ NEUE ROUTE FÜR KÄUFER-STATISTIKEN
router.get("/stats/kaeufer", (req, res) => {
  const sql = `
    SELECT 
      k.id,
      k.name,
      k.kunden_nr,
      COUNT(fh.id) as anzahl_kaeufe,
      SUM(fh.verkaufspreis) as gesamt_kaufvolumen,
      AVG(fh.verkaufspreis) as durchschnitt_kaufpreis,
      MIN(fh.datum) as erster_kauf,
      MAX(fh.datum) as letzter_kauf
    FROM kunden k
    INNER JOIN fahrzeug_handel fh ON k.id = fh.kaeufer_id
    WHERE fh.typ = 'verkauf' AND fh.status = 'abgeschlossen'
    GROUP BY k.id, k.name, k.kunden_nr
    ORDER BY gesamt_kaufvolumen DESC
    LIMIT 20
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      console.error("❌ Fehler bei Käufer-Statistiken:", err);
      res.status(500).json({ error: "Datenbankfehler" });
      return;
    }

    console.log(`📊 ${rows.length} Top-Käufer gefunden`);
    res.json({
      top_kaeufer: rows,
      zeitstempel: new Date().toISOString(),
    });
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
      vin, // 🎯 VIN aus Request lesen
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

    // 🆕 NEUE VALIDIERUNG: Bei neuem Fahrzeug VIN und Kunde prüfen
    if (!fahrzeug_id) {
      if (!vin || vin.length !== 17) {
        return res.status(400).json({
          error: "VIN-Nummer ist erforderlich und muss 17 Zeichen haben",
        });
      }

      if (!kunden_id) {
        return res
          .status(400)
          .json({ error: "Kunde muss bei neuen Fahrzeugen ausgewählt werden" });
      }
    }

    // Automatische Handel-Nr generieren
    const handelNr = await generateHandelNr();

    // Gewinn berechnen
    const gewinn = calculateProfit(ankaufspreis, verkaufspreis);

    let finalFahrzeugId = fahrzeug_id;
    let fahrzeugErstellt = false;

    // Fahrzeug automatisch erstellen wenn nicht ausgewählt
    if (!fahrzeug_id && kennzeichen && marke && modell) {
      console.log(
        "🚗 Erstelle neues Fahrzeug für Handelsgeschäft:",
        kennzeichen
      );

      // Prüfen ob Fahrzeug mit diesem Kennzeichen bereits existiert
      const existingFahrzeug = await new Promise((resolve, reject) => {
        db.get(
          "SELECT id FROM fahrzeuge WHERE UPPER(kennzeichen) = UPPER(?)",
          [kennzeichen],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (existingFahrzeug) {
        // Fahrzeug existiert bereits - verwende bestehende ID
        finalFahrzeugId = existingFahrzeug.id;
        console.log("✅ Verwende bestehendes Fahrzeug ID:", finalFahrzeugId);
      } else {
        // Neues Fahrzeug erstellen - MIT VIN!
        const fahrzeugData = {
          kunden_id: kunden_id,
          kennzeichen: kennzeichen.toUpperCase(),
          marke: marke,
          modell: modell,
          vin: vin, // 🎯 VIN übertragen
          baujahr: baujahr || null,
          farbe: farbe || null,
          farbcode: null,
        };

        const newFahrzeugId = await new Promise((resolve, reject) => {
          const fahrzeugSql = `
            INSERT INTO fahrzeuge (
              kunden_id, kennzeichen, marke, modell, vin, baujahr, farbe, farbcode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.run(
            fahrzeugSql,
            [
              fahrzeugData.kunden_id,
              fahrzeugData.kennzeichen,
              fahrzeugData.marke,
              fahrzeugData.modell,
              fahrzeugData.vin, // 🎯 VIN hier eingefügt
              fahrzeugData.baujahr,
              fahrzeugData.farbe,
              fahrzeugData.farbcode,
            ],
            function (err) {
              if (err) {
                console.error("Fehler beim Erstellen des Fahrzeugs:", err);
                reject(err);
              } else {
                console.log(
                  "✅ Neues Fahrzeug erstellt mit ID:",
                  this.lastID,
                  "VIN:",
                  vin
                );
                resolve(this.lastID);
              }
            }
          );
        });

        finalFahrzeugId = newFahrzeugId;
        fahrzeugErstellt = true;
      }
    }

    // Handelsgeschäft erstellen
    const sql = `
  INSERT INTO fahrzeug_handel (
    handel_nr, typ, kunden_id, fahrzeug_id, datum, kennzeichen, marke, modell, vin,
    baujahr, kilometerstand, farbe, zustand, ankaufspreis, verkaufspreis, gewinn,
    tuev_bis, au_bis, papiere_vollstaendig, bemerkungen, interne_notizen, verkauft_an
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

    const params = [
      handelNr,
      typ,
      kunden_id,
      finalFahrzeugId,
      datum || new Date().toISOString().split("T")[0],
      kennzeichen.toUpperCase(),
      marke,
      modell,
      vin || null, // ✅ VIN hier hinzugefügt!
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
          res.status(500).json({ error: "Datenbankfehler: " + err.message });
        }
        return;
      }

      // Erfolgreiche Antwort
      db.get(
        "SELECT * FROM fahrzeug_handel WHERE id = ?",
        [this.lastID],
        (err, row) => {
          if (err) {
            console.error(
              "Fehler beim Abrufen des erstellten Handelsgeschäfts:",
              err
            );
            res.status(500).json({
              error: "Handelsgeschäft erstellt, aber Abrufen fehlgeschlagen",
            });
            return;
          }

          const response = {
            message: "Handelsgeschäft erfolgreich erstellt",
            id: this.lastID,
            handel_nr: handelNr,
            handelsgeschaeft: row,
            fahrzeug_erstellt: fahrzeugErstellt,
            fahrzeug_id: finalFahrzeugId,
          };

          if (fahrzeugErstellt) {
            response.message += ` (Fahrzeug ${kennzeichen} mit VIN ${vin} automatisch erstellt)`;
            console.log(
              `✅ Handelsgeschäft ${handelNr} und Fahrzeug ${kennzeichen} (VIN: ${vin}) erstellt`
            );
          }

          res.status(201).json(response);
        }
      );
    });
  } catch (error) {
    console.error("Fehler beim Erstellen des Handelsgeschäfts:", error);
    res.status(500).json({ error: "Server-Fehler: " + error.message });
  }
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

router.put("/:id", async (req, res) => {
  console.log("🔄 PUT /api/fahrzeughandel/:id aufgerufen", req.params.id);
  console.log("📋 Request Body:", req.body);

  const { id } = req.params;
  const {
    typ,
    kunden_id,
    fahrzeug_id,
    datum,
    kennzeichen,
    marke,
    modell,
    vin,
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

  // 🔧 DEBUG: Fahrzeug-ID genauer prüfen
  console.log("🔍 Fahrzeug-ID Debug:", {
    fahrzeug_id: fahrzeug_id,
    type: typeof fahrzeug_id,
    isString: typeof fahrzeug_id === "string",
    isNumber: typeof fahrzeug_id === "number",
    parsed: parseInt(fahrzeug_id),
    isEmpty: !fahrzeug_id || fahrzeug_id === "" || fahrzeug_id === "null",
  });

  try {
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

    // Gewinn berechnen
    const gewinn = calculateProfit(ankaufspreis, verkaufspreis);

    console.log("📝 Aktualisiere Handelsgeschäft ID:", id);

    const handelResult = await new Promise((resolve, reject) => {
      const sql = `
        UPDATE fahrzeug_handel SET
          typ = ?, kunden_id = ?, fahrzeug_id = ?, datum = ?, kennzeichen = ?,
          marke = ?, modell = ?, vin = ?, baujahr = ?, kilometerstand = ?, farbe = ?,
          zustand = ?, ankaufspreis = ?, verkaufspreis = ?, gewinn = ?, status = ?,
          tuev_bis = ?, au_bis = ?, papiere_vollstaendig = ?, bemerkungen = ?,
          interne_notizen = ?, verkauft_an = ?, aktualisiert_am = CURRENT_TIMESTAMP,
          abgeschlossen_am = CASE WHEN ? = 'abgeschlossen' AND status != 'abgeschlossen' 
                                  THEN CURRENT_TIMESTAMP ELSE abgeschlossen_am END
        WHERE id = ?
      `;

      const params = [
        typ,
        kunden_id || null,
        fahrzeug_id || null,
        datum,
        kennzeichen.toUpperCase(),
        marke,
        modell,
        vin || null,
        baujahr || null,
        kilometerstand || null,
        farbe || null,
        zustand || "gut",
        parseFloat(ankaufspreis) || 0,
        parseFloat(verkaufspreis) || 0,
        gewinn,
        status || "offen",
        tuev_bis || null,
        au_bis || null,
        papiere_vollstaendig !== false,
        bemerkungen || null,
        interne_notizen || null,
        verkauft_an || null,
        status,
        id,
      ];

      console.log("📝 Handelsgeschäft SQL-Params:", params.slice(0, 10));

      db.run(sql, params, function (err) {
        if (err) {
          console.error("❌ Handelsgeschäft Update Fehler:", err);
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error("Handelsgeschäft nicht gefunden"));
        } else {
          console.log(
            "✅ Handelsgeschäft aktualisiert, Änderungen:",
            this.changes
          );
          resolve(this.changes);
        }
      });
    });

    // ✅ SCHRITT 2: Erweiterte Fahrzeug-Synchronisation mit Besitzerwechsel
    let fahrzeugSyncResult = 0;
    let fahrzeugSyncError = null;
    let besitzerwechselStatus = null;

    const fahrzeugIdNumber = parseInt(fahrzeug_id);
    const hasFahrzeugId =
      fahrzeug_id &&
      fahrzeug_id !== "null" &&
      fahrzeug_id !== "" &&
      !isNaN(fahrzeugIdNumber) &&
      fahrzeugIdNumber > 0;

    console.log("🚗 Fahrzeug-Synchronisation Check:", {
      fahrzeug_id_original: fahrzeug_id,
      fahrzeug_id_parsed: fahrzeugIdNumber,
      has_fahrzeug_id: hasFahrzeugId,
      typ: typ,
      status: status,
      verkauft_an: verkauft_an,
    });

    if (hasFahrzeugId) {
      console.log(
        `🚗 Starte erweiterte Fahrzeug-Synchronisation für ID ${fahrzeugIdNumber}`
      );

      try {
        // Prüfen ob Fahrzeug existiert
        const existingFahrzeug = await new Promise((resolve, reject) => {
          db.get(
            "SELECT * FROM fahrzeuge WHERE id = ?",
            [fahrzeugIdNumber],
            (err, row) => {
              if (err) {
                console.error("❌ Fehler beim Prüfen des Fahrzeugs:", err);
                reject(err);
              } else {
                console.log(
                  "🔍 Gefundenes Fahrzeug:",
                  row
                    ? {
                        id: row.id,
                        kennzeichen: row.kennzeichen,
                        aktueller_besitzer: row.kunden_id,
                        marke: row.marke,
                        modell: row.modell,
                        vin: row.vin,
                      }
                    : null
                );
                resolve(row);
              }
            }
          );
        });

        if (!existingFahrzeug) {
          console.warn(`⚠️ Fahrzeug mit ID ${fahrzeugIdNumber} nicht gefunden`);
          fahrzeugSyncError = `Fahrzeug ID ${fahrzeugIdNumber} nicht gefunden`;
        } else {
          // ✅ NEUE LOGIK: Besitzerwechsel bei Verkaufsabschluss
          let updateData = {
            kennzeichen: kennzeichen.toUpperCase(),
            marke: marke,
            modell: modell,
            vin: vin || existingFahrzeug.vin,
            baujahr: baujahr || existingFahrzeug.baujahr,
            farbe: farbe || existingFahrzeug.farbe,
            kilometerstand:
              kilometerstand || existingFahrzeug.kilometerstand || 0,
            kunden_id: existingFahrzeug.kunden_id, // Standardmäßig alter Besitzer
          };

          // 🎯 KERNFUNKTION: Besitzerwechsel bei abgeschlossenem Verkauf
          if (typ === "verkauf" && status === "abgeschlossen" && verkauft_an) {
            const neuerBesitzerId = parseInt(verkauft_an);

            // Prüfen ob verkauft_an eine gültige Kunden-ID ist
            if (!isNaN(neuerBesitzerId) && neuerBesitzerId > 0) {
              console.log(
                `🔄 BESITZERWECHSEL ERKANNT: Fahrzeug ${kennzeichen} von Kunde ${existingFahrzeug.kunden_id} zu Kunde ${neuerBesitzerId}`
              );

              // Prüfen ob neuer Besitzer existiert
              const neuerBesitzer = await new Promise((resolve, reject) => {
                db.get(
                  "SELECT * FROM kunden WHERE id = ?",
                  [neuerBesitzerId],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });

              if (neuerBesitzer) {
                updateData.kunden_id = neuerBesitzerId;
                besitzerwechselStatus = `Besitzer gewechselt von Kunde ${existingFahrzeug.kunden_id} zu ${neuerBesitzer.name} (${neuerBesitzer.kunden_nr})`;
                console.log(
                  `✅ Neuer Besitzer gefunden: ${neuerBesitzer.name} (${neuerBesitzer.kunden_nr})`
                );
              } else {
                console.warn(
                  `⚠️ Neuer Besitzer ID ${neuerBesitzerId} nicht gefunden - Besitzer bleibt unverändert`
                );
                fahrzeugSyncError = `Neuer Besitzer ID ${neuerBesitzerId} nicht gefunden`;
                besitzerwechselStatus = `Besitzerwechsel fehlgeschlagen - Kunde ${neuerBesitzerId} nicht gefunden`;
              }
            } else {
              console.log(
                `📝 Verkauft_an "${verkauft_an}" ist keine Kunden-ID - Besitzer bleibt unverändert`
              );
              besitzerwechselStatus = `Verkauft_an ist keine Kunden-ID - kein Besitzerwechsel`;
            }
          }

          // Fahrzeug aktualisieren (MIT kilometerstand nach Migration)
          fahrzeugSyncResult = await new Promise((resolve, reject) => {
            const fahrzeugSql = `
              UPDATE fahrzeuge SET
                kunden_id = ?,
                kennzeichen = ?, 
                marke = ?, 
                modell = ?, 
                vin = ?, 
                baujahr = ?, 
                farbe = ?,
                kilometerstand = ?,
                aktualisiert_am = CURRENT_TIMESTAMP
              WHERE id = ?
            `;

            const fahrzeugParams = [
              updateData.kunden_id, // Besitzer (neu oder alt)
              updateData.kennzeichen,
              updateData.marke,
              updateData.modell,
              updateData.vin,
              updateData.baujahr,
              updateData.farbe,
              updateData.kilometerstand,
              fahrzeugIdNumber,
            ];

            console.log("🔄 Fahrzeug-Update SQL-Params:", {
              neuer_besitzer: updateData.kunden_id,
              kennzeichen: updateData.kennzeichen,
              fahrzeug_id: fahrzeugIdNumber,
              vin: updateData.vin,
              farbe: updateData.farbe,
              kilometerstand: updateData.kilometerstand,
            });

            db.run(fahrzeugSql, fahrzeugParams, function (err) {
              if (err) {
                console.error("❌ Fahrzeug-Update SQL Fehler:", err);

                // Fallback: Wenn kilometerstand-Spalte nicht existiert, versuche ohne
                if (err.message.includes("no such column: kilometerstand")) {
                  console.log(
                    "⚠️ kilometerstand-Spalte nicht gefunden - Fallback ohne kilometerstand"
                  );

                  const fallbackSql = `
                    UPDATE fahrzeuge SET
                      kunden_id = ?, kennzeichen = ?, marke = ?, modell = ?, 
                      vin = ?, baujahr = ?, farbe = ?, aktualisiert_am = CURRENT_TIMESTAMP
                    WHERE id = ?
                  `;

                  const fallbackParams = fahrzeugParams
                    .slice(0, -2)
                    .concat([fahrzeugIdNumber]);

                  db.run(fallbackSql, fallbackParams, function (fallbackErr) {
                    if (fallbackErr) {
                      console.error(
                        "❌ Auch Fallback-Update fehlgeschlagen:",
                        fallbackErr
                      );
                      reject(fallbackErr);
                    } else {
                      console.log(
                        "✅ Fallback-Update erfolgreich (ohne kilometerstand)"
                      );
                      console.log(
                        "💡 Tipp: Führen Sie die Kilometerstand-Migration aus für vollständige Funktionalität"
                      );
                      resolve(this.changes);
                    }
                  });
                } else {
                  reject(err);
                }
              } else {
                const changes = this.changes;
                console.log(
                  `🚗 Fahrzeug-Update abgeschlossen - Änderungen: ${changes}`
                );

                if (changes > 0) {
                  console.log(
                    `✅ Fahrzeug ID ${fahrzeugIdNumber} erfolgreich synchronisiert`
                  );

                  // Erfolgreiche Besitzerwechsel-Meldung
                  if (updateData.kunden_id !== existingFahrzeug.kunden_id) {
                    console.log(
                      `🎉 BESITZERWECHSEL ERFOLGREICH: Fahrzeug ${kennzeichen} gehört jetzt Kunde ${updateData.kunden_id}`
                    );
                  }

                  // Kilometerstand-Update-Meldung
                  if (
                    updateData.kilometerstand &&
                    updateData.kilometerstand !==
                      existingFahrzeug.kilometerstand
                  ) {
                    console.log(
                      `📊 KILOMETERSTAND AKTUALISIERT: ${
                        existingFahrzeug.kilometerstand || 0
                      } → ${updateData.kilometerstand} km`
                    );
                  }
                } else {
                  console.warn(
                    `⚠️ Fahrzeug ID ${fahrzeugIdNumber} - keine Änderungen`
                  );
                }

                resolve(changes);
              }
            });
          });
        }
      } catch (fahrzeugError) {
        console.error("❌ Fahrzeug-Synchronisation Fehler:", fahrzeugError);
        fahrzeugSyncError = fahrzeugError.message;
      }
    } else {
      console.log("ℹ️ Keine gültige Fahrzeug-ID - keine Synchronisation", {
        fahrzeug_id,
        fahrzeugIdNumber,
        hasFahrzeugId,
      });
    }

    // ✅ SCHRITT 3: Käufer-ID in Handelsgeschäft aktualisieren (bei abgeschlossenem Verkauf)
    let kaeuferUpdateResult = 0;

    if (typ === "verkauf" && status === "abgeschlossen" && verkauft_an) {
      const neuerBesitzerId = parseInt(verkauft_an);

      if (!isNaN(neuerBesitzerId) && neuerBesitzerId > 0) {
        console.log(
          `💼 Aktualisiere Käufer-ID im Handelsgeschäft für Kunde ${neuerBesitzerId}`
        );

        try {
          // Prüfen ob neuer Käufer existiert und seine Daten abrufen
          const kaeuferInfo = await new Promise((resolve, reject) => {
            db.get(
              "SELECT name, kunden_nr, telefon, email FROM kunden WHERE id = ?",
              [neuerBesitzerId],
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          });

          if (kaeuferInfo) {
            console.log(
              `✅ Käufer-Info gefunden: ${kaeuferInfo.name} (${kaeuferInfo.kunden_nr})`
            );

            // Käufer-ID in fahrzeug_handel-Tabelle setzen
            const updateKaeuferSql = `
              UPDATE fahrzeug_handel 
              SET kaeufer_id = ? 
              WHERE id = ?
            `;

            kaeuferUpdateResult = await new Promise((resolve, reject) => {
              db.run(updateKaeuferSql, [neuerBesitzerId, id], function (err) {
                if (err) {
                  // Fallback: Wenn kaeufer_id-Spalte nicht existiert, weiter ohne Fehler
                  if (err.message.includes("no such column: kaeufer_id")) {
                    console.log(
                      "⚠️ kaeufer_id-Spalte nicht gefunden - Migration erforderlich"
                    );
                    console.log(
                      "💡 Tipp: Führen Sie die Käufer-ID-Migration aus für vollständige Funktionalität"
                    );
                    resolve(0); // Kein Fehler, aber auch kein Update
                  } else {
                    console.error("❌ Käufer-ID-Update fehlgeschlagen:", err);
                    reject(err);
                  }
                } else {
                  console.log(
                    `✅ Käufer-ID in Handelsgeschäft gesetzt: ${neuerBesitzerId}`
                  );
                  resolve(this.changes);
                }
              });
            });

            besitzerwechselStatus = `Fahrzeug verkauft an ${kaeuferInfo.name} (${kaeuferInfo.kunden_nr}) - Besitzer gewechselt, Käufer-ID aktualisiert`;
          } else {
            console.warn(
              `⚠️ Käufer-ID ${neuerBesitzerId} nicht in Kunden-Datenbank gefunden`
            );
            besitzerwechselStatus = `Verkauft_an ID ${neuerBesitzerId} gesetzt - aber Kunde nicht gefunden`;
          }
        } catch (kaeuferError) {
          console.error(
            "❌ Fehler beim Abrufen/Setzen der Käufer-Info:",
            kaeuferError
          );
          besitzerwechselStatus = `Käufer-Update fehlgeschlagen: ${kaeuferError.message}`;
        }
      } else {
        console.log(
          `📝 Verkauft_an "${verkauft_an}" ist keine Kunden-ID - nur verkauft_an gesetzt`
        );
        besitzerwechselStatus = `Verkauft_an als Text gesetzt (${verkauft_an}) - kein Käufer-ID-Update`;
      }
    }

    // ✅ SCHRITT 4: Aktualisierte Daten zurückgeben
    // ✅ SCHRITT 4: Aktualisierte Daten zurückgeben
    const updatedHandel = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM fahrzeug_handel WHERE id = ?", [id], (err, row) => {
        if (err) {
          console.error(
            "❌ Fehler beim Abrufen der aktualisierten Daten:",
            err
          );
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    // 🔧 ERWEITERTE Erfolgreiche Antwort mit Besitzerwechsel-Info
    const response = {
      message: "Handelsgeschäft erfolgreich aktualisiert",
      handelsgeschaeft: updatedHandel,
      updates: {
        handelsgeschaeft: true,
        fahrzeug_synchronisiert: fahrzeugSyncResult > 0,
        fahrzeug_id: hasFahrzeugId ? fahrzeugIdNumber : null,
        fahrzeug_sync_attempts: hasFahrzeugId ? 1 : 0,
        fahrzeug_sync_error: fahrzeugSyncError,
        besitzerwechsel: besitzerwechselStatus,
        kaeufer_update: kaeuferUpdateResult > 0,
      },
    };

    if (fahrzeugSyncResult > 0) {
      response.message += " (Fahrzeugdaten synchronisiert)";
    }

    if (besitzerwechselStatus && besitzerwechselStatus.includes("gewechselt")) {
      response.message += " (Fahrzeug-Besitzer geändert)";
    }

    if (kaeuferUpdateResult > 0) {
      response.message += " (Käufer-Info aktualisiert)";
    }

    if (fahrzeugSyncError) {
      response.message += ` (Fahrzeug-Sync Warnung: ${fahrzeugSyncError})`;
    }

    console.log("✅ PUT Request erfolgreich abgeschlossen:", {
      ...response.updates,
      message: response.message,
    });
    res.json(response);
  } catch (error) {
    console.error("❌ PUT Request Fehler:", error);

    if (error.message === "Handelsgeschäft nicht gefunden") {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Server-Fehler: " + error.message });
    }
  }
});

module.exports = router;
