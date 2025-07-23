const Einstellung = require("../models/einstellung");

// Validierungsregeln für verschiedene Einstellungstypen
const validationRules = {
  firmenname: { required: true, maxLength: 100 },
  firmen_email: { type: "email", maxLength: 100 },
  firmen_telefon: { maxLength: 50 },
  firmen_fax: { maxLength: 50 },
  firmen_website: { type: "url", maxLength: 200 },
  firmen_strasse: { maxLength: 100 },
  firmen_plz: { maxLength: 10 },
  firmen_ort: { maxLength: 50 },
  steuernummer: { maxLength: 50 },
  umsatzsteuer_id: { maxLength: 50 },
  firmen_logo: { type: "base64", maxSize: 2 * 1024 * 1024 }, // 2MB
  basis_stundenpreis: { type: "number", min: 0, max: 1000 },
  mwst_satz_standard: { type: "number", min: 0, max: 100 },
  mwst_satz_ermaessigt: { type: "number", min: 0, max: 100 },
  wochenend_zuschlag: { type: "number", min: 0, max: 100 },
  standard_bearbeitungszeit: { type: "integer", min: 1, max: 100 },
  auto_status_update: { type: "boolean" },
  email_benachrichtigung: { type: "boolean" },
  benachrichtigung_email: { type: "email", maxLength: 100 },
};

function validateValue(key, value, rule) {
  if (!rule) return { isValid: true };

  // Required validation
  if (rule.required && (!value || value.toString().trim() === "")) {
    return { isValid: false, error: `${key} ist erforderlich` };
  }

  // Skip further validation if value is empty and not required
  if (!value || value.toString().trim() === "") {
    return { isValid: true };
  }

  // Type-specific validation
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
      // NEUE FLEXIBLE URL-VALIDIERUNG
      const flexibleUrlRegex =
        /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;

      // Automatisch http:// hinzufügen wenn kein Protokoll angegeben
      let normalizedUrl = value.trim();
      if (!normalizedUrl.match(/^https?:\/\//i)) {
        normalizedUrl = "http://" + normalizedUrl;
      }

      // Prüfe ob URL gültig ist (sehr flexibel)
      const simpleCheck =
        /^(https?:\/\/)?([\w\-]+(\.[\w\-]+)+)([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?$/i;

      if (!simpleCheck.test(normalizedUrl)) {
        return {
          isValid: false,
          error: `${key} muss eine gültige Website-Adresse sein (z.B. www.beispiel.de oder https://beispiel.de)`,
        };
      }
      break;

    case "number":
      const num = parseFloat(value);
      if (isNaN(num)) {
        return { isValid: false, error: `${key} muss eine Zahl sein` };
      }
      if (rule.min !== undefined && num < rule.min) {
        return {
          isValid: false,
          error: `${key} muss mindestens ${rule.min} sein`,
        };
      }
      if (rule.max !== undefined && num > rule.max) {
        return {
          isValid: false,
          error: `${key} darf höchstens ${rule.max} sein`,
        };
      }
      break;

    case "integer":
      const int = parseInt(value);
      if (isNaN(int) || !Number.isInteger(int)) {
        return { isValid: false, error: `${key} muss eine ganze Zahl sein` };
      }
      if (rule.min !== undefined && int < rule.min) {
        return {
          isValid: false,
          error: `${key} muss mindestens ${rule.min} sein`,
        };
      }
      if (rule.max !== undefined && int > rule.max) {
        return {
          isValid: false,
          error: `${key} darf höchstens ${rule.max} sein`,
        };
      }
      break;

    case "boolean":
      const validBooleans = ["0", "1", "true", "false"];
      if (!validBooleans.includes(value.toString().toLowerCase())) {
        return { isValid: false, error: `${key} muss true oder false sein` };
      }
      break;

    case "iban":
      // Einfache IBAN-Validierung
      const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$/;
      const cleanIban = value.replace(/\s/g, "").toUpperCase();
      if (!ibanRegex.test(cleanIban)) {
        return { isValid: false, error: `${key} muss eine gültige IBAN sein` };
      }
      break;

    case "bic":
      // BIC-Validierung
      const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
      if (!bicRegex.test(value.toUpperCase())) {
        return { isValid: false, error: `${key} muss ein gültiger BIC sein` };
      }
      break;

    case "base64":
      // Base64-Validierung für Logos
      if (rule.maxSize) {
        const base64Data = value.replace(/^data:image\/[a-z]+;base64,/, "");
        const size =
          (base64Data.length * 3) / 4 -
          (base64Data.endsWith("==") ? 2 : base64Data.endsWith("=") ? 1 : 0);
        if (size > rule.maxSize) {
          return {
            isValid: false,
            error: `${key} ist zu groß. Maximal ${
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

// GET /api/einstellungen - Alle Einstellungen laden
exports.list = async (req, res) => {
  try {
    const einstellungen = await Einstellung.findAll();
    res.json(einstellungen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/einstellungen/:key - Einzelne Einstellung aktualisieren
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

    // IBAN und BIC formatieren
    if (rule && rule.type === "iban") {
      processedValue = value.replace(/\s/g, "").toUpperCase();
    }

    if (rule && rule.type === "bic") {
      processedValue = value.toUpperCase();
    }

    await Einstellung.update(key, processedValue);

    res.json({
      success: true,
      key: key,
      value: processedValue,
      message: `Einstellung ${key} erfolgreich gespeichert`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/einstellungen/ - Multiple Einstellungen aktualisieren (Legacy)
exports.updateMultiple = async (req, res) => {
  try {
    const updates = req.body;
    const errors = [];
    const successes = [];

    for (const [key, value] of Object.entries(updates)) {
      try {
        // Validierung
        const rule = validationRules[key];
        const validation = validateValue(key, value, rule);

        if (!validation.isValid) {
          errors.push({ key, error: validation.error });
          continue;
        }

        // Spezielle Behandlung für bestimmte Felder
        let processedValue = value;

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
        successes.push(key);
      } catch (err) {
        errors.push({ key, error: err.message });
      }
    }

    res.json({
      success: true,
      updated: successes.length,
      errors: errors.length,
      message: `${successes.length} Einstellungen erfolgreich gespeichert`,
      details: { successes, errors },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/einstellungen/batch - NEUE BATCH-UPDATE FUNKTION
exports.updateBatch = async (req, res) => {
  try {
    const { settings } = req.body;

    console.log("📥 Batch-Update empfangen:", {
      settingsCount: Object.keys(settings || {}).length,
      keys: Object.keys(settings || {}),
    });

    if (!settings || typeof settings !== "object") {
      console.error("❌ Ungültige Request-Body");
      return res.status(400).json({
        error: "Invalid request body. Expected 'settings' object.",
      });
    }

    const results = {
      success: [],
      errors: [],
      updated: 0,
      failed: 0,
    };

    // Alle Updates sequenziell abarbeiten (verhindert DB-Locks)
    for (const [key, value] of Object.entries(settings)) {
      try {
        // Validierung
        const rule = validationRules[key];
        const validation = validateValue(key, value, rule);

        if (!validation.isValid) {
          results.errors.push({
            key,
            error: validation.error,
          });
          results.failed++;
          continue;
        }

        // Wert verarbeiten
        let processedValue = value;

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

        // **WICHTIG: UPSERT statt UPDATE verwenden**
        const result = await Einstellung.upsert(key, processedValue);

        results.success.push({
          key,
          value: processedValue,
          action: result.action,
        });
        results.updated++;
      } catch (error) {
        console.error(`❌ Error updating setting ${key}:`, error);
        results.errors.push({
          key,
          error: error.message,
        });
        results.failed++;
      }
    }

    // Response zusammenstellen
    const response = {
      success: results.failed === 0,
      updated: results.updated,
      failed: results.failed,
      message: `${results.updated} Einstellungen erfolgreich gespeichert`,
      details: results.success,
    };

    if (results.errors.length > 0) {
      response.errors = results.errors;
      response.message += `, ${results.failed} Fehler aufgetreten`;
    }

    // Status Code je nach Ergebnis
    const statusCode =
      results.failed === 0 ? 200 : results.updated === 0 ? 400 : 207;
    res.status(statusCode).json(response);
  } catch (err) {
    console.error("Batch update error:", err);
    res.status(500).json({
      error: "Internal server error during batch update",
      message: err.message,
    });
  }
};

// GET /api/einstellungen/export - Einstellungen exportieren
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

// POST /api/einstellungen/import - Einstellungen importieren
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

      try {
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
      } catch (error) {
        errors.push({ key, error: error.message });
      }
    }

    res.json({
      success: true,
      imported: successes.length,
      skipped: skipped.length,
      errors: errors.length,
      details: {
        imported: successes,
        skipped: skipped,
        errors: errors,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/einstellungen/reset - Einstellungen zurücksetzen
exports.reset = async (req, res) => {
  try {
    // Hier könnten Sie Standard-Einstellungen wiederherstellen
    // Für jetzt nur eine einfache Bestätigung
    res.json({
      success: true,
      message: "Reset-Funktionalität nicht implementiert",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
