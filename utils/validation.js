// utils/validation.js
class ValidationUtil {
  // Grundlegende Validierungsregeln
  static rules = {
    required: (value, field) => {
      if (value === null || value === undefined || value === "") {
        return { valid: false, message: `${field} ist erforderlich` };
      }
      return { valid: true };
    },

    email: (value, field) => {
      if (!value) return { valid: true }; // Optional wenn nicht required

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return {
          valid: false,
          message: `${field} muss eine gültige E-Mail-Adresse sein`,
        };
      }
      return { valid: true };
    },

    minLength: (minLength) => (value, field) => {
      if (!value) return { valid: true };

      if (value.length < minLength) {
        return {
          valid: false,
          message: `${field} muss mindestens ${minLength} Zeichen lang sein`,
        };
      }
      return { valid: true };
    },

    maxLength: (maxLength) => (value, field) => {
      if (!value) return { valid: true };

      if (value.length > maxLength) {
        return {
          valid: false,
          message: `${field} darf maximal ${maxLength} Zeichen lang sein`,
        };
      }
      return { valid: true };
    },

    numeric: (value, field) => {
      if (!value) return { valid: true };

      if (isNaN(parseFloat(value)) || !isFinite(value)) {
        return { valid: false, message: `${field} muss eine Zahl sein` };
      }
      return { valid: true };
    },

    integer: (value, field) => {
      if (!value) return { valid: true };

      if (!Number.isInteger(parseFloat(value))) {
        return { valid: false, message: `${field} muss eine ganze Zahl sein` };
      }
      return { valid: true };
    },

    min: (minValue) => (value, field) => {
      if (!value) return { valid: true };

      if (parseFloat(value) < minValue) {
        return {
          valid: false,
          message: `${field} muss mindestens ${minValue} sein`,
        };
      }
      return { valid: true };
    },

    max: (maxValue) => (value, field) => {
      if (!value) return { valid: true };

      if (parseFloat(value) > maxValue) {
        return {
          valid: false,
          message: `${field} darf maximal ${maxValue} sein`,
        };
      }
      return { valid: true };
    },

    phone: (value, field) => {
      if (!value) return { valid: true };

      // Deutsche Telefonnummern (flexibel)
      const phoneRegex = /^[\+]?[\d\s\-\(\)\/]{6,20}$/;
      if (!phoneRegex.test(value)) {
        return {
          valid: false,
          message: `${field} muss eine gültige Telefonnummer sein`,
        };
      }
      return { valid: true };
    },

    kennzeichen: (value, field) => {
      if (!value) return { valid: true };

      // Deutsche Kennzeichen (vereinfacht)
      const kennzeichenRegex =
        /^[A-ZÄÖÜ]{1,3}\s?[A-ZÄÖÜ]{1,2}\s?\d{1,4}[EH]?$/i;
      if (!kennzeichenRegex.test(value)) {
        return {
          valid: false,
          message: `${field} muss ein gültiges Kennzeichen sein`,
        };
      }
      return { valid: true };
    },

    plz: (value, field) => {
      if (!value) return { valid: true };

      // Deutsche PLZ
      const plzRegex = /^\d{5}$/;
      if (!plzRegex.test(value)) {
        return {
          valid: false,
          message: `${field} muss eine 5-stellige Postleitzahl sein`,
        };
      }
      return { valid: true };
    },

    year: (value, field) => {
      if (!value) return { valid: true };

      const year = parseInt(value);
      const currentYear = new Date().getFullYear();

      if (year < 1900 || year > currentYear + 1) {
        return {
          valid: false,
          message: `${field} muss zwischen 1900 und ${currentYear + 1} liegen`,
        };
      }
      return { valid: true };
    },

    color: (value, field) => {
      if (!value) return { valid: true };

      const colorRegex = /^#[0-9A-F]{6}$/i;
      if (!colorRegex.test(value)) {
        return {
          valid: false,
          message: `${field} muss eine gültige Hex-Farbe sein (#000000)`,
        };
      }
      return { valid: true };
    },

    url: (value, field) => {
      if (!value) return { valid: true };

      try {
        new URL(value);
        return { valid: true };
      } catch {
        return { valid: false, message: `${field} muss eine gültige URL sein` };
      }
    },

    oneOf: (allowedValues) => (value, field) => {
      if (!value) return { valid: true };

      if (!allowedValues.includes(value)) {
        return {
          valid: false,
          message: `${field} muss einer der folgenden Werte sein: ${allowedValues.join(
            ", "
          )}`,
        };
      }
      return { valid: true };
    },

    date: (value, field) => {
      if (!value) return { valid: true };

      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return {
          valid: false,
          message: `${field} muss ein gültiges Datum sein`,
        };
      }
      return { valid: true };
    },

    vin: (value, field) => {
      if (!value) return { valid: true };

      // Fahrzeug-Identifikationsnummer (17 Zeichen, ohne I, O, Q)
      const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;
      if (!vinRegex.test(value)) {
        return {
          valid: false,
          message: `${field} muss eine gültige 17-stellige Fahrgestellnummer sein`,
        };
      }
      return { valid: true };
    },
  };

  // Validierungs-Schema definieren und ausführen
  static validate(data, schema) {
    const errors = {};
    let isValid = true;

    Object.keys(schema).forEach((field) => {
      const rules = schema[field];
      const value = data[field];
      const fieldLabel = this.getFieldLabel(field);

      // Wenn rules ein Array ist
      if (Array.isArray(rules)) {
        for (const rule of rules) {
          const result = this.executeRule(rule, value, fieldLabel);
          if (!result.valid) {
            errors[field] = result.message;
            isValid = false;
            break; // Stoppe bei erstem Fehler pro Feld
          }
        }
      }
      // Wenn rules eine einzelne Regel ist
      else {
        const result = this.executeRule(rules, value, fieldLabel);
        if (!result.valid) {
          errors[field] = result.message;
          isValid = false;
        }
      }
    });

    return {
      valid: isValid,
      errors: errors,
      message: isValid ? "Validation erfolgreich" : "Validierungsfehler",
    };
  }

  // Einzelne Regel ausführen
  static executeRule(rule, value, fieldLabel) {
    if (typeof rule === "string") {
      // Einfache Regel wie 'required' oder 'email'
      const ruleFunction = this.rules[rule];
      if (!ruleFunction) {
        throw new Error(`Unbekannte Validierungsregel: ${rule}`);
      }
      return ruleFunction(value, fieldLabel);
    } else if (typeof rule === "function") {
      // Custom-Funktion
      return rule(value, fieldLabel);
    } else if (typeof rule === "object") {
      // Regel mit Parametern, z.B. { rule: 'minLength', param: 5 }
      const ruleFunction = this.rules[rule.rule];
      if (!ruleFunction) {
        throw new Error(`Unbekannte Validierungsregel: ${rule.rule}`);
      }

      if (rule.param !== undefined) {
        return ruleFunction(rule.param)(value, fieldLabel);
      } else {
        return ruleFunction(value, fieldLabel);
      }
    }

    throw new Error("Ungültiges Regel-Format");
  }

  // Feld-Label für benutzerfreundliche Fehlermeldungen
  static getFieldLabel(field) {
    const labels = {
      name: "Name",
      email: "E-Mail",
      telefon: "Telefon",
      kennzeichen: "Kennzeichen",
      plz: "Postleitzahl",
      ort: "Ort",
      strasse: "Straße",
      marke: "Marke",
      modell: "Modell",
      baujahr: "Baujahr",
      farbe: "Farbe",
      farbcode: "Farbcode",
      vin: "Fahrgestellnummer",
      beschreibung: "Beschreibung",
      stundenpreis: "Stundenpreis",
      zeit: "Zeit",
      gesamt: "Gesamtbetrag",
      mwst_satz: "MwSt-Satz",
      basis_stundenpreis: "Basis-Stundenpreis",
      rechnungsdatum: "Rechnungsdatum",
      auftragsdatum: "Auftragsdatum",
      username: "Benutzername",
      password: "Passwort",
    };

    return labels[field] || field.charAt(0).toUpperCase() + field.slice(1);
  }

  // Vordefinierte Schemas für verschiedene Models
  static schemas = {
    kunde: {
      name: ["required", { rule: "maxLength", param: 100 }],
      email: ["email"],
      telefon: ["phone"],
      plz: ["plz"],
      strasse: [{ rule: "maxLength", param: 200 }],
      ort: [{ rule: "maxLength", param: 100 }],
    },

    fahrzeug: {
      kennzeichen: ["required", "kennzeichen"],
      marke: [{ rule: "maxLength", param: 50 }],
      modell: [{ rule: "maxLength", param: 50 }],
      baujahr: ["year"],
      vin: ["vin"],
      farbe: [{ rule: "maxLength", param: 50 }],
      farbcode: [{ rule: "maxLength", param: 20 }],
    },

    auftrag: {
      auftrag_nr: ["required", { rule: "maxLength", param: 20 }],
      kunden_id: ["required", "integer"],
      datum: ["required", "date"],
      status: [
        {
          rule: "oneOf",
          param: ["offen", "in_bearbeitung", "abgeschlossen", "storniert"],
        },
      ],
      basis_stundenpreis: ["numeric", { rule: "min", param: 0 }],
      gesamt_zeit: ["numeric", { rule: "min", param: 0 }],
      gesamt_kosten: ["numeric", { rule: "min", param: 0 }],
    },

    rechnung: {
      rechnung_nr: ["required", { rule: "maxLength", param: 20 }],
      kunden_id: ["required", "integer"],
      rechnungsdatum: ["required", "date"],
      status: [
        { rule: "oneOf", param: ["offen", "bezahlt", "storniert", "mahnung"] },
      ],
      zwischensumme: ["numeric", { rule: "min", param: 0 }],
      rabatt_prozent: [
        "numeric",
        { rule: "min", param: 0 },
        { rule: "max", param: 100 },
      ],
      gesamtbetrag: ["numeric", { rule: "min", param: 0 }],
    },

    user: {
      username: [
        "required",
        { rule: "minLength", param: 3 },
        { rule: "maxLength", param: 50 },
      ],
      email: ["required", "email"],
      password: ["required", { rule: "minLength", param: 6 }],
      role: [{ rule: "oneOf", param: ["admin", "user"] }],
    },

    einstellung: {
      key: ["required", { rule: "maxLength", param: 100 }],
      value: [{ rule: "maxLength", param: 1000 }],
    },
  };

  // Modell-spezifische Validierung
  static validateModel(model, data, options = {}) {
    const schema = this.schemas[model];
    if (!schema) {
      throw new Error(`Kein Validierungs-Schema für Model '${model}' gefunden`);
    }

    // Bei Updates sind manche Felder optional
    let validationSchema = schema;
    if (options.isUpdate) {
      validationSchema = {};
      Object.keys(schema).forEach((field) => {
        if (data.hasOwnProperty(field)) {
          // Entferne 'required' bei Updates
          validationSchema[field] = schema[field].filter(
            (rule) =>
              rule !== "required" &&
              !(typeof rule === "string" && rule === "required")
          );
        }
      });
    }

    return this.validate(data, validationSchema);
  }

  // Sanitization (Bereinigung von Eingaben)
  static sanitize = {
    trim: (value) => (typeof value === "string" ? value.trim() : value),

    upperCase: (value) =>
      typeof value === "string" ? value.toUpperCase() : value,

    lowerCase: (value) =>
      typeof value === "string" ? value.toLowerCase() : value,

    removeSpaces: (value) =>
      typeof value === "string" ? value.replace(/\s/g, "") : value,

    normalizeKennzeichen: (value) => {
      if (typeof value !== "string") return value;
      return value.toUpperCase().replace(/\s/g, "");
    },

    normalizePhone: (value) => {
      if (typeof value !== "string") return value;
      return value.replace(/[\s\-\(\)\/]/g, "");
    },

    normalizeEmail: (value) => {
      if (typeof value !== "string") return value;
      return value.toLowerCase().trim();
    },

    decimal: (value, decimals = 2) => {
      if (typeof value === "number") {
        return parseFloat(value.toFixed(decimals));
      }
      if (typeof value === "string") {
        const num = parseFloat(value);
        return isNaN(num) ? value : parseFloat(num.toFixed(decimals));
      }
      return value;
    },
  };

  // Daten sanitizen
  static sanitizeData(data, sanitizationRules) {
    const sanitized = { ...data };

    Object.keys(sanitizationRules).forEach((field) => {
      if (sanitized.hasOwnProperty(field)) {
        const rules = sanitizationRules[field];

        if (Array.isArray(rules)) {
          rules.forEach((rule) => {
            if (typeof rule === "string" && this.sanitize[rule]) {
              sanitized[field] = this.sanitize[rule](sanitized[field]);
            } else if (typeof rule === "function") {
              sanitized[field] = rule(sanitized[field]);
            }
          });
        } else if (typeof rules === "string" && this.sanitize[rules]) {
          sanitized[field] = this.sanitize[rules](sanitized[field]);
        } else if (typeof rules === "function") {
          sanitized[field] = rules(sanitized[field]);
        }
      }
    });

    return sanitized;
  }

  // Vordefinierte Sanitization-Regeln
  static sanitizationRules = {
    kunde: {
      name: ["trim"],
      email: ["normalizeEmail"],
      telefon: ["normalizePhone"],
      plz: ["trim", "removeSpaces"],
      strasse: ["trim"],
      ort: ["trim"],
    },

    fahrzeug: {
      kennzeichen: ["normalizeKennzeichen"],
      marke: ["trim"],
      modell: ["trim"],
      vin: ["upperCase", "removeSpaces"],
      farbe: ["trim"],
      farbcode: ["trim", "upperCase"],
    },

    auftrag: {
      auftrag_nr: ["trim", "upperCase"],
      basis_stundenpreis: [(value) => this.sanitize.decimal(value, 2)],
      gesamt_zeit: [(value) => this.sanitize.decimal(value, 2)],
      gesamt_kosten: [(value) => this.sanitize.decimal(value, 2)],
    },

    user: {
      username: ["trim", "lowerCase"],
      email: ["normalizeEmail"],
    },
  };

  // Modell-spezifische Sanitization
  static sanitizeModel(model, data) {
    const rules = this.sanitizationRules[model];
    if (!rules) {
      return data; // Keine Sanitization-Regeln definiert
    }

    return this.sanitizeData(data, rules);
  }

  // Kombinierte Validierung und Sanitization
  static validateAndSanitize(model, data, options = {}) {
    // Zuerst sanitizen
    const sanitizedData = this.sanitizeModel(model, data);

    // Dann validieren
    const validation = this.validateModel(model, sanitizedData, options);

    return {
      ...validation,
      data: validation.valid ? sanitizedData : data,
    };
  }
}

module.exports = ValidationUtil;
