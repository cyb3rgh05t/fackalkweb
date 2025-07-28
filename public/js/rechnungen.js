import {
  apiCall,
  showNotification,
  formatDate,
  formatCurrency,
} from "./utils.js";
import { addSearchToTable } from "./search.js";
import { createModal, closeModal } from "./modals.js";
import { getSetting, getSettings } from "./einstellungen.js";

// Rechnungen laden und Tabelle füllen
export async function loadRechnungen() {
  try {
    window.rechnungen = await apiCall("/api/rechnungen");
    const tableBody = document.querySelector("#rechnungen-table tbody");
    tableBody.innerHTML = window.rechnungen
      .map(
        (rechnung) => `
            <tr>
                <td>${rechnung.rechnung_nr}</td>
                <td>${rechnung.kunde_name || "-"}</td>
                <td>${rechnung.kennzeichen || ""} ${rechnung.marke || ""}</td>
                <td>${formatDate(rechnung.rechnungsdatum)}</td>
                <td>
                    <select class="status status-${
                      rechnung.status
                    }" onchange="updateRechnungStatus(${
          rechnung.id
        }, this.value)" style="background: transparent; border: none; color: inherit;">
                        <option value="offen" ${
                          rechnung.status === "offen" ? "selected" : ""
                        }>Offen</option>
                        <option value="bezahlt" ${
                          rechnung.status === "bezahlt" ? "selected" : ""
                        }>Bezahlt</option>
                        <option value="mahnung" ${
                          rechnung.status === "mahnung" ? "selected" : ""
                        }>Mahnung</option>
                        <option value="storniert" ${
                          rechnung.status === "storniert" ? "selected" : ""
                        }>Storniert</option>
                    </select>
                </td>
                <td>${formatCurrency(rechnung.gesamtbetrag)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewRechnung(${
                      rechnung.id
                    })" title="Anzeigen">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="editRechnung(${
                      rechnung.id
                    })" title="Bearbeiten">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="printRechnung(${
                      rechnung.id
                    })" title="Drucken">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteRechnung(${
                      rechnung.id
                    })" title="Löschen">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `
      )
      .join("");
    setTimeout(
      () => addSearchToTable("rechnungen-table", "rechnungen-search"),
      100
    );
  } catch (error) {
    console.error("Failed to load invoices:", error);
  }
}

// Für Inline-Events
window.editRechnung = showRechnungModal;
window.viewRechnung = viewRechnung;
window.deleteRechnung = deleteRechnung;
window.updateRechnungStatus = updateRechnungStatus;
window.printRechnung = printRechnung;

export async function showRechnungModal(rechnungId = null) {
  if (!window.kunden || window.kunden.length === 0) {
    window.kunden = await apiCall("/api/kunden");
  }
  if (!window.einstellungen) {
    await import("./einstellungen.js").then((m) => m.loadEinstellungen());
  }

  if (rechnungId) {
    loadRechnungForEdit(rechnungId);
  } else {
    displayRechnungModal(null);
  }
}

async function loadRechnungForEdit(rechnungId) {
  try {
    const rechnung = await apiCall(`/api/rechnungen/${rechnungId}`);
    displayRechnungModal(rechnung);
  } catch (error) {
    showNotification("Fehler beim Laden der Rechnung", "error");
  }
}

function displayRechnungModal(rechnung = null) {
  const isEdit = !!rechnung;
  const kundenOptions = window.kunden
    .map(
      (k) =>
        `<option value="${k.id}" ${
          k.id === rechnung?.kunden_id ? "selected" : ""
        }>${k.name}</option>`
    )
    .join("");

  // Einstellungen aus dem System holen
  const mwstSatz = parseInt(getSetting("mwst_satz", "19"));
  const basisStundenpreis = parseFloat(
    getSetting("basis_stundenpreis", "110.00")
  );

  // SKonto-Einstellungen holen
  const skontoTage = getSetting("skonto_tage", "10");
  const skontoProzent = getSetting("skonto_prozent", "2");
  const zahlungszielTage = getSetting("zahlungsziel_tage", "14");

  // Standard-Positionen
  const standardPositionen = [
    {
      kategorie: "ARBEITSZEITEN",
      beschreibung: "Vorarbeiten/Schleifen",
      einheit: "Std.",
      einzelpreis: basisStundenpreis,
      mwst: mwstSatz,
    },
    {
      kategorie: "ARBEITSZEITEN",
      beschreibung: "Grundierung",
      einheit: "Std.",
      einzelpreis: basisStundenpreis,
      mwst: mwstSatz,
    },
    {
      kategorie: "ARBEITSZEITEN",
      beschreibung: "Lackierung",
      einheit: "Std.",
      einzelpreis: basisStundenpreis,
      mwst: mwstSatz,
    },
    {
      kategorie: "ARBEITSZEITEN",
      beschreibung: "Polieren/Finish",
      einheit: "Std.",
      einzelpreis: basisStundenpreis,
      mwst: mwstSatz,
    },
    {
      kategorie: "MATERIALIEN",
      beschreibung: "Grundierung",
      einheit: "Liter",
      einzelpreis: 0,
      mwst: mwstSatz,
    },
    {
      kategorie: "MATERIALIEN",
      beschreibung: "Basislack",
      einheit: "Liter",
      einzelpreis: 0,
      mwst: mwstSatz,
    },
    {
      kategorie: "MATERIALIEN",
      beschreibung: "Klarlack",
      einheit: "Liter",
      einzelpreis: 0,
      mwst: mwstSatz,
    },
    {
      kategorie: "MATERIALIEN",
      beschreibung: "Schleifpapier/Verbrauchsmaterial",
      einheit: "Pauschal",
      einzelpreis: 0,
      mwst: mwstSatz,
    },
  ];

  // Anzahl der Positionen (Standard + zusätzliche)
  const anzahlPositionen =
    rechnung?.positionen?.length > standardPositionen.length
      ? rechnung.positionen.length
      : standardPositionen.length;

  // Mindestens 2 zusätzliche leere Positionen
  const maxPositionen = Math.max(
    anzahlPositionen + 2,
    standardPositionen.length + 2
  );

  const positionenRows = Array.from({ length: maxPositionen }, (_, index) => {
    const position = rechnung?.positionen?.[index] || {};
    const standardPos = standardPositionen[index] || {};

    return `
      <tr id="position-row-${index}">
          <td>
            <input type="text" class="form-input" 
                   value="${
                     position.beschreibung || standardPos.beschreibung || ""
                   }" 
                   name="beschreibung_${index}" 
                   placeholder="Beschreibung eingeben...">
          </td>
          <td>
            <input type="number" step="0.01" class="form-input" 
                   value="${position.menge || 0}" 
                   name="menge_${index}" 
                   onchange="calculateRechnungRow(${index})"
                   placeholder="0">
          </td>
          <td>
            <select class="form-select" name="einheit_${index}">
              <option value="Std." ${
                (position.einheit || standardPos.einheit) === "Std."
                  ? "selected"
                  : ""
              }>Std.</option>
              <option value="Liter" ${
                (position.einheit || standardPos.einheit) === "Liter"
                  ? "selected"
                  : ""
              }>Liter</option>
              <option value="Stk." ${
                (position.einheit || standardPos.einheit) === "Stk."
                  ? "selected"
                  : ""
              }>Stk.</option>
              <option value="m²" ${
                (position.einheit || standardPos.einheit) === "m²"
                  ? "selected"
                  : ""
              }>m²</option>
              <option value="Pauschal" ${
                (position.einheit || standardPos.einheit) === "Pauschal"
                  ? "selected"
                  : ""
              }>Pauschal</option>
              <option value="kg" ${
                (position.einheit || standardPos.einheit) === "kg"
                  ? "selected"
                  : ""
              }>kg</option>
            </select>
          </td>
          <td>
            <input type="number" step="0.01" class="form-input" 
                   value="${
                     position.einzelpreis || standardPos.einzelpreis || 0
                   }" 
                   name="einzelpreis_${index}" 
                   onchange="calculateRechnungRow(${index})"
                   placeholder="0,00">
          </td>
          <td>
            <select class="form-select" name="mwst_${index}" onchange="calculateRechnungRow(${index})">
              <option value="19" ${
                (position.mwst_prozent || standardPos.mwst) === 19
                  ? "selected"
                  : ""
              }>19%</option>
              <option value="7" ${
                (position.mwst_prozent || standardPos.mwst) === 7
                  ? "selected"
                  : ""
              }>7%</option>
              <option value="0" ${
                (position.mwst_prozent || standardPos.mwst) === 0
                  ? "selected"
                  : ""
              }>0%</option>
            </select>
          </td>
          <td>
            <input type="number" step="0.01" class="form-input" 
                   value="${position.gesamt || 0}" 
                   name="gesamt_${index}"
                   placeholder="0.0"
                   readonly>
          </td>
          <td>
            <button type="button" class="btn btn-sm btn-danger" 
                    onclick="removePosition(${index})" 
                    title="Position entfernen"
                    ${
                      index < standardPositionen.length
                        ? 'style="display:none"'
                        : ""
                    }>
              <i class="fas fa-times"></i>
            </button>
          </td>
          <input type="hidden" name="kategorie_${index}" value="${
      position.kategorie || standardPos.kategorie || "ZUSATZ"
    }">
      </tr>
    `;
  }).join("");

  // Zahlungsbedingungen mit SKonto erweitern
  const baseZahlungsbedingungen = getSetting("zahlungsbedingungen", "");
  const skontoText =
    skontoTage && skontoProzent
      ? `\nBei Zahlung innerhalb von ${skontoTage} Tagen ${skontoProzent}% Skonto.`
      : "";
  const zahlungsbedingungenMitSkonto = baseZahlungsbedingungen + skontoText;

  const gewaehrleistung = getSetting("gewaehrleistung", "");
  const rechnungshinweise = getSetting("rechnungshinweise", "");

  const content = `
        <form id="rechnung-form" novalidate>
  <!-- Validation Summary -->
  <div id="validation-summary" class="validation-summary" style="display: none;">
    <div class="validation-header">
      <i class="fas fa-exclamation-triangle"></i>
      Bitte korrigieren Sie folgende Fehler:
    </div>
    <ul id="validation-errors"></ul>
  </div>

  <div class="form-grid">
    <div class="form-group">
      <label class="form-label">
        Kunde 
        <span class="required-indicator">*</span>
      </label>
      <select 
        class="form-select" 
        name="kunden_id" 
        required 
        onchange="loadKundenFahrzeuge(this.value); validateRechnungKundeSelection();"
        oninvalid="this.setCustomValidity('Bitte wählen Sie einen Kunden aus')"
        oninput="this.setCustomValidity('')">
        <option value="">Kunde auswählen...</option>
        ${kundenOptions}
      </select>
      <div class="field-error" id="kunden_id-error"></div>
    </div>
    
    <div class="form-group">
      <label class="form-label">
        Fahrzeug 
        <span class="required-indicator">*</span>
      </label>
      <select 
        class="form-select" 
        name="fahrzeug_id" 
        required
        onchange="validateRechnungFahrzeugSelection();"
        oninvalid="this.setCustomValidity('Bitte wählen Sie ein Fahrzeug aus')"
        oninput="this.setCustomValidity('')"
        disabled>
        <option value="">Zuerst Kunde auswählen...</option>
      </select>
      <div class="field-error" id="fahrzeug_id-error"></div>
    </div>
    
    <div class="form-group">
      <label class="form-label">
        Rechnungsdatum 
        <span class="required-indicator">*</span>
      </label>
      <input 
        type="date" 
        class="form-input" 
        name="rechnungsdatum" 
        required
        value="${
          rechnung?.rechnungsdatum || new Date().toISOString().split("T")[0]
        }"
        onchange="validateRechnungsdatum();"
        oninvalid="this.setCustomValidity('Bitte geben Sie ein Rechnungsdatum an')"
        oninput="this.setCustomValidity('')">
      <div class="field-error" id="rechnungsdatum-error"></div>
    </div>
    
    <div class="form-group">
      <label class="form-label">Auftragsdatum</label>
      <input 
        type="date" 
        class="form-input"
        name="auftragsdatum" 
        value="${rechnung?.auftragsdatum || ""}"
        placeholder="Optional">
    </div>
    
    <div class="form-group">
      <label class="form-label">Rabatt (%)</label>
      <input 
        type="number" 
        step="0.1" 
        class="form-input" 
        name="rabatt_prozent" 
        value="${rechnung?.rabatt_prozent || 0}" 
        onchange="calculateRechnungGesamt()" 
        placeholder="0.0"
        min="0"
        max="100">
      <small class="text-muted">Rabatt in Prozent (0-100%)</small>
    </div>
    
    <div class="form-group">
      <label class="form-label">Status</label>
      <select class="form-select" name="status">
        <option value="offen" ${
          rechnung?.status === "offen" ? "selected" : ""
        }>Offen</option>
        <option value="bezahlt" ${
          rechnung?.status === "bezahlt" ? "selected" : ""
        }>Bezahlt</option>
        <option value="mahnung" ${
          rechnung?.status === "mahnung" ? "selected" : ""
        }>Mahnung</option>
        <option value="storniert" ${
          rechnung?.status === "storniert" ? "selected" : ""
        }>Storniert</option>
      </select>
    </div>
    
    <div class="form-group">
      <label class="form-label">MwSt-Satz</label>
      <input type="text" class="form-input" value="${mwstSatz}%" readonly>
      <small class="text-muted">Wird aus den Einstellungen übernommen</small>
    </div>
    
    <div class="form-group">
      <label class="form-label">Zahlungsziel</label>
      <input type="text" class="form-input" value="${zahlungszielTage} Tage" readonly>
      <small class="text-muted">Wird aus den Einstellungen übernommen</small>
    </div>
  </div>
  
  <h3 style="margin: 2rem 0 1rem 0;">Positionen</h3>
  <div class="positions-info" style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 8px;">
    <i class="fas fa-info-circle" style="color: var(--accent-primary);"></i>
    <small>Mindestens eine Position mit Beschreibung und Menge > 0 muss ausgefüllt werden</small>
  </div>
  
  <div class="table-container">
    <table class="table" id="positionen-table">
      <thead>
        <tr>
          <th>Beschreibung</th>
          <th>Menge</th>
          <th>Einheit</th>
          <th>Einzelpreis (€)</th>
          <th>MwSt %</th>
          <th>Gesamt (€)</th>
          <th>
            <button type="button" class="btn btn-sm btn-success" 
                    onclick="addNewPosition(); validatePositions();" 
                    title="Neue Position hinzufügen">
              <i class="fas fa-plus"></i>
            </button>
          </th>
        </tr>
      </thead>
      <tbody id="positionen-tbody">
        ${positionenRows}
      </tbody>
    </table>
  </div>
  
  <div style="margin-top: 2rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
      <span>Zwischensumme netto:</span>
      <span id="zwischensumme">0,00 €</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
      <span>Rabatt:</span>
      <span id="rabatt-betrag">0,00 €</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
      <span>Netto nach Rabatt:</span>
      <span id="netto-nach-rabatt">0,00 €</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
      <span>MwSt. ${mwstSatz}%:</span>
      <span id="mwst-gesamt">0,00 €</span>
    </div>
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
      <span>GESAMTBETRAG:</span>
      <span id="gesamtbetrag">0,00 €</span>
    </div>
  </div>

  <h3 style="margin: 2rem 0 1rem 0;">Zahlungsbedingungen & Hinweise</h3>
  <div class="form-grid">
    <div class="form-group">
      <label class="form-label">Zahlungsbedingungen</label>
      <textarea 
        class="form-textarea" 
        name="zahlungsbedingungen" 
        rows="4"
        placeholder="Zahlungsbedingungen für diese Rechnung...">${zahlungsbedingungenMitSkonto}</textarea>
      <small class="text-muted">Inkl. SKonto: ${skontoProzent}% bei Zahlung innerhalb ${skontoTage} Tagen</small>
    </div>
    
    <div class="form-group">
      <label class="form-label">Gewährleistung</label>
      <textarea 
        class="form-textarea" 
        name="gewaehrleistung" 
        rows="2"
        placeholder="Gewährleistungsbestimmungen...">${gewaehrleistung}</textarea>
    </div>
    
    <div class="form-group">
      <label class="form-label">Rechnungshinweise</label>
      <textarea 
        class="form-textarea" 
        name="rechnungshinweise" 
        rows="3"
        placeholder="Zusätzliche Hinweise für diese Rechnung...">${rechnungshinweise}</textarea>
      <small class="text-muted">Zusätzliche Hinweise für diese Rechnung</small>
    </div>
  </div>

  <style>
  /* VALIDIERUNGS-STYLES für Rechnungen */
  .required-indicator {
    color: #ef4444;
    font-weight: bold;
  }

  .field-error {
    color: #ef4444;
    font-size: 0.875rem;
    margin-top: 0.25rem;
    display: none;
  }

  .field-error.show {
    display: block;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .validation-summary {
    background: linear-gradient(135deg, 
      rgba(239, 68, 68, 0.1) 0%, 
      rgba(239, 68, 68, 0.05) 100%);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    animation: shake 0.5s ease-in-out;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }

  .validation-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #ef4444;
    margin-bottom: 0.5rem;
  }

  .validation-summary ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #ef4444;
  }

  .validation-summary li {
    margin-bottom: 0.25rem;
  }

  /* VERBESSERTE FORM-STYLES */
  .form-select:invalid,
  .form-input:invalid {
    border-color: #ef4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
  }

  .form-select:valid,
  .form-input:valid {
    border-color: #10b981;
  }

  .form-select:disabled {
    background-color: var(--clr-surface-a10);
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* LOADING BUTTON STYLES */
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn .fa-spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* FOCUS IMPROVEMENTS */
  .form-select:focus,
  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px rgba(175, 234, 180, 0.2);
  }

  /* PLACEHOLDER IMPROVEMENTS */
  .form-input::placeholder,
  .form-textarea::placeholder {
    color: var(--text-muted);
    opacity: 0.7;
  }

  /* POSITIONS INFO STYLING */
  .positions-info {
    border-left: 4px solid var(--accent-primary);
  }

  /* SUCCESS STATES */
  .form-input:valid:not(:placeholder-shown),
  .form-select:valid:not([value=""]) {
    border-color: #10b981;
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
  }

  /* ENHANCED TABLE STYLING */
  .table-container {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-color);
  }

  .table th {
    background: var(--bg-secondary);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  /* MOBILE RESPONSIVE */
  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
    
    .validation-summary {
      margin: 0.5rem 0;
      padding: 0.75rem;
    }
    
    .positions-info {
      padding: 0.5rem;
      font-size: 0.875rem;
    }
  }
  </style>
</form>
    `;

  const footer = `
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
        <button type="button" class="btn btn-primary" onclick="saveRechnung(${
          rechnung?.id || null
        })">
            <i class="fas fa-save"></i> ${
              isEdit ? "Aktualisieren" : "Erstellen"
            }
        </button>
    `;

  createModal(
    isEdit ? "Rechnung bearbeiten" : "Neue Rechnung",
    content,
    footer
  );

  if (rechnung?.kunden_id) {
    loadKundenFahrzeuge(rechnung.kunden_id, rechnung.fahrzeug_id);
  }

  setTimeout(() => {
    for (let i = 0; i < maxPositionen; i++) {
      calculateRechnungRow(i);
    }
  }, 100);
}

window.addNewPosition = function () {
  // AUTOMATISCHE ERKENNUNG: Auftrags- oder Rechnungsmodal?
  let tbody = document.getElementById("arbeitszeiten-tbody"); // Auftragsmodal
  let isAuftragModal = true;

  if (!tbody) {
    tbody = document.getElementById("positionen-tbody"); // Rechnungsmodal
    isAuftragModal = false;
  }

  if (!tbody) {
    console.error("Keine Tabelle gefunden!");
    showNotification("Fehler: Tabelle nicht gefunden", "error");
    return;
  }

  const currentRows = tbody.children.length;
  const newIndex = currentRows;

  if (isAuftragModal) {
    // AUFTRAGSMODAL: Arbeitszeiten hinzufügen
    const basisStundenpreis = parseFloat(
      getSetting("basis_stundenpreis", "110.00")
    );

    const newRow = document.createElement("tr");
    newRow.id = `position-row-${newIndex}`;
    newRow.innerHTML = `
      <td>
        <input type="text" class="form-input" 
               name="beschreibung_${newIndex}" 
               placeholder="Arbeitsschritt...">
      </td>
      <td>
        <input type="number" step="0.01" class="form-input" 
               value="${basisStundenpreis}" 
               name="stundenpreis_${newIndex}" 
               onchange="calculateAuftragRow(${newIndex})"
               placeholder="${basisStundenpreis}">
      </td>
      <td>
        <input type="number" step="0.1" class="form-input" 
               name="zeit_${newIndex}" 
               onchange="calculateAuftragRow(${newIndex})"
               placeholder="0.0">
      </td>
      <td>
        <select class="form-select" name="einheit_${newIndex}">
          <option value="Std." selected>Std.</option>
          <option value="Min.">Min.</option>
          <option value="Pauschal">Pauschal</option>
        </select>
      </td>
      <td>
        <input type="number" step="0.01" class="form-input" 
               name="gesamt_${newIndex}" 
               readonly
               placeholder="0,00">
      </td>
      <td>
        <button type="button" class="btn btn-sm btn-danger" 
                onclick="removePosition(${newIndex})" 
                title="Position entfernen">
          <i class="fas fa-times"></i>
        </button>
      </td>
    `;

    tbody.appendChild(newRow);

    // Fokus auf Beschreibung
    const beschreibungInput = newRow.querySelector(
      `input[name="beschreibung_${newIndex}"]`
    );
    if (beschreibungInput) {
      beschreibungInput.focus();
    }

    console.log(`✅ Neue Arbeitszeit-Position ${newIndex} hinzugefügt`);
  } else {
    // RECHNUNGSMODAL: Rechnungsposition hinzufügen
    const newRow = document.createElement("tr");
    newRow.id = `position-row-${newIndex}`;
    newRow.innerHTML = `
      <td>
        <input type="text" class="form-input" 
               name="beschreibung_${newIndex}" 
               placeholder="Beschreibung eingeben...">
      </td>
      <td>
        <input type="number" step="0.01" class="form-input" 
               value="0" 
               name="menge_${newIndex}" 
               onchange="calculateRechnungRow(${newIndex})"
               placeholder="0">
      </td>
      <td>
        <select class="form-select" name="einheit_${newIndex}">
          <option value="Std.">Std.</option>
          <option value="Liter">Liter</option>
          <option value="Stk." selected>Stk.</option>
          <option value="m²">m²</option>
          <option value="Pauschal">Pauschal</option>
          <option value="kg">kg</option>
        </select>
      </td>
      <td>
        <input type="number" step="0.01" class="form-input" 
               value="0" 
               name="einzelpreis_${newIndex}" 
               onchange="calculateRechnungRow(${newIndex})"
               placeholder="0,00">
      </td>
      <td>
        <select class="form-select" name="mwst_${newIndex}" onchange="calculateRechnungRow(${newIndex})">
          <option value="19" selected>19%</option>
          <option value="7">7%</option>
          <option value="0">0%</option>
        </select>
      </td>
      <td>
        <input type="number" step="0.01" class="form-input" 
               value="0" 
               name="gesamt_${newIndex}"
               readonly>
      </td>
      <td>
        <button type="button" class="btn btn-sm btn-danger" 
                onclick="removePosition(${newIndex})" 
                title="Position entfernen">
          <i class="fas fa-times"></i>
        </button>
      </td>
      <input type="hidden" name="kategorie_${newIndex}" value="ZUSATZ">
    `;

    tbody.appendChild(newRow);

    // Fokus auf Beschreibung
    const beschreibungInput = newRow.querySelector(
      `input[name="beschreibung_${newIndex}"]`
    );
    if (beschreibungInput) {
      beschreibungInput.focus();
    }

    console.log(`✅ Neue Rechnungs-Position ${newIndex} hinzugefügt`);
  }
};

// 3. POSITION ENTFERNEN
window.removePosition = function (index) {
  const row = document.getElementById(`position-row-${index}`);
  if (row) {
    row.remove();

    // Je nach Modal die richtige Berechnungsfunktion aufrufen
    if (document.getElementById("arbeitszeiten-tbody")) {
      // Auftragsmodal
      if (typeof updateAuftragCalculations === "function") {
        updateAuftragCalculations();
      }
    } else {
      // Rechnungsmodal
      if (typeof calculateRechnungGesamt === "function") {
        calculateRechnungGesamt();
      }
    }

    console.log(`✅ Position ${index} entfernt`);
  } else {
    console.warn(`Position ${index} nicht gefunden`);
  }
};

window.loadKundenFahrzeuge = async function (
  kundenId,
  selectedFahrzeugId = null
) {
  if (!kundenId) return;
  try {
    const kundenFahrzeuge = await apiCall(
      `/api/fahrzeuge?kunden_id=${kundenId}`
    );
    const select = document.querySelector('[name="fahrzeug_id"]');
    select.innerHTML =
      '<option value="">Fahrzeug auswählen</option>' +
      kundenFahrzeuge
        .map(
          (f) =>
            `<option value="${f.id}" ${
              f.id == selectedFahrzeugId ? "selected" : ""
            }>${f.kennzeichen} - ${f.marke} ${f.modell}</option>`
        )
        .join("");
  } catch (error) {
    console.error("Failed to load customer vehicles:", error);
  }
};

window.calculateRechnungRow = function (index) {
  const mengeInput = document.querySelector(`input[name="menge_${index}"]`);
  const einzelpreisInput = document.querySelector(
    `input[name="einzelpreis_${index}"]`
  );
  const gesamtInput = document.querySelector(`input[name="gesamt_${index}"]`);

  if (!mengeInput || !einzelpreisInput || !gesamtInput) return;

  const menge = parseFloat(mengeInput.value) || 0;
  const einzelpreis = parseFloat(einzelpreisInput.value) || 0;
  const gesamt = menge * einzelpreis;

  gesamtInput.value = gesamt.toFixed(2);

  calculateRechnungGesamt();
};

window.calculateRechnungTotal = function () {
  let zwischensumme = 0;
  const mwstSatz = parseInt(getSetting("mwst_satz", "19"));

  for (let i = 0; i < 8; i++) {
    const gesamtInput = document.querySelector(`[name="gesamt_${i}"]`);
    if (gesamtInput) {
      const gesamt = parseFloat(gesamtInput.value) || 0;
      zwischensumme += gesamt;
    }
  }

  const rabattProzent =
    parseFloat(document.querySelector('[name="rabatt_prozent"]')?.value) || 0;
  const rabattBetrag = zwischensumme * (rabattProzent / 100);
  const nettoNachRabatt = zwischensumme - rabattBetrag;
  const mwstBetrag = nettoNachRabatt * (mwstSatz / 100);
  const gesamtbetrag = nettoNachRabatt + mwstBetrag;

  const elements = {
    zwischensumme: document.getElementById("zwischensumme"),
    "rabatt-betrag": document.getElementById("rabatt-betrag"),
    "netto-nach-rabatt": document.getElementById("netto-nach-rabatt"),
    "mwst-gesamt": document.getElementById("mwst-gesamt"),
    gesamtbetrag: document.getElementById("gesamtbetrag"),
  };

  if (elements.zwischensumme)
    elements.zwischensumme.textContent = formatCurrency(zwischensumme);
  if (elements["rabatt-betrag"])
    elements["rabatt-betrag"].textContent = formatCurrency(rabattBetrag);
  if (elements["netto-nach-rabatt"])
    elements["netto-nach-rabatt"].textContent = formatCurrency(nettoNachRabatt);
  if (elements["mwst-gesamt"])
    elements["mwst-gesamt"].textContent = formatCurrency(mwstBetrag);
  if (elements.gesamtbetrag)
    elements.gesamtbetrag.textContent = formatCurrency(gesamtbetrag);
};

window.calculateRechnungGesamt = function () {
  let zwischensumme = 0;
  let mwst19Basis = 0;
  let mwst7Basis = 0;

  // Alle Positionen durchlaufen
  const tbody = document.getElementById("positionen-tbody");
  if (!tbody) return;

  Array.from(tbody.children).forEach((row, index) => {
    const gesamtInput = row.querySelector(`input[name="gesamt_${index}"]`);
    const mwstSelect = row.querySelector(`select[name="mwst_${index}"]`);

    if (gesamtInput && mwstSelect) {
      const gesamt = parseFloat(gesamtInput.value) || 0;
      const mwstSatz = parseInt(mwstSelect.value) || 0;

      zwischensumme += gesamt;

      if (mwstSatz === 19) {
        mwst19Basis += gesamt;
      } else if (mwstSatz === 7) {
        mwst7Basis += gesamt;
      }
    }
  });

  // Rabatt berechnen
  const rabattInput = document.querySelector('input[name="rabatt_prozent"]');
  const rabattProzent = rabattInput ? parseFloat(rabattInput.value) || 0 : 0;
  const rabattBetrag = zwischensumme * (rabattProzent / 100);
  const nettoNachRabatt = zwischensumme - rabattBetrag;

  // MwSt berechnen
  const mwst19 = mwst19Basis * (1 - rabattProzent / 100) * 0.19;
  const mwst7 = mwst7Basis * (1 - rabattProzent / 100) * 0.07;
  const mwstGesamt = mwst19 + mwst7;

  const gesamtbetrag = nettoNachRabatt + mwstGesamt;

  // Anzeige aktualisieren
  updateElement("zwischensumme", formatCurrency(zwischensumme));
  updateElement("rabatt-betrag", formatCurrency(rabattBetrag));
  updateElement("netto-nach-rabatt", formatCurrency(nettoNachRabatt));
  updateElement("mwst-gesamt", formatCurrency(mwstGesamt));
  updateElement("gesamtbetrag", formatCurrency(gesamtbetrag));
};

// 5. HILFSFUNKTIONEN
function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

// 6. ERWEITERTE SAVE-FUNKTION MIT RECHNUNGSHINWEISEN
window.saveRechnung = async function (rechnungId = null) {
  console.log("💾 Speichere Rechnung...");

  // 1. FORM-ELEMENT HOLEN
  const form = document.getElementById("rechnung-form");
  if (!form) {
    showNotification("Fehler: Formular nicht gefunden", "error");
    return;
  }

  // 2. HTML5-VALIDIERUNG PRÜFEN
  if (!form.checkValidity()) {
    console.warn("❌ HTML5-Validierung fehlgeschlagen");

    // Zeige Fehlermeldungen an
    const firstInvalidElement = form.querySelector(":invalid");
    if (firstInvalidElement) {
      firstInvalidElement.focus();
      firstInvalidElement.reportValidity();
    }

    showNotification("Bitte füllen Sie alle Pflichtfelder aus", "error");
    return;
  }

  // 3. FORMDATA SAMMELN
  const formData = new FormData(form);

  // 4. MANUELLE VALIDIERUNG (zusätzlich zur HTML5-Validierung)
  const kundenId = parseInt(formData.get("kunden_id"));
  const fahrzeugId = parseInt(formData.get("fahrzeug_id"));
  const rechnungsdatum = formData.get("rechnungsdatum");

  // Validierungsfehler sammeln
  const errors = [];

  if (!kundenId || kundenId <= 0) {
    errors.push("Kunde muss ausgewählt werden");
    markFieldAsError("kunden_id", "Kunde muss ausgewählt werden");
  }

  if (!fahrzeugId || fahrzeugId <= 0) {
    errors.push("Fahrzeug muss ausgewählt werden");
    markFieldAsError("fahrzeug_id", "Fahrzeug muss ausgewählt werden");
  }

  if (!rechnungsdatum || rechnungsdatum.trim() === "") {
    errors.push("Rechnungsdatum muss angegeben werden");
    markFieldAsError("rechnungsdatum", "Rechnungsdatum muss angegeben werden");
  }

  // 5. POSITIONEN VALIDIERUNG UND SAMMLUNG
  const positionen = [];
  const tbody = document.getElementById("positionen-tbody");
  let hasValidPositions = false;

  if (tbody) {
    Array.from(tbody.children).forEach((row, i) => {
      const beschreibung = row
        .querySelector(`input[name="beschreibung_${i}"]`)
        ?.value?.trim();
      const menge =
        parseFloat(row.querySelector(`input[name="menge_${i}"]`)?.value) || 0;
      const einzelpreis =
        parseFloat(
          row.querySelector(`input[name="einzelpreis_${i}"]`)?.value
        ) || 0;
      const gesamt =
        parseFloat(row.querySelector(`input[name="gesamt_${i}"]`)?.value) || 0;

      if (beschreibung && (menge > 0 || gesamt > 0)) {
        positionen.push({
          kategorie:
            row.querySelector(`input[name="kategorie_${i}"]`)?.value ||
            "ZUSATZ",
          beschreibung,
          menge,
          einheit:
            row.querySelector(`select[name="einheit_${i}"]`)?.value || "Stk.",
          einzelpreis,
          mwst_prozent:
            parseInt(row.querySelector(`select[name="mwst_${i}"]`)?.value) ||
            19,
          gesamt,
        });
        hasValidPositions = true;
      }
    });
  }

  if (!hasValidPositions) {
    errors.push("Mindestens eine Rechnungsposition muss ausgefüllt werden");
  }

  // 6. FEHLER ANZEIGEN FALLS VORHANDEN
  if (errors.length > 0) {
    console.error("❌ Validierungsfehler:", errors);

    // Validation Summary anzeigen
    showValidationSummary(errors);

    showNotification(`Validierungsfehler:\n• ${errors.join("\n• ")}`, "error");
    return;
  }

  // 7. DATEN-OBJEKT ERSTELLEN
  const data = {
    kunden_id: kundenId,
    fahrzeug_id: fahrzeugId,
    rechnungsdatum,
    auftragsdatum: formData.get("auftragsdatum") || null,
    rabatt_prozent: parseFloat(formData.get("rabatt_prozent")) || 0,
    status: formData.get("status") || "offen",
    zahlungsbedingungen: formData.get("zahlungsbedingungen")?.trim() || "",
    gewaehrleistung: formData.get("gewaehrleistung")?.trim() || "",
    rechnungshinweise: formData.get("rechnungshinweise")?.trim() || "",
    positionen,
  };

  console.log("📋 Rechnungsdaten:", data);

  // 8. SPEICHERN MIT LOADING-INDIKATOR
  try {
    // Loading-Zustand anzeigen
    const saveButton = document.querySelector(
      'button[onclick*="saveRechnung"]'
    );
    const originalText = saveButton?.textContent;
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Speichert...';
    }

    if (rechnungId) {
      console.log(`📝 Aktualisiere Rechnung ${rechnungId}`);
      await apiCall(`/api/rechnungen/${rechnungId}`, "PUT", data);
      showNotification("Rechnung erfolgreich aktualisiert", "success");
    } else {
      console.log("➕ Erstelle neue Rechnung");
      const result = await apiCall("/api/rechnungen", "POST", data);
      console.log("✅ Rechnung erstellt:", result);
      showNotification("Rechnung erfolgreich erstellt", "success");
    }

    closeModal();
    loadRechnungen();
  } catch (error) {
    console.error("❌ Speicherfehler:", error);
    showNotification(
      `Fehler beim Speichern: ${error.message || "Unbekannter Fehler"}`,
      "error"
    );
  } finally {
    // Loading-Zustand zurücksetzen
    const saveButton = document.querySelector(
      'button[onclick*="saveRechnung"]'
    );
    if (saveButton && originalText) {
      saveButton.disabled = false;
      saveButton.textContent = originalText;
    }
  }
};

// VALIDIERUNGS-HILFSFUNKTIONEN für Rechnungen

// Feld als fehlerhaft markieren
function markFieldAsError(fieldName, message) {
  const field = document.querySelector(`[name="${fieldName}"]`);
  if (field) {
    field.style.borderColor = "#ef4444";
    field.style.boxShadow = "0 0 0 2px rgba(239, 68, 68, 0.2)";

    // Tooltip mit Fehlermeldung
    field.title = message;

    // Fehler-Element anzeigen falls vorhanden
    const errorDiv = document.getElementById(`${fieldName}-error`);
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.classList.add("show");
    }

    // Nach 5 Sekunden zurücksetzen
    setTimeout(() => {
      field.style.borderColor = "";
      field.style.boxShadow = "";
      field.title = "";
      if (errorDiv) {
        errorDiv.classList.remove("show");
      }
    }, 5000);
  }
}

// Validation Summary anzeigen
function showValidationSummary(errors) {
  let summaryDiv = document.getElementById("validation-summary");

  if (!summaryDiv) {
    // Summary-Div erstellen falls nicht vorhanden
    summaryDiv = document.createElement("div");
    summaryDiv.id = "validation-summary";
    summaryDiv.className = "validation-summary";

    const form = document.getElementById("rechnung-form");
    if (form && form.firstChild) {
      form.insertBefore(summaryDiv, form.firstChild);
    }
  }

  summaryDiv.innerHTML = `
    <div class="validation-header">
      <i class="fas fa-exclamation-triangle"></i>
      Bitte korrigieren Sie folgende Fehler:
    </div>
    <ul id="validation-errors">
      ${errors.map((error) => `<li>${error}</li>`).join("")}
    </ul>
  `;

  summaryDiv.style.display = "block";

  // Nach 10 Sekunden ausblenden
  setTimeout(() => {
    summaryDiv.style.display = "none";
  }, 10000);
}

// Echtzeit-Validierung für Kunde-Auswahl
window.validateRechnungKundeSelection = function () {
  const kundenSelect = document.querySelector('[name="kunden_id"]');
  const fahrzeugSelect = document.querySelector('[name="fahrzeug_id"]');

  if (kundenSelect && kundenSelect.value) {
    kundenSelect.style.borderColor = "#10b981";

    // Fehler-Element verstecken
    const errorDiv = document.getElementById("kunden_id-error");
    if (errorDiv) {
      errorDiv.classList.remove("show");
    }

    // Fahrzeug-Select aktivieren
    if (fahrzeugSelect) {
      fahrzeugSelect.disabled = false;
      fahrzeugSelect.innerHTML =
        '<option value="">Fahrzeug auswählen...</option>';
    }
  } else {
    markFieldAsError("kunden_id", "Kunde muss ausgewählt werden");

    // Fahrzeug-Select deaktivieren
    if (fahrzeugSelect) {
      fahrzeugSelect.disabled = true;
      fahrzeugSelect.innerHTML =
        '<option value="">Zuerst Kunde auswählen...</option>';
      fahrzeugSelect.value = "";
    }
  }
};

// Echtzeit-Validierung für Fahrzeug-Auswahl
window.validateRechnungFahrzeugSelection = function () {
  const fahrzeugSelect = document.querySelector('[name="fahrzeug_id"]');

  if (fahrzeugSelect && fahrzeugSelect.value) {
    fahrzeugSelect.style.borderColor = "#10b981";

    // Fehler-Element verstecken
    const errorDiv = document.getElementById("fahrzeug_id-error");
    if (errorDiv) {
      errorDiv.classList.remove("show");
    }
  } else {
    markFieldAsError("fahrzeug_id", "Fahrzeug muss ausgewählt werden");
  }
};

// Echtzeit-Validierung für Rechnungsdatum
window.validateRechnungsdatum = function () {
  const datumInput = document.querySelector('[name="rechnungsdatum"]');

  if (datumInput && datumInput.value) {
    datumInput.style.borderColor = "#10b981";

    // Fehler-Element verstecken
    const errorDiv = document.getElementById("rechnungsdatum-error");
    if (errorDiv) {
      errorDiv.classList.remove("show");
    }
  } else {
    markFieldAsError("rechnungsdatum", "Rechnungsdatum muss angegeben werden");
  }
};

// ERWEITERTE KUNDENFUNKTION mit Validierung für Rechnungen
window.loadKundenFahrzeuge = async function (
  kundenId,
  selectedFahrzeugId = null
) {
  console.log(`🚗 Lade Fahrzeuge für Kunde ${kundenId}`);

  // Validierung
  validateRechnungKundeSelection();

  if (!kundenId) {
    console.warn("Keine Kunden-ID angegeben");
    return;
  }

  try {
    const fahrzeuge = await apiCall(`/api/fahrzeuge?kunden_id=${kundenId}`);
    const fahrzeugSelect = document.querySelector('[name="fahrzeug_id"]');

    if (!fahrzeugSelect) {
      console.error("Fahrzeug-Select nicht gefunden");
      return;
    }

    if (fahrzeuge.length === 0) {
      fahrzeugSelect.innerHTML =
        '<option value="">Keine Fahrzeuge für diesen Kunden</option>';
      fahrzeugSelect.disabled = true;
      return;
    }

    fahrzeugSelect.disabled = false;
    fahrzeugSelect.innerHTML = `
      <option value="">Fahrzeug auswählen...</option>
      ${fahrzeuge
        .map(
          (f) =>
            `<option value="${f.id}" ${
              f.id == selectedFahrzeugId ? "selected" : ""
            }>
          ${f.kennzeichen} - ${f.marke} ${f.modell}
        </option>`
        )
        .join("")}
    `;

    console.log(`✅ ${fahrzeuge.length} Fahrzeuge geladen`);

    // Validierung nach dem Laden
    if (selectedFahrzeugId) {
      validateRechnungFahrzeugSelection();
    }
  } catch (error) {
    console.error("❌ Fehler beim Laden der Fahrzeuge:", error);
    showNotification("Fehler beim Laden der Fahrzeuge", "error");
  }
};

// ERWEITERTE POSITIONSVALIDIERUNG
window.validatePositions = function () {
  const tbody = document.getElementById("positionen-tbody");
  if (!tbody) return true;

  let hasValidPositions = false;

  Array.from(tbody.children).forEach((row, i) => {
    const beschreibung = row
      .querySelector(`input[name="beschreibung_${i}"]`)
      ?.value?.trim();
    const menge =
      parseFloat(row.querySelector(`input[name="menge_${i}"]`)?.value) || 0;
    const gesamt =
      parseFloat(row.querySelector(`input[name="gesamt_${i}"]`)?.value) || 0;

    if (beschreibung && (menge > 0 || gesamt > 0)) {
      hasValidPositions = true;
    }
  });

  if (!hasValidPositions) {
    showNotification(
      "Mindestens eine Rechnungsposition muss ausgefüllt werden",
      "warning"
    );

    // Erste Beschreibung fokussieren
    const firstBeschreibung = tbody.querySelector(
      'input[name^="beschreibung_"]'
    );
    if (firstBeschreibung) {
      firstBeschreibung.focus();
      firstBeschreibung.style.borderColor = "#f59e0b";
      setTimeout(() => (firstBeschreibung.style.borderColor = ""), 3000);
    }
  }

  return hasValidPositions;
};

console.log("✅ Erweiterte Rechnungs-Validierung geladen");

async function deleteRechnung(id) {
  try {
    // Versuche Rechnung-Details zu laden für bessere Bestätigung
    let rechnung = null;
    try {
      rechnung = await apiCall(`/api/rechnungen/${id}`);

      // Debug: Zeige verfügbare Felder in der Konsole
      console.log("🔍 Rechnung-Daten für Dialog:", rechnung);
      console.log("📋 Verfügbare Felder:", Object.keys(rechnung));
    } catch (loadError) {
      console.warn("Rechnung-Details konnten nicht geladen werden:", loadError);
    }

    // Bestätigungs-Dialog erstellen
    let confirmMessage;
    let dialogTitle;

    if (rechnung) {
      // Mit Rechnung-Details - Verschiedene mögliche Feldnamen prüfen
      const möglicheBetragFelder = [
        "gesamt_betrag",
        "betrag",
        "total",
        "amount",
        "gesamtbetrag",
        "summe",
        "brutto",
        "netto",
      ];
      let betragWert = null;

      for (const feld of möglicheBetragFelder) {
        if (rechnung[feld] !== undefined && rechnung[feld] !== null) {
          betragWert = rechnung[feld];
          break;
        }
      }

      const betrag = betragWert
        ? `€ ${parseFloat(betragWert).toFixed(2)}`
        : "Betrag unbekannt";

      // Status mit verschiedenen möglichen Feldnamen
      const möglicheStatusFelder = [
        "status",
        "state",
        "zustand",
        "rechnungsstatus",
      ];
      let statusWert = "Status unbekannt";

      for (const feld of möglicheStatusFelder) {
        if (rechnung[feld]) {
          statusWert = rechnung[feld];
          break;
        }
      }

      const istBezahlt =
        statusWert.toLowerCase().includes("bezahlt") ||
        statusWert.toLowerCase().includes("paid") ||
        statusWert.toLowerCase().includes("completed") ||
        statusWert.toLowerCase().includes("erledigt");

      // Datum mit verschiedenen möglichen Feldnamen
      const möglicheDatumFelder = [
        "datum",
        "created_at",
        "erstellt_am",
        "date",
        "rechnungsdatum",
        "erstellungsdatum",
        "timestamp",
      ];
      let datumWert = null;

      for (const feld of möglicheDatumFelder) {
        if (rechnung[feld]) {
          datumWert = rechnung[feld];
          break;
        }
      }

      const datum = datumWert
        ? new Date(datumWert).toLocaleDateString("de-DE")
        : "Datum unbekannt";

      // Rechnungsnummer mit verschiedenen möglichen Feldnamen
      const möglicheNummerFelder = [
        "nummer",
        "number",
        "rechnungsnummer",
        "invoice_number",
        "id",
      ];
      let nummerWert = id; // Fallback zur ID

      for (const feld of möglicheNummerFelder) {
        if (rechnung[feld]) {
          nummerWert = rechnung[feld];
          break;
        }
      }

      // Kundenname mit verschiedenen möglichen Feldnamen
      const möglicheKundenFelder = [
        "kunde_name",
        "customer_name",
        "kundenname",
        "name",
        "kunde",
      ];
      let kundenname = "Kunde unbekannt";

      for (const feld of möglicheKundenFelder) {
        if (rechnung[feld]) {
          kundenname = rechnung[feld];
          break;
        }
      }

      confirmMessage = `🧾 RECHNUNG LÖSCHEN

Rechnung-Details:
• Rechnung-Nr: ${nummerWert}
• Betrag: ${betrag}
• Kunde: ${kundenname}
• Datum: ${datum}
• Status: ${statusWert}`;

      // Spezielle Warnung je nach Status
      if (istBezahlt) {
        confirmMessage += `\n\n🚨 ACHTUNG: BEZAHLTE RECHNUNG!

Diese Rechnung wurde bereits bezahlt!
• Buchhaltungsrelevante Daten gehen verloren
• Steuerliche Dokumentation wird gelöscht
• Zahlungshistorie geht verloren
• Kann Probleme bei Steuerprüfung verursachen`;
        dialogTitle = "🚨 Bezahlte Rechnung löschen";
      } else {
        confirmMessage += `\n\n⚠️ BUCHHALTUNGS-WARNUNG:

• Rechnungsdaten gehen verloren
• Auftragszuordnung wird entfernt
• Steuerliche Dokumentation wird gelöscht`;
        dialogTitle = "🧾 Rechnung löschen";
      }

      confirmMessage += `\n\n🔥 DIESE AKTION KANN NICHT RÜCKGÄNGIG GEMACHT WERDEN!

Für die Buchhaltung sollten Rechnungen normalerweise storniert statt gelöscht werden.

Trotzdem löschen?`;
    } else {
      // Ohne Details (Fallback)
      confirmMessage = `Rechnung (ID: ${id}) wirklich löschen?

⚠️ BUCHHALTUNGS-WARNUNG:
• Rechnungsdaten gehen unwiderruflich verloren
• Steuerliche Dokumentation wird gelöscht
• Kann Probleme bei Buchprüfung verursachen

Diese Aktion kann nicht rückgängig gemacht werden.

Normalerweise sollten Rechnungen storniert statt gelöscht werden.`;
      dialogTitle = "🧾 Rechnung löschen";
    }

    const confirmed = await customConfirm(confirmMessage, dialogTitle);

    if (confirmed) {
      // Bei bezahlten Rechnungen zusätzliche Bestätigung
      if (
        rechnung &&
        statusWert &&
        statusWert.toLowerCase().includes("bezahlt")
      ) {
        const betragText = betragWert
          ? `€ ${parseFloat(betragWert).toFixed(2)}`
          : "Unbekannter Betrag";

        const secondConfirm = await customConfirm(
          `Letzte Warnung für bezahlte Rechnung!

Rechnung: ${nummerWert || id}
Betrag: ${betragText}

Das Löschen einer bezahlten Rechnung kann:
• Steuerliche Probleme verursachen
• Buchhaltung durcheinanderbringen
• Bei Prüfungen Schwierigkeiten bereiten

Sind Sie sich absolut sicher?`,
          "🚨 Finale Warnung"
        );

        if (!secondConfirm) {
          await customAlert(
            "Löschung abgebrochen.\n\nÜberlegen Sie eine Stornierung statt Löschung.",
            "info",
            "Abgebrochen"
          );
          return;
        }
      }

      // Loading-Notification während Löschung
      if (typeof showNotification === "function") {
        showNotification("Rechnung wird gelöscht...", "info");
      }

      await apiCall(`/api/rechnungen/${id}`, "DELETE");

      // Erfolgs-Dialog
      const erfolgsBetrag = betragWert
        ? `\nBetrag: € ${parseFloat(betragWert).toFixed(2)}`
        : "";

      await customAlert(
        `Rechnung erfolgreich gelöscht!${
          nummerWert && nummerWert !== id
            ? `\n\nRechnung-Nr: ${nummerWert}`
            : ""
        }${erfolgsBetrag}

⚠️ Hinweis: Stellen Sie sicher, dass diese Löschung in Ihrer Buchhaltung vermerkt wird.`,
        "success",
        "Rechnung gelöscht"
      );

      if (typeof showNotification === "function") {
        showNotification("Rechnung erfolgreich gelöscht", "success");
      }

      loadRechnungen();
    }
  } catch (error) {
    console.error("Fehler beim Löschen der Rechnung:", error);

    // Fehler-Dialog mit Details
    await customAlert(
      `Fehler beim Löschen der Rechnung:

${error.message || "Unbekannter Fehler"}

Mögliche Ursachen:
• Netzwerk-Problem
• Server-Fehler
• Rechnung ist mit Zahlungen verknüpft
• Buchhaltungssystem verhindert Löschung
• Unzureichende Berechtigung
• Rechnung bereits storniert/gelöscht

WICHTIG: Die Rechnung wurde möglicherweise NICHT gelöscht.
Prüfen Sie den Status und versuchen Sie es erneut.

Bei Problemen mit Buchhaltungsdaten kontaktieren Sie den Support.`,
      "error",
      "Löschung fehlgeschlagen"
    );

    if (typeof showNotification === "function") {
      showNotification("Fehler beim Löschen der Rechnung", "error");
    }
  }
}

async function updateRechnungStatus(id, status) {
  try {
    const rechnung = await apiCall(`/api/rechnungen/${id}`);
    rechnung.status = status;
    await apiCall(`/api/rechnungen/${id}`, "PUT", rechnung);
    showNotification("Status erfolgreich aktualisiert", "success");
    loadRechnungen();
  } catch (error) {
    showNotification("Fehler beim Aktualisieren des Status", "error");
    loadRechnungen();
  }
}

async function viewRechnung(id) {
  try {
    const rechnung = await apiCall(`/api/rechnungen/${id}`);
    const settings = getSettings();

    // Firmendaten aus Einstellungen
    const firmenname = getSetting("firmenname", "Meine Firma");
    const firmenStrasse = getSetting("firmen_strasse", "");
    const firmenPlz = getSetting("firmen_plz", "");
    const firmenOrt = getSetting("firmen_ort", "");
    const firmenTelefon = getSetting("firmen_telefon", "");
    const firmenEmail = getSetting("firmen_email", "");
    const steuernummer = getSetting("steuernummer", "");
    const umsatzsteuerId = getSetting("umsatzsteuer_id", "");
    const bankName = getSetting("bank_name", "");
    const bankIban = getSetting("iban", "");
    const bankBic = getSetting("bic", "");

    const positionenHtml =
      rechnung.positionen
        ?.map(
          (pos) => `
      <tr>
        <td>${pos.beschreibung}</td>
        <td>${pos.menge} ${pos.einheit}</td>
        <td>${formatCurrency(pos.einzelpreis)}</td>
        <td>${pos.mwst_prozent}%</td>
        <td>${formatCurrency(pos.gesamt)}</td>
      </tr>
    `
        )
        .join("") || '<tr><td colspan="5">Keine Positionen</td></tr>';

    const content = `
      <!-- Firmen-Header -->
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid var(--accent-primary);">
        <div>
          <h1 style="color: var(--accent-primary); margin-bottom: 0.5rem;">${firmenname}</h1>
          <div style="color: var(--text-secondary); line-height: 1.4;">
            ${firmenStrasse}<br>
            ${firmenPlz} ${firmenOrt}<br>
            Tel: ${firmenTelefon}<br>
            E-Mail: ${firmenEmail}
          </div>
        </div>
        <div style="text-align: right;">
          <h2 style="color: var(--accent-primary); margin-bottom: 1rem;">RECHNUNG</h2>
          <div><strong>Rechnung-Nr.:</strong> ${rechnung.rechnung_nr}<br>
${
  rechnung.auftrag_nr
    ? `<strong>Auftrag:</strong> ${rechnung.auftrag_nr}<br>`
    : ""
}</div>
          <div><strong>Datum:</strong> ${formatDate(
            rechnung.rechnungsdatum
          )}</div>
          ${
            rechnung.auftragsdatum
              ? `<div><strong>Auftragsdatum:</strong> ${formatDate(
                  rechnung.auftragsdatum
                )}</div>`
              : ""
          }
        </div>
      </div>

      <!-- Kundendaten -->
      <div style="margin-bottom: 2rem;">
        <h3>Rechnungsempfänger:</h3>
        <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 0.5rem;">
          <strong>${rechnung.kunde_name}</strong>${
      rechnung.kunden_nr
        ? ` <small>(Kd.-Nr.: ${rechnung.kunden_nr})</small>`
        : ""
    }<br>
          ${rechnung.strasse || ""}<br>
          ${rechnung.plz || ""} ${rechnung.ort || ""}<br>
          ${rechnung.telefon ? `Tel: ${rechnung.telefon}` : ""}
        </div>
      </div>

      <!-- Fahrzeugdaten -->
      <div style="margin-bottom: 2rem;">
        <h3>Fahrzeug:</h3>
        <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 0.5rem;">
          <strong>${rechnung.kennzeichen} - ${rechnung.marke} ${
      rechnung.modell
    }</strong><br>
${rechnung.vin ? `VIN: ${rechnung.vin}` : ""}
${
  rechnung.farbe || rechnung.farbcode
    ? `<br>Farbe: ${rechnung.farbe || ""} ${
        rechnung.farbcode ? `(${rechnung.farbcode})` : ""
      }`
    : ""
}
        </div>
      </div>

      <!-- Positionen -->
      <h3>Leistungen:</h3>
      <table class="table" style="margin-bottom: 2rem;">
        <thead>
          <tr>
            <th>Beschreibung</th>
            <th>Menge</th>
            <th>Einzelpreis</th>
            <th>MwSt.</th>
            <th>Gesamt</th>
          </tr>
        </thead>
        <tbody>${positionenHtml}</tbody>
      </table>

      <!-- Rechnungssumme -->
      <div style="margin: 2rem 0; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>Zwischensumme netto:</span>
          <span>${formatCurrency(rechnung.zwischensumme)}</span>
        </div>
        ${
          rechnung.rabatt_prozent > 0
            ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>Rabatt (${rechnung.rabatt_prozent}%):</span>
          <span>-${formatCurrency(rechnung.rabatt_betrag)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>Netto nach Rabatt:</span>
          <span>${formatCurrency(rechnung.netto_nach_rabatt)}</span>
        </div>
        `
            : ""
        }
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>MwSt. ${getSetting("mwst_satz", "19")}%:</span>
          <span>${formatCurrency(
            rechnung.mwst_19 || rechnung.mwst_7 || 0
          )}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em; border-top: 1px solid var(--border-color); padding-top: 0.5rem; margin-top: 1rem;">
          <span>GESAMTBETRAG:</span>
          <span>${formatCurrency(rechnung.gesamtbetrag)}</span>
        </div>
      </div>

      <!-- Zahlungsinformationen -->
      ${
        rechnung.zahlungsbedingungen || rechnung.gewaehrleistung || bankIban
          ? `
      <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
        ${
          rechnung.zahlungsbedingungen
            ? `
        <div style="margin-bottom: 1rem;">
          <h4>Zahlungsbedingungen:</h4>
          <p style="margin-top: 0.5rem;">${rechnung.zahlungsbedingungen}</p>
        </div>
        `
            : ""
        }
        
        ${
          bankIban
            ? `
        <div style="margin-bottom: 1rem;">
          <h4>Bankverbindung:</h4>
          <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 0.5rem;">
            ${bankName ? `<div><strong>Bank:</strong> ${bankName}</div>` : ""}
            <div><strong>IBAN:</strong> ${bankIban}</div>
            ${bankBic ? `<div><strong>BIC:</strong> ${bankBic}</div>` : ""}
          </div>
        </div>
        `
            : ""
        }

        ${
          rechnung.gewaehrleistung
            ? `
        <div>
          <h4>Gewährleistung:</h4>
          <p style="margin-top: 0.5rem;">${rechnung.gewaehrleistung}</p>
        </div>
        `
            : ""
        }
      </div>
      `
          : ""
      }

      <!-- Firmendaten Footer -->
      ${
        steuernummer || umsatzsteuerId
          ? `
      <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color); text-align: center; color: var(--text-muted); font-size: 0.9em;">
        ${steuernummer ? `Steuernummer: ${steuernummer}` : ""}
        ${steuernummer && umsatzsteuerId ? " | " : ""}
        ${umsatzsteuerId ? `USt-IdNr.: ${umsatzsteuerId}` : ""}
      </div>
      `
          : ""
      }
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Schließen</button>
      <button type="button" class="btn btn-success" onclick="printRechnung(${id})">
        <i class="fas fa-print"></i> Drucken
      </button>
    `;

    createModal(`Rechnung ${rechnung.rechnung_nr}`, content, footer);
  } catch (error) {
    showNotification("Fehler beim Laden der Rechnung", "error");
  }
}

async function printRechnung(id) {
  try {
    // IMMER printRechnungDirect verwenden - nicht das Modal
    await printRechnungDirect(id);
  } catch (error) {
    console.error("Print error:", error);
    showNotification("Fehler beim Drucken der Rechnung", "error");
  }
}

// Hilfsfunktion: Modal-Inhalt drucken
function printModalContent(modalContent) {
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
      <head>
        <title>Rechnung</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 2cm; }
          table { width: 100%; border-collapse: collapse; margin: 1em 0; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; }
          .text-right { text-align: right; }
          @media print { 
            button { display: none; }
            .modal-header, .modal-footer { display: none; }
          }
        </style>
      </head>
      <body>
        ${modalContent.innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

// Event Listener für Einstellungsänderungen
window.addEventListener("settingsUpdated", () => {
  console.log("Einstellungen wurden aktualisiert - Rechnungen-Modul reagiert");
});
window.showRechnungModal = showRechnungModal;
