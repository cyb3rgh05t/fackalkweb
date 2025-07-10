// Globale State-Objekte als window-Property, damit Eventhandler aus anderen Modulen Zugriff haben
export let kunden = window.kunden || [];
export let fahrzeuge = window.fahrzeuge || [];
export let auftraege = window.auftraege || [];
export let rechnungen = window.rechnungen || [];
export let einstellungen = window.einstellungen || {};

export async function apiCall(url, method = "GET", data = null) {
  try {
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (data) options.body = JSON.stringify(data);
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }
    return await response.json();
  } catch (err) {
    console.error("API Call failed:", err);
    throw err;
  }
}

export function showNotification(message, type = "info") {
  // Entferne vorherige Benachrichtigungen
  const existingNotifications = document.querySelectorAll(".notification");
  existingNotifications.forEach((n) => n.remove());

  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; font-size: 1.2em; cursor: pointer; margin-left: 1rem;">&times;</button>
  `;

  // Styling für die Notification
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem;
    border-radius: 8px; color: white; font-weight: 500; z-index: 10000;
    animation: slideIn 0.3s ease-out; max-width: 400px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;

  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };
  notification.style.background = colors[type] || colors.info;

  document.body.appendChild(notification);

  // Automatisch nach 5 Sekunden entfernen
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

export function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE");
}

export function formatCurrency(amount) {
  if (typeof amount !== "number") amount = parseFloat(amount) || 0;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDateTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString("de-DE");
}

// Navigation zwischen Sections
export function showSection(sectionId) {
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));

  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.add("active");
    section.classList.add("fade-in");
  }

  const navItem = Array.from(document.querySelectorAll(".nav-item")).find(
    (item) => item.onclick && item.onclick.toString().includes(sectionId)
  );
  if (navItem) navItem.classList.add("active");

  // Je nach Section die passenden Daten laden
  switch (sectionId) {
    case "dashboard":
      import("./dashboard.js").then((m) => m.loadDashboard());
      break;
    case "auftraege":
      import("./auftraege.js").then((m) => m.loadAuftraege());
      break;
    case "rechnungen":
      import("./rechnungen.js").then((m) => m.loadRechnungen());
      break;
    case "kunden":
      import("./kunden.js").then((m) => m.loadKunden());
      break;
    case "fahrzeuge":
      import("./fahrzeuge.js").then((m) => m.loadFahrzeuge());
      break;
    case "einstellungen":
      import("./einstellungen.js").then((m) => m.loadEinstellungen());
      break;
  }
}

// Verbesserte getSetting Funktion mit besserer Fehlerbehandlung
export function getSetting(key, defaultValue = "") {
  // Zuerst prüfen ob window.einstellungen existiert
  if (!window.einstellungen) {
    console.warn(
      "Einstellungen noch nicht geladen, verwende Default-Wert für:",
      key
    );
    return defaultValue;
  }

  // Wert aus Einstellungen holen
  const value = window.einstellungen[key];

  // Wenn kein Wert vorhanden, Default zurückgeben
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return value;
}

// Funktion um alle Einstellungen zu holen
export function getSettings() {
  return window.einstellungen || {};
}

// Funktion um Einstellungen zu aktualisieren
export function updateSetting(key, value) {
  if (!window.einstellungen) {
    window.einstellungen = {};
  }
  window.einstellungen[key] = value;
}

// Funktion um Einstellungen zu laden und im globalen Scope zu speichern
export async function loadGlobalSettings() {
  try {
    const settings = await apiCall("/api/einstellungen");
    window.einstellungen = {};
    settings.forEach((setting) => {
      window.einstellungen[setting.key] = setting.value;
    });

    // Event auslösen dass Einstellungen geladen wurden
    window.dispatchEvent(
      new CustomEvent("settingsLoaded", {
        detail: window.einstellungen,
      })
    );

    return window.einstellungen;
  } catch (error) {
    console.error("Fehler beim Laden der Einstellungen:", error);
    return {};
  }
}

// Hilfsfunktionen für Formulare
export function fillFormWithData(formId, data) {
  const form = document.getElementById(formId);
  if (!form || !data) return;

  Object.keys(data).forEach((key) => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input) {
      if (input.type === "checkbox") {
        input.checked = data[key] === "1" || data[key] === true;
      } else {
        input.value = data[key] || "";
      }
    }
  });
}

export function getFormData(formId) {
  const form = document.getElementById(formId);
  if (!form) return {};

  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    const input = form.querySelector(`[name="${key}"]`);
    if (input && input.type === "checkbox") {
      data[key] = input.checked ? "1" : "0";
    } else {
      data[key] = value;
    }
  }

  return data;
}

// Validierungsfunktionen
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone) {
  const phoneRegex = /^[\d\s\-\+\(\)\/]+$/;
  return phoneRegex.test(phone);
}

export function validateIBAN(iban) {
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/;
  return ibanRegex.test(iban.replace(/\s/g, ""));
}

// Funktion um Währungsbeträge zu parsen
export function parseCurrency(currencyString) {
  if (typeof currencyString === "number") return currencyString;
  if (!currencyString) return 0;

  // Entferne Währungszeichen und Leerzeichen
  const cleanString = currencyString
    .replace(/[€$£¥]/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");

  return parseFloat(cleanString) || 0;
}

// Debug-Funktionen für Entwicklung
export function debugSettings() {
  console.log("Aktuelle Einstellungen:", window.einstellungen);
}

export function debugState() {
  console.log("Aktueller App-State:", {
    kunden: window.kunden?.length || 0,
    fahrzeuge: window.fahrzeuge?.length || 0,
    auftraege: window.auftraege?.length || 0,
    rechnungen: window.rechnungen?.length || 0,
    einstellungen: Object.keys(window.einstellungen || {}).length,
  });
}

// Event-Listener für globale Einstellungsänderungen
window.addEventListener("settingsUpdated", (event) => {
  console.log("Einstellungen wurden global aktualisiert");
  // Alle Module über Änderungen informieren
  if (window.loadRechnungen) window.loadRechnungen();
  if (window.loadAuftraege) window.loadAuftraege();
  if (window.loadDashboard) window.loadDashboard();
});

// Beim Laden der App die Einstellungen initialisieren
document.addEventListener("DOMContentLoaded", () => {
  loadGlobalSettings();
});
