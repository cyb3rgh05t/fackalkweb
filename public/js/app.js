import { showSection } from "./utils.js";
import { loadDashboard } from "./dashboard.js";
import { loadKunden } from "./kunden.js";
import { loadFahrzeuge } from "./fahrzeuge.js";
import { loadAuftraege } from "./auftraege.js";
import { loadRechnungen } from "./rechnungen.js";
import { loadEinstellungen } from "./einstellungen.js";

window.showSection = showSection; // Damit Buttons im HTML es aufrufen können

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
  loadKunden();
  loadFahrzeuge();
  loadAuftraege();
  loadRechnungen();
  loadEinstellungen();
  // Sections erst bei Bedarf nachladen
});
