// utils/numbering.js
class NumberingUtil {
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

  // Nächste Nummer für verschiedene Typen generieren
  static async generateNextNumber(type, options = {}) {
    const generators = {
      kunden: () => this.generateKundenNr(options),
      auftrag: () => this.generateAuftragNr(options),
      rechnung: () => this.generateRechnungNr(options),
      fahrzeug: () => this.generateFahrzeugNr(options),
    };

    const generator = generators[type];
    if (!generator) {
      throw new Error(`Unbekannter Nummerierungstyp: ${type}`);
    }

    return generator();
  }

  // Kunden-Nummer generieren (K0001, K0002, ...)
  static generateKundenNr(options = {}) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const prefix = options.prefix || "K";
      const digits = options.digits || 4;

      const sql = `
        SELECT MAX(CAST(SUBSTR(kunden_nr, ${
          prefix.length + 1
        }) AS INTEGER)) as max_nr 
        FROM kunden 
        WHERE kunden_nr LIKE '${prefix}%' 
        AND LENGTH(kunden_nr) = ${prefix.length + digits}
        AND SUBSTR(kunden_nr, ${prefix.length + 1}) GLOB '[0-9]*'
      `;

      db.get(sql, (err, row) => {
        if (err) {
          console.error("Fehler beim Generieren der Kunden-Nummer:", err);
          reject(err);
        } else {
          const nextNr = (row.max_nr || 0) + 1;
          const kundenNr = `${prefix}${nextNr
            .toString()
            .padStart(digits, "0")}`;
          resolve(kundenNr);
        }
      });
    });
  }

  // Auftrag-Nummer generieren (0001/25, 0002/25, ...)
  static generateAuftragNr(options = {}) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const currentYear = options.year || new Date().getFullYear();
      const yearSuffix =
        options.yearFormat === "full"
          ? currentYear.toString()
          : currentYear.toString().slice(-2);
      const digits = options.digits || 4;
      const separator = options.separator || "/";

      const sql = `
        SELECT MAX(CAST(SUBSTR(auftrag_nr, 1, INSTR(auftrag_nr, '${separator}') - 1) AS INTEGER)) as max_nr 
        FROM auftraege 
        WHERE auftrag_nr LIKE '%${separator}${yearSuffix}'
      `;

      db.get(sql, (err, row) => {
        if (err) {
          console.error("Fehler beim Generieren der Auftrag-Nummer:", err);
          reject(err);
        } else {
          const nextNr = (row.max_nr || 0) + 1;
          const auftragNr = `${nextNr
            .toString()
            .padStart(digits, "0")}${separator}${yearSuffix}`;
          resolve(auftragNr);
        }
      });
    });
  }

  // Rechnung-Nummer generieren (0001/2025, 0002/2025, ...)
  static generateRechnungNr(options = {}) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const currentYear = options.year || new Date().getFullYear();
      const yearSuffix =
        options.yearFormat === "short"
          ? currentYear.toString().slice(-2)
          : currentYear.toString();
      const digits = options.digits || 4;
      const separator = options.separator || "/";

      const sql = `
        SELECT MAX(CAST(SUBSTR(rechnung_nr, 1, INSTR(rechnung_nr, '${separator}') - 1) AS INTEGER)) as max_nr 
        FROM rechnungen 
        WHERE rechnung_nr LIKE '%${separator}${yearSuffix}'
      `;

      db.get(sql, (err, row) => {
        if (err) {
          console.error("Fehler beim Generieren der Rechnung-Nummer:", err);
          reject(err);
        } else {
          const nextNr = (row.max_nr || 0) + 1;
          const rechnungNr = `${nextNr
            .toString()
            .padStart(digits, "0")}${separator}${yearSuffix}`;
          resolve(rechnungNr);
        }
      });
    });
  }

  // Fahrzeug-interne Nummer generieren (F0001, F0002, ...)
  static generateFahrzeugNr(options = {}) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const prefix = options.prefix || "F";
      const digits = options.digits || 4;

      const sql = `
        SELECT MAX(CAST(SUBSTR(internal_nr, ${
          prefix.length + 1
        }) AS INTEGER)) as max_nr 
        FROM fahrzeuge 
        WHERE internal_nr LIKE '${prefix}%' 
        AND LENGTH(internal_nr) = ${prefix.length + digits}
      `;

      db.get(sql, (err, row) => {
        if (err) {
          console.error("Fehler beim Generieren der Fahrzeug-Nummer:", err);
          reject(err);
        } else {
          const nextNr = (row.max_nr || 0) + 1;
          const fahrzeugNr = `${prefix}${nextNr
            .toString()
            .padStart(digits, "0")}`;
          resolve(fahrzeugNr);
        }
      });
    });
  }

  // Benutzerdefinierte Nummerierung
  static generateCustomNumber(table, column, pattern, options = {}) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      // Pattern-Parsing (z.B. "INV-{YYYY}-{####}")
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const currentDay = new Date().getDate();

      let processedPattern = pattern
        .replace("{YYYY}", currentYear.toString())
        .replace("{YY}", currentYear.toString().slice(-2))
        .replace("{MM}", currentMonth.toString().padStart(2, "0"))
        .replace("{DD}", currentDay.toString().padStart(2, "0"));

      // Finde Nummer-Platzhalter
      const numberMatch = pattern.match(/\{(#+)\}/);
      if (!numberMatch) {
        return reject(
          new Error("Kein Nummern-Platzhalter gefunden (z.B. {####})")
        );
      }

      const digits = numberMatch[1].length;
      const numberPlaceholder = numberMatch[0];

      // SQL für höchste bestehende Nummer
      const likePattern = processedPattern.replace(numberPlaceholder, "%");
      const sql = `
        SELECT ${column} FROM ${table} 
        WHERE ${column} LIKE ? 
        ORDER BY ${column} DESC 
        LIMIT 1
      `;

      db.get(sql, [likePattern], (err, row) => {
        if (err) {
          console.error(
            "Fehler beim Generieren der benutzerdefinierten Nummer:",
            err
          );
          reject(err);
        } else {
          let nextNr = 1;

          if (row && row[column]) {
            // Extrahiere Nummer aus bestehendem Wert
            const existing = row[column];
            const numberRegex = new RegExp(
              processedPattern.replace(numberPlaceholder, "(\\d+)")
            );
            const match = existing.match(numberRegex);

            if (match) {
              nextNr = parseInt(match[1]) + 1;
            }
          }

          const finalNumber = processedPattern.replace(
            numberPlaceholder,
            nextNr.toString().padStart(digits, "0")
          );

          resolve(finalNumber);
        }
      });
    });
  }

  // Nummerierung-Konfiguration laden
  static getNumberingConfig() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `
        SELECT key, value FROM einstellungen 
        WHERE key LIKE 'numbering_%'
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error(
            "Fehler beim Laden der Nummerierungs-Konfiguration:",
            err
          );
          reject(err);
        } else {
          const config = {};
          (rows || []).forEach((row) => {
            const key = row.key.replace("numbering_", "");
            config[key] = row.value;
          });

          // Standard-Werte setzen falls nicht konfiguriert
          const defaults = {
            kunden_prefix: "K",
            kunden_digits: "4",
            auftrag_digits: "4",
            auftrag_separator: "/",
            auftrag_year_format: "short",
            rechnung_digits: "4",
            rechnung_separator: "/",
            rechnung_year_format: "full",
          };

          Object.keys(defaults).forEach((key) => {
            if (!config[key]) {
              config[key] = defaults[key];
            }
          });

          resolve(config);
        }
      });
    });
  }

  // Nummer validieren
  static validateNumber(type, number) {
    const patterns = {
      kunden: /^K\d{4}$/,
      auftrag: /^\d{4}\/\d{2}$/,
      rechnung: /^\d{4}\/\d{4}$/,
    };

    const pattern = patterns[type];
    if (!pattern) {
      return { valid: false, message: `Unbekannter Nummerierungstyp: ${type}` };
    }

    if (!pattern.test(number)) {
      return { valid: false, message: `Ungültiges Format für ${type}` };
    }

    return { valid: true };
  }

  // Nummer bereits verwendet?
  static isNumberUsed(table, column, number) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      const sql = `SELECT COUNT(*) as count FROM ${table} WHERE ${column} = ?`;

      db.get(sql, [number], (err, row) => {
        if (err) {
          console.error("Fehler beim Prüfen der Nummer:", err);
          reject(err);
        } else {
          resolve(row.count > 0);
        }
      });
    });
  }

  // Nächste verfügbare Nummer in einem Bereich finden
  static findNextAvailableNumber(table, column, start, end, format = null) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      // Alle verwendeten Nummern im Bereich laden
      const sql = `
        SELECT ${column} FROM ${table} 
        WHERE ${column} >= ? AND ${column} <= ?
        ORDER BY ${column}
      `;

      db.all(sql, [start, end], (err, rows) => {
        if (err) {
          console.error("Fehler beim Suchen verfügbarer Nummern:", err);
          reject(err);
        } else {
          const usedNumbers = new Set((rows || []).map((row) => row[column]));

          // Erste verfügbare Nummer finden
          for (let i = start; i <= end; i++) {
            const formattedNumber = format
              ? format.replace("{n}", i)
              : i.toString();

            if (!usedNumbers.has(formattedNumber)) {
              resolve(formattedNumber);
              return;
            }
          }

          reject(
            new Error("Keine verfügbare Nummer im angegebenen Bereich gefunden")
          );
        }
      });
    });
  }

  // Nummerierung zurücksetzen (für neue Jahr etc.)
  static resetNumbering(type, options = {}) {
    return new Promise((resolve, reject) => {
      // Hier könnten Backup-Operationen oder spezielle Reset-Logik implementiert werden
      // Für jetzt einfach die nächste Nummer ermitteln
      this.generateNextNumber(type, options)
        .then((nextNumber) => {
          resolve({
            type,
            next_number: nextNumber,
            reset_at: new Date().toISOString(),
          });
        })
        .catch(reject);
    });
  }
}

// Convenience-Funktionen für Backward-Compatibility
async function generateNextNumber(type, options = {}) {
  // Automatisch req.userDb verwenden wenn verfügbar (Express-Context)
  if (typeof req !== "undefined" && req.userDb) {
    NumberingUtil.setDb(req.userDb);
  }

  return NumberingUtil.generateNextNumber(type, options);
}

module.exports = {
  NumberingUtil,
  generateNextNumber,
};
