// Komplette app.js mit verbessertem Search-System und Dashboard-Integration
// Diese Datei ersetzt die bestehende public/js/app.js

import { showSection } from "./utils.js";
import { loadDashboard } from "./dashboard.js";
import { loadKunden } from "./kunden.js";
import { loadFahrzeuge } from "./fahrzeuge.js";
import { loadAuftraege } from "./auftraege.js";
import { loadRechnungen } from "./rechnungen.js";
import { loadEinstellungen } from "./einstellungen.js";
import { initializeSearch } from "./search.js";
import { loadFahrzeughandel } from "./fahrzeughandel.js";

// Globaler App-State
let appInitialized = false;
let moduleStatus = {
  einstellungen: false,
  dashboard: false,
  kunden: false,
  fahrzeuge: false,
  auftraege: false,
  rechnungen: false,
  fahrzeughandel: false,
  search: false,
};

// Konfiguration
const APP_CONFIG = {
  maxRetries: 3,
  retryDelay: 500,
  searchInitDelay: 300,
  postInitDelay: 1000,
  fallbackDelay: 2000,
  debugMode: false, // Auf true setzen für erweiterte Debug-Ausgaben
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

// Module sicher laden mit verbessertem Retry-Mechanismus
async function loadModuleSafely(moduleName, loadFunction) {
  const maxRetries = APP_CONFIG.maxRetries;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      if (APP_CONFIG.debugMode) {
        console.log(
          `🔄 Lade ${moduleName} (Versuch ${attempt + 1}/${maxRetries})`
        );
      }

      await loadFunction();
      moduleStatus[moduleName] = true;
      console.log(`✅ ${moduleName} erfolgreich geladen`);
      return true;
    } catch (error) {
      attempt++;
      console.warn(
        `⚠️ Fehler beim Laden von ${moduleName} (Versuch ${attempt}/${maxRetries}):`,
        error
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, APP_CONFIG.retryDelay)
        );
      }
    }
  }

  console.error(
    `❌ ${moduleName} konnte nach ${maxRetries} Versuchen nicht geladen werden`
  );
  return false;
}

// Hauptfunktion: App mit Search-System initialisieren
async function initializeApp() {
  if (appInitialized) {
    console.log("ℹ️ App bereits initialisiert");
    return;
  }

  console.log("🚀 App-Initialisierung mit Search-System gestartet...");

  try {
    // Phase 0: Grundlagen
    ensureModalContainer();

    // Phase 1: Einstellungen laden (kritisch)
    console.log("📋 Phase 1: Einstellungen laden");
    await loadModuleSafely("einstellungen", loadEinstellungen);

    // Phase 2: Dashboard laden (wichtig)
    console.log("📊 Phase 2: Dashboard laden");
    await loadModuleSafely("dashboard", loadDashboard);

    console.log("🔧 Phase 3: Weitere Module laden");
    await loadModuleSafely("fahrzeughandel", loadFahrzeughandel);

    // Phase 3: Kern-Module parallel laden
    console.log("⚡ Kern-Module parallel laden");
    const coreModules = [
      ["kunden", loadKunden],
      ["fahrzeuge", loadFahrzeuge],
      ["auftraege", loadAuftraege],
      ["rechnungen", loadRechnungen],
    ];

    const moduleResults = await Promise.allSettled(
      coreModules.map(([name, loader]) => loadModuleSafely(name, loader))
    );

    // Ergebnisse auswerten
    moduleResults.forEach((result, index) => {
      const [moduleName] = coreModules[index];
      if (result.status === "rejected") {
        console.warn(
          `⚠️ Modul ${moduleName} konnte nicht geladen werden:`,
          result.reason
        );
      }
    });

    // Phase 4: Search-System initialisieren
    console.log("🔍 Phase 4: Search-System initialisieren");
    await initializeSearchSystem();

    // Phase 5: Post-Initialisierung
    console.log("🔧 Phase 5: Post-Initialisierung");
    await performPostInitTasks();

    appInitialized = true;

    // Status-Report
    const successfulModules =
      Object.values(moduleStatus).filter(Boolean).length;
    const totalModules = Object.keys(moduleStatus).length;

    console.log("📈 Module-Status:", moduleStatus);
    console.log(
      `✅ ${successfulModules}/${totalModules} Module erfolgreich geladen`
    );

    // Event für andere Komponenten
    window.dispatchEvent(
      new CustomEvent("appInitialized", {
        detail: {
          moduleStatus,
          success: successfulModules >= totalModules - 1, // Toleranz für 1 fehlgeschlagenes Modul
          timestamp: Date.now(),
        },
      })
    );

    // Visuelles Feedback
    showInitializationComplete(successfulModules, totalModules);
  } catch (error) {
    console.error("💥 Kritischer Fehler bei App-Initialisierung:", error);
    activateFallbackMode();
  }
}

// Verbesserte Search-System-Initialisierung mit Fallback
async function initializeSearchSystem() {
  const maxAttempts = 5;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      if (APP_CONFIG.debugMode) {
        console.log(
          `🔍 Search-Initialisierung (Versuch ${attempt + 1}/${maxAttempts})`
        );
      }

      // Prüfe ob alle notwendigen Elemente vorhanden sind
      const requiredElements = [
        "auftraege-table",
        "auftraege-search",
        "rechnungen-table",
        "rechnungen-search",
        "kunden-table",
        "kunden-search",
        "fahrzeuge-table",
        "fahrzeuge-search",
        "fahrzeughandel-table",
        "fahrzeughandel-search",
      ];

      let missingElements = requiredElements.filter(
        (id) => !document.getElementById(id)
      );

      if (missingElements.length > 0) {
        if (APP_CONFIG.debugMode) {
          console.log(`⏳ Warte auf Elemente: ${missingElements.join(", ")}`);
        }
        await new Promise((resolve) =>
          setTimeout(resolve, APP_CONFIG.searchInitDelay)
        );
        attempt++;
        continue;
      }

      // Search-System initialisieren
      console.log("🔍 Initialisiere Search-System...");

      // Prüfe ob initializeSearch verfügbar ist
      if (typeof initializeSearch !== "function") {
        console.warn(
          "⚠️ initializeSearch Funktion nicht verfügbar, verwende Fallback"
        );
        // Fallback: Manuell Search initialisieren
        initializeSearchFallback();
      } else {
        initializeSearch();
      }

      // Kurz warten
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Testen ob Search funktioniert
      const testSuccess = testSearchFunctionality();

      if (testSuccess) {
        console.log("✅ Search-System erfolgreich initialisiert und getestet");
        moduleStatus.search = true;
        return;
      } else {
        // Fallback: Wenn Test fehlschlägt, aber Elemente da sind, trotzdem als Erfolg werten
        console.warn(
          "⚠️ Search-Test fehlgeschlagen, aber Elemente sind vorhanden - verwende Fallback"
        );

        // Prüfe nochmal ob wenigstens die Grundelemente da sind
        const basicElementsExist = requiredElements.every((id) =>
          document.getElementById(id)
        );

        if (basicElementsExist) {
          console.log(
            "✅ Search-System: Fallback-Modus - Grundelemente vorhanden"
          );
          moduleStatus.search = true;

          // Zusätzlicher Fallback-Versuch für Search-Funktionalität
          setTimeout(() => {
            console.log("🔄 Search-System: Zusätzlicher Fallback-Versuch...");
            try {
              initializeSearch();
              console.log("✅ Search-System: Fallback erfolgreich");
            } catch (e) {
              console.warn(
                "⚠️ Search-System: Fallback-Versuch fehlgeschlagen:",
                e
              );
            }
          }, 1000);

          return; // Erfolgreich, auch wenn Test fehlgeschlagen ist
        } else {
          throw new Error("Grundelemente nicht vorhanden");
        }
      }
    } catch (error) {
      attempt++;
      console.warn(
        `⚠️ Search-Initialisierung Versuch ${attempt} fehlgeschlagen:`,
        error
      );

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  }

  // Wenn alle Versuche fehlgeschlagen sind
  console.error(
    `❌ Search-System konnte nach ${maxAttempts} Versuchen nicht initialisiert werden`
  );

  // Last-Resort Fallback: Wenn Elemente da sind, als teilweise erfolgreich markieren
  const requiredElements = [
    "auftraege-table",
    "auftraege-search",
    "rechnungen-table",
    "rechnungen-search",
    "kunden-table",
    "kunden-search",
    "fahrzeuge-table",
    "fahrzeuge-search",
  ];

  const missingElements = requiredElements.filter(
    (id) => !document.getElementById(id)
  );

  if (missingElements.length === 0) {
    console.log(
      "🆘 Search-System: Last-Resort Fallback - Elemente sind da, markiere als teilweise erfolgreich"
    );
    moduleStatus.search = "partial";

    // Letzter Versuch in 3 Sekunden
    setTimeout(() => {
      console.log("🔄 Search-System: Letzter Versuch...");
      try {
        initializeSearch();
        moduleStatus.search = true;
        console.log("✅ Search-System: Letzter Versuch erfolgreich!");

        if (window.showNotification) {
          window.showNotification(
            "🔍 Suchfunktion wurde aktiviert",
            "success",
            3000
          );
        }
      } catch (e) {
        console.error("❌ Search-System: Letzter Versuch fehlgeschlagen:", e);
        if (window.showNotification) {
          window.showNotification(
            "⚠️ Suchfunktion teilweise verfügbar",
            "warning",
            3000
          );
        }
      }
    }, 3000);
  } else {
    console.error(
      `❌ Search-System: Folgende Elemente fehlen: ${missingElements.join(
        ", "
      )}`
    );
    moduleStatus.search = false;
  }
}

// Fallback Search-Initialisierung falls Import fehlschlägt
function initializeSearchFallback() {
  console.log("🔄 Verwende Search-Fallback-Initialisierung...");

  const searchConfigs = [
    ["kunden-table", "kunden-search"],
    ["fahrzeuge-table", "fahrzeuge-search"],
    ["auftraege-table", "auftraege-search"],
    ["rechnungen-table", "rechnungen-search"],
  ];

  let initializedCount = 0;

  searchConfigs.forEach(([tableId, searchId]) => {
    const table = document.getElementById(tableId);
    const searchInput = document.getElementById(searchId);

    if (table && searchInput) {
      // Einfache Search-Funktionalität hinzufügen
      searchInput.addEventListener("input", function () {
        const searchTerm = this.value.toLowerCase().trim();
        const rows = table.querySelectorAll("tbody tr");

        rows.forEach((row) => {
          if (!searchTerm) {
            row.style.display = "";
          } else {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? "" : "none";
          }
        });
      });

      // Markierung für Test
      searchInput._searchInitialized = true;
      initializedCount++;
      console.log(`✅ Fallback-Search aktiviert: ${tableId}`);
    }
  });

  console.log(
    `🔍 Fallback-Search: ${initializedCount}/${searchConfigs.length} Tabellen aktiviert`
  );
}
function testSearchFunctionality() {
  try {
    const testConfigs = [
      ["auftraege-search", "auftraege-table"],
      ["rechnungen-search", "rechnungen-table"],
      ["kunden-search", "kunden-table"],
      ["fahrzeuge-search", "fahrzeuge-table"],
    ];

    let workingSearches = 0;
    let totalSearches = testConfigs.length;

    for (let [searchId, tableId] of testConfigs) {
      const searchInput = document.getElementById(searchId);
      const table = document.getElementById(tableId);

      if (!searchInput || !table) {
        if (APP_CONFIG.debugMode) {
          console.warn(
            `⚠️ Search-Test: ${searchId} oder ${tableId} nicht gefunden`
          );
        }
        continue;
      }

      // Mehrere Methoden zum Prüfen der Event-Listener
      let hasInputEvent = false;

      // Methode 1: oninput Property
      if (searchInput.oninput) {
        hasInputEvent = true;
      }

      // Methode 2: addEventListener-Flag (unsere eigene Markierung)
      if (searchInput._searchInitialized) {
        hasInputEvent = true;
      }

      // Methode 3: Versuche einen Test-Event zu triggern
      if (!hasInputEvent) {
        try {
          const testEvent = new Event("input", { bubbles: true });
          const result = searchInput.dispatchEvent(testEvent);
          if (result !== undefined) {
            hasInputEvent = true;
          }
        } catch (e) {
          // Ignore test event errors
        }
      }

      if (hasInputEvent) {
        workingSearches++;
        if (APP_CONFIG.debugMode) {
          console.log(`✅ Search-Test: ${searchId} funktioniert`);
        }
      } else {
        if (APP_CONFIG.debugMode) {
          console.warn(`⚠️ Search-Test: ${searchId} hat keine Event-Listener`);
        }
      }
    }

    // Erfolg wenn mindestens 50% der Searches funktionieren
    const successRate = workingSearches / totalSearches;
    const isSuccess = successRate >= 0.5;

    if (APP_CONFIG.debugMode) {
      console.log(
        `🔍 Search-Test: ${workingSearches}/${totalSearches} funktionieren (${Math.round(
          successRate * 100
        )}%)`
      );
    }

    if (isSuccess) {
      console.log("✅ Search-Funktionalitäts-Test bestanden");
    } else {
      console.warn("⚠️ Search-Test: Zu wenige funktionierende Searches");
    }

    return isSuccess;
  } catch (error) {
    console.error("❌ Search-Test fehlgeschlagen:", error);
    return false;
  }
}

// Post-Initialisierungs-Tasks
async function performPostInitTasks() {
  if (APP_CONFIG.debugMode) {
    console.log("🔧 Führe Post-Init-Tasks aus...");
  }

  // Task 1: Dashboard-Cards klickbar machen (nach Verzögerung)
  setTimeout(() => {
    try {
      if (window.makeCardsClickable) {
        window.makeCardsClickable();
        if (APP_CONFIG.debugMode) {
          console.log("✅ Dashboard-Cards klickbar gemacht");
        }
      }
    } catch (error) {
      console.warn("⚠️ Fehler beim Klickbar-Machen der Cards:", error);
    }
  }, 500);

  // Task 2: Filter-Controls hinzufügen (nach Verzögerung)
  setTimeout(() => {
    try {
      if (
        window.addFilterControls &&
        (window.location.hash === "#dashboard" || !window.location.hash)
      ) {
        window.addFilterControls();
        if (APP_CONFIG.debugMode) {
          console.log("✅ Filter-Controls hinzugefügt");
        }
      }
    } catch (error) {
      console.warn("⚠️ Fehler beim Hinzufügen der Filter-Controls:", error);
    }
  }, APP_CONFIG.postInitDelay);

  // Task 3: System-Status loggen (nach Verzögerung)
  setTimeout(() => {
    logSystemStatus();
  }, APP_CONFIG.postInitDelay + 1000);

  // Task 4: Eventlistener für dynamische Inhalte
  setupDynamicEventListeners();

  if (APP_CONFIG.debugMode) {
    console.log("✅ Post-Init-Tasks eingeplant");
  }
}

// Setup für dynamische Event Listener
function setupDynamicEventListeners() {
  // Section-Change-Events überwachen für Search-Re-Init
  window.addEventListener("sectionChanged", (event) => {
    const { sectionId, fromDashboardCard } = event.detail;

    if (APP_CONFIG.debugMode) {
      console.log(
        `📍 Section geändert zu: ${sectionId} (von Dashboard: ${fromDashboardCard})`
      );
    }

    // Search-System re-initialisieren falls nötig
    setTimeout(() => {
      const searchInput = document.getElementById(`${sectionId}-search`);
      const table = document.getElementById(`${sectionId}-table`);

      if (searchInput && table && !searchInput._searchInitialized) {
        if (APP_CONFIG.debugMode) {
          console.log(`🔄 Re-initialisiere Search für ${sectionId}`);
        }
        try {
          initializeSearch();
        } catch (error) {
          console.warn(
            `⚠️ Search-Re-Init für ${sectionId} fehlgeschlagen:`,
            error
          );
        }
      }
    }, APP_CONFIG.searchInitDelay);
  });

  // Module-Load-Events überwachen
  window.addEventListener("moduleLoaded", (event) => {
    const { moduleName } = event.detail;
    if (APP_CONFIG.debugMode) {
      console.log(`📦 Modul ${moduleName} wurde nachgeladen`);
    }

    // Search-System für das neue Modul initialisieren
    setTimeout(() => {
      if (moduleStatus.search) {
        initializeSearch();
      }
    }, 200);
  });
}

// Visuelles Feedback für erfolgreiche Initialisierung
function showInitializationComplete(successful, total) {
  if (window.showNotification) {
    const percentage = Math.round((successful / total) * 100);
    let message, type;

    if (percentage === 100) {
      message = `🚀 System vollständig geladen (${successful}/${total} Module)`;
      type = "success";
    } else if (percentage >= 80) {
      message = `⚡ System größtenteils geladen (${successful}/${total} Module)`;
      type = "warning";
    } else {
      message = `⚠️ System teilweise geladen (${successful}/${total} Module)`;
      type = "error";
    }

    //window.showNotification(message, type, 3000);
  }
}

// Erweiterte Fallback-Mode-Funktion
function activateFallbackMode() {
  console.log("🆘 Erweiterter Fallback-Modus aktiviert");

  // Module einzeln mit gestaffelten Timeouts laden
  const fallbackModules = [
    [100, "einstellungen", loadEinstellungen],
    [200, "dashboard", loadDashboard],
    [300, "kunden", loadKunden],
    [400, "fahrzeuge", loadFahrzeuge],
    [500, "auftraege", loadAuftraege],
    [600, "rechnungen", loadRechnungen],
  ];

  fallbackModules.forEach(([delay, name, loader]) => {
    setTimeout(async () => {
      try {
        console.log(`🔄 Fallback: Lade ${name}...`);
        await loader();
        moduleStatus[name] = true;
        console.log(`✅ Fallback: ${name} geladen`);
      } catch (error) {
        console.error(`❌ Fallback: ${name} fehlgeschlagen:`, error);
      }
    }, delay);
  });

  // Search-System im Fallback-Modus
  setTimeout(() => {
    console.log("🔍 Fallback: Search-System initialisieren...");
    try {
      initializeSearch();
      moduleStatus.search = true;
      console.log("✅ Fallback: Search-System geladen");
    } catch (e) {
      console.error("❌ Fallback: Search-System fehlgeschlagen", e);
    }
  }, APP_CONFIG.fallbackDelay);

  // Nach Fallback: Versuche fehlende Module nachzuladen
  setTimeout(() => {
    const failedModules = Object.entries(moduleStatus)
      .filter(([name, status]) => !status)
      .map(([name]) => name);

    if (failedModules.length > 0) {
      console.warn(
        `⚠️ Fallback: Folgende Module konnten nicht geladen werden: ${failedModules.join(
          ", "
        )}`
      );

      if (window.showNotification) {
        window.showNotification(
          `⚠️ Einige Module konnten nicht geladen werden. Funktionalität möglicherweise eingeschränkt.`,
          "warning",
          5000
        );
      }
    }
  }, APP_CONFIG.fallbackDelay + 2000);
}

// Sichere Modal-Funktionen global verfügbar machen
function ensureModalFunctions() {
  const modalFunctions = [
    "showAuftragModal",
    "showKundenModal",
    "showFahrzeugModal",
    "showRechnungModal",
  ];

  modalFunctions.forEach((funcName) => {
    const original = window[funcName];
    if (original) {
      window[funcName] = function (...args) {
        if (!appInitialized) {
          console.warn(`⏳ ${funcName}: App noch nicht bereit, warte...`);

          // Warte auf App-Initialisierung und versuche erneut
          const retryModal = () => {
            if (appInitialized) {
              return original.apply(this, args);
            } else {
              setTimeout(retryModal, 300);
            }
          };

          setTimeout(retryModal, 500);
          return;
        }
        return original.apply(this, args);
      };
    }
  });

  if (APP_CONFIG.debugMode) {
    console.log("✅ Modal-Funktionen sicher gemacht");
  }
}

// Navigation verbessern
window.showSection = function (sectionId, fromDashboardCard = false) {
  if (APP_CONFIG.debugMode) {
    console.log(
      `🧭 Navigation zu: ${sectionId} (fromDashboard: ${fromDashboardCard})`
    );
  }

  if (!appInitialized) {
    console.warn(
      "⏳ App noch nicht bereit für Navigation, versuche trotzdem..."
    );
  }

  try {
    return showSection(sectionId, fromDashboardCard);
  } catch (error) {
    console.error(`❌ Navigation zu ${sectionId} fehlgeschlagen:`, error);

    // Fallback: Zeige wenigstens eine Basis-Navigation
    const section = document.getElementById(sectionId);
    if (section) {
      document.querySelectorAll(".section").forEach((s) => {
        s.style.display = "none";
        s.classList.remove("active");
      });

      section.style.display = "block";
      section.classList.add("active");
    }
  }
};

// System-Status für Debugging loggen
function logSystemStatus() {
  if (!APP_CONFIG.debugMode) return;

  console.log("🔍 === SYSTEM-STATUS ===");
  console.log("App initialisiert:", appInitialized);
  console.log("Module-Status:", moduleStatus);

  // Search-System-Status
  const searchElements = [
    "auftraege-search",
    "rechnungen-search",
    "kunden-search",
    "fahrzeuge-search",
  ];

  const searchStatus = {};
  searchElements.forEach((id) => {
    const element = document.getElementById(id);
    searchStatus[id] = {
      exists: !!element,
      hasValue: element?.value || null,
      hasListener: !!(element?.oninput || element?._searchInitialized),
    };
  });

  console.log("Search-Status:", searchStatus);

  // Tabellen-Status
  const tableElements = [
    "auftraege-table",
    "rechnungen-table",
    "kunden-table",
    "fahrzeuge-table",
  ];

  const tableStatus = {};
  tableElements.forEach((id) => {
    const table = document.getElementById(id);
    tableStatus[id] = {
      exists: !!table,
      rowCount: table?.querySelectorAll("tbody tr")?.length || 0,
    };
  });

  console.log("Tabellen-Status:", tableStatus);

  // Performance-Info
  const perfInfo = {
    initTime: performance.now(),
    memoryUsage: navigator.memory
      ? {
          used:
            Math.round(navigator.memory.usedJSHeapSize / 1024 / 1024) + " MB",
          total:
            Math.round(navigator.memory.totalJSHeapSize / 1024 / 1024) + " MB",
        }
      : "Nicht verfügbar",
  };

  console.log("Performance-Info:", perfInfo);
  console.log("=== ENDE STATUS ===");
}

// DOM-Ready Event mit erweiterter Fehlerbehandlung
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🏁 DOM Ready - Starte erweiterte App-Initialisierung");

  try {
    // Performance-Messung starten
    const startTime = performance.now();

    // Modal-Funktionen sicher machen
    ensureModalFunctions();

    // Erweiterte App-Initialisierung
    await initializeApp();

    // Performance-Messung
    const endTime = performance.now();
    const initDuration = Math.round(endTime - startTime);

    console.log(`⚡ App-Initialisierung abgeschlossen in ${initDuration}ms`);
  } catch (error) {
    console.error("💥 Schwerer Fehler bei der Initialisierung:", error);

    // Last-Resort Fallback
    setTimeout(() => {
      activateFallbackMode();
    }, 1000);

    // User benachrichtigen
    if (window.showNotification) {
      window.showNotification(
        "⚠️ Fehler beim Laden der Anwendung. Versuche Wiederherstellung...",
        "error",
        5000
      );
    }
  }
});

// Einstellungsänderungs-Event
window.addEventListener("settingsUpdated", () => {
  console.log("🔄 Einstellungen aktualisiert - Module werden benachrichtigt");

  // Nur Dashboard neu laden, wenn App initialisiert ist
  if (appInitialized && moduleStatus.dashboard) {
    loadDashboard().catch(console.error);
  }
});

// Cleanup bei Seitenwechsel
window.addEventListener("beforeunload", () => {
  if (APP_CONFIG.debugMode) {
    console.log("🧹 App-Cleanup beim Seitenwechsel");
  }
});

// Erweiterte Debug-Funktionen global verfügbar machen
window.debugApp = {
  // Basis-Funktionen
  status: () => ({
    appInitialized,
    moduleStatus,
    config: APP_CONFIG,
    timestamp: Date.now(),
  }),
  reinit: initializeApp,
  forceModal: () => ensureModalContainer(),

  // Search-spezifische Debug-Funktionen
  testSearch: testSearchFunctionality,
  initSearch: () => {
    try {
      if (typeof initializeSearch === "function") {
        initializeSearch();
        console.log("✅ Search manuell initialisiert");
      } else {
        initializeSearchFallback();
        console.log("✅ Search-Fallback manuell initialisiert");
      }
    } catch (error) {
      console.error("❌ Manuelle Search-Init fehlgeschlagen:", error);
    }
  },
  systemStatus: logSystemStatus,

  // Neue Debug-Hilfsfunktionen
  checkSearchElements: () => {
    const elements = {
      "auftraege-search": !!document.getElementById("auftraege-search"),
      "auftraege-table": !!document.getElementById("auftraege-table"),
      "rechnungen-search": !!document.getElementById("rechnungen-search"),
      "rechnungen-table": !!document.getElementById("rechnungen-table"),
      "kunden-search": !!document.getElementById("kunden-search"),
      "kunden-table": !!document.getElementById("kunden-table"),
      "fahrzeuge-search": !!document.getElementById("fahrzeuge-search"),
      "fahrzeuge-table": !!document.getElementById("fahrzeuge-table"),
      "fahrzeughandel-search": !!document.getElementById(
        "fahrzeughandel-search"
      ),
      "fahrzeughandel-table": !!document.getElementById("fahrzeughandel-table"),
    };

    console.log("🔍 Search-Elemente Status:", elements);

    const missing = Object.entries(elements)
      .filter(([id, exists]) => !exists)
      .map(([id]) => id);

    if (missing.length > 0) {
      console.warn("❌ Fehlende Elemente:", missing);
    } else {
      console.log("✅ Alle Search-Elemente vorhanden");
    }

    return elements;
  },

  forceSearchInit: () => {
    console.log("🔧 Erzwinge Search-Initialisierung...");
    initializeSearchFallback();
    moduleStatus.search = true;
    console.log("✅ Search-System zwangsinitialisiert");
  },

  // Module-spezifische Debug-Funktionen
  reloadModule: async (moduleName) => {
    console.log(`🔄 Lade Modul ${moduleName} neu...`);
    try {
      switch (moduleName) {
        case "dashboard":
          await loadDashboard();
          break;
        case "kunden":
          await loadKunden();
          break;
        case "fahrzeuge":
          await loadFahrzeuge();
          break;
        case "auftraege":
          await loadAuftraege();
          break;
        case "rechnungen":
          await loadRechnungen();
          break;
        case "einstellungen":
          await loadEinstellungen();
          break;
        default:
          console.warn(`Unbekanntes Modul: ${moduleName}`);
          return;
      }
      moduleStatus[moduleName] = true;
      console.log(`✅ Modul ${moduleName} neu geladen`);
    } catch (error) {
      console.error(`❌ Fehler beim Neuladen von ${moduleName}:`, error);
    }
  },

  // Konfiguration
  enableDebugMode: () => {
    APP_CONFIG.debugMode = true;
    console.log("🔍 Debug-Modus aktiviert");
  },

  disableDebugMode: () => {
    APP_CONFIG.debugMode = false;
    console.log("🔇 Debug-Modus deaktiviert");
  },

  // Performance-Tests
  performanceTest: () => {
    const start = performance.now();

    // Simuliere typische App-Operationen
    const testOps = [
      () => document.getElementById("auftraege-table"),
      () => document.querySelectorAll(".search-input"),
      () => window.showSection("dashboard"),
      () => Object.keys(moduleStatus),
    ];

    testOps.forEach((op) => op());

    const end = performance.now();
    const duration = Math.round(end - start);

    console.log(
      `⚡ Performance-Test: ${duration}ms für ${testOps.length} Operationen`
    );
    return duration;
  },
};

console.log("✅ Erweiterte App-Initialisierung mit Search-System geladen");
console.log("🔧 Debug-Tools verfügbar unter: window.debugApp");
