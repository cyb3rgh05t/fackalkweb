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
  if (!data.typ) {
    showNotification("Bitte wählen Sie einen Geschäftstyp", "error");
    return false;
  }

  if (!data.kennzeichen || !data.marke || !data.modell) {
    showNotification(
      "Kennzeichen, Marke und Modell sind erforderlich",
      "error"
    );
    return false;
  }

  if (!data.datum) {
    showNotification("Datum ist erforderlich", "error");
    return false;
  }

  return true;
}

// Modal-Funktionen
window.showFahrzeughandelModal = function (handelId = null) {
  editingHandelId = handelId;

  const modal = document.getElementById("fahrzeughandel-modal");
  const title = document.getElementById("fahrzeughandel-modal-title");
  const form = document.getElementById("fahrzeughandel-form");

  if (!modal || !title || !form) {
    console.error("Modal-Elemente nicht gefunden");
    return;
  }

  // Modal-Titel setzen
  title.textContent = handelId
    ? "Handelsgeschäft bearbeiten"
    : "Neues Handelsgeschäft";

  // Dropdowns füllen
  populateDropdowns();

  if (handelId) {
    // Bearbeitungsmodus: Daten laden
    loadHandelForEdit(handelId);
  } else {
    // Neuer Eintrag: Form zurücksetzen
    form.reset();
    document.getElementById("handel-status").value = "offen";
    document.getElementById("handel-zustand").value = "gut";
    document.getElementById("handel-papiere").checked = true;

    // Heute als Datum setzen
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("handel-datum").value = today;
  }

  modal.style.display = "block";
  modal.style.visibility = "visible";
  modal.style.opacity = "1";
  modal.classList.add("modal-open");
  document.body.style.overflow = "hidden";
};

window.closeFahrzeughandelModal = function () {
  const modal = document.getElementById("fahrzeughandel-modal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }

  editingHandelId = null;
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
    .closest(".form-group");
  const gewinnGroup = document
    .getElementById("handel-gewinn")
    .closest(".form-group");

  // Bei Ankauf Verkaufspreis optional machen
  if (typ === "ankauf") {
    if (verkaufspreisGroup) verkaufspreisGroup.style.opacity = "0.6";
    if (gewinnGroup) gewinnGroup.style.opacity = "0.6";
  } else {
    if (verkaufspreisGroup) verkaufspreisGroup.style.opacity = "1";
    if (gewinnGroup) gewinnGroup.style.opacity = "1";
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

  document.getElementById("handel-gewinn").value = gewinn.toFixed(2);
};

// CRUD-Operationen
window.editFahrzeughandel = function (handelId) {
  showFahrzeughandelModal(handelId);
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
