import { apiCall } from "./utils.js";
import { createModal, closeModal } from "./modals.js";

// Globaler State
let fahrzeughandelData = [];
let fahrzeughandelStats = {};
let currentFilter = "alle";
let editingHandelId = null;
let availableKunden = [];
let availableFahrzeuge = [];

// Initialisierung
export async function loadFahrzeughandel() {
  console.log("🚗 Lade Fahrzeughandel-Modul...");

  try {
    // Daten laden
    await Promise.all([
      loadFahrzeughandelData(),
      loadFahrzeughandelStats(),
      loadDropdownOptions(),
    ]);

    // UI initialisieren
    initializeFahrzeughandelEvents();
    updateFahrzeughandelTable();
    updateStatsDisplay();

    console.log("✅ Fahrzeughandel-Modul geladen");
    return true;
  } catch (error) {
    console.error("❌ Fehler beim Laden des Fahrzeughandel-Moduls:", error);
    showNotification("Fehler beim Laden der Handelsgeschäfte", "error");
    return false;
  }
}

// Daten von API laden
async function loadFahrzeughandelData() {
  try {
    const response = await fetch("/api/fahrzeughandel");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    fahrzeughandelData = data.handelsgeschaefte || [];

    console.log(`✅ ${fahrzeughandelData.length} Handelsgeschäfte geladen`);
  } catch (error) {
    console.error("Fehler beim Laden der Handelsgeschäfte:", error);
    throw error;
  }
}

// Statistiken laden
async function loadFahrzeughandelStats() {
  try {
    const response = await fetch("/api/fahrzeughandel/stats/dashboard");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    fahrzeughandelStats = await response.json();

    console.log("✅ Fahrzeughandel-Statistiken geladen");
  } catch (error) {
    console.error("Fehler beim Laden der Statistiken:", error);
    fahrzeughandelStats = { stats: {}, recent_geschaefte: [] };
  }
}

// Dropdown-Optionen laden
async function loadDropdownOptions() {
  try {
    const [kundenResponse, fahrzeugResponse] = await Promise.all([
      fetch("/api/fahrzeughandel/options/kunden"),
      fetch("/api/fahrzeughandel/options/fahrzeuge"),
    ]);

    if (kundenResponse.ok) {
      availableKunden = await kundenResponse.json();
    }

    if (fahrzeugResponse.ok) {
      availableFahrzeuge = await fahrzeugResponse.json();
    }

    console.log(
      `✅ ${availableKunden.length} Kunden, ${availableFahrzeuge.length} Fahrzeuge geladen`
    );
  } catch (error) {
    console.error("Fehler beim Laden der Dropdown-Optionen:", error);
  }
}

// Event-Handler initialisieren
function initializeFahrzeughandelEvents() {
  // Search-Handler
  const searchInput = document.getElementById("fahrzeughandel-search");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(handleSearch, 300));
  }

  // Status-Filter
  const statusFilter = document.getElementById("status-filter");
  if (statusFilter) {
    statusFilter.addEventListener("change", handleStatusFilter);
  }

  // Form-Submit
  const form = document.getElementById("fahrzeughandel-form");
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }

  // Heute als Standard-Datum setzen
  const datumField = document.getElementById("handel-datum");
  if (datumField && !datumField.value) {
    datumField.value = new Date().toISOString().split("T")[0];
  }

  console.log("✅ Fahrzeughandel Events initialisiert");
}

// Tabelle aktualisieren
function updateFahrzeughandelTable() {
  const tableBody = document.querySelector("#fahrzeughandel-table tbody");
  if (!tableBody) {
    console.error("❌ Fahrzeughandel-Tabelle nicht gefunden");
    return;
  }

  const filteredData = getFilteredData();

  tableBody.innerHTML = filteredData
    .map(
      (geschaeft) => `
    <tr>
      <td>
        <div style="font-size: 0.875rem; margin-bottom: 0.25rem;">
          ${geschaeft.handel_nr}
        </div>
      </td>
      <td>
        <div class="typ-badge typ-${geschaeft.typ}">
          ${geschaeft.typ}
        </div>
      </td>
      <td>
        <div>
          <strong>${geschaeft.kennzeichen}</strong>
        </div>
        <div style="font-size: 0.875rem; color: #6b7280;">
          ${geschaeft.marke} ${geschaeft.modell} ${
        geschaeft.baujahr ? `(${geschaeft.baujahr})` : ""
      } 
        </div>
        ${
          geschaeft.fahrzeug_kilometerstand
            ? `<div style="font-size: 0.75rem; color: #9ca3af;">
        ${formatNumber(geschaeft.fahrzeug_kilometerstand)} km
       </div>`
            : ""
        }
${
  geschaeft.vin
    ? `<div style="font-size: 0.75rem; color: #9ca3af; font-family: monospace;">
        ${geschaeft.vin}
       </div>`
    : ""
}

      </td>
      <td>
        ${
          geschaeft.kaeufer_info
            ? `<div><strong>${geschaeft.kaeufer_info.name}</strong></div>
               <div style="font-size: 0.875rem; color: #6b7280;">
                 ${geschaeft.kaeufer_info.kunden_nr}
                 
               </div>
               `
            : geschaeft.kunde_name
            ? `<div><strong>${geschaeft.kunde_name}</strong></div>
               <div style="font-size: 0.875rem; color: #6b7280;">${
                 geschaeft.kunden_nr || ""
               }</div>`
            : geschaeft.verkauft_an_display || "<em>Nicht angegeben</em>"
        }
      </td>
      <td>
        ${formatDate(geschaeft.datum)}
      </td>
      <td>
        <div style="font-size: 0.875rem;">
          ${
            geschaeft.ankaufspreis > 0
              ? `<div>Ankauf: <strong>${formatCurrency(
                  geschaeft.ankaufspreis
                )}</strong></div>`
              : ""
          }
          ${
            geschaeft.verkaufspreis > 0
              ? `<div>Verkauf: <strong>${formatCurrency(
                  geschaeft.verkaufspreis
                )}</strong></div>`
              : ""
          }
        </div>
      </td>
      <td>
        <span style="color: ${
          geschaeft.gewinn >= 0 ? "#059669" : "#dc2626"
        }; font-weight: 600;">
          ${formatCurrency(geschaeft.gewinn)}
        </span>
      </td>
      <td>
        <span class="status-badge status-${geschaeft.status}">
          ${geschaeft.status}
        </span>
      </td>
      <td>
        ${generateActionButtons(geschaeft)}
      </td>
    </tr>
  `
    )
    .join("");

  console.log(
    `✅ Tabelle aktualisiert: ${filteredData.length} Einträge (mit Käufer-Info)`
  );
}

// Helper-Funktion für Zahlenformatierung
function formatNumber(num) {
  return new Intl.NumberFormat("de-DE").format(num);
}

console.log(
  "🎉 Erweiterte Fahrzeughandel-Queries mit Käufer-ID-Unterstützung bereit!"
);

async function createRechnungFromHandel(handelId) {
  try {
    // 1. Handels-Datensatz abrufen (Verkaufsdetails)
    const handel = await apiCall(`/api/fahrzeughandel/${handelId}`);
    if (!handel || !handel.id) {
      throw new Error(`Handelsgeschäft mit ID ${handelId} nicht gefunden`);
    }
    if (handel.typ !== "verkauf") {
      throw new Error(
        "Nur Verkäufe können in eine Rechnung umgewandelt werden"
      );
    }

    // 2. Prüfen, ob ein gültiger Kunden-ID als Käufer vorliegt
    const kundenId = parseInt(handel.verkauft_an);
    if (isNaN(kundenId)) {
      throw new Error(
        "Für diesen Verkauf ist kein gültiger Kunde (Käufer) hinterlegt."
      );
    }

    // 3. Rechnungsposition(en) aus Verkaufsdaten erstellen
    const mwstSatz = parseFloat(getSetting("mwst_satz", "19")) || 19;
    const verkaufspreisBrutto = parseFloat(handel.verkaufspreis) || 0;
    if (verkaufspreisBrutto <= 0) {
      throw new Error(
        "Kein Verkaufspreis vorhanden – Rechnung kann nicht erstellt werden."
      );
    }
    // Nettopreis aus Brutto berechnen (z.B. bei 19% MwSt)
    const nettopreis = verkaufspreisBrutto / (1 + mwstSatz / 100);
    const nettopreisGerundet = parseFloat(nettopreis.toFixed(2));
    // Position: Fahrzeugverkauf
    const beschreibung = `Fahrzeugverkauf ${handel.marke} ${handel.modell}${
      handel.kennzeichen ? " (" + handel.kennzeichen + ")" : ""
    }`;
    const rechnungsPositionen = [
      {
        kategorie: "ZUSATZ", // Kategorie festlegen (z.B. "ZUSATZ")
        beschreibung: beschreibung,
        menge: 1,
        einheit: "Pauschal",
        einzelpreis: nettopreisGerundet,
        mwst_prozent: mwstSatz,
        gesamt: nettopreisGerundet,
      },
    ];

    // 4. Rechnungs-Datenobjekt zusammenstellen
    const rechnungsData = {
      // auftrag_id lassen wir weg (kein Auftrag, sondern Verkauf)
      kunden_id: kundenId,
      fahrzeug_id: handel.fahrzeug_id || null,
      rechnungsdatum: new Date().toISOString().split("T")[0], // heutiges Datum
      auftragsdatum: handel.datum, // Datum des Verkaufs
      positionen: rechnungsPositionen,
      rabatt_prozent: 0,
      status: "offen",
    };

    // 5. Rechnung per API erstellen
    const result = await apiCall("/api/rechnungen", "POST", rechnungsData);
    console.log(
      `📋 Rechnung aus Verkauf ${handel.handel_nr} erstellt:`,
      result
    );
    showNotification(
      `Rechnung ${result.rechnung_nr} erfolgreich aus Handelsgeschäft ${handel.handel_nr} erstellt`,
      "success"
    );

    // 6. Verkauf als 'abgeschlossen' markieren, falls noch nicht geschehen
    if (handel.status !== "abgeschlossen") {
      handel.status = "abgeschlossen";
      await apiCall(`/api/fahrzeughandel/${handelId}`, "PUT", handel);
    }

    // 7. Listen/Interface aktualisieren
    await loadFahrzeughandel(); // Handels-Liste neu laden (z.B. Status-Änderung sichtbar)
    showSection("rechnungen"); // zur Rechnungsübersicht wechseln
  } catch (error) {
    console.error("Fehler in createRechnungFromHandel:", error);
    showNotification(
      `Fehler beim Erstellen der Rechnung: ${error.message}`,
      "error"
    );
  }
}

// Statistiken-Anzeige aktualisieren
function updateStatsDisplay() {
  const stats = fahrzeughandelStats.stats || {};

  // Zahlen aktualisieren
  updateStatElement("total-geschaefte", stats.gesamt_geschaefte || 0);
  updateStatElement("total-ankauf", stats.abgeschlossene_ankaeufe || 0);
  updateStatElement("total-verkauf", stats.abgeschlossene_verkaeufe || 0);
  updateStatElement("total-gewinn", formatCurrency(stats.gesamt_gewinn || 0));
}

function updateStatElement(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

// Gefilterte Daten abrufen
function getFilteredData() {
  let filtered = [...fahrzeughandelData];

  // Filter nach Typ/Status
  if (currentFilter !== "alle") {
    if (["ankauf", "verkauf"].includes(currentFilter)) {
      filtered = filtered.filter((item) => item.typ === currentFilter);
    } else if (
      ["offen", "abgeschlossen", "storniert"].includes(currentFilter)
    ) {
      filtered = filtered.filter((item) => item.status === currentFilter);
    }
  }

  // Status-Filter aus Dropdown
  const statusFilter = document.getElementById("status-filter");
  if (statusFilter && statusFilter.value) {
    filtered = filtered.filter((item) => item.status === statusFilter.value);
  }

  // Suchfilter
  const searchInput = document.getElementById("fahrzeughandel-search");
  if (searchInput && searchInput.value.trim()) {
    const searchTerm = searchInput.value.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.handel_nr.toLowerCase().includes(searchTerm) ||
        item.kennzeichen.toLowerCase().includes(searchTerm) ||
        item.marke.toLowerCase().includes(searchTerm) ||
        item.modell.toLowerCase().includes(searchTerm) ||
        (item.kunde_name &&
          item.kunde_name.toLowerCase().includes(searchTerm)) ||
        (item.verkauft_an &&
          item.verkauft_an.toLowerCase().includes(searchTerm))
    );
  }

  return filtered;
}

// Event Handler
function handleSearch() {
  updateFahrzeughandelTable();
}

function handleStatusFilter() {
  updateFahrzeughandelTable();
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const submitButton = event.target.querySelector('button[type="submit"]');
  const originalText = submitButton.innerHTML;

  try {
    // Button deaktivieren
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Speichern...';

    const formData = getFormData();

    // Validierung
    if (!validateFormData(formData)) {
      return;
    }

    let response;
    if (editingHandelId) {
      // Bearbeiten
      response = await fetch(`/api/fahrzeughandel/${editingHandelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    } else {
      // Neu erstellen
      response = await fetch("/api/fahrzeughandel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Server-Fehler");
    }

    const result = await response.json();

    showNotification(
      editingHandelId
        ? "Handelsgeschäft aktualisiert"
        : "Handelsgeschäft erstellt",
      "success"
    );

    closeFahrzeughandelModalDynamic();
    await loadFahrzeughandel(); // Daten neu laden
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    showNotification(`Fehler: ${error.message}`, "error");
  } finally {
    // Button wieder aktivieren
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
  }
}

// Form-Daten sammeln
function getFormData() {
  // Verkauft-An Wert richtig verarbeiten
  const verkauftAnSelect = document.getElementById("handel-verkauft-an");
  let verkauftAnWert = null;

  if (verkauftAnSelect && verkauftAnSelect.value) {
    if (verkauftAnSelect.value === "custom") {
      // Custom-Wert beibehalten
      const selectedOption =
        verkauftAnSelect.options[verkauftAnSelect.selectedIndex];
      verkauftAnWert = selectedOption.textContent
        .replace("📝 ", "")
        .replace(" (manuell eingetragen)", "");
    } else {
      // Kunden-ID verwenden
      verkauftAnWert = verkauftAnSelect.value;
    }
  }

  return {
    typ: document.getElementById("handel-typ").value,
    kunden_id: document.getElementById("handel-kunde").value || null,
    fahrzeug_id: document.getElementById("handel-fahrzeug").value || null,
    datum: document.getElementById("handel-datum").value,
    kennzeichen: document.getElementById("handel-kennzeichen").value,
    marke: document.getElementById("handel-marke").value,
    modell: document.getElementById("handel-modell").value,
    vin: document.getElementById("handel-vin").value || null,
    baujahr: document.getElementById("handel-baujahr").value || null,
    kilometerstand:
      document.getElementById("handel-kilometerstand").value || null,
    farbe: document.getElementById("handel-farbe").value || null,
    zustand: document.getElementById("handel-zustand").value,
    ankaufspreis: document.getElementById("handel-ankaufspreis").value || 0,
    verkaufspreis: document.getElementById("handel-verkaufspreis").value || 0,
    tuev_bis: document.getElementById("handel-tuev").value || null,
    au_bis: document.getElementById("handel-au").value || null,
    papiere_vollstaendig: document.getElementById("handel-papiere").checked,
    bemerkungen: document.getElementById("handel-bemerkungen").value || null,
    interne_notizen:
      document.getElementById("handel-interne-notizen").value || null,
    verkauft_an: verkauftAnWert,
    status: document.getElementById("handel-status").value,
  };
}

// Form-Validierung
function validateFormData(data) {
  const errors = [];

  // Pflichtfelder prüfen
  if (!data.typ) {
    errors.push("Geschäftstyp ist erforderlich");
    highlightField("handel-typ");
  }

  if (!data.kennzeichen || !data.marke || !data.modell) {
    if (!data.kennzeichen) {
      errors.push("Kennzeichen ist erforderlich");
      highlightField("handel-kennzeichen");
    }
    if (!data.marke) {
      errors.push("Marke ist erforderlich");
      highlightField("handel-marke");
    }
    if (!data.modell) {
      errors.push("Modell ist erforderlich");
      highlightField("handel-modell");
    }
  }

  if (!data.datum) {
    errors.push("Datum ist erforderlich");
    highlightField("handel-datum");
  }

  const kaeuferErrors = validateKaeuferForVerkauf(data);
  errors.push(...kaeuferErrors);

  // Bei neuem Fahrzeug (kein fahrzeug_id) sind VIN und Kunde Pflicht
  const istNeuesFahrzeug = !data.fahrzeug_id;

  if (istNeuesFahrzeug) {
    // VIN-Nummer prüfen
    const vinWert = document.getElementById("handel-vin")?.value?.trim();
    if (!vinWert) {
      errors.push("VIN-Nummer ist bei neuen Fahrzeugen erforderlich");
      highlightField("handel-vin");
    } else if (vinWert.length !== 17) {
      errors.push("VIN-Nummer muss genau 17 Zeichen haben");
      highlightField("handel-vin");
    }

    // Kunde prüfen
    if (!data.kunden_id) {
      errors.push("Kunde muss bei neuen Fahrzeugen ausgewählt werden");
      highlightField("handel-kunde");
    }
  }

  // Preise validieren
  if (data.ankaufspreis < 0) {
    errors.push("Ankaufspreis kann nicht negativ sein");
    highlightField("handel-ankaufspreis");
  }

  if (data.verkaufspreis < 0) {
    errors.push("Verkaufspreis kann nicht negativ sein");
    highlightField("handel-verkaufspreis");
  }

  // Baujahr validieren
  if (
    data.baujahr &&
    (data.baujahr < 1900 || data.baujahr > new Date().getFullYear() + 1)
  ) {
    errors.push("Ungültiges Baujahr");
    highlightField("handel-baujahr");
  }

  // Fehler anzeigen
  if (errors.length > 0) {
    displayValidationErrors(errors);
    return false;
  }

  // Validierung erfolgreich
  clearValidationErrors();
  return true;
}

function displayValidationErrors(errors) {
  // Bestehende Fehler-Anzeige entfernen
  clearValidationErrors();

  // Neue Fehler-Anzeige erstellen
  const form = document.getElementById("fahrzeughandel-form");
  const errorDiv = document.createElement("div");
  errorDiv.className = "validation-summary";
  errorDiv.innerHTML = `
    <div class="validation-header">
      <i class="fas fa-exclamation-triangle"></i>
      Bitte korrigieren Sie folgende Fehler:
    </div>
    <ul>
      ${errors.map((error) => `<li>${error}</li>`).join("")}
    </ul>
  `;

  form.insertBefore(errorDiv, form.firstChild);

  // Nach oben scrollen
  errorDiv.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearValidationErrors() {
  const existing = document.querySelector(".validation-summary");
  if (existing) {
    existing.remove();
  }

  // Alle Feld-Hervorhebungen entfernen
  document.querySelectorAll(".validation-error").forEach((field) => {
    field.classList.remove("validation-error");
  });
}

function highlightField(fieldId) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.classList.add("validation-error");
  }
}

// CSS für Fehler-Styling hinzufügen
const errorStyles = `
<style>
.validation-error {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
  animation: shake 0.3s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}

.validation-summary {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 2rem;
  color: #ef4444;
}

.validation-header {
  font-weight: 600;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.validation-summary ul {
  margin: 0;
  padding-left: 1.5rem;
}

.validation-summary li {
  margin-bottom: 0.25rem;
}
</style>
`;

// Error-Styles beim Laden hinzufügen
if (!document.querySelector("#fahrzeughandel-error-styles")) {
  const styleElement = document.createElement("div");
  styleElement.id = "fahrzeughandel-error-styles";
  styleElement.innerHTML = errorStyles;
  document.head.appendChild(styleElement);
}

// Modal CSS Styles
const improvedModalStyles = `
<style>
/* 3-Spalten Grid für bessere Übersicht */
#fahrzeughandel-form .form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-bottom: 2rem;
}

/* Grid-Span Klassen für 3-Spalten Layout */
.form-span-2-of-3 {
  grid-column: span 2;
}

.form-span-3 {
  grid-column: span 3;
}

/* Schöne normale Checkbox */
.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.checkbox-group input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent-primary, #3b82f6);
  cursor: pointer;
  transform: scale(1.1);
}

.checkbox-group label {
  cursor: pointer;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  user-select: none;
}

.checkbox-group label:hover {
  color: var(--accent-primary, #3b82f6);
}

/* Mobile Anpassung für 3-Spalten */
@media (max-width: 768px) {
  #fahrzeughandel-form .form-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .form-span-2-of-3,
  .form-span-3 {
    grid-column: span 1;
  }
}

@media (max-width: 1024px) {
  #fahrzeughandel-form .form-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .form-span-2-of-3 {
    grid-column: span 2;
  }
  
  .form-span-3 {
    grid-column: span 2;
  }
}
</style>
`;

// Styles automatisch hinzufügen
if (!document.querySelector("#improved-modal-styles")) {
  const styleElement = document.createElement("div");
  styleElement.id = "improved-modal-styles";
  styleElement.innerHTML = improvedModalStyles;
  document.head.appendChild(styleElement);
}

// MODAL-FUNKTIONEN
window.showFahrzeughandelModal = function (handelId = null) {
  console.log("🚀 Fahrzeughandel-Modal öffnen...", handelId);

  editingHandelId = handelId;

  // Altes Modal entfernen
  const existingModal = document.querySelector(".fahrzeughandel-modal-dynamic");
  if (existingModal) {
    existingModal.remove();
  }

  const title = handelId
    ? "Handelsgeschäft bearbeiten"
    : "Neues Handelsgeschäft";
  const modal = document.createElement("div");
  modal.className = "modal fahrzeughandel-modal-dynamic active";

  modal.innerHTML = `
    <div class="modal-content card fade-in" style="max-width: 650px; width: 70vw; margin: 2rem auto;">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" type="button" onclick="closeFahrzeughandelModalDynamic()">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <form id="fahrzeughandel-form" onsubmit="saveFahrzeughandel(event)">
        <!-- Grunddaten - 3 Spalten -->
        <div class="form-grid">
          <div class="form-group">
            <label for="handel-typ" class="form-label">Geschäfts-Typ</label>
            <select id="handel-typ" class="form-select" onchange="handleTypChange()">
              <option value="">Bitte wählen</option>
              <option value="ankauf">Ankauf</option>
              <option value="verkauf">Verkauf</option>
            </select>
          </div>
          <div class="form-group">
            <label for="handel-kunde" class="form-label">
              Kunde <span style="color: #ef4444; font-size: 0.8em">*bei neuen Fahrzeugen</span>
            </label>
            <select id="handel-kunde" class="form-select"></select>
          </div>
          <div class="form-group">
            <label for="handel-datum" class="form-label">Datum</label>
            <input type="date" id="handel-datum" class="form-input" required>
          </div>
          
          <div class="form-group">
            <label for="handel-fahrzeug" class="form-label">Fahrzeug auswählen</label>
            <select id="handel-fahrzeug" class="form-select" onchange="loadFahrzeugData()"></select>
          </div>
        </div>

        <!-- Fahrzeugdaten - 3 Spalten -->
        <div class="form-section">
          <h3><i class="fas fa-car"></i> Fahrzeugdaten</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="handel-kennzeichen" class="form-label">Kennzeichen</label>
              <input type="text" id="handel-kennzeichen" class="form-input" placeholder="z.B. DO-AB 123">
            </div>
            <div class="form-group">
              <label for="handel-marke" class="form-label">Marke</label>
              <input type="text" id="handel-marke" class="form-input" placeholder="z.B. Volkswagen">
            </div>
            <div class="form-group">
              <label for="handel-modell" class="form-label">Modell</label>
              <input type="text" id="handel-modell" class="form-input" placeholder="z.B. Golf">
            </div>
            
            <div class="form-group">
              <label for="handel-vin" class="form-label">VIN-Nummer</label>
              <input type="text" id="handel-vin" class="form-input" placeholder="17-stellige VIN" maxlength="17">
            </div>
            <div class="form-group">
              <label for="handel-baujahr" class="form-label">Baujahr</label>
              <input type="number" id="handel-baujahr" class="form-input" min="1950" max="2030">
            </div>
            <div class="form-group">
              <label for="handel-kilometerstand" class="form-label">Kilometerstand</label>
              <input type="number" id="handel-kilometerstand" class="form-input" placeholder="0">
            </div>
            
            <div class="form-group">
              <label for="handel-farbe" class="form-label">Farbe</label>
              <input type="text" id="handel-farbe" class="form-input" placeholder="z.B. Schwarz">
            </div>
            <div class="form-group">
              <label for="handel-zustand" class="form-label">Zustand</label>
              <select id="handel-zustand" class="form-select">
                <option value="sehr gut">Sehr gut</option>
                <option value="gut" selected>Gut</option>
                <option value="befriedigend">Befriedigend</option>
                <option value="reparaturbedürftig">Reparaturbedürftig</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Technische Details - 3 Spalten -->
        <div class="form-section">
          <h3><i class="fas fa-cogs"></i> Technische Details</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="handel-tuev" class="form-label">TÜV bis</label>
              <input type="date" id="handel-tuev" class="form-input">
            </div>
            <div class="form-group">
              <label for="handel-au" class="form-label">AU bis</label>
              <input type="date" id="handel-au" class="form-input">
            </div>
            <div class="form-group">
              <!-- Leer für Grid-Layout -->
            </div>
            <!-- Normale Checkbox -->
            <div class="form-group checkbox-group">
              <label for="handel-papiere">
                <i class="fas fa-file-alt" style="color: var(--accent-primary); margin-right: 0.5rem;"></i>
                Fahrzeugpapiere vollständig
              </label>
              <input type="checkbox" id="handel-papiere" checked>
            </div>
          </div>
        </div>

        <!-- Finanzielle Details - 3 Spalten -->
        <div class="form-section">
          <h3><i class="fas fa-euro-sign"></i> Finanzielle Details</h3>
          <div class="form-grid">
            <div class="form-group">
              <label for="handel-ankaufspreis" class="form-label">Ankaufspreis (€)</label>
              <input type="number" step="0.01" id="handel-ankaufspreis" class="form-input" onchange="calculateProfit()">
            </div>
            <div class="form-group">
              <label for="handel-verkaufspreis" class="form-label">Verkaufspreis (€)</label>
              <input type="number" step="0.01" id="handel-verkaufspreis" class="form-input" onchange="calculateProfit()">
            </div>
            <div class="form-group">
              <label for="handel-gewinn" class="form-label">Gewinn/Verlust (€)</label>
              <input type="number" step="0.01" id="handel-gewinn" class="form-input" readonly>
            </div>
            
            <div class="form-group">
              <label for="handel-status" class="form-label">Status</label>
              <select id="handel-status" class="form-select">
                <option value="offen" selected>Offen</option>
                <option value="abgeschlossen">Abgeschlossen</option>
                <option value="storniert">Storniert</option>
              </select>
            </div>
            <div class="form-group form-span-2-of-3">
              <label for="handel-verkauft-an" class="form-label">Verkauft an (Käufer)</label>
              <select id="handel-verkauft-an" class="form-select"></select>
            </div>
          </div>
        </div>

        <!-- Notizen - 3 Spalten, aber volle Breite -->
        <div class="form-section">
          <h3><i class="fas fa-sticky-note"></i> Notizen</h3>
          <div class="form-grid">
            <div class="form-group form-span-3">
              <label for="handel-bemerkungen" class="form-label">Bemerkungen</label>
              <textarea id="handel-bemerkungen" class="form-textarea" rows="3" placeholder="Zusätzliche Notizen für Kunden..."></textarea>
            </div>
            <div class="form-group form-span-3">
              <label for="handel-interne-notizen" class="form-label">Interne Notizen</label>
              <textarea id="handel-interne-notizen" class="form-textarea" rows="3" placeholder="Interne Notizen (nicht für Kunden sichtbar)..."></textarea>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeFahrzeughandelModalDynamic()">
            <i class="fas fa-times"></i> Abbrechen
          </button>
          <button type="submit" class="btn btn-primary">
            <i class="fas fa-save"></i> ${
              handelId ? "Aktualisieren" : "Speichern"
            }
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  // EVENT-LISTENER für Modal-Schließung
  setupModalCloseEvents(modal);

  setTimeout(() => {
    initializeFahrzeughandelModal(handelId);
  }, 100);

  console.log("✅ Fahrzeughandel-Modal erstellt");
};

// Event-Listener für Modal-Schließung
function setupModalCloseEvents(modal) {
  const escapeHandler = (e) => {
    if (e.key === "Escape" && modal && document.body.contains(modal)) {
      closeFahrzeughandelModalDynamic();
    }
  };

  const clickOutsideHandler = (e) => {
    if (e.target === modal) {
      closeFahrzeughandelModalDynamic();
    }
  };

  document.addEventListener("keydown", escapeHandler);
  modal.addEventListener("click", clickOutsideHandler);

  modal._escapeHandler = escapeHandler;
  modal._clickHandler = clickOutsideHandler;
}

// Modal schließen
window.closeFahrzeughandelModalDynamic = function () {
  console.log("🔒 Modal schließen...");

  const modal = document.querySelector(".fahrzeughandel-modal-dynamic");
  if (modal) {
    // Event-Listeners entfernen
    if (modal._escapeHandler) {
      document.removeEventListener("keydown", modal._escapeHandler);
    }
    if (modal._clickHandler) {
      modal.removeEventListener("click", modal._clickHandler);
    }

    modal.remove();
  }

  document.body.style.overflow = "auto";

  if (typeof editingHandelId !== "undefined") {
    editingHandelId = null;
  }

  console.log("✅ Modal geschlossen");
};

function generateActionButtons(geschaeft) {
  // Wenn Status "abgeschlossen" ist, keine Action-Buttons anzeigen
  if (geschaeft.status === "abgeschlossen") {
    return `<div style="display: flex; justify-content: center; align-items: center; height: 100%; text-align: center;">
              <span style="color: #10b981; font-size: 35px; font-weight: 500;">&#10004;</span>
            </div>`;
  }

  // Normale Action-Buttons für alle anderen Status
  return `
    <div class="action-buttons">
      <button class="btn btn-sm btn-primary" onclick="editFahrzeughandel(${
        geschaeft.id
      })" title="Bearbeiten">
        <i class="fas fa-edit"></i>
      </button>
      ${
        geschaeft.typ === "verkauf"
          ? `
            <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); createRechnungFromHandel(${geschaeft.id})" title="Rechnung erstellen">
              <i class="fas fa-file-invoice"></i>
            </button>
          `
          : ""
      }
    </div>
  `;
}

// 2. ✅ KÄUFER-VALIDIERUNG BEIM SPEICHERN VERBESSERT
// Diese Funktion erweitert die bestehende validateFormData-Funktion

function validateKaeuferForVerkauf(data) {
  const errors = [];

  // Bei Verkäufen muss immer ein Käufer angegeben werden
  if (data.typ === "verkauf") {
    const verkauftAnSelect = document.getElementById("handel-verkauft-an");
    const verkauftAnWert = verkauftAnSelect?.value;

    if (!verkauftAnWert) {
      errors.push("Käufer muss bei Verkäufen ausgewählt werden");
      highlightField("handel-verkauft-an");
    }
  }

  return errors;
}

// 3. ✅ FOCUS AUF GESCHÄFTSTYP BEI NEUEM MODAL
// Diese Funktion erweitert initializeFahrzeughandelModal

function setFocusOnGeschaeftstyp(handelId) {
  // Bei neuem Geschäft (kein handelId) Focus auf Geschäftstyp setzen
  if (!handelId) {
    setTimeout(() => {
      const typSelect = document.getElementById("handel-typ");
      if (typSelect) {
        typSelect.focus();
        console.log("✅ Focus auf Geschäftstyp gesetzt");
      }
    }, 150); // Kleine Verzögerung für DOM-Bereitschaft
  }
}

function initializeFahrzeughandelModal(handelId) {
  // Dropdowns füllen
  populateDropdowns();

  if (handelId) {
    // Bearbeitungsmodus: Daten laden
    loadHandelForEdit(handelId);
  } else {
    // Neuer Eintrag: Standardwerte setzen
    const statusEl = document.getElementById("handel-status");
    const zustandEl = document.getElementById("handel-zustand");
    const papiereEl = document.getElementById("handel-papiere");
    const datumEl = document.getElementById("handel-datum");

    if (statusEl) statusEl.value = "offen";
    if (zustandEl) zustandEl.value = "gut";
    if (papiereEl) papiereEl.checked = true;

    // Heute als Datum setzen
    if (datumEl) {
      const today = new Date().toISOString().split("T")[0];
      datumEl.value = today;
    }
    setFocusOnGeschaeftstyp(handelId);
  }

  console.log("✅ Fahrzeughandel-Modal initialisiert");
}

// Dropdowns mit Daten füllen
function populateDropdowns() {
  // Kunden-Dropdown (Besitzer)
  const kundenSelect = document.getElementById("handel-kunde");
  if (kundenSelect) {
    kundenSelect.innerHTML =
      '<option value="">Bitte wählen (optional)</option>';
    availableKunden.forEach((kunde) => {
      kundenSelect.innerHTML += `
        <option value="${kunde.id}">
          ${kunde.name} (${kunde.kunden_nr})
        </option>
      `;
    });
  }

  // VERKAUFT AN Dropdown (Käufer)
  const verkauftAnSelect = document.getElementById("handel-verkauft-an");
  if (verkauftAnSelect) {
    verkauftAnSelect.innerHTML =
      '<option value="">Bitte wählen (optional)</option>';
    availableKunden.forEach((kunde) => {
      verkauftAnSelect.innerHTML += `
        <option value="${kunde.id}">
          ${kunde.name} (${kunde.kunden_nr})
        </option>
      `;
    });
  }

  // Fahrzeuge-Dropdown
  const fahrzeugSelect = document.getElementById("handel-fahrzeug");
  if (fahrzeugSelect) {
    fahrzeugSelect.innerHTML = `
      <option value="">🆕 Fahrzeug neu eingeben</option>
      <option disabled>──────────────────────</option>
      <option disabled>📋 Oder bestehendes wählen:</option>
    `;

    if (availableFahrzeuge && availableFahrzeuge.length > 0) {
      availableFahrzeuge.forEach((fahrzeug) => {
        fahrzeugSelect.innerHTML += `
          <option value="${fahrzeug.id}">
            🚗 ${fahrzeug.kennzeichen} - ${fahrzeug.marke} ${fahrzeug.modell}
            ${fahrzeug.besitzer ? ` (${fahrzeug.besitzer})` : ""}
          </option>
        `;
      });
    } else {
      fahrzeugSelect.innerHTML += `<option disabled>Keine Fahrzeuge verfügbar</option>`;
    }
  }
}

// Handel für Bearbeitung laden
async function loadHandelForEdit(handelId) {
  try {
    const response = await fetch(`/api/fahrzeughandel/${handelId}`);
    if (!response.ok) throw new Error("Handelsgeschäft nicht gefunden");

    const handel = await response.json();
    console.log("🔍 Handelsgeschäft geladen:", handel);
    console.log("🔍 VIN aus API:", handel.vin);

    // Form mit Daten füllen
    fillFormWithData(handel);
  } catch (error) {
    console.error("Fehler beim Laden des Handelsgeschäfts:", error);
    showNotification("Fehler beim Laden der Daten", "error");
    closeFahrzeughandelModalDynamic();
  }
}

// Form mit Daten füllen
function fillFormWithData(handel) {
  console.log("🔍 Fülle Form mit Daten:", handel);

  // ✅ WICHTIG: VIN ist jetzt in der Liste!
  const fields = [
    "typ",
    "datum",
    "kennzeichen",
    "marke",
    "modell",
    "vin", // ✅ VIN HINZUGEFÜGT!
    "baujahr",
    "kilometerstand",
    "farbe",
    "zustand",
    "ankaufspreis",
    "verkaufspreis",
    "tuev_bis",
    "au_bis",
    "bemerkungen",
    "interne_notizen",
    "status",
  ];

  fields.forEach((field) => {
    const element = document.getElementById(
      `handel-${field.replace("_", "-")}`
    );
    if (element && handel[field] !== null && handel[field] !== undefined) {
      element.value = handel[field];

      // Debug für VIN
      if (field === "vin") {
        console.log("✅ VIN gesetzt:", handel[field], "Element:", element);
      }
    }
  });

  // Checkboxes
  document.getElementById("handel-papiere").checked =
    handel.papiere_vollstaendig;

  // Dropdowns
  if (handel.kunden_id) {
    document.getElementById("handel-kunde").value = handel.kunden_id;
  }
  if (handel.fahrzeug_id) {
    document.getElementById("handel-fahrzeug").value = handel.fahrzeug_id;
  }

  // VERKAUFT AN Dropdown
  if (handel.verkauft_an) {
    const verkauftAnSelect = document.getElementById("handel-verkauft-an");
    const kundenId = parseInt(handel.verkauft_an);
    if (!isNaN(kundenId) && availableKunden.find((k) => k.id === kundenId)) {
      verkauftAnSelect.value = kundenId;
    } else {
      const customOption = document.createElement("option");
      customOption.value = "custom";
      customOption.textContent = `📝 ${handel.verkauft_an} (manuell eingetragen)`;
      customOption.selected = true;
      verkauftAnSelect.appendChild(customOption);
    }
  }

  // Gewinn berechnen
  calculateProfit();

  // Final VIN Check
  const vinElement = document.getElementById("handel-vin");
  console.log("🏁 Final VIN Check - Element Value:", vinElement?.value);
}

// Filter-Funktionen
window.filterHandel = function (filter) {
  currentFilter = filter;

  document.querySelectorAll(".filter-buttons .btn").forEach((btn) => {
    btn.setAttribute("data-active", "false");
  });

  const activeButton = document.getElementById(`filter-${filter}`);
  if (activeButton) {
    activeButton.setAttribute("data-active", "true");
  }

  updateFahrzeughandelTable();
};

// Fahrzeug-Daten laden wenn aus Dropdown gewählt
window.loadFahrzeugData = function () {
  const fahrzeugSelect = document.getElementById("handel-fahrzeug");
  const selectedId = fahrzeugSelect.value;

  // Fahrzeugdatenfelder
  const kennzeichenField = document.getElementById("handel-kennzeichen");
  const markeField = document.getElementById("handel-marke");
  const modellField = document.getElementById("handel-modell");
  const vinField = document.getElementById("handel-vin");
  const baujahrField = document.getElementById("handel-baujahr");
  const farbeField = document.getElementById("handel-farbe");
  const kilometerstandField = document.getElementById("handel-kilometerstand");

  if (!selectedId) {
    // Neues Fahrzeug eingeben - Felder leeren
    if (kennzeichenField) kennzeichenField.value = "";
    if (markeField) markeField.value = "";
    if (modellField) modellField.value = "";
    if (vinField) vinField.value = "";
    if (baujahrField) baujahrField.value = "";
    if (farbeField) farbeField.value = "";
    if (kilometerstandField) kilometerstandField.value = "";

    // Felder aktivieren
    [
      kennzeichenField,
      markeField,
      modellField,
      vinField,
      baujahrField,
      farbeField,
      kilometerstandField,
    ].forEach((field) => {
      if (field) {
        field.disabled = false;
        field.style.backgroundColor = "";
        field.style.opacity = "1";
      }
    });

    if (kennzeichenField) {
      kennzeichenField.focus();
    }

    return;
  }

  // Existierendes Fahrzeug laden
  const fahrzeug = availableFahrzeuge.find((f) => f.id == selectedId);
  if (fahrzeug) {
    if (kennzeichenField) kennzeichenField.value = fahrzeug.kennzeichen || "";
    if (markeField) markeField.value = fahrzeug.marke || "";
    if (modellField) modellField.value = fahrzeug.modell || "";
    if (vinField) vinField.value = fahrzeug.vin || "";
    if (baujahrField) baujahrField.value = fahrzeug.baujahr || "";
    if (farbeField) farbeField.value = fahrzeug.farbe || "";
    if (kilometerstandField)
      kilometerstandField.value = fahrzeug.kilometerstand || "";

    console.log(
      "✅ Fahrzeugdaten geladen:",
      fahrzeug.kennzeichen,
      "VIN:",
      fahrzeug.vin
    );
  }
};

// Typ-Änderung behandeln
window.handleTypChange = function () {
  const typ = document.getElementById("handel-typ").value;
  const verkaufspreisGroup = document
    .getElementById("handel-verkaufspreis")
    ?.closest(".form-group");
  const gewinnGroup = document
    .getElementById("handel-gewinn")
    ?.closest(".form-group");
  const verkauftAnGroup = document
    .getElementById("handel-verkauft-an")
    ?.closest(".form-group");

  // NEU: Kunden-Feld referenzieren
  const kundenSelect = document.getElementById("handel-kunde");

  if (typ === "ankauf") {
    if (verkaufspreisGroup) {
      verkaufspreisGroup.style.opacity = "0.6";
      const label = verkaufspreisGroup.querySelector("label");
      if (label) label.textContent = "Geplanter Verkaufspreis (€)";
    }
    if (gewinnGroup) {
      gewinnGroup.style.opacity = "0.6";
      const label = gewinnGroup.querySelector("label");
      if (label) label.textContent = "Erwarteter Gewinn (€)";
    }
    if (verkauftAnGroup) {
      verkauftAnGroup.style.display = "none";
    }

    // NEU: Kunden-Feld aktivieren bei Ankauf
    if (kundenSelect) {
      kundenSelect.disabled = false;
      kundenSelect.style.opacity = "1";
      kundenSelect.style.pointerEvents = "auto";
    }
  } else if (typ === "verkauf") {
    if (verkaufspreisGroup) {
      verkaufspreisGroup.style.opacity = "1";
      const label = verkaufspreisGroup.querySelector("label");
      if (label) label.textContent = "Verkaufspreis (€)";
    }
    if (gewinnGroup) {
      gewinnGroup.style.opacity = "1";
      const label = gewinnGroup.querySelector("label");
      if (label) label.textContent = "Gewinn (€)";
    }
    if (verkauftAnGroup) {
      verkauftAnGroup.style.display = "block";
    }

    // NEU: Kunden-Feld deaktivieren bei Verkauf (Kunde muss derselbe bleiben)
    if (kundenSelect) {
      kundenSelect.disabled = true;
      kundenSelect.style.opacity = "0.6";
      kundenSelect.style.pointerEvents = "none";

      // Optionale Tooltip-Info hinzufügen
      if (!kundenSelect.title) {
        kundenSelect.title =
          "Kunde kann bei Verkauf nicht geändert werden - muss derselbe wie beim Ankauf bleiben";
      }
    }
  } else {
    // Kein Typ ausgewählt - alles auf Standard zurücksetzen
    [verkaufspreisGroup, gewinnGroup, verkauftAnGroup].forEach((group) => {
      if (group) {
        group.style.opacity = "1";
        group.style.display = "block";
      }
    });

    // NEU: Kunden-Feld wieder aktivieren
    if (kundenSelect) {
      kundenSelect.disabled = false;
      kundenSelect.style.opacity = "1";
      kundenSelect.style.pointerEvents = "auto";
      kundenSelect.title = "";
    }
  }

  calculateProfit();
};

// Gewinn berechnen
window.calculateProfit = function () {
  const ankaufspreis =
    parseFloat(document.getElementById("handel-ankaufspreis").value) || 0;
  const verkaufspreis =
    parseFloat(document.getElementById("handel-verkaufspreis").value) || 0;
  const gewinn = verkaufspreis - ankaufspreis;

  const gewinnField = document.getElementById("handel-gewinn");
  if (gewinnField) {
    gewinnField.value = gewinn.toFixed(2);

    gewinnField.classList.remove("profit-positive", "profit-negative");
    if (gewinn > 0) {
      gewinnField.classList.add("profit-positive");
      gewinnField.title = `Gewinn: ${gewinn.toFixed(2)} €`;
    } else if (gewinn < 0) {
      gewinnField.classList.add("profit-negative");
      gewinnField.title = `Verlust: ${Math.abs(gewinn).toFixed(2)} €`;
    } else {
      gewinnField.title = "Ausgeglichen";
    }
  }
};

// CRUD-Operationen
window.editFahrzeughandel = function (handelId) {
  showFahrzeughandelModal(handelId);
};

// ✅ REPARIERTE saveFahrzeughandel Funktion
window.saveFahrzeughandel = async function (event) {
  // Form-Submit verhindern
  if (event) {
    event.preventDefault();
  }

  const submitButton = document.querySelector(
    "#fahrzeughandel-form .btn-primary"
  );
  const originalText = submitButton.textContent;

  // Button deaktivieren
  submitButton.disabled = true;
  submitButton.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Speichern...';

  try {
    // Validierung ZUERST
    const formData = getFormData();

    if (!validateFormData(formData)) {
      // Button wieder aktivieren bei Validierungsfehlern
      submitButton.disabled = false;
      submitButton.textContent = originalText;
      return;
    }

    // API-Aufruf
    const url = editingHandelId
      ? `/api/fahrzeughandel/${editingHandelId}`
      : "/api/fahrzeughandel";
    const method = editingHandelId ? "PUT" : "POST";

    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Speichern fehlgeschlagen");
    }

    const result = await response.json();

    // ✅ ERWEITERTE Erfolgsmeldung
    let message = editingHandelId
      ? "Handelsgeschäft aktualisiert"
      : "Handelsgeschäft erstellt";

    if (result.fahrzeug_erstellt) {
      message += " (Fahrzeug automatisch erstellt)";
    }

    // ✅ NEU: Fahrzeug-Synchronisation berücksichtigen
    if (result.updates && result.updates.fahrzeug_synchronisiert) {
      message += " (Fahrzeugdaten synchronisiert)";
    }

    showNotification(message, "success");

    // ✅ NEU: Cache-Invalidierung bei Fahrzeug-Updates
    if (
      editingHandelId &&
      result.updates &&
      result.updates.fahrzeug_synchronisiert
    ) {
      console.log("🔄 Fahrzeug wurde synchronisiert - invalidiere Caches");

      // Browser-Storage cleanen (falls verwendet)
      if (typeof localStorage !== "undefined") {
        Object.keys(localStorage).forEach((key) => {
          if (
            key.startsWith("fahrzeuge_") ||
            key.startsWith("cache_fahrzeuge")
          ) {
            localStorage.removeItem(key);
            console.log("🗑️ Cache-Key entfernt:", key);
          }
        });
      }

      // Global Event für andere Komponenten senden
      if (typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
          new CustomEvent("fahrzeugDataChanged", {
            detail: {
              type: "updated_from_handel",
              fahrzeug_id: result.updates.fahrzeug_id,
              handelsgeschaeft_id: editingHandelId,
            },
          })
        );
      }
    }

    // Modal schließen
    closeFahrzeughandelModalDynamic();

    // ✅ ERWEITERTE Daten-Aktualisierung
    await Promise.all([
      loadFahrzeughandelData(),
      loadFahrzeughandelStats(),
      // ✅ NEU: Fahrzeuge auch neu laden wenn synchronisiert
      result.updates &&
      result.updates.fahrzeug_synchronisiert &&
      typeof loadFahrzeuge === "function"
        ? loadFahrzeuge()
        : Promise.resolve(),
    ]);

    updateFahrzeughandelTable();
    updateStatsDisplay();

    // ✅ ERWEITERTE Fahrzeuge-Dropdown Aktualisierung
    let shouldUpdateDropdown = false;

    if (result.fahrzeug_erstellt) {
      shouldUpdateDropdown = true;
    }

    if (result.updates && result.updates.fahrzeug_synchronisiert) {
      shouldUpdateDropdown = true;
    }

    if (shouldUpdateDropdown) {
      try {
        const response = await fetch("/api/fahrzeughandel/options/fahrzeuge");
        if (response.ok) {
          availableFahrzeuge = await response.json();
          console.log("✅ Fahrzeuge-Dropdown aktualisiert");
        }
      } catch (error) {
        console.warn(
          "Warnung: Dropdown-Fahrzeuge konnten nicht aktualisiert werden:",
          error
        );
      }
    }

    // ✅ ERWEITERTE Benachrichtigungen
    if (result.fahrzeug_erstellt) {
      setTimeout(() => {
        showNotification(
          `Fahrzeug "${result.handelsgeschaeft?.kennzeichen}" wurde erstellt`,
          "info"
        );
      }, 1000);
    } else if (result.updates && result.updates.fahrzeug_synchronisiert) {
      setTimeout(() => {
        showNotification(
          `Fahrzeugdaten wurden in der Hauptsektion aktualisiert`,
          "info"
        );
      }, 1000);
    }

    // ✅ NEU: Debug-Ausgabe für Entwicklung
    if (result.updates) {
      console.log("✅ Update-Status:", {
        handelsgeschaeft: result.updates.handelsgeschaeft,
        fahrzeug_synchronisiert: result.updates.fahrzeug_synchronisiert,
        fahrzeug_id: result.updates.fahrzeug_id,
      });
    }
  } catch (error) {
    console.error("❌ Fehler beim Speichern:", error);
    showNotification(`Fehler: ${error.message}`, "error");

    // Button wieder aktivieren bei Fehlern
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  } finally {
    // ✅ NEU: Sicherstellen dass Button immer wieder aktiviert wird
    if (submitButton.disabled) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
};

window.deleteFahrzeughandel = async function (handelId, handelNr) {
  if (
    !confirm(
      `Handelsgeschäft ${handelNr} wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`/api/fahrzeughandel/${handelId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Löschen fehlgeschlagen");
    }

    showNotification(`Handelsgeschäft ${handelNr} gelöscht`, "success");
    await loadFahrzeughandel();
  } catch (error) {
    console.error("Fehler beim Löschen:", error);
    showNotification(`Fehler beim Löschen: ${error.message}`, "error");
  }
};

// Hilfsfunktionen
function formatDate(dateString) {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("de-DE");
  } catch {
    return dateString;
  }
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return "0,00 €";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function debounce(func, wait) {
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

function showNotification(message, type = "info") {
  if (window.showNotification) {
    window.showNotification(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  }
}

// Event-Listener für DOMContentLoaded
document.addEventListener("DOMContentLoaded", function () {
  const fahrzeugSelect = document.getElementById("handel-fahrzeug");
  if (fahrzeugSelect) {
    fahrzeugSelect.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !this.value) {
        e.preventDefault();
        const kennzeichenField = document.getElementById("handel-kennzeichen");
        if (kennzeichenField) {
          kennzeichenField.focus();
        }
      }
    });
  }
});

// Global verfügbar machen
window.createRechnungFromHandel = createRechnungFromHandel;

console.log("✅ Fahrzeughandel-Modul geladen - Komplett und funktionsfähig");
