import { apiCall, showNotification } from "./utils.js";

// Debounce-Timer für das Speichern
let saveTimer = null;

export async function loadEinstellungen() {
  try {
    const settings = await apiCall("/api/einstellungen");
    window.einstellungen = {};
    settings.forEach(
      (setting) => (window.einstellungen[setting.key] = setting.value)
    );

    // Alle Formulare füllen
    fillForm("firma-form", window.einstellungen);
    fillForm("leistungen-form", window.einstellungen);
    fillForm("rechnungen-form", window.einstellungen);
    fillForm("auftraege-form", window.einstellungen);

    // Logo-Vorschau laden falls vorhanden
    if (window.einstellungen.firmen_logo) {
      const logoPreview = document.getElementById("logo-preview");
      if (logoPreview) {
        logoPreview.innerHTML = `<img src="${window.einstellungen.firmen_logo}" alt="Firmenlogo" style="max-width: 200px; max-height: 100px;">`;
      }
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

function fillForm(formId, settings) {
  const form = document.getElementById(formId);
  if (!form) return;

  Object.keys(settings).forEach((key) => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input) input.value = settings[key];
  });
}

// Tab-Funktionalität
window.showSettingsTab = function (tabName) {
  // Alle Tabs und Inhalte verstecken
  document
    .querySelectorAll(".settings-tab")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelectorAll(".settings-content")
    .forEach((content) => content.classList.remove("active"));

  // Aktiven Tab und Inhalt anzeigen
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
  document.getElementById(`${tabName}-settings`).classList.add("active");
};

// Logo-Upload-Funktionalität
window.handleLogoUpload = function (event) {
  const file = event.target.files[0];
  if (!file) return;

  // Datei-Validierung
  if (!file.type.startsWith("image/")) {
    showNotification("Bitte wählen Sie eine Bilddatei aus", "error");
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    // 2MB
    showNotification("Die Datei ist zu groß. Maximal 2MB erlaubt.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const logoPreview = document.getElementById("logo-preview");
    logoPreview.innerHTML = `<img src="${e.target.result}" alt="Firmenlogo" style="max-width: 200px; max-height: 100px;">`;

    // Base64 in verstecktes Feld speichern
    document.querySelector('[name="firmen_logo"]').value = e.target.result;
  };
  reader.readAsDataURL(file);
};

document.addEventListener("DOMContentLoaded", function () {
  // Event-Listener für alle Einstellungsformulare
  const forms = [
    "firma-form",
    "leistungen-form",
    "rechnungen-form",
    "auftraege-form",
  ];

  forms.forEach((formId) => {
    const form = document.getElementById(formId);
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        await saveSettingsBatch(formId);
      });
    }
  });

  // Standard-Tab anzeigen
  showSettingsTab("firma");
});

// NEUE BATCH-SAVE FUNKTION (LÖSUNG FÜR DAS PROBLEM)
async function saveSettingsBatch(formId) {
  const form = document.getElementById(formId);
  const formData = new FormData(form);
  const updates = {};

  // Alle Formularwerte sammeln
  for (const [key, value] of formData.entries()) {
    if (key && value !== undefined && value !== "") {
      updates[key] = value;
    }
  }

  // Zeige Lade-Indikator
  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton.innerHTML;
  submitButton.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Speichere...';
  submitButton.disabled = true;

  try {
    // Ein einziger API-Call für alle Einstellungen
    await apiCall("/api/einstellungen/batch", "PUT", { settings: updates });

    showNotification("Einstellungen erfolgreich gespeichert", "success");

    // Einstellungen lokal aktualisieren
    Object.assign(window.einstellungen, updates);

    // Debounced Event für andere Module (verhindert Spam)
    debouncedSettingsUpdate();
  } catch (err) {
    console.error("Save error:", err);
    showNotification(`Fehler beim Speichern: ${err.message}`, "error");
  } finally {
    // Button zurücksetzen
    submitButton.innerHTML = originalText;
    submitButton.disabled = false;
  }
}

// Debounced Settings Update (verhindert zu viele Events)
function debouncedSettingsUpdate() {
  // Vorherigen Timer abbrechen
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  // Neuen Timer setzen
  saveTimer = setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent("settingsUpdated", {
        detail: { timestamp: Date.now() },
      })
    );
  }, 500); // 500ms Verzögerung
}

// FALLBACK: Alte Funktion für Kompatibilität
async function saveSettings(formId) {
  console.warn("saveSettings (old) called - using batch update instead");
  return saveSettingsBatch(formId);
}

// Exportiere Funktionen die in anderen Modulen benötigt werden
export function getSetting(key, defaultValue = "") {
  return window.einstellungen?.[key] || defaultValue;
}

export function getSettings() {
  return window.einstellungen || {};
}

// Neue Hilfsfunktion: Einzelne Einstellung aktualisieren
export async function updateSingleSetting(key, value) {
  try {
    await apiCall(`/api/einstellungen/${key}`, "PUT", { value });
    window.einstellungen[key] = value;
    debouncedSettingsUpdate();
    return true;
  } catch (err) {
    console.error(`Failed to update setting ${key}:`, err);
    return false;
  }
}
