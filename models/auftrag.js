// models/auftrag.js - KOMPLETT UND KORRIGIERT
const db = require("../db");

const Auftrag = {
  findAll: () =>
    new Promise((resolve, reject) => {
      const sql = `
      SELECT a.*, k.name as kunde_name, f.kennzeichen, f.marke, f.modell
      FROM auftraege a
      LEFT JOIN kunden k ON a.kunden_id = k.id
      LEFT JOIN fahrzeuge f ON a.fahrzeug_id = f.id
      ORDER BY a.datum DESC, a.auftrag_nr DESC`;
      db.all(sql, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    }),

  findById: (id) =>
    new Promise((resolve, reject) => {
      const sql = `
      SELECT 
        a.id, a.auftrag_nr, a.kunden_id, a.fahrzeug_id, a.datum, 
        a.basis_stundenpreis, a.gesamt_zeit, a.gesamt_kosten, a.mwst_betrag, 
        a.bemerkungen, a.status, a.erstellt_am, a.aktualisiert_am,
        a.anfahrt_aktiv, a.express_aktiv, a.wochenend_aktiv,
        a.anfahrt_betrag, a.express_betrag, a.wochenend_betrag, a.arbeitszeiten_kosten,
        k.name, k.kunden_nr, k.strasse, k.plz, k.ort, k.telefon, k.email,
        f.kennzeichen, f.marke, f.modell, f.vin, f.farbe, f.farbcode, f.baujahr
      FROM auftraege a
      LEFT JOIN kunden k ON a.kunden_id = k.id
      LEFT JOIN fahrzeuge f ON a.fahrzeug_id = f.id
      WHERE a.id = ?`;

      db.get(sql, [id], (err, auftrag) => {
        if (err) return reject(err);
        if (!auftrag) return resolve(null);

        // Positionen laden
        db.all(
          "SELECT * FROM auftrag_positionen WHERE auftrag_id = ? ORDER BY reihenfolge",
          [id],
          (err2, positionen) => {
            if (err2) return reject(err2);
            auftrag.positionen = positionen;
            resolve(auftrag);
          }
        );
      });
    }),

  create: (data) =>
    new Promise((resolve, reject) => {
      const sql = `INSERT INTO auftraege (
        auftrag_nr, kunden_id, fahrzeug_id, datum, basis_stundenpreis, 
        gesamt_zeit, gesamt_kosten, mwst_betrag, bemerkungen, status,
        anfahrt_aktiv, express_aktiv, wochenend_aktiv,
        anfahrt_betrag, express_betrag, wochenend_betrag, arbeitszeiten_kosten
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      db.run(
        sql,
        [
          data.auftrag_nr,
          data.kunden_id,
          data.fahrzeug_id,
          data.datum,
          data.basis_stundenpreis,
          data.gesamt_zeit,
          data.gesamt_kosten,
          data.mwst_betrag,
          data.bemerkungen,
          data.status || "offen",
          data.anfahrt_aktiv ? 1 : 0,
          data.express_aktiv ? 1 : 0,
          data.wochenend_aktiv ? 1 : 0,
          data.anfahrt_betrag || 0,
          data.express_betrag || 0,
          data.wochenend_betrag || 0,
          data.arbeitszeiten_kosten || 0,
        ],
        function (err) {
          if (err) return reject(err);
          const auftragId = this.lastID;

          // Positionen einfügen
          if (data.positionen && data.positionen.length > 0) {
            const stmt = db.prepare(
              `INSERT INTO auftrag_positionen (auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge) VALUES (?, ?, ?, ?, ?, ?, ?)`
            );

            (data.positionen || []).forEach((pos, idx) => {
              stmt.run([
                auftragId,
                pos.beschreibung,
                pos.stundenpreis,
                pos.zeit,
                pos.einheit,
                pos.gesamt,
                idx,
              ]);
            });
            stmt.finalize();
          }

          resolve({ id: auftragId, auftrag_nr: data.auftrag_nr });
        }
      );
    }),

  update: (id, data) =>
    new Promise((resolve, reject) => {
      const sql = `UPDATE auftraege SET 
        kunden_id=?, fahrzeug_id=?, datum=?, basis_stundenpreis=?, 
        gesamt_zeit=?, gesamt_kosten=?, mwst_betrag=?, bemerkungen=?, status=?,
        anfahrt_aktiv=?, express_aktiv=?, wochenend_aktiv=?,
        anfahrt_betrag=?, express_betrag=?, wochenend_betrag=?, arbeitszeiten_kosten=?,
        aktualisiert_am=CURRENT_TIMESTAMP
        WHERE id=?`;

      db.run(
        sql,
        [
          data.kunden_id,
          data.fahrzeug_id,
          data.datum,
          data.basis_stundenpreis,
          data.gesamt_zeit,
          data.gesamt_kosten,
          data.mwst_betrag,
          data.bemerkungen,
          data.status,
          data.anfahrt_aktiv ? 1 : 0,
          data.express_aktiv ? 1 : 0,
          data.wochenend_aktiv ? 1 : 0,
          data.anfahrt_betrag || 0,
          data.express_betrag || 0,
          data.wochenend_betrag || 0,
          data.arbeitszeiten_kosten || 0,
          id,
        ],
        function (err) {
          if (err) return reject(err);

          // Positionen neu schreiben
          db.run(
            "DELETE FROM auftrag_positionen WHERE auftrag_id = ?",
            [id],
            (err2) => {
              if (err2) return reject(err2);

              if (data.positionen && data.positionen.length > 0) {
                const stmt = db.prepare(
                  `INSERT INTO auftrag_positionen (auftrag_id, beschreibung, stundenpreis, zeit, einheit, gesamt, reihenfolge) VALUES (?, ?, ?, ?, ?, ?, ?)`
                );

                (data.positionen || []).forEach((pos, idx) => {
                  stmt.run([
                    id,
                    pos.beschreibung,
                    pos.stundenpreis,
                    pos.zeit,
                    pos.einheit,
                    pos.gesamt,
                    idx,
                  ]);
                });
                stmt.finalize();
              }

              resolve({ changes: this.changes });
            }
          );
        }
      );
    }),

  // KORRIGIERTE REMOVE-FUNKTION
  remove: (id) =>
    new Promise((resolve, reject) => {
      console.log(`🗑️ Lösche Auftrag mit ID: ${id}`);

      // Erst Positionen löschen
      db.run(
        "DELETE FROM auftrag_positionen WHERE auftrag_id = ?",
        [id],
        function (err) {
          if (err) {
            console.error("Fehler beim Löschen der Auftragspositionen:", err);
            return reject(err);
          }

          console.log(`✅ ${this.changes} Auftragspositionen gelöscht`);

          // Dann Auftrag löschen
          db.run("DELETE FROM auftraege WHERE id = ?", [id], function (err2) {
            if (err2) {
              console.error("Fehler beim Löschen des Auftrags:", err2);
              return reject(err2);
            }

            console.log(
              `✅ Auftrag gelöscht (${this.changes} Zeile(n) betroffen)`
            );
            resolve({ changes: this.changes });
          });
        }
      );
    }),

  // ALIAS für Kompatibilität
  delete: function (id) {
    console.warn(
      "⚠️ Verwendung von deprecated Auftrag.delete() - verwende stattdessen Auftrag.remove()"
    );
    return this.remove(id);
  },
};

// WICHTIG: Alle Funktionen exportieren
module.exports = Auftrag;
