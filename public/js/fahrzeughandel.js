// public/js/fahrzeughandel.js
// JavaScript für Fahrzeug Ankauf/Verkauf Funktionalität

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
  if (!tableBody) return;

  // Gefilterte Daten
  const filteredData = getFilteredData();

  if (filteredData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center" style="padding: 2rem; color: #6b7280;">
          <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
          <div>Keine Handelsgeschäfte gefunden</div>
          <div style="font-size: 0.875rem; margin-top: 0.5rem;">
            ${
              currentFilter !== "alle"
                ? "Versuchen Sie einen anderen Filter"
                : "Erstellen Sie Ihr erstes Handelsgeschäft"
            }
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filteredData
    .map(
      (geschaeft) => `
    <tr data-handel-id="${geschaeft.id}">
      <td>
        <strong>${geschaeft.handel_nr}</strong>
      </td>
      <td>
        <span class="typ-badge typ-${geschaeft.typ}">
          <i class="fas fa-arrow-${
            geschaeft.typ === "ankauf" ? "down" : "up"
          }"></i>
          ${geschaeft.typ}
        </span>
      </td>
      <td>
        <div>
          <strong>${geschaeft.kennzeichen}</strong>
        </div>
        <div style="font-size: 0.875rem; color: #6b7280;">
          ${geschaeft.marke} ${geschaeft.modell}
          ${geschaeft.baujahr ? ` (${geschaeft.baujahr})` : ""}
        </div>
      </td>
      <td>
        ${
          geschaeft.kunde_name
            ? `<div><strong>${geschaeft.kunde_name}</strong></div>
           <div style="font-size: 0.875rem; color: #6b7280;">${
             geschaeft.kunden_nr || ""
           }</div>`
            : geschaeft.verkauft_an || "<em>Nicht angegeben</em>"
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
        <div class="action-buttons">
          <button class="btn-icon" onclick="editFahrzeughandel(${
            geschaeft.id
          })" title="Bearbeiten">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon btn-danger" onclick="deleteFahrzeughandel(${
            geschaeft.id
          }, '${geschaeft.handel_nr}')" title="Löschen">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");

  console.log(`✅ Tabelle aktualisiert: ${filteredData.length} Einträge`);
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

    closeFahrzeughandelModal();
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
  return {
    typ: document.getElementById("handel-typ").value,
    kunden_id: document.getElementById("handel-kunde").value || null,
    fahrzeug_id: document.getElementById("handel-fahrzeug").value || null,
    datum: document.getElementById("handel-datum").value,
    kennzeichen: document.getElementById("handel-kennzeichen").value,
    marke: document.getElementById("handel-marke").value,
    modell: document.getElementById("handel-modell").value,
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
    verkauft_an: document.getElementById("handel-verkauft-an").value || null,
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
    (data.baujahr < 1900 || data.baujahr > new Date().getFullYear() + 2)
  ) {
    errors.push("Ungültiges Baujahr");
    highlightField("handel-baujahr");
  }

  if (errors.length > 0) {
    showValidationErrors(errors);
    return false;
  }

  return true;
}

function highlightField(fieldId) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.classList.add("error");
    field.focus();

    // Error-Klasse nach 3 Sekunden entfernen
    setTimeout(() => {
      field.classList.remove("error");
    }, 3000);
  }
}

// Validierungs-Fehler anzeigen
function showValidationErrors(errors) {
  const errorHtml = `
    <div class="validation-summary">
      <div class="validation-header">
        <i class="fas fa-exclamation-triangle"></i>
        Bitte korrigieren Sie folgende Fehler:
      </div>
      <ul>
        ${errors.map((error) => `<li>${error}</li>`).join("")}
      </ul>
    </div>
  `;

  // Bestehende Fehler entfernen
  const existingError = document.querySelector(".validation-summary");
  if (existingError) {
    existingError.remove();
  }

  // Neue Fehler am Anfang des Forms einfügen
  const form = document.getElementById("fahrzeughandel-form");
  if (form) {
    form.insertAdjacentHTML("afterbegin", errorHtml);

    // Nach oben scrollen zu Fehlern
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// CSS für Fehler-Styling hinzufügen
const errorStyles = `
<style>
.form-input.error,
.form-select.error {
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

// Modal-Funktionen
// Komplette Modal-Lösung für Fahrzeughandel

// Modal öffnen
window.showFahrzeughandelModal = function (handelId = null) {
  console.log("🚀 Modal öffnen...", handelId);
  editingHandelId = handelId;

  const modal = document.getElementById("fahrzeughandel-modal");
  const title = document.getElementById("fahrzeughandel-modal-title");
  const form = document.getElementById("fahrzeughandel-form");

  if (!modal || !title || !form) {
    console.error("❌ Modal-Elemente nicht gefunden");
    return;
  }

  // Modal-Titel setzen
  title.textContent = handelId
    ? "Handelsgeschäft bearbeiten"
    : "Neues Handelsgeschäft";

  // Dropdowns füllen
  if (typeof populateDropdowns === "function") {
    populateDropdowns();
  }

  if (handelId) {
    // Bearbeitungsmodus: Daten laden
    if (typeof loadHandelForEdit === "function") {
      loadHandelForEdit(handelId);
    }
  } else {
    // Neuer Eintrag: Form zurücksetzen
    form.reset();

    // Standard-Werte setzen (sicher prüfen ob Elemente existieren)
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
  }

  // Modal sichtbar machen - mehrere Methoden für Sicherheit
  modal.classList.add("active");
  modal.style.display = "flex";
  modal.style.visibility = "visible";
  modal.style.opacity = "1";
  modal.style.zIndex = "10001";

  // Body Scroll verhindern
  document.body.style.overflow = "hidden";

  console.log("✅ Modal geöffnet");
};

// Modal schließen - Verbesserte Version
window.closeFahrzeughandelModal = function () {
  console.log("🔒 Modal schließen...");

  const modal = document.getElementById("fahrzeughandel-modal");
  if (!modal) {
    console.error("❌ Modal nicht gefunden");
    return;
  }

  // CSS-Klasse entfernen
  modal.classList.remove("active");

  // Alle direkten Styles zurücksetzen
  modal.style.display = "none";
  modal.style.visibility = "hidden";
  modal.style.opacity = "0";

  // Body Scroll wieder aktivieren
  document.body.style.overflow = "auto";

  // Editing-ID zurücksetzen
  if (typeof editingHandelId !== "undefined") {
    editingHandelId = null;
  }

  console.log("✅ Modal geschlossen");
};

// Event-Listener für das Schließen - Neu aufsetzen
function setupModalEventListeners() {
  const modal = document.getElementById("fahrzeughandel-modal");
  if (!modal) return;

  // 1. Escape-Taste
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      closeFahrzeughandelModal();
    }
  });

  // 2. Klick außerhalb des Modals
  modal.addEventListener("click", function (e) {
    if (e.target === modal) {
      closeFahrzeughandelModal();
    }
  });

  // 3. X-Button (falls vorhanden)
  const closeButton = modal.querySelector(".modal-close");
  if (closeButton) {
    closeButton.addEventListener("click", function (e) {
      e.preventDefault();
      closeFahrzeughandelModal();
    });
  }

  console.log("✅ Modal Event-Listener eingerichtet");
}

// Event-Listener beim Laden der Seite einrichten
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupModalEventListeners);
} else {
  setupModalEventListeners();
}

// Debug-Funktionen
window.debugModal = function () {
  const modal = document.getElementById("fahrzeughandel-modal");
  console.log("Modal Element:", modal);
  console.log("Modal Classes:", modal?.classList?.toString());
  console.log("Modal Display:", window.getComputedStyle(modal)?.display);
  console.log("Modal Visibility:", window.getComputedStyle(modal)?.visibility);
  console.log("Modal Opacity:", window.getComputedStyle(modal)?.opacity);
};

// Fallback-Schließ-Funktion (falls andere nicht funktioniert)
window.forceCloseModal = function () {
  const modal = document.getElementById("fahrzeughandel-modal");
  if (modal) {
    modal.style.display = "none !important";
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
    console.log("🔧 Modal zwangsweise geschlossen");
  }
};

// Dropdowns mit Daten füllen
function populateDropdowns() {
  // Kunden-Dropdown
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

  // Fahrzeuge-Dropdown
  const fahrzeugSelect = document.getElementById("handel-fahrzeug");
  if (fahrzeugSelect) {
    fahrzeugSelect.innerHTML =
      '<option value="">Neu eingeben oder auswählen</option>';
    availableFahrzeuge.forEach((fahrzeug) => {
      fahrzeugSelect.innerHTML += `
        <option value="${fahrzeug.id}">
          ${fahrzeug.kennzeichen} - ${fahrzeug.marke} ${fahrzeug.modell}
          ${fahrzeug.besitzer ? ` (${fahrzeug.besitzer})` : ""}
        </option>
      `;
    });
  }
}

// Handel für Bearbeitung laden
async function loadHandelForEdit(handelId) {
  try {
    const response = await fetch(`/api/fahrzeughandel/${handelId}`);
    if (!response.ok) throw new Error("Handelsgeschäft nicht gefunden");

    const handel = await response.json();

    // Form mit Daten füllen
    fillFormWithData(handel);
  } catch (error) {
    console.error("Fehler beim Laden des Handelsgeschäfts:", error);
    showNotification("Fehler beim Laden der Daten", "error");
    closeFahrzeughandelModal();
  }
}

// Form mit Daten füllen
function fillFormWithData(handel) {
  const fields = [
    "typ",
    "datum",
    "kennzeichen",
    "marke",
    "modell",
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
    "verkauft_an",
    "status",
  ];

  fields.forEach((field) => {
    const element = document.getElementById(
      `handel-${field.replace("_", "-")}`
    );
    if (element && handel[field] !== null && handel[field] !== undefined) {
      element.value = handel[field];
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

  // Gewinn berechnen
  calculateProfit();
}

// Filter-Funktionen
window.filterHandel = function (filter) {
  currentFilter = filter;

  // Aktiven Button markieren
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

  if (!selectedId) return;

  const fahrzeug = availableFahrzeuge.find((f) => f.id == selectedId);
  if (fahrzeug) {
    document.getElementById("handel-kennzeichen").value = fahrzeug.kennzeichen;
    document.getElementById("handel-marke").value = fahrzeug.marke;
    document.getElementById("handel-modell").value = fahrzeug.modell;
    if (fahrzeug.baujahr) {
      document.getElementById("handel-baujahr").value = fahrzeug.baujahr;
    }
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

  if (typ === "ankauf") {
    // Bei Ankauf: Verkaufspreis und Gewinn weniger wichtig
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
  } else if (typ === "verkauf") {
    // Bei Verkauf: Alle Felder wichtig
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
  } else {
    // Kein Typ gewählt: Alle normal anzeigen
    [verkaufspreisGroup, gewinnGroup, verkauftAnGroup].forEach((group) => {
      if (group) {
        group.style.opacity = "1";
        group.style.display = "block";
      }
    });
  }

  // Gewinn neu berechnen
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

    // Visuelle Hinweise für Gewinn/Verlust
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

window.saveFahrzeughandel = async function () {
  const submitButton = document.querySelector(
    "#fahrzeughandel-form .btn-primary"
  );
  const submitText = document.getElementById("submit-text");
  const originalText = submitText.textContent;

  // Button-Status setzen
  submitButton.disabled = true;
  submitText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Speichern...';

  try {
    // Validierung
    const formData = getFormData();
    if (!validateFormData(formData)) {
      return;
    }

    // API-Aufruf
    const url = editingHandelId
      ? `/api/fahrzeughandel/${editingHandelId}`
      : "/api/fahrzeughandel";

    const method = editingHandelId ? "PUT" : "POST";

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Speichern fehlgeschlagen");
    }

    const result = await response.json();

    showNotification(
      editingHandelId
        ? "Handelsgeschäft aktualisiert"
        : "Handelsgeschäft erstellt",
      "success"
    );

    closeFahrzeughandelModal();

    // Daten neu laden falls Funktion vorhanden
    if (typeof loadFahrzeughandel === "function") {
      await loadFahrzeughandel();
    }
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    showNotification(`Fehler: ${error.message}`, "error");
  } finally {
    // Button wieder aktivieren
    submitButton.disabled = false;
    submitText.textContent = originalText;
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
    await loadFahrzeughandel(); // Daten neu laden
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
  // Integration in das bestehende Notification-System
  if (window.showNotification) {
    window.showNotification(message, type);
  } else {
    // Fallback
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  }
}

// Modal-Schließen bei Escape oder Klick außerhalb
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeFahrzeughandelModal();
  }
});

// Klick außerhalb Modal
document.addEventListener("click", (e) => {
  const modal = document.getElementById("fahrzeughandel-modal");
  if (e.target === modal) {
    closeFahrzeughandelModal();
  }
});

console.log("✅ Fahrzeughandel-Modul geladen");
