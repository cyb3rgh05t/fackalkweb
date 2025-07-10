const Einstellung = require("../models/einstellung");

// Validierungsregeln für verschiedene Einstellungstypen
const validationRules = {
  firmenname: { required: true, maxLength: 100 },
  firmen_email: { type: "email" },
  firmen_website: { type: "url" },
  basis_stundenpreis: { type: "number", min: 0, max: 9999.99 },
  mwst_satz: { type: "integer", min: 0, max: 100 },
  anfahrtspauschale: { type: "number", min: 0, max: 9999.99 },
  mindestauftragswert: { type: "number", min: 0, max: 999999.99 },
  express_zuschlag: { type: "integer", min: 0, max: 500 },
  wochenend_zuschlag: { type: "integer", min: 0, max: 500 },
  skonto_tage: { type: "integer", min: 1, max: 365 },
  skonto_prozent: { type: "number", min: 0, max: 100 },
  zahlungsziel_tage: { type: "integer", min: 1, max: 365 },
  standard_bearbeitungszeit: { type: "integer", min: 1, max: 365 },
  auto_status_update: { type: "boolean" },
  email_benachrichtigung: { type: "boolean" },
  benachrichtigung_email: { type: "email" },
  bank_iban: { type: "iban" },
  bank_bic: { type: "bic" },
  firmen_logo: { type: "base64Image", maxSize: 2 * 1024 * 1024 }, // 2MB
};

// Validierungsfunktionen
function validateValue(key, value, rule) {
  if (!rule) return { isValid: true };

  // Required Check
  if (rule.required && (!value || value.trim() === "")) {
    return { isValid: false, error: `${key} ist ein Pflichtfeld` };
  }

  // Skip validation for empty optional fields
  if (!value || value.trim() === "") {
    return { isValid: true };
  }

  // Type validations
  switch (rule.type) {
    case "email":
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return {
          isValid: false,
          error: `${key} muss eine gültige E-Mail-Adresse sein`,
        };
      }
      break;

    case "url":
      try {
        new URL(value);
      } catch {
        return { isValid: false, error: `${key} muss eine gültige URL sein` };
      }
      break;

    case "number":
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return { isValid: false, error: `${key} muss eine Zahl sein` };
      }
      if (rule.min !== undefined && numValue < rule.min) {
        return {
          isValid: false,
          error: `${key} muss mindestens ${rule.min} sein`,
        };
      }
      if (rule.max !== undefined && numValue > rule.max) {
        return {
          isValid: false,
          error: `${key} darf maximal ${rule.max} sein`,
        };
      }
      break;

    case "integer":
      const intValue = parseInt(value);
      if (isNaN(intValue) || intValue != value) {
        return { isValid: false, error: `${key} muss eine ganze Zahl sein` };
      }
      if (rule.min !== undefined && intValue < rule.min) {
        return {
          isValid: false,
          error: `${key} muss mindestens ${rule.min} sein`,
        };
      }
      if (rule.max !== undefined && intValue > rule.max) {
        return {
          isValid: false,
          error: `${key} darf maximal ${rule.max} sein`,
        };
      }
      break;

    case "boolean":
      if (!["0", "1", "true", "false"].includes(value.toString())) {
        return { isValid: false, error: `${key} muss ein Boolean-Wert sein` };
      }
      break;

    case "iban":
      // Vereinfachte IBAN-Validierung
      const ibanRegex =
        /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/;
      if (!ibanRegex.test(value.replace(/\s/g, ""))) {
        return { isValid: false, error: `${key} muss eine gültige IBAN sein` };
      }
      break;

    case "bic":
      const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
      if (!bicRegex.test(value)) {
        return { isValid: false, error: `${key} muss ein gültiger BIC sein` };
      }
      break;

    case "base64Image":
      if (value.startsWith("data:image/")) {
        // Base64 Image size check
        const base64Data = value.split(",")[1];
        const sizeInBytes = (base64Data.length * 3) / 4;
        if (rule.maxSize && sizeInBytes > rule.maxSize) {
          return {
            isValid: false,
            error: `Logo ist zu groß. Maximal ${
              rule.maxSize / (1024 * 1024)
            }MB erlaubt`,
          };
        }
      }
      break;
  }

  // String length validation
  if (rule.maxLength && value.length > rule.maxLength) {
    return {
      isValid: false,
      error: `${key} darf maximal ${rule.maxLength} Zeichen haben`,
    };
  }

  return { isValid: true };
}

exports.list = async (req, res) => {
  try {
    const einstellungen = await Einstellung.findAll();
    res.json(einstellungen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    // Validierung
    const rule = validationRules[key];
    const validation = validateValue(key, value, rule);

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.error,
        field: key,
      });
    }

    // Spezielle Behandlung für bestimmte Felder
    let processedValue = value;

    // Boolean-Werte normalisieren
    if (rule && rule.type === "boolean") {
      processedValue = ["1", "true"].includes(value.toString()) ? "1" : "0";
    }

    // Zahlen formatieren
    if (rule && (rule.type === "number" || rule.type === "integer")) {
      processedValue =
        rule.type === "integer"
          ? parseInt(value).toString()
          : parseFloat(value).toFixed(2);
    }

    // IBAN formatieren (Leerzeichen entfernen)
    if (rule && rule.type === "iban") {
      processedValue = value.replace(/\s/g, "").toUpperCase();
    }

    // BIC formatieren
    if (rule && rule.type === "bic") {
      processedValue = value.toUpperCase();
    }

    await Einstellung.update(key, processedValue);

    res.json({
      success: true,
      key: key,
      value: processedValue,
      message: "Einstellung erfolgreich gespeichert",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Neue Funktion: Mehrere Einstellungen auf einmal aktualisieren
exports.updateMultiple = async (req, res) => {
  try {
    const { settings } = req.body;
    const errors = [];
    const successes = [];

    // Alle Einstellungen validieren
    for (const [key, value] of Object.entries(settings)) {
      const rule = validationRules[key];
      const validation = validateValue(key, value, rule);

      if (!validation.isValid) {
        errors.push({ key, error: validation.error });
      } else {
        successes.push({ key, value });
      }
    }

    // Bei Validierungsfehlern abbrechen
    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validierungsfehler",
        details: errors,
      });
    }

    // Alle Einstellungen speichern
    for (const { key, value } of successes) {
      const rule = validationRules[key];
      let processedValue = value;

      // Wert-Verarbeitung wie oben
      if (rule && rule.type === "boolean") {
        processedValue = ["1", "true"].includes(value.toString()) ? "1" : "0";
      }

      if (rule && (rule.type === "number" || rule.type === "integer")) {
        processedValue =
          rule.type === "integer"
            ? parseInt(value).toString()
            : parseFloat(value).toFixed(2);
      }

      if (rule && rule.type === "iban") {
        processedValue = value.replace(/\s/g, "").toUpperCase();
      }

      if (rule && rule.type === "bic") {
        processedValue = value.toUpperCase();
      }

      await Einstellung.update(key, processedValue);
    }

    res.json({
      success: true,
      updated: successes.length,
      message: `${successes.length} Einstellungen erfolgreich gespeichert`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Neue Funktion: Einstellungen exportieren
exports.export = async (req, res) => {
  try {
    const einstellungen = await Einstellung.findAll();

    // System-Einstellungen ausschließen
    const systemKeys = [
      "next_auftrag_nr",
      "next_rechnung_nr",
      "next_kunden_nr",
    ];
    const exportData = einstellungen
      .filter((setting) => !systemKeys.includes(setting.key))
      .reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {});

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="einstellungen-export.json"'
    );
    res.json({
      exportDate: new Date().toISOString(),
      version: "1.0",
      settings: exportData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Neue Funktion: Einstellungen importieren
exports.import = async (req, res) => {
  try {
    const { settings, overwrite = false } = req.body;

    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ error: "Ungültige Einstellungsdaten" });
    }

    const errors = [];
    const successes = [];
    const skipped = [];

    for (const [key, value] of Object.entries(settings)) {
      // System-Keys überspringen
      if (
        ["next_auftrag_nr", "next_rechnung_nr", "next_kunden_nr"].includes(key)
      ) {
        skipped.push(key);
        continue;
      }

      // Validierung
      const rule = validationRules[key];
      const validation = validateValue(key, value, rule);

      if (!validation.isValid) {
        errors.push({ key, error: validation.error });
        continue;
      }

      // Prüfen ob Einstellung bereits existiert
      const existingSettings = await Einstellung.findAll();
      const exists = existingSettings.some((s) => s.key === key);

      if (exists && !overwrite) {
        skipped.push(key);
        continue;
      }

      // Wert verarbeiten und speichern
      let processedValue = value;
      if (rule && rule.type === "boolean") {
        processedValue = ["1", "true"].includes(value.toString()) ? "1" : "0";
      }

      await Einstellung.update(key, processedValue);
      successes.push(key);
    }

    res.json({
      success: true,
      imported: successes.length,
      skipped: skipped.length,
      errors: errors.length,
      details: { successes, skipped, errors },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Neue Funktion: Einstellungen zurücksetzen
exports.reset = async (req, res) => {
  try {
    const { category } = req.body;

    // Standard-Einstellungen je Kategorie
    const defaultsByCategory = {
      firma: {
        firmenname: "FAF Lackiererei",
        firmen_strasse: "",
        firmen_plz: "",
        firmen_ort: "",
        firmen_telefon: "",
        firmen_email: "",
        firmen_logo: "",
      },
      leistungen: {
        basis_stundenpreis: "110.00",
        anfahrtspauschale: "0.00",
        mindestauftragswert: "0.00",
        express_zuschlag: "20",
        wochenend_zuschlag: "30",
      },
      rechnungen: {
        mwst_satz: "19",
        zahlungsbedingungen: "Zahlbar innerhalb 14 Tagen netto.",
        gewaehrleistung:
          "3 Jahre auf Lackierarbeiten bei ordnungsgemäßer Behandlung.",
        skonto_tage: "10",
        skonto_prozent: "2.0",
        zahlungsziel_tage: "14",
      },
      auftraege: {
        standard_bearbeitungszeit: "5",
        auto_status_update: "0",
        email_benachrichtigung: "0",
        standard_arbeitsschritte:
          "Demontage/Vorbereitung\nSchleifen/Spachteln\nGrundierung\nZwischenschliff\nBasislack\nKlarlack\nPolieren/Finish\nMontage",
      },
    };

    const defaults = defaultsByCategory[category];
    if (!defaults) {
      return res.status(400).json({ error: "Ungültige Kategorie" });
    }

    let resetCount = 0;
    for (const [key, value] of Object.entries(defaults)) {
      await Einstellung.update(key, value);
      resetCount++;
    }

    res.json({
      success: true,
      reset: resetCount,
      category: category,
      message: `${resetCount} Einstellungen in Kategorie "${category}" zurückgesetzt`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
