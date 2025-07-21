// ===== VERBESSERTE APP-INITIALISIERUNG =====

import { showSection } from "./utils.js";
import { loadDashboard } from "./dashboard.js";
import { loadKunden } from "./kunden.js";
import { loadFahrzeuge } from "./fahrzeuge.js";
import { loadAuftraege } from "./auftraege.js";
import { loadRechnungen } from "./rechnungen.js";
import { loadEinstellungen } from "./einstellungen.js";

// Globaler App-State
let appInitialized = false;
let moduleStatus = {
  einstellungen: false,
  dashboard: false,
  kunden: false,
  fahrzeuge: false,
  auftraege: false,
  rechnungen: false,
};

// Modal-Container früh sicherstellen
function ensureModalContainer() {
  if (!document.getElementById("modal-container")) {
    const container = document.createElement("div");
    container.id = "modal-container";
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
    `;
    document.body.appendChild(container);
    console.log("✅ Modal-Container initialisiert");
  }
}

// Module sicher laden mit Retry-Mechanismus
async function loadModuleSafely(moduleName, loadFunction) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(`🔄 Lade ${moduleName} (Versuch ${attempt + 1})`);
      await loadFunction();
      moduleStatus[moduleName] = true;
      console.log(`✅ ${moduleName} erfolgreich geladen`);
      return true;
    } catch (error) {
      attempt++;
      console.warn(
        `⚠️ Fehler beim Laden von ${moduleName} (Versuch ${attempt}):`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms warten
      }
    }
  }

  console.error(
    `❌ ${moduleName} konnte nach ${maxRetries} Versuchen nicht geladen werden`
  );
  return false;
}

// App initialisieren
async function initializeApp() {
  if (appInitialized) {
    console.log("ℹ️ App bereits initialisiert");
    return;
  }

  console.log("🚀 App-Initialisierung gestartet...");

  try {
    // 1. Modal-Container sofort erstellen
    ensureModalContainer();

    // 2. Einstellungen ZUERST laden (kritisch!)
    console.log("📋 Phase 1: Einstellungen laden");
    await loadModuleSafely("einstellungen", loadEinstellungen);

    // 3. Dashboard laden
    console.log("📊 Phase 2: Dashboard laden");
    await loadModuleSafely("dashboard", loadDashboard);

    // 4. Kern-Module parallel laden
    console.log("⚡ Phase 3: Kern-Module parallel laden");
    const coreModules = [
      ["kunden", loadKunden],
      ["fahrzeuge", loadFahrzeuge],
      ["auftraege", loadAuftraege],
      ["rechnungen", loadRechnungen],
    ];

    // Parallel, aber mit individuellem Error-Handling
    await Promise.allSettled(
      coreModules.map(([name, loader]) => loadModuleSafely(name, loader))
    );

    // 5. App als initialisiert markieren
    appInitialized = true;

    // 6. Status ausgeben
    console.log("📈 Module-Status:", moduleStatus);
    const successfulModules =
      Object.values(moduleStatus).filter(Boolean).length;
    console.log(
      `✅ ${successfulModules}/${
        Object.keys(moduleStatus).length
      } Module erfolgreich geladen`
    );

    // 7. Event für andere Teile der App
    window.dispatchEvent(
      new CustomEvent("appInitialized", {
        detail: { moduleStatus, success: successfulModules >= 4 },
      })
    );
  } catch (error) {
    console.error("💥 Kritischer Fehler bei App-Initialisierung:", error);
    // Fallback-Modus aktivieren
    activateFallbackMode();
  }
}

// Fallback-Modus für kritische Fehler
function activateFallbackMode() {
  console.log("🆘 Fallback-Modus aktiviert");

  // Module einzeln mit Timeout laden
  setTimeout(() => loadEinstellungen().catch(console.error), 100);
  setTimeout(() => loadDashboard().catch(console.error), 200);
  setTimeout(() => loadKunden().catch(console.error), 300);
  setTimeout(() => loadFahrzeuge().catch(console.error), 400);
  setTimeout(() => loadAuftraege().catch(console.error), 500);
  setTimeout(() => loadRechnungen().catch(console.error), 600);
}

// Sichere Modal-Funktionen global verfügbar machen
function ensureModalFunctions() {
  // Modal-Funktionen sicher wrappen
  const originalShowAuftragModal = window.showAuftragModal;
  if (originalShowAuftragModal) {
    window.showAuftragModal = function (...args) {
      if (!appInitialized) {
        console.warn("⏳ App noch nicht initialisiert, warte...");
        setTimeout(() => window.showAuftragModal(...args), 500);
        return;
      }
      return originalShowAuftragModal.apply(this, args);
    };
  }

  // Ähnlich für andere Modal-Funktionen
  ["showKundenModal", "showFahrzeugModal", "showRechnungModal"].forEach(
    (funcName) => {
      const original = window[funcName];
      if (original) {
        window[funcName] = function (...args) {
          if (!appInitialized) {
            console.warn(`⏳ ${funcName}: App noch nicht bereit, warte...`);
            setTimeout(() => window[funcName](...args), 500);
            return;
          }
          return original.apply(this, args);
        };
      }
    }
  );
}

// Navigation verbessern
window.showSection = function (sectionId) {
  console.log(`🧭 Navigation zu: ${sectionId}`);

  if (!appInitialized) {
    console.warn("⏳ App noch nicht bereit für Navigation");
    // Trotzdem versuchen
  }

  return showSection(sectionId);
};

// DOM-Ready Event
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🏁 DOM Ready - Starte App-Initialisierung");

  // Modal-Funktionen sicher machen
  ensureModalFunctions();

  // App initialisieren
  await initializeApp();
});

// Einstellungsänderungs-Event
window.addEventListener("settingsUpdated", () => {
  console.log("🔄 Einstellungen aktualisiert - Module werden benachrichtigt");

  // Nur Dashboard neu laden, wenn App initialisiert ist
  if (appInitialized && moduleStatus.dashboard) {
    loadDashboard().catch(console.error);
  }
});

// Debug-Funktionen global verfügbar machen
window.debugApp = {
  status: () => ({ appInitialized, moduleStatus }),
  reinit: initializeApp,
  forceModal: () => ensureModalContainer(),
};

console.log("📦 Verbesserte App-Initialisierung geladen");
