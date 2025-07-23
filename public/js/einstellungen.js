// Erweiterte Einstellungen-Verwaltung mit Layout-Editor Integration
import { apiCall, showNotification } from "./utils.js";

// Layout-Editor Import
let layoutEditorModule = null;

// Debounce-Timer für das Speichern
let saveTimer = null;

export async function loadEinstellungen() {
  try {
    console.log("🔧 Lade Einstellungen...");
    const settings = await apiCall("/api/einstellungen");

    // KRITISCH: Bestehende Einstellungen NICHT überschreiben!
    if (!window.einstellungen) {
      window.einstellungen = {};
    }

    // Merge neue Einstellungen mit bestehenden
    const newSettings = {};
    settings.forEach((setting) => (newSettings[setting.key] = setting.value));

    // Bestehende Werte behalten, neue hinzufügen
    Object.assign(window.einstellungen, newSettings);

    console.log(
      "✅ Einstellungen geladen:",
      Object.keys(window.einstellungen).length,
      "Einträge"
    );
    console.log(
      "🖼️ Logo nach Reload:",
      window.einstellungen?.firmen_logo?.length || "NICHT VORHANDEN"
    );

    // Alle Formulare füllen
    fillForm("firma-form", window.einstellungen);
    fillForm("leistungen-form", window.einstellungen);
    fillForm("rechnungen-form", window.einstellungen);
    fillForm("auftraege-form", window.einstellungen);

    // Layout-Editor initialisieren falls verfügbar
    await initializeLayoutEditor();

    // Logo-Vorschau laden falls vorhanden
    if (window.einstellungen.firmen_logo) {
      const logoPreview = document.getElementById("logo-preview");
      if (logoPreview) {
        logoPreview.innerHTML = `<img src="${window.einstellungen.firmen_logo}" alt="Firmenlogo" style="max-width: 200px; max-height: 100px;">`;
      }
    }

    updateLogoButtonVisibility();

    // Event für andere Module senden
    window.dispatchEvent(
      new CustomEvent("settingsLoaded", {
        detail: window.einstellungen,
      })
    );
  } catch (err) {
    console.error("❌ Fehler beim Laden der Einstellungen:", err);
    // Fallback: Leere Einstellungen setzen
    window.einstellungen = {};
  }
}

// Layout-Editor initialisieren
async function initializeLayoutEditor() {
  try {
    // Layout-Editor-Modul dynamisch laden
    if (!layoutEditorModule) {
      layoutEditorModule = await import("./layout-editor.js");
      console.log("🎨 Layout-Editor-Modul geladen");
    }

    // Layout-Editor initialisieren
    if (layoutEditorModule.initLayoutEditor) {
      await layoutEditorModule.initLayoutEditor();
    }

    // Enhanced Print System laden
    await import("./enhanced-print.js");
    console.log("🖨️ Enhanced Print System geladen");
  } catch (error) {
    console.warn("⚠️ Layout-Editor konnte nicht geladen werden:", error);
    // Gracefully degradieren - das System funktioniert auch ohne Layout-Editor
  }
}

// Hilfsfunktion: Einstellung sicher abrufen
export function getSetting(key, defaultValue = "") {
  // Warten bis Einstellungen geladen sind
  if (!window.einstellungen) {
    console.warn(
      `⚠️ Einstellungen noch nicht geladen - verwende Standardwert für ${key}`
    );
    return defaultValue;
  }
  return window.einstellungen[key] || defaultValue;
}

// Hilfsfunktion: Einstellungen sicher setzen
export function setSetting(key, value) {
  if (!window.einstellungen) {
    window.einstellungen = {};
  }
  window.einstellungen[key] = value;
}

// Hilfsfunktion: Alle Einstellungen abrufen
export function getSettings() {
  return window.einstellungen || {};
}

function fillForm(formId, settings) {
  const form = document.getElementById(formId);
  if (!form) return;

  Object.keys(settings).forEach((key) => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input) {
      if (input.type === "checkbox") {
        input.checked = settings[key] === "true" || settings[key] === "1";
      } else {
        input.value = settings[key];
      }
    }
  });
}

// Tab-Funktionalität - Erweitert um Layout-Tab
window.showSettingsTab = function (tabName) {
  // Alle Tabs und Inhalte verstecken
  document
    .querySelectorAll(".settings-tab")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".settings-content")
    .forEach((content) => content.classList.remove("active"));

  // Aktiven Tab und Inhalt anzeigen
  const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
  const tabContent = document.getElementById(`${tabName}-settings`);

  if (tabButton) tabButton.classList.add("active");
  if (tabContent) tabContent.classList.add("active");

  // Layout-Editor spezielle Behandlung
  if (tabName === "layout" && layoutEditorModule) {
    // Layout-Form mit aktuellen Werten füllen
    setTimeout(() => {
      if (layoutEditorModule.fillLayoutForm) {
        layoutEditorModule.fillLayoutForm();
      }
    }, 100);
  }
};

// VERBESSERTE BATCH-SAVE FUNKTION
async function saveSettingsBatch(formId) {
  const form = document.getElementById(formId);
  const formData = new FormData(form);
  const updates = {};

  // **KORRIGIERT:** Alle Formularwerte sammeln (auch leere)
  for (const [key, value] of formData.entries()) {
    if (key && value !== undefined) {
      // Nur undefined ausschließen
      updates[key] = value.toString().trim(); // Leerzeichen entfernen
    }
  }

  // **NEU:** Explizit alle Eingabefelder durchgehen
  const inputs = form.querySelectorAll(
    "input[name], select[name], textarea[name]"
  );
  inputs.forEach((input) => {
    if (input.name && !updates.hasOwnProperty(input.name)) {
      updates[input.name] = input.value || ""; // Leere Werte mit einschließen
    }
  });

  // Checkbox-Werte korrekt verarbeiten
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    if (checkbox.name) {
      updates[checkbox.name] = checkbox.checked ? "true" : "false";
    }
  });

  // **DEBUG:** Logging hinzufügen
  console.log(`Speichere ${formId}:`, updates);

  // Rest der Funktion bleibt gleich...
  const submitButton = form.querySelector('button[type="submit"]');
  if (!submitButton) return;

  const originalText = submitButton.innerHTML;
  submitButton.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Speichere...';
  submitButton.disabled = true;

  try {
    const result = await apiCall("/api/einstellungen/batch", "PUT", {
      settings: updates,
    });

    Object.assign(window.einstellungen, updates);

    const successCount = Object.keys(updates).length;
    showNotification(
      `${successCount} Einstellungen erfolgreich gespeichert`,
      "success"
    );

    window.dispatchEvent(
      new CustomEvent("settingsUpdated", {
        detail: { updated: updates, form: formId },
      })
    );

    if (formId === "layout-form") {
      window.dispatchEvent(
        new CustomEvent("layoutSettingsUpdated", {
          detail: updates,
        })
      );
    }

    form.classList.add("saved");
    setTimeout(() => form.classList.remove("saved"), 2000);
  } catch (error) {
    console.error("Batch save error:", error);
    showNotification(`Fehler beim Speichern: ${error.message}`, "error");
  } finally {
    submitButton.innerHTML = originalText;
    submitButton.disabled = false;
  }
}

// Einzelne Einstellung speichern (für Live-Updates)
async function saveSingleSetting(key, value) {
  try {
    await apiCall(`/api/einstellungen/${key}`, "PUT", { value });
    window.einstellungen[key] = value;

    // Event senden
    window.dispatchEvent(
      new CustomEvent("settingUpdated", {
        detail: { key, value },
      })
    );

    return true;
  } catch (error) {
    console.error(`Fehler beim Speichern von ${key}:`, error);
    return false;
  }
}

// Debounced Live-Save für bestimmte Felder
function setupLiveSave() {
  // Felder identifizieren die Live-Save verwenden sollen
  const liveSaveFields = [
    "layout_font_size_normal",
    "layout_font_size_small",
    "layout_font_size_large",
    "layout_color_primary",
    "layout_color_text",
    "layout_line_height",
  ];

  liveSaveFields.forEach((fieldName) => {
    const field = document.querySelector(`[name="${fieldName}"]`);
    if (field) {
      field.addEventListener(
        "input",
        debounce((event) => {
          saveSingleSetting(fieldName, event.target.value);
        }, 1000)
      );
    }
  });
}

function updateLogoButtonVisibility() {
  const removeBtnElement = document.getElementById("remove-logo-btn");
  const logoPreview = document.getElementById("logo-preview");
  const hasLogo =
    window.einstellungen?.firmen_logo &&
    window.einstellungen.firmen_logo.length > 0;

  if (removeBtnElement) {
    removeBtnElement.style.display = hasLogo ? "inline-flex" : "none";
  }
}

// Logo-Upload Funktionalität
window.uploadLogo = async function () {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";

  fileInput.onchange = async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showNotification("Logo-Datei zu groß (max. 2MB)", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
      const base64Data = e.target.result;

      try {
        // 1. API-Call zum Speichern
        await apiCall("/api/einstellungen/firmen_logo", "PUT", {
          value: base64Data,
        });

        // 2. SICHER: window.einstellungen erstellen falls nicht vorhanden
        if (!window.einstellungen) {
          window.einstellungen = {};
        }

        // 3. Logo setzen
        window.einstellungen.firmen_logo = base64Data;

        // 4. VALIDATION: Prüfen ob Logo wirklich gesetzt wurde
        const logoCheck = window.einstellungen?.firmen_logo;
        console.log("✅ Logo-Upload VALIDATION:", {
          logoExists: !!logoCheck,
          logoLength: logoCheck?.length || 0,
          timestamp: new Date().toISOString(),
        });

        // 5. UI updates
        const logoPreview = document.getElementById("logo-preview");
        if (logoPreview) {
          logoPreview.innerHTML = `<img src="${base64Data}" alt="Firmenlogo" style="max-width: 200px; max-height: 100px;">`;
        }

        updateLogoButtonVisibility();
        showNotification("Logo erfolgreich hochgeladen", "success");

        // 6. Events für andere Module
        window.dispatchEvent(
          new CustomEvent("logoUpdated", {
            detail: { logo: base64Data },
          })
        );

        // 7. FORCE: Dashboard-Logo aktualisieren
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("settingsUpdated", {
              detail: { updated: { firmen_logo: base64Data } },
            })
          );
        }, 100);
      } catch (error) {
        console.error("Logo-Upload Fehler:", error);
        showNotification("Fehler beim Hochladen des Logos", "error");
      }
    };

    reader.readAsDataURL(file);
  };

  fileInput.click();
};

// Logo entfernen
window.removeLogo = async function () {
  if (!confirm("Möchten Sie das Logo wirklich entfernen?")) return;

  try {
    await apiCall("/api/einstellungen/firmen_logo", "PUT", { value: "" });
    window.einstellungen.firmen_logo = "";

    const logoPreview = document.getElementById("logo-preview");
    if (logoPreview) {
      logoPreview.innerHTML =
        '<div class="no-logo">Kein Logo hochgeladen</div>';
    }

    // **NEUE ZEILEN:** Browser-Cache für das Logo löschen
    if (window.einstellungen.firmen_logo) {
      window.einstellungen.firmen_logo = null;
    }

    // Force Browser-Cache löschen
    const logoImages = document.querySelectorAll('img[alt="Firmenlogo"]');
    logoImages.forEach((img) => {
      img.src = "";
      img.remove();
    });

    updateLogoButtonVisibility();
    showNotification("Logo entfernt", "success");

    // Event senden
    window.dispatchEvent(new CustomEvent("logoRemoved", { detail: {} }));

    // **WICHTIG:** Seite neu laden um alle Caches zu löschen
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    showNotification("Fehler beim Entfernen des Logos", "error");
  }
};

// Einstellungen exportieren
window.exportEinstellungen = async function () {
  try {
    const response = await fetch("/api/einstellungen/export");
    const blob = await response.blob();

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faf-einstellungen-export-${
      new Date().toISOString().split("T")[0]
    }.json`;
    a.click();

    window.URL.revokeObjectURL(url);
    showNotification("Einstellungen erfolgreich exportiert", "success");
  } catch (error) {
    showNotification("Fehler beim Exportieren der Einstellungen", "error");
  }
};

// Einstellungen importieren
window.importEinstellungen = function () {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.style.display = "none";

  fileInput.onchange = async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      if (!importData.settings || typeof importData.settings !== "object") {
        throw new Error("Ungültige Import-Datei");
      }

      const overwrite = confirm(
        "Sollen bestehende Einstellungen überschrieben werden?"
      );

      const response = await apiCall("/api/einstellungen/import", "POST", {
        settings: importData.settings,
        overwrite,
      });

      showNotification(
        `Import abgeschlossen: ${
          response.successes?.length || 0
        } erfolgreich, ${response.errors?.length || 0} Fehler`,
        response.errors?.length > 0 ? "warning" : "success"
      );

      // Einstellungen neu laden
      await loadEinstellungen();
    } catch (error) {
      showNotification(`Import-Fehler: ${error.message}`, "error");
    }
  };

  fileInput.click();
};

// Standard-Arbeitsschritte verwalten
window.addArbeitsschritt = function () {
  const container = document.getElementById("arbeitsschritte-container");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "form-input";
  input.placeholder = "Neuer Arbeitsschritt";
  input.style.marginBottom = "0.5rem";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-sm btn-danger";
  removeBtn.innerHTML = '<i class="fas fa-times"></i>';
  removeBtn.style.marginLeft = "0.5rem";
  removeBtn.onclick = () => {
    input.remove();
    removeBtn.remove();
  };

  container.appendChild(input);
  container.appendChild(removeBtn);
  container.appendChild(document.createElement("br"));
};

// Form-Event-Listener
document.addEventListener("DOMContentLoaded", function () {
  // Form-Submit-Events
  const forms = [
    "firma-form",
    "leistungen-form",
    "rechnungen-form",
    "auftraege-form",
  ];

  forms.forEach((formId) => {
    const form = document.getElementById(formId);
    if (form) {
      // Bestehende Event-Listener entfernen
      form.removeEventListener("submit", handleFormSubmit);

      // Neuen Event-Listener hinzufügen
      form.addEventListener("submit", handleFormSubmit);

      console.log(`✅ Event-Handler für ${formId} registriert`);
    } else {
      console.warn(`⚠️ Form ${formId} nicht gefunden`);
    }
  });

  function handleFormSubmit(e) {
    e.preventDefault();
    const formId = e.target.id;
    console.log(`📝 Form ${formId} wird gespeichert...`);
    saveSettingsBatch(formId);
  }

  // Live-Save Setup
  setTimeout(setupLiveSave, 1000);

  // Drag & Drop für Logo
  const logoUploadArea = document.getElementById("logo-upload-area");
  if (logoUploadArea) {
    logoUploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      logoUploadArea.classList.add("drag-over");
    });

    logoUploadArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      logoUploadArea.classList.remove("drag-over");
    });

    logoUploadArea.addEventListener("drop", async (e) => {
      e.preventDefault();
      logoUploadArea.classList.remove("drag-over");

      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith("image/")) {
        const file = files[0];
        // Logo-Upload-Logik hier
        const reader = new FileReader();
        reader.onload = async function (e) {
          const base64Data = e.target.result;
          try {
            await apiCall("/api/einstellungen/firmen_logo", "PUT", {
              value: base64Data,
            });
            window.einstellungen.firmen_logo = base64Data;
            showNotification("Logo erfolgreich hochgeladen", "success");
          } catch (error) {
            showNotification("Fehler beim Hochladen des Logos", "error");
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }
});

// Debounce-Hilfsfunktion
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Validierungs-Funktionen
function validateSetting(key, value) {
  const validationRules = {
    mwst_satz: {
      type: "number",
      min: 0,
      max: 25,
      step: 0.01,
    },
    basis_stundenpreis: {
      type: "number",
      min: 0,
      max: 1000,
      step: 0.01,
    },
    layout_font_size_normal: {
      type: "css-size",
      units: ["px", "rem", "em", "pt"],
    },
    layout_color_primary: {
      type: "color",
    },
    // Weitere Validierungsregeln können hier hinzugefügt werden
  };

  const rule = validationRules[key];
  if (!rule) return { valid: true };

  switch (rule.type) {
    case "number":
      const num = parseFloat(value);
      if (isNaN(num)) return { valid: false, message: "Muss eine Zahl sein" };
      if (rule.min !== undefined && num < rule.min)
        return { valid: false, message: `Minimum: ${rule.min}` };
      if (rule.max !== undefined && num > rule.max)
        return { valid: false, message: `Maximum: ${rule.max}` };
      break;

    case "color":
      if (!/^#[0-9A-F]{6}$/i.test(value))
        return { valid: false, message: "Ungültiges Farbformat" };
      break;

    case "css-size":
      const sizePattern = new RegExp(
        `^\\d+(\\.\\d+)?(${rule.units.join("|")})$`
      );
      if (!sizePattern.test(value))
        return {
          valid: false,
          message: `Erlaubte Einheiten: ${rule.units.join(", ")}`,
        };
      break;
  }

  return { valid: true };
}

// Theme-Funktionen
window.applyTheme = function (themeName) {
  const themes = {
    classic: {
      layout_color_primary: "#007bff",
      layout_color_text: "#333333",
      layout_font_family: "Arial, sans-serif",
    },
    elegant: {
      layout_color_primary: "#2c3e50",
      layout_color_text: "#34495e",
      layout_font_family: "'Times New Roman', serif",
    },
    modern: {
      layout_color_primary: "#e74c3c",
      layout_color_text: "#2c3e50",
      layout_font_family: "'Roboto', sans-serif",
    },
  };

  const theme = themes[themeName];
  if (theme) {
    Object.assign(window.einstellungen, theme);

    // Form aktualisieren
    Object.keys(theme).forEach((key) => {
      const input = document.querySelector(`[name="${key}"]`);
      if (input) input.value = theme[key];
    });

    showNotification(`Theme "${themeName}" angewendet`, "success");
  }
};

// Reset-Funktionen
window.resetSection = async function (section) {
  const confirmMessage = `Möchten Sie wirklich alle ${section}-Einstellungen zurücksetzen?`;
  if (!confirm(confirmMessage)) return;

  try {
    // Standard-Werte für verschiedene Sektionen
    const defaults = {
      firma: {
        firmenname: "Meine Firma",
        firmen_strasse: "",
        firmen_plz: "",
        firmen_ort: "",
      },
      layout: layoutEditorModule
        ? layoutEditorModule.DEFAULT_LAYOUT_SETTINGS
        : {},
    };

    const sectionDefaults = defaults[section];
    if (sectionDefaults) {
      await apiCall("/api/einstellungen/batch", "PUT", {
        settings: sectionDefaults,
      });

      Object.assign(window.einstellungen, sectionDefaults);
      fillForm(`${section}-form`, window.einstellungen);

      showNotification(`${section}-Einstellungen zurückgesetzt`, "success");
    }
  } catch (error) {
    showNotification(
      `Fehler beim Zurücksetzen der ${section}-Einstellungen`,
      "error"
    );
  }
};

// Erweiterte Suchfunktionalität für Einstellungen
window.searchSettings = function (query) {
  const forms = document.querySelectorAll(".settings-content");
  query = query.toLowerCase();

  forms.forEach((form) => {
    const inputs = form.querySelectorAll(".form-group");
    inputs.forEach((group) => {
      const label = group.querySelector(".form-label");
      const input = group.querySelector(".form-input");

      if (label && input) {
        const labelText = label.textContent.toLowerCase();
        const inputName = input.name ? input.name.toLowerCase() : "";

        if (labelText.includes(query) || inputName.includes(query)) {
          group.style.display = "";
          group.classList.add("highlight-search");
        } else {
          group.style.display = query ? "none" : "";
          group.classList.remove("highlight-search");
        }
      }
    });
  });
};

// Cleanup beim Unload
window.addEventListener("beforeunload", () => {
  // Alle Timer stoppen
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
});

// Kompatibilität für alte Funktionsnamen
window.handleLogoUpload = window.uploadLogo;
window.handleLogoRemove = window.removeLogo;
window.saveSettings = function (formId) {
  return saveSettingsBatch(formId);
};
window.handleSettingChange = function (key, value) {
  return saveSingleSetting(key, value);
};

console.log(
  "Einstellungen-Modul v2.0 mit Layout-Editor geladen - " +
    new Date().toISOString()
);
