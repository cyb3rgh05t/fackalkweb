import { showSection } from "./utils.js";
import { loadDashboard } from "./dashboard.js";
import { loadKunden } from "./kunden.js";
import { loadFahrzeuge } from "./fahrzeuge.js";
import { loadAuftraege } from "./auftraege.js";
import { loadRechnungen } from "./rechnungen.js";
import { loadEinstellungen } from "./einstellungen.js";

window.showSection = showSection; // Damit Buttons im HTML es aufrufen können

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 1. ZUERST Einstellungen laden (kritisch für alle anderen Module)
    console.log("Lade Einstellungen...");
    await loadEinstellungen();

    // 2. Dann Dashboard laden (verwendet Einstellungen)
    console.log("Lade Dashboard...");
    await loadDashboard();

    // 3. Dann andere Module parallel laden
    console.log("Lade weitere Module...");
    await Promise.all([
      loadKunden(),
      loadFahrzeuge(),
      loadAuftraege(),
      loadRechnungen(),
    ]);

    console.log("✅ Alle Module erfolgreich geladen");
  } catch (error) {
    console.error("❌ Fehler beim Laden der Module:", error);
    // Fallback: Versuche Module einzeln zu laden
    loadDashboard();
    loadKunden();
    loadFahrzeuge();
    loadAuftraege();
    loadRechnungen();
  }
});

// Event-Listener für Einstellungsänderungen hinzufügen
window.addEventListener("settingsUpdated", () => {
  console.log("🔄 Einstellungen aktualisiert - Module werden benachrichtigt");
  // Dashboard aktualisieren wenn Einstellungen geändert werden
  loadDashboard();
});
