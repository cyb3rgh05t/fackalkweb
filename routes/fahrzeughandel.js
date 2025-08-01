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
      -- 🆕 Käufer-Info für Anzeige
      k2.name as kaeufer_name,
      k2.kunden_nr as kaeufer_nr
    FROM fahrzeug_handel fh
    LEFT JOIN kunden k ON fh.kunden_id = k.id
    LEFT JOIN fahrzeuge f ON fh.fahrzeug_id = f.id
    -- 🆕 JOIN für Käufer-Daten
    LEFT JOIN kunden k2 ON (
      CASE 
        WHEN fh.verkauft_an GLOB '[0-9]*' 
        THEN CAST(fh.verkauft_an AS INTEGER) = k2.id
        ELSE 0
      END
    )
    WHERE 1=1
  `;

  const params = []; // 🎯 HIER war das Problem - params war nicht definiert!

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

  console.log(
    "📋 GET /api/fahrzeughandel - SQL:",
    sql.substring(0, 100) + "..."
  );
  console.log("📋 GET /api/fahrzeughandel - Params:", params);

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ Fehler beim Abrufen der Handelsgeschäfte:", err);
      res.status(500).json({ error: "Datenbankfehler: " + err.message });
      return;
    }

    console.log(`✅ ${rows.length} Handelsgeschäfte gefunden`);

    // 🆕 Verkauft_an Werte für Anzeige anreichern
    rows.forEach((row) => {
      if (row.kaeufer_name) {
        row.verkauft_an_display = `${row.kaeufer_name} (${row.kaeufer_nr})`;
      } else if (row.verkauft_an) {
        row.verkauft_an_display = row.verkauft_an;
      }
    });

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
    COALESCE(fh.vin, f.vin) as vin, -- VIN aus Handelsgeschäft, fallback auf Fahrzeug
    f.vin as fahrzeug_vin, -- Original VIN aus Fahrzeug
    k2.name as kaeufer_name,
    k2.kunden_nr as kaeufer_nr
  FROM fahrzeug_handel fh
  LEFT JOIN kunden k ON fh.kunden_id = k.id
  LEFT JOIN fahrzeuge f ON fh.fahrzeug_id = f.id
  LEFT JOIN kunden k2 ON (
    CASE 
      WHEN fh.verkauft_an GLOB '[0-9]*' 
      THEN CAST(fh.verkauft_an AS INTEGER) = k2.id
      ELSE 0
    END
  )
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

    // 🆕 Verkauft_an Wert anreichern
    if (row.kaeufer_name) {
      row.verkauft_an_display = `${row.kaeufer_name} (${row.kaeufer_nr})`;
      row.verkauft_an_type = "kunde";
    } else if (row.verkauft_an) {
      row.verkauft_an_display = row.verkauft_an;
      row.verkauft_an_type = "text";
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

    // ✅ SCHRITT 1: Handelsgeschäft aktualisieren
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

      console.log("📝 Handelsgeschäft SQL-Params:", params.slice(0, 10)); // Erste 10 Params zeigen

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

    // ✅ SCHRITT 2: Fahrzeug synchronisieren - VERBESSERTE LOGIC
    let fahrzeugSyncResult = 0;
    let fahrzeugSyncError = null;

    // 🔧 REPARIERT: Bessere Fahrzeug-ID-Prüfung
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
    });

    if (hasFahrzeugId) {
      console.log(
        `🚗 Starte Fahrzeug-Synchronisation für ID ${fahrzeugIdNumber}`
      );

      try {
        // 🔧 ZUERST: Prüfen ob Fahrzeug existiert
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
          console.warn(
            `⚠️ Fahrzeug mit ID ${fahrzeugIdNumber} nicht gefunden - Skip Synchronisation`
          );
          fahrzeugSyncError = `Fahrzeug ID ${fahrzeugIdNumber} nicht gefunden`;
        } else {
          // Fahrzeug existiert - synchronisieren
          fahrzeugSyncResult = await new Promise((resolve, reject) => {
            const fahrzeugSql = `
              UPDATE fahrzeuge SET
                kennzeichen = ?, marke = ?, modell = ?, vin = ?, 
                baujahr = ?, farbe = ?, kunden_id = ?, 
                aktualisiert_am = CURRENT_TIMESTAMP
              WHERE id = ?
            `;

            const fahrzeugParams = [
              kennzeichen.toUpperCase(),
              marke,
              modell,
              vin || null,
              baujahr || null,
              farbe || null,
              kunden_id || null,
              fahrzeugIdNumber,
            ];

            console.log("🚗 Fahrzeug-Update SQL:", fahrzeugSql);
            console.log("🚗 Fahrzeug-Update Params:", fahrzeugParams);

            db.run(fahrzeugSql, fahrzeugParams, function (err) {
              if (err) {
                console.error("❌ Fahrzeug-Update SQL Fehler:", err);
                reject(err);
              } else {
                const changes = this.changes;
                console.log(
                  `🚗 Fahrzeug-Update abgeschlossen - Änderungen: ${changes}`
                );
                if (changes > 0) {
                  console.log(
                    `✅ Fahrzeug ID ${fahrzeugIdNumber} erfolgreich synchronisiert`
                  );
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
        // Nicht den ganzen Request abbrechen
      }
    } else {
      console.log("ℹ️ Keine gültige Fahrzeug-ID - keine Synchronisation", {
        fahrzeug_id,
        fahrzeugIdNumber,
        hasFahrzeugId,
      });
    }

    // ✅ SCHRITT 3: Aktualisierte Daten zurückgeben
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

    // 🔧 VERBESSERTE Erfolgreiche Antwort
    const response = {
      message: "Handelsgeschäft erfolgreich aktualisiert",
      handelsgeschaeft: updatedHandel,
      updates: {
        handelsgeschaeft: true,
        fahrzeug_synchronisiert: fahrzeugSyncResult > 0,
        fahrzeug_id: hasFahrzeugId ? fahrzeugIdNumber : null,
        fahrzeug_sync_attempts: hasFahrzeugId ? 1 : 0,
        fahrzeug_sync_error: fahrzeugSyncError,
      },
    };

    if (fahrzeugSyncResult > 0) {
      response.message += " (Fahrzeugdaten synchronisiert)";
    } else if (fahrzeugSyncError) {
      response.message += ` (Fahrzeug-Sync fehlgeschlagen: ${fahrzeugSyncError})`;
    }

    console.log("✅ PUT Request erfolgreich abgeschlossen:", response.updates);
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
