const db = require("../db");

const Rechnung = {
  /**
   * Alle Rechnungen mit Grunddaten abrufen
   * @returns {Promise<Array>} Liste aller Rechnungen
   */
  findAll: () =>
    new Promise((resolve, reject) => {
      const sql = `
        SELECT r.*, 
               k.name as kunde_name, 
               k.kunden_nr,
               f.kennzeichen, 
               f.marke, 
               f.modell, 
               a.auftrag_nr
        FROM rechnungen r
        LEFT JOIN kunden k ON r.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
        LEFT JOIN auftraege a ON r.auftrag_id = a.id
        ORDER BY r.rechnungsdatum DESC, r.rechnung_nr DESC`;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden aller Rechnungen:", err);
          return reject(err);
        }
        resolve(rows);
      });
    }),

  /**
   * Einzelne Rechnung mit allen Details abrufen
   * @param {number} id - Rechnungs-ID
   * @returns {Promise<Object|null>} Rechnung mit Positionen oder null
   */
  findById: (id) =>
    new Promise((resolve, reject) => {
      const sql = `
        SELECT r.*, 
               k.name as kunde_name, 
               k.kunden_nr, 
               k.strasse, 
               k.plz, 
               k.ort, 
               k.telefon, 
               k.email,
               f.kennzeichen, 
               f.marke, 
               f.modell, 
               f.vin, 
               f.farbe, 
               f.farbcode,
               a.auftrag_nr,
               a.datum as auftragsdatum_original
        FROM rechnungen r
        LEFT JOIN kunden k ON r.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
        LEFT JOIN auftraege a ON r.auftrag_id = a.id
        WHERE r.id = ?`;

      db.get(sql, [id], (err, rechnung) => {
        if (err) {
          console.error("Fehler beim Laden der Rechnung:", err);
          return reject(err);
        }

        if (!rechnung) {
          return resolve(null);
        }

        // Positionen laden
        db.all(
          "SELECT * FROM rechnung_positionen WHERE rechnung_id = ? ORDER BY reihenfolge ASC",
          [id],
          (err2, positionen) => {
            if (err2) {
              console.error("Fehler beim Laden der Rechnungspositionen:", err2);
              return reject(err2);
            }

            rechnung.positionen = positionen || [];
            resolve(rechnung);
          }
        );
      });
    }),

  /**
   * Neue Rechnung erstellen
   * @param {Object} data - Rechnungsdaten
   * @returns {Promise<Object>} Erstellte Rechnung mit ID und Nummer
   */
  create: (data) =>
    new Promise((resolve, reject) => {
      // Nächste Rechnungsnummer generieren
      Rechnung._getNextRechnungNr()
        .then((rechnung_nr) => {
          const stmt = db.prepare(`
          INSERT INTO rechnungen (
            rechnung_nr, auftrag_id, kunden_id, fahrzeug_id, 
            rechnungsdatum, auftragsdatum, status,
            zwischensumme, rabatt_prozent, rabatt_betrag, 
            netto_nach_rabatt, mwst_19, mwst_7, gesamtbetrag,
            zahlungsbedingungen, gewaehrleistung, rechnungshinweise,
            skonto_aktiv, skonto_betrag
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

          stmt.run(
            [
              rechnung_nr,
              data.auftrag_id || null,
              data.kunden_id,
              data.fahrzeug_id,
              data.rechnungsdatum,
              data.auftragsdatum || null,
              data.status || "offen",
              parseFloat(data.zwischensumme) || 0,
              parseFloat(data.rabatt_prozent) || 0,
              parseFloat(data.rabatt_betrag) || 0,
              parseFloat(data.netto_nach_rabatt) || 0,
              parseFloat(data.mwst_19) || 0,
              parseFloat(data.mwst_7) || 0,
              parseFloat(data.gesamtbetrag) || 0,
              data.zahlungsbedingungen || "",
              data.gewaehrleistung || "",
              data.rechnungshinweise || "",
              data.skonto_aktiv ? 1 : 0, // NEU: Skonto-Checkbox
              parseFloat(data.skonto_betrag) || 0, // NEU: Skonto-Betrag
            ],
            function (err) {
              if (err) {
                console.error("Fehler beim Erstellen der Rechnung:", err);
                return reject(err);
              }

              const rechnungId = this.lastID;

              // Positionen einfügen
              Rechnung._insertPositionen(rechnungId, data.positionen)
                .then(() => {
                  // Rechnungsnummer erhöhen
                  Rechnung._incrementRechnungNr()
                    .then(() => {
                      resolve({ id: rechnungId, rechnung_nr });
                    })
                    .catch(reject);
                })
                .catch(reject);
            }
          );
        })
        .catch(reject);
    }),

  /**
   * Rechnung aktualisieren
   * @param {number} id - Rechnungs-ID
   * @param {Object} data - Aktualisierte Rechnungsdaten
   * @returns {Promise<Object>} Aktualisierungsresultat
   */
  update: (id, data) =>
    new Promise((resolve, reject) => {
      const stmt = db.prepare(`
      UPDATE rechnungen SET
        auftrag_id = ?, kunden_id = ?, fahrzeug_id = ?,
        rechnungsdatum = ?, auftragsdatum = ?, status = ?,
        zwischensumme = ?, rabatt_prozent = ?, rabatt_betrag = ?,
        netto_nach_rabatt = ?, mwst_19 = ?, mwst_7 = ?, gesamtbetrag = ?,
        zahlungsbedingungen = ?, gewaehrleistung = ?, rechnungshinweise = ?,
        skonto_aktiv = ?, skonto_betrag = ?,
        aktualisiert_am = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

      stmt.run(
        [
          data.auftrag_id || null,
          data.kunden_id,
          data.fahrzeug_id,
          data.rechnungsdatum,
          data.auftragsdatum || null,
          data.status || "offen",
          parseFloat(data.zwischensumme) || 0,
          parseFloat(data.rabatt_prozent) || 0,
          parseFloat(data.rabatt_betrag) || 0,
          parseFloat(data.netto_nach_rabatt) || 0,
          parseFloat(data.mwst_19) || 0,
          parseFloat(data.mwst_7) || 0,
          parseFloat(data.gesamtbetrag) || 0,
          data.zahlungsbedingungen || "",
          data.gewaehrleistung || "",
          data.rechnungshinweise || "",
          data.skonto_aktiv ? 1 : 0, // NEU: Skonto-Checkbox
          parseFloat(data.skonto_betrag) || 0, // NEU: Skonto-Betrag
          id,
        ],
        function (err) {
          if (err) {
            console.error("Fehler beim Aktualisieren der Rechnung:", err);
            return reject(err);
          }

          if (this.changes === 0) {
            return reject(new Error("Rechnung nicht gefunden"));
          }

          // Bestehende Positionen löschen
          db.run(
            "DELETE FROM rechnung_positionen WHERE rechnung_id = ?",
            [id],
            (err) => {
              if (err) return reject(err);

              // Neue Positionen einfügen
              Rechnung._insertPositionen(id, data.positionen)
                .then(() => resolve({ id }))
                .catch(reject);
            }
          );
        }
      );
    }),

  /**
   * Rechnung löschen
   * @param {number} id - Rechnungs-ID
   * @returns {Promise<Object>} Löschresultat
   */
  remove: (id) =>
    new Promise((resolve, reject) => {
      const sql = "DELETE FROM rechnungen WHERE id = ?";

      db.run(sql, [id], function (err) {
        if (err) {
          console.error("Fehler beim Löschen der Rechnung:", err);
          return reject(err);
        }

        resolve({
          changes: this.changes,
          message:
            this.changes > 0
              ? "Rechnung erfolgreich gelöscht"
              : "Rechnung nicht gefunden",
        });
      });
    }),

  /**
   * Rechnungsstatus aktualisieren
   * @param {number} id - Rechnungs-ID
   * @param {string} status - Neuer Status ('offen', 'bezahlt', 'mahnung', 'storniert')
   * @returns {Promise<Object>} Aktualisierungsresultat
   */
  updateStatus: (id, status) =>
    new Promise((resolve, reject) => {
      const validStatuses = ["offen", "bezahlt", "mahnung", "storniert"];

      if (!validStatuses.includes(status)) {
        return reject(new Error(`Ungültiger Status: ${status}`));
      }

      const sql =
        "UPDATE rechnungen SET status = ?, aktualisiert_am = CURRENT_TIMESTAMP WHERE id = ?";

      db.run(sql, [status, id], function (err) {
        if (err) {
          console.error("Fehler beim Aktualisieren des Rechnungsstatus:", err);
          return reject(err);
        }

        resolve({
          changes: this.changes,
          status: status,
          message:
            this.changes > 0
              ? "Status erfolgreich aktualisiert"
              : "Rechnung nicht gefunden",
        });
      });
    }),

  /**
   * Rechnungen nach Kunden-ID abrufen
   * @param {number} kundenId - Kunden-ID
   * @returns {Promise<Array>} Liste der Rechnungen des Kunden
   */
  findByKundenId: (kundenId) =>
    new Promise((resolve, reject) => {
      const sql = `
        SELECT r.*, 
               k.name as kunde_name, 
               f.kennzeichen, 
               f.marke, 
               f.modell
        FROM rechnungen r
        LEFT JOIN kunden k ON r.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
        WHERE r.kunden_id = ?
        ORDER BY r.rechnungsdatum DESC`;

      db.all(sql, [kundenId], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Kundenrechnungen:", err);
          return reject(err);
        }
        resolve(rows);
      });
    }),

  /**
   * Rechnungen nach Status abrufen
   * @param {string} status - Status ('offen', 'bezahlt', 'mahnung', 'storniert')
   * @returns {Promise<Array>} Liste der Rechnungen mit dem Status
   */
  findByStatus: (status) =>
    new Promise((resolve, reject) => {
      const sql = `
        SELECT r.*, 
               k.name as kunde_name, 
               f.kennzeichen, 
               f.marke, 
               f.modell
        FROM rechnungen r
        LEFT JOIN kunden k ON r.kunden_id = k.id
        LEFT JOIN fahrzeuge f ON r.fahrzeug_id = f.id
        WHERE r.status = ?
        ORDER BY r.rechnungsdatum DESC`;

      db.all(sql, [status], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Rechnungen nach Status:", err);
          return reject(err);
        }
        resolve(rows);
      });
    }),

  /**
   * Rechnungsstatistiken abrufen
   * @returns {Promise<Object>} Statistiken
   */
  getStatistics: () =>
    new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as gesamt_rechnungen,
          COUNT(CASE WHEN status = 'offen' THEN 1 END) as offene_rechnungen,
          COUNT(CASE WHEN status = 'bezahlt' THEN 1 END) as bezahlte_rechnungen,
          COUNT(CASE WHEN status = 'mahnung' THEN 1 END) as mahnungen,
          COUNT(CASE WHEN status = 'storniert' THEN 1 END) as stornierte_rechnungen,
          SUM(CASE WHEN status = 'offen' THEN gesamtbetrag ELSE 0 END) as offener_betrag,
          SUM(CASE WHEN status = 'bezahlt' THEN gesamtbetrag ELSE 0 END) as bezahlter_betrag,
          SUM(gesamtbetrag) as gesamt_betrag
        FROM rechnungen
        WHERE rechnungsdatum >= date('now', '-12 months')`;

      db.get(sql, [], (err, stats) => {
        if (err) {
          console.error("Fehler beim Laden der Rechnungsstatistiken:", err);
          return reject(err);
        }
        resolve(stats);
      });
    }),

  /**
   * Nächste Rechnungsnummer generieren
   * @returns {Promise<string>} Nächste Rechnungsnummer
   */
  _getNextRechnungNr: () =>
    new Promise((resolve, reject) => {
      // Aktuelle Nummer und Präfix aus Einstellungen holen
      db.all(
        'SELECT key, value FROM einstellungen WHERE key IN ("next_rechnung_nr", "rechnung_prefix")',
        [],
        (err, settings) => {
          if (err) {
            console.error(
              "Fehler beim Laden der Rechnungsnummer-Einstellungen:",
              err
            );
            return reject(err);
          }

          const nextNr = parseInt(
            settings.find((s) => s.key === "next_rechnung_nr")?.value || 1
          );
          const prefix =
            settings.find((s) => s.key === "rechnung_prefix")?.value || "R";

          const rechnungNr = `${prefix}${nextNr.toString().padStart(6, "0")}`;
          resolve(rechnungNr);
        }
      );
    }),

  /**
   * Rechnungsnummer-Zähler erhöhen
   * @returns {Promise<void>}
   */
  _incrementRechnungNr: () =>
    new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM einstellungen WHERE key = "next_rechnung_nr"',
        [],
        (err, row) => {
          if (err) {
            console.error(
              "Fehler beim Laden der aktuellen Rechnungsnummer:",
              err
            );
            return reject(err);
          }

          const currentNr = parseInt(row?.value || 1);
          const nextNr = currentNr + 1;

          db.run(
            'UPDATE einstellungen SET value = ? WHERE key = "next_rechnung_nr"',
            [nextNr.toString()],
            (err2) => {
              if (err2) {
                console.error("Fehler beim Erhöhen der Rechnungsnummer:", err2);
                return reject(err2);
              }
              resolve();
            }
          );
        }
      );
    }),

  /**
   * Private Hilfsfunktion: Positionen einfügen
   * @param {number} rechnungId - Rechnungs-ID
   * @param {Array} positionen - Array von Positionsobjekten
   * @returns {Promise<void>}
   */
  _insertPositionen: (rechnungId, positionen) =>
    new Promise((resolve, reject) => {
      if (
        !positionen ||
        !Array.isArray(positionen) ||
        positionen.length === 0
      ) {
        return resolve();
      }

      const stmt = db.prepare(`
        INSERT INTO rechnung_positionen (
          rechnung_id, kategorie, beschreibung, menge, einheit, 
          einzelpreis, mwst_prozent, gesamt, reihenfolge
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let completed = 0;
      let hasError = false;

      positionen.forEach((pos, index) => {
        // Nur Positionen mit Beschreibung einfügen
        if (!pos.beschreibung || pos.beschreibung.trim() === "") {
          completed++;
          if (completed === positionen.length && !hasError) {
            stmt.finalize();
            resolve();
          }
          return;
        }

        stmt.run(
          [
            rechnungId,
            pos.kategorie || "ZUSATZ",
            pos.beschreibung.trim(),
            parseFloat(pos.menge) || 0,
            pos.einheit || "Stk.",
            parseFloat(pos.einzelpreis) || 0,
            parseInt(pos.mwst_prozent) || 19,
            parseFloat(pos.gesamt) || 0,
            index,
          ],
          (err) => {
            completed++;

            if (err) {
              console.error(`Fehler beim Einfügen der Position ${index}:`, err);
              hasError = true;
              stmt.finalize();
              reject(err);
              return;
            }

            if (completed === positionen.length && !hasError) {
              stmt.finalize();
              resolve();
            }
          }
        );
      });
    }),
};

module.exports = Rechnung;
