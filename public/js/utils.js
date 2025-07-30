export let kunden = window.kunden || [];
export let fahrzeuge = window.fahrzeuge || [];
export let auftraege = window.auftraege || [];
export let rechnungen = window.rechnungen || [];
export let einstellungen = window.einstellungen || {};

/**
 * Zentrale API-Call Funktion mit Error Handling
 * @param {string} url - API Endpoint
 * @param {string} method - HTTP Methode (GET, POST, PUT, DELETE)
 * @param {Object|null} data - Request Body Data
 * @returns {Promise<Object>} API Response
 */
export async function apiCall(url, method = "GET", data = null) {
  try {
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin", // Für Session-basierte Auth
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    showNotification(
      "Fehler bei der Serververbindung: " + error.message,
      "error"
    );
    throw error;
  }
}

/**
 * Zeigt Benachrichtigungen an
 * @param {string} message - Nachricht
 * @param {string} type - Typ (info, success, warning, error)
 * @returns {void}
 */
export function showNotification(message, type = "info") {
  return window.showNotification(message, type);
}

/**
 * Formatiert Datum für deutsche Anzeige
 * @param {string} dateString - ISO Date String
 * @returns {string} Formatiertes Datum (dd.mm.yyyy)
 */
export function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE");
}

/**
 * Formatiert Währungsbeträge für deutsche Anzeige
 * @param {number} amount - Betrag
 * @returns {string} Formatierter Betrag (€ x.xxx,xx)
 */
export function formatCurrency(amount) {
  if (!amount) return "0,00 €";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Formatiert Telefonnummern
 * @param {string} phone - Telefonnummer
 * @returns {string} Formatierte Telefonnummer
 */
export function formatPhone(phone) {
  if (!phone) return "";
  // Einfache deutsche Telefonnummer-Formatierung
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length >= 10) {
    return cleaned.replace(/(\d{4})(\d{3})(\d+)/, "$1 $2 $3");
  }
  return phone;
}

/**
 * Formatiert Postleitzahlen
 * @param {string} plz - Postleitzahl
 * @returns {string} Formatierte PLZ
 */
export function formatPLZ(plz) {
  if (!plz) return "";
  const cleaned = plz.replace(/\D/g, "");
  return cleaned.slice(0, 5); // Deutsche PLZ max 5 Stellen
}

/**
 * Zentrale Funktion für Section-Navigation (erweitert für Sidebar)
 * @param {string} sectionId - ID der anzuzeigenden Section
 * @param {boolean} fromDashboardCard - Aufruf von Dashboard-Karte
 */
export function showSection(sectionId, fromDashboardCard = false) {
  console.log(`🧭 Navigation zu Section: ${sectionId}`);

  // Alle Sections ausblenden
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
    section.style.display = "none";
  });

  // Alle Navigation-Items deaktivieren
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Ziel-Section anzeigen
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add("active");
    targetSection.classList.add("fade-in");
    targetSection.style.display = "block";
  }

  // Entsprechendes Navigation-Item aktivieren
  const navItem = Array.from(document.querySelectorAll(".nav-item")).find(
    (item) => {
      const onclick = item.getAttribute("onclick");
      return onclick && onclick.includes(`showSection('${sectionId}')`);
    }
  );

  if (navItem) {
    navItem.classList.add("active");
  }

  // Page Title aktualisieren (für Sidebar-Layout)
  updatePageTitle(sectionId);

  // Je nach Section die passenden Daten laden
  loadSectionData(sectionId);

  // Event für andere Module
  window.dispatchEvent(
    new CustomEvent("sectionChanged", {
      detail: { sectionId, fromDashboardCard },
    })
  );
}

/**
 * Aktualisiert den Seitentitel in der Top-Bar
 * @param {string} sectionId - Aktuelle Section ID
 */
function updatePageTitle(sectionId) {
  const titles = {
    dashboard: "Dashboard",
    auftraege: "Aufträge",
    rechnungen: "Rechnungen",
    kunden: "Kunden",
    fahrzeuge: "Fahrzeuge",
    fahrzeughandel: "Fahrzeughandel",
    einstellungen: "Einstellungen",
  };

  const pageTitle = document.getElementById("page-title");
  if (pageTitle && titles[sectionId]) {
    pageTitle.textContent = titles[sectionId];
  }

  // Auch den Browser-Titel aktualisieren
  const firmenname = window.einstellungen?.firmenname || "KFZ FacPro";
  document.title = `${titles[sectionId] || sectionId} - ${firmenname}`;
}

/**
 * Lädt die entsprechenden Daten für eine Section
 * @param {string} sectionId - Section ID
 */
async function loadSectionData(sectionId) {
  try {
    switch (sectionId) {
      case "dashboard":
        const dashboard = await import("./dashboard.js");
        if (dashboard.loadDashboard) await dashboard.loadDashboard();
        break;
      case "kunden":
        const kunden = await import("./kunden.js");
        if (kunden.loadKunden) await kunden.loadKunden();
        break;
      case "fahrzeuge":
        const fahrzeuge = await import("./fahrzeuge.js");
        if (fahrzeuge.loadFahrzeuge) await fahrzeuge.loadFahrzeuge();
        break;
      case "fahrzeughandel":
        const fahrzeughandel = await import("./fahrzeughandel.js");
        if (fahrzeughandel.loadFahrzeughandel)
          await fahrzeughandel.loadFahrzeughandel();
        break;
      case "auftraege":
        const auftraege = await import("./auftraege.js");
        if (auftraege.loadAuftraege) await auftraege.loadAuftraege();
        break;
      case "rechnungen":
        const rechnungen = await import("./rechnungen.js");
        if (rechnungen.loadRechnungen) await rechnungen.loadRechnungen();
        break;
      case "einstellungen":
        const einstellungen = await import("./einstellungen.js");
        if (einstellungen.loadEinstellungen)
          await einstellungen.loadEinstellungen();
        break;
    }
  } catch (error) {
    console.error(`Fehler beim Laden der Section ${sectionId}:`, error);
  }
}

/**
 * Togglet die Sidebar zwischen collapsed und expanded
 */
export function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) {
    console.warn("Sidebar nicht gefunden");
    return;
  }

  const isCollapsed = sidebar.classList.contains("collapsed");

  if (isCollapsed) {
    expandSidebar();
  } else {
    collapseSidebar();
  }

  // Status in localStorage speichern
  try {
    localStorage.setItem("sidebar-collapsed", !isCollapsed);
  } catch (e) {
    // Ignoriere localStorage-Fehler
  }
}

/**
 * Collapsed die Sidebar
 */
export function collapseSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.add("collapsed");
    console.log("🔼 Sidebar collapsed");
  }
}

/**
 * Expandiert die Sidebar
 */
export function expandSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.remove("collapsed");
    console.log("🔽 Sidebar expanded");
  }
}

/**
 * Initialisiert den Sidebar-Status beim Laden
 */
export function initializeSidebar() {
  try {
    const wasCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
    if (wasCollapsed) {
      collapseSidebar();
    }
  } catch (e) {
    // Ignoriere localStorage-Fehler
  }
}

/**
 * Behandelt Mobile-spezifische Sidebar-Funktionen
 */
export function initMobile() {
  const sidebar = document.getElementById("sidebar");
  const isMobile = window.innerWidth <= 768;

  if (!sidebar) return;

  if (isMobile) {
    // Auf Mobile: Sidebar standardmäßig nicht collapsed, aber versteckt
    sidebar.classList.remove("collapsed");
    sidebar.classList.remove("mobile-open");

    // Mobile-Overlay hinzufügen falls nicht vorhanden
    addMobileOverlay();
  } else {
    // Desktop: Mobile-spezifische Klassen entfernen
    sidebar.classList.remove("mobile-open");
    removeMobileOverlay();
  }
}

/**
 * Öffnet die Sidebar auf Mobile
 */
export function openMobileSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar && window.innerWidth <= 768) {
    sidebar.classList.add("mobile-open");
    showMobileOverlay();
  }
}

/**
 * Schließt die Sidebar auf Mobile
 */
export function closeMobileSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.remove("mobile-open");
    hideMobileOverlay();
  }
}

/**
 * Fügt Mobile-Overlay hinzu
 */
function addMobileOverlay() {
  if (document.getElementById("mobile-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "mobile-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
    display: none;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  overlay.addEventListener("click", closeMobileSidebar);
  document.body.appendChild(overlay);
}

/**
 * Entfernt Mobile-Overlay
 */
function removeMobileOverlay() {
  const overlay = document.getElementById("mobile-overlay");
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Zeigt Mobile-Overlay an
 */
function showMobileOverlay() {
  const overlay = document.getElementById("mobile-overlay");
  if (overlay) {
    overlay.style.display = "block";
    setTimeout(() => {
      overlay.style.opacity = "1";
    }, 10);
  }
}

/**
 * Versteckt Mobile-Overlay
 */
function hideMobileOverlay() {
  const overlay = document.getElementById("mobile-overlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.style.display = "none";
    }, 300);
  }
}

/**
 * Initialisiert URL-basiertes Routing
 */
export function initializeRouting() {
  // Hash-basiertes Routing
  function handleHashChange() {
    const hash = window.location.hash.slice(1); // Entferne #
    if (hash && document.getElementById(hash)) {
      showSection(hash);
    } else {
      showSection("dashboard"); // Fallback
    }
  }

  // Event Listener für Hash-Änderungen
  window.addEventListener("hashchange", handleHashChange);

  // Initial-Routing beim Laden
  handleHashChange();
}

/**
 * Navigiert zu einer Section und aktualisiert die URL
 * @param {string} sectionId - Section ID
 */
export function navigateToSection(sectionId) {
  window.location.hash = sectionId;
  // hashchange Event wird automatisch showSection aufrufen
}

/**
 * Validiert ein Formular
 * @param {HTMLFormElement} form - Formular-Element
 * @returns {boolean} Validierungsergebnis
 */
export function validateForm(form) {
  if (!form) return false;

  let isValid = true;
  const requiredFields = form.querySelectorAll("[required]");

  requiredFields.forEach((field) => {
    if (!field.value.trim()) {
      field.classList.add("error");
      isValid = false;
    } else {
      field.classList.remove("error");
    }
  });

  return isValid;
}

/**
 * Sammelt Formulardaten als Objekt
 * @param {HTMLFormElement} form - Formular-Element
 * @returns {Object} Formulardaten
 */
export function getFormData(form) {
  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    data[key] = value;
  }

  return data;
}

/**
 * Füllt ein Formular mit Daten
 * @param {string} formId - Formular ID
 * @param {Object} data - Daten zum Füllen
 */
export function fillForm(formId, data) {
  const form = document.getElementById(formId);
  if (!form || !data) return;

  Object.entries(data).forEach(([key, value]) => {
    const field = form.querySelector(`[name="${key}"]`);
    if (field) {
      if (field.type === "checkbox") {
        field.checked = value === "1" || value === true;
      } else {
        field.value = value || "";
      }
    }
  });
}

/**
 * Debounce-Funktion für Performance-Optimierung
 * @param {Function} func - Auszuführende Funktion
 * @param {number} wait - Wartezeit in ms
 * @returns {Function} Debounced Function
 */
export function debounce(func, wait) {
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

/**
 * Throttle-Funktion für Performance-Optimierung
 * @param {Function} func - Auszuführende Funktion
 * @param {number} limit - Limit in ms
 * @returns {Function} Throttled Function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Generiert eine eindeutige ID
 * @param {string} prefix - Prefix für die ID
 * @returns {string} Eindeutige ID
 */
export function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Prüft ob ein Element im Viewport sichtbar ist
 * @param {HTMLElement} element - Element zum Prüfen
 * @returns {boolean} Sichtbarkeit
 */
export function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Smooth Scroll zu einem Element
 * @param {string|HTMLElement} target - Ziel-Element oder Selektor
 * @param {number} offset - Offset in Pixeln
 */
export function scrollToElement(target, offset = 0) {
  const element =
    typeof target === "string" ? document.querySelector(target) : target;
  if (!element) return;

  const elementPosition = element.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - offset;

  window.scrollTo({
    top: offsetPosition,
    behavior: "smooth",
  });
}

/**
 * Initialisiert alle Utility-Funktionen
 */
export function initializeUtils() {
  console.log("🔧 Initialisiere Utils...");

  // Mobile-Handling
  initMobile();

  // Sidebar-Status
  initializeSidebar();

  // URL-Routing
  initializeRouting();

  // Window Resize Handler
  const handleResize = throttle(() => {
    initMobile();
  }, 250);

  window.addEventListener("resize", handleResize);

  // Cleanup bei beforeunload
  window.addEventListener("beforeunload", () => {
    // Cleanup-Code hier falls nötig
  });

  console.log("✅ Utils initialisiert");
}

// Für Kompatibilität mit bestehenden HTML-onclick-Events
window.showSection = showSection;
window.toggleSidebar = toggleSidebar;
window.openMobileSidebar = openMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.navigateToSection = navigateToSection;

// Auto-Initialisierung wenn DOM bereit ist
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeUtils);
} else {
  // DOM bereits geladen
  initializeUtils();
}

// Export für Module
export default {
  // Core Functions
  apiCall,
  showNotification,

  // Formatting
  formatDate,
  formatCurrency,
  formatPhone,
  formatPLZ,

  // Navigation
  showSection,
  navigateToSection,

  // Sidebar
  toggleSidebar,
  collapseSidebar,
  expandSidebar,

  // Mobile
  openMobileSidebar,
  closeMobileSidebar,

  // Form Utilities
  validateForm,
  getFormData,
  fillForm,

  // Performance
  debounce,
  throttle,

  // Utilities
  generateId,
  isElementInViewport,
  scrollToElement,

  // State
  kunden,
  fahrzeuge,
  auftraege,
  rechnungen,
  einstellungen,
};
