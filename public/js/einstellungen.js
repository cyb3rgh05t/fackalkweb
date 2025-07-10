import { apiCall, showNotification } from "./utils.js";

// Debounce-Timer für das Speichern
let saveTimer = null;

export async function loadEinstellungen() {
  try {
    console.log("🔧 Lade Einstellungen...");
    const settings = await apiCall("/api/einstellungen");

    // Einstellungen global verfügbar machen
    window.einstellungen = {};
    settings.forEach(
      (setting) => (window.einstellungen[setting.key] = setting.value)
    );

    console.log(
      "✅ Einstellungen geladen:",
      Object.keys(window.einstellungen).length,
      "Einträge"
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

// VERBESSERTE BATCH-SAVE FUNKTION
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

    // Event für andere Module senden
    window.dispatchEvent(
      new CustomEvent("settingsUpdated", {
        detail: { updated: updates, all: window.einstellungen },
      })
    );
  } catch (error) {
    console.error("❌ Fehler beim Speichern:", error);
    showNotification("Fehler beim Speichern der Einstellungen", "error");
  } finally {
    // Lade-Indikator zurücksetzen
    submitButton.innerHTML = originalText;
    submitButton.disabled = false;
  }
}

// Event-Listener für Formulare
document.addEventListener("DOMContentLoaded", function () {
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
