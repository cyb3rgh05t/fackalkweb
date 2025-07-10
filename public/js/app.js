import { showSection, loadGlobalSettings } from "./utils.js";
import { loadDashboard } from "./dashboard.js";
import { loadKunden } from "./kunden.js";
import { loadFahrzeuge } from "./fahrzeuge.js";
import { loadAuftraege } from "./auftraege.js";
import { loadRechnungen } from "./rechnungen.js";
import { loadEinstellungen } from "./einstellungen.js";

// Globale Funktionen für HTML onclick events verfügbar machen
window.showSection = showSection;

document.addEventListener("DOMContentLoaded", async () => {
  console.log("App wird initialisiert...");

  // Zuerst Einstellungen laden
  await loadGlobalSettings();

  // Dann alle Module initialisieren
  await Promise.all([
    loadDashboard(),
    loadKunden(),
    loadFahrzeuge(),
    loadAuftraege(),
    loadRechnungen(),
    loadEinstellungen(),
  ]);

  console.log("App erfolgreich initialisiert");
});
