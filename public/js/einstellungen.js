import { apiCall, showNotification } from "./utils.js";

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
        await saveSettings(formId);
      });
    }
  });

  // Standard-Tab anzeigen
  showSettingsTab("firma");
});

async function saveSettings(formId) {
  const form = document.getElementById(formId);
  const formData = new FormData(form);
  const updates = [];

  for (const [key, value] of formData.entries()) {
    if (key && value !== undefined) {
      updates.push(apiCall(`/api/einstellungen/${key}`, "PUT", { value }));
    }
  }

  try {
    await Promise.all(updates);
    showNotification("Einstellungen erfolgreich gespeichert", "success");
    loadEinstellungen();

    // Andere Komponenten über Änderungen informieren
    window.dispatchEvent(new CustomEvent("settingsUpdated"));
  } catch (err) {
    showNotification("Fehler beim Speichern der Einstellungen", "error");
  }
}

// Exportiere Funktionen die in anderen Modulen benötigt werden
export function getSetting(key, defaultValue = "") {
  return window.einstellungen?.[key] || defaultValue;
}

export function getSettings() {
  return window.einstellungen || {};
}
