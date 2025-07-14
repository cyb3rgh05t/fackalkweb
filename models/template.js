// models/template.js
class Template {
  constructor() {
    this.db = null;
  }

  // Multi-Tenant: DB-Verbindung setzen
  static setDb(userDb) {
    this.db = userDb;
  }

  // Standard-DB falls keine User-DB gesetzt
  static getDb() {
    return this.db || require("../db");
  }

  // Alle Templates laden
  static findAll() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT * FROM templates 
        ORDER BY typ ASC, kategorie ASC, name ASC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden aller Templates:", err);
          reject(err);
        } else {
          // Positions-JSON parsen
          const templates = (rows || []).map((template) => ({
            ...template,
            positions: this.parsePositions(template.positions),
          }));
          resolve(templates);
        }
      });
    });
  }

  // Template per ID laden
  static findById(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = "SELECT * FROM templates WHERE id = ?";

      db.get(sql, [id], (err, row) => {
        if (err) {
          console.error("Fehler beim Laden des Templates:", err);
          reject(err);
        } else {
          if (row) {
            row.positions = this.parsePositions(row.positions);
          }
          resolve(row);
        }
      });
    });
  }

  // Templates nach Typ laden
  static findByType(typ) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT * FROM templates 
        WHERE typ = ? 
        ORDER BY kategorie ASC, name ASC
      `;

      db.all(sql, [typ], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Templates nach Typ:", err);
          reject(err);
        } else {
          const templates = (rows || []).map((template) => ({
            ...template,
            positions: this.parsePositions(template.positions),
          }));
          resolve(templates);
        }
      });
    });
  }

  // Templates nach Kategorie laden
  static findByCategory(kategorie) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT * FROM templates 
        WHERE kategorie = ? 
        ORDER BY typ ASC, name ASC
      `;

      db.all(sql, [kategorie], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Templates nach Kategorie:", err);
          reject(err);
        } else {
          const templates = (rows || []).map((template) => ({
            ...template,
            positions: this.parsePositions(template.positions),
          }));
          resolve(templates);
        }
      });
    });
  }

  // Neues Template erstellen
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const {
        name,
        typ,
        kategorie = "arbeitszeit",
        beschreibung = "",
        positions = [],
      } = data;

      // Validierung
      if (!name || !typ) {
        return reject(new Error("Name und Typ sind erforderlich"));
      }

      const positionsJson = JSON.stringify(positions);

      const sql = `
        INSERT INTO templates (name, typ, kategorie, beschreibung, positions)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.run(
        sql,
        [name, typ, kategorie, beschreibung, positionsJson],
        function (err) {
          if (err) {
            console.error("Fehler beim Erstellen des Templates:", err);

            if (err.message.includes("UNIQUE constraint failed")) {
              reject(new Error("Template-Name bereits vergeben"));
            } else {
              reject(err);
            }
          } else {
            const newTemplate = {
              id: this.lastID,
              name,
              typ,
              kategorie,
              beschreibung,
              positions,
            };

            resolve(newTemplate);
          }
        }
      );
    });
  }

  // Template aktualisieren
  static update(id, data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const { name, typ, kategorie, beschreibung, positions } = data;

      if (!name || !typ) {
        return reject(new Error("Name und Typ sind erforderlich"));
      }

      const positionsJson = JSON.stringify(positions || []);

      const sql = `
        UPDATE templates 
        SET name = ?, typ = ?, kategorie = ?, beschreibung = ?, 
            positions = ?, aktualisiert_am = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.run(
        sql,
        [name, typ, kategorie, beschreibung, positionsJson, id],
        function (err) {
          if (err) {
            console.error("Fehler beim Aktualisieren des Templates:", err);
            reject(err);
          } else {
            resolve({
              changes: this.changes,
              success: this.changes > 0,
            });
          }
        }
      );
    });
  }

  // Template löschen
  static remove(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = "DELETE FROM templates WHERE id = ?";

      db.run(sql, [id], function (err) {
        if (err) {
          console.error("Fehler beim Löschen des Templates:", err);
          reject(err);
        } else {
          resolve({
            changes: this.changes,
            success: this.changes > 0,
          });
        }
      });
    });
  }

  // Templates suchen
  static search(searchTerm) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT * FROM templates 
        WHERE name LIKE ? OR kategorie LIKE ? OR beschreibung LIKE ?
        ORDER BY typ ASC, kategorie ASC, name ASC
      `;

      const searchPattern = `%${searchTerm}%`;

      db.all(
        sql,
        [searchPattern, searchPattern, searchPattern],
        (err, rows) => {
          if (err) {
            console.error("Fehler bei der Template-Suche:", err);
            reject(err);
          } else {
            const templates = (rows || []).map((template) => ({
              ...template,
              positions: this.parsePositions(template.positions),
            }));
            resolve(templates);
          }
        }
      );
    });
  }

  // Template duplizieren
  static duplicate(id, newName = null) {
    return new Promise((resolve, reject) => {
      this.findById(id)
        .then((template) => {
          if (!template) {
            return reject(new Error("Template nicht gefunden"));
          }

          const duplicatedTemplate = {
            name: newName || `${template.name} (Kopie)`,
            typ: template.typ,
            kategorie: template.kategorie,
            beschreibung: template.beschreibung,
            positions: template.positions,
          };

          this.create(duplicatedTemplate).then(resolve).catch(reject);
        })
        .catch(reject);
    });
  }

  // Standard-Templates initialisieren
  static initializeDefaults() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const defaultTemplates = [
        {
          name: "Standard Lackierung",
          typ: "auftrag",
          kategorie: "lackierung",
          beschreibung: "Standard-Vorlage für Lackierarbeiten",
          positions: [
            {
              beschreibung: "Fahrzeug reinigen und vorbereiten",
              stundenpreis: 110,
              zeit: 2,
              einheit: "Std.",
              gesamt: 220,
            },
            {
              beschreibung: "Grundierung auftragen",
              stundenpreis: 110,
              zeit: 1.5,
              einheit: "Std.",
              gesamt: 165,
            },
            {
              beschreibung: "Lackierung durchführen",
              stundenpreis: 110,
              zeit: 3,
              einheit: "Std.",
              gesamt: 330,
            },
            {
              beschreibung: "Finish und Polieren",
              stundenpreis: 110,
              zeit: 1,
              einheit: "Std.",
              gesamt: 110,
            },
          ],
        },
        {
          name: "Unfallreparatur",
          typ: "auftrag",
          kategorie: "reparatur",
          beschreibung: "Vorlage für Unfallschäden",
          positions: [
            {
              beschreibung: "Schadensaufnahme und Begutachtung",
              stundenpreis: 110,
              zeit: 0.5,
              einheit: "Std.",
              gesamt: 55,
            },
            {
              beschreibung: "Spachtelarbeiten",
              stundenpreis: 110,
              zeit: 4,
              einheit: "Std.",
              gesamt: 440,
            },
            {
              beschreibung: "Schleifen und Vorbereitung",
              stundenpreis: 110,
              zeit: 2,
              einheit: "Std.",
              gesamt: 220,
            },
            {
              beschreibung: "Lackierung",
              stundenpreis: 110,
              zeit: 3,
              einheit: "Std.",
              gesamt: 330,
            },
          ],
        },
        {
          name: "Kratzer entfernen",
          typ: "auftrag",
          kategorie: "reparatur",
          beschreibung: "Kleine Kratzer und Steinschläge",
          positions: [
            {
              beschreibung: "Stelle reinigen und anschleifen",
              stundenpreis: 110,
              zeit: 0.5,
              einheit: "Std.",
              gesamt: 55,
            },
            {
              beschreibung: "Spot-Lackierung",
              stundenpreis: 110,
              zeit: 1,
              einheit: "Std.",
              gesamt: 110,
            },
            {
              beschreibung: "Polieren und Finish",
              stundenpreis: 110,
              zeit: 0.5,
              einheit: "Std.",
              gesamt: 55,
            },
          ],
        },
        {
          name: "Standard Rechnung",
          typ: "rechnung",
          kategorie: "arbeitszeit",
          beschreibung: "Standard-Vorlage für Rechnungen",
          positions: [
            {
              kategorie: "Arbeitszeit",
              beschreibung: "Lackierarbeiten",
              menge: 1,
              einheit: "Std.",
              einzelpreis: 110,
              mwst_prozent: 19,
              gesamt: 110,
            },
          ],
        },
        {
          name: "Material und Arbeitszeit",
          typ: "rechnung",
          kategorie: "gemischt",
          beschreibung: "Rechnung mit Material und Arbeitszeit",
          positions: [
            {
              kategorie: "Arbeitszeit",
              beschreibung: "Arbeitszeit",
              menge: 1,
              einheit: "Std.",
              einzelpreis: 110,
              mwst_prozent: 19,
              gesamt: 110,
            },
            {
              kategorie: "Material",
              beschreibung: "Lack und Grundierung",
              menge: 1,
              einheit: "Stk.",
              einzelpreis: 50,
              mwst_prozent: 19,
              gesamt: 50,
            },
          ],
        },
      ];

      let completed = 0;
      let hasError = false;

      const createTemplate = (templateData) => {
        const positionsJson = JSON.stringify(templateData.positions);

        const sql = `
          INSERT OR IGNORE INTO templates (name, typ, kategorie, beschreibung, positions)
          VALUES (?, ?, ?, ?, ?)
        `;

        db.run(
          sql,
          [
            templateData.name,
            templateData.typ,
            templateData.kategorie,
            templateData.beschreibung,
            positionsJson,
          ],
          (err) => {
            if (err && !hasError) {
              console.error(
                "Fehler beim Initialisieren der Standard-Templates:",
                err
              );
              hasError = true;
              return reject(err);
            }

            completed++;

            if (completed === defaultTemplates.length) {
              resolve({
                initialized: defaultTemplates.length,
                templates: defaultTemplates.map((t) => t.name),
              });
            }
          }
        );
      };

      defaultTemplates.forEach(createTemplate);
    });
  }

  // JSON-Positionen parsen
  static parsePositions(positionsJson) {
    if (!positionsJson) return [];

    try {
      return JSON.parse(positionsJson);
    } catch (err) {
      console.error("Fehler beim Parsen der Template-Positionen:", err);
      return [];
    }
  }

  // Template-Kategorien laden
  static getCategories() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT DISTINCT kategorie, COUNT(*) as count 
        FROM templates 
        GROUP BY kategorie 
        ORDER BY kategorie ASC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Template-Kategorien:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Template-Typen laden
  static getTypes() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT DISTINCT typ, COUNT(*) as count 
        FROM templates 
        GROUP BY typ 
        ORDER BY typ ASC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der Template-Typen:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

module.exports = Template;
