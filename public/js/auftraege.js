import {
  apiCall,
  showNotification,
  showSection,
  formatDate,
  formatCurrency,
} from "./utils.js";
import { addSearchToTable } from "./search.js";
import { createModal, closeModal } from "./modals.js";
import { getSetting, getSettings } from "./einstellungen.js";

async function loadAuftraege() {
  try {
    const auftraege = await apiCall("/api/auftraege");
    window.auftraege = auftraege;

    const tbody = document.querySelector("#auftraege-table tbody");
    tbody.innerHTML = auftraege
      .map((auftrag) => {
        // Status-Spalte: Dropdown oder Badge je nach Status
        const statusHtml = generateAuftragStatusHtml(auftrag);

        return `
        <tr onclick="viewAuftrag(${auftrag.id})" style="cursor: pointer;">
          <td>${auftrag.auftrag_nr}</td>
          <td>${auftrag.kunde_name || auftrag.name || "-"}</td>
          <td>${auftrag.kennzeichen || ""} - ${auftrag.marke || ""} ${
          auftrag.modell || ""
        }</td>
          <td>${formatDate(auftrag.datum)}</td>
          <td>${statusHtml}</td>
          <td>${formatCurrency(auftrag.gesamt_kosten)}</td>
          <td>
  <div class="btn-group">
    ${
      auftrag.status !== "abgeschlossen" && auftrag.status !== "storniert"
        ? `
      <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editAuftrag(${auftrag.id})" title="Auftrag bearbeiten">
        <i class="fas fa-edit"></i>
      </button>
    `
        : `
      <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); viewAuftrag(${auftrag.id})" title="Auftrag ansehen (nur lesen)">
        <i class="fas fa-eye"></i>
      </button>
    `
    }
    
    <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); printAuftrag(${
      auftrag.id
    })" title="Auftrag drucken">
      <i class="fas fa-print"></i>
    </button>
    
    ${
      auftrag.status !== "storniert" && auftrag.status !== "abgeschlossen"
        ? `
      <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); createRechnungFromAuftrag(${auftrag.id})" title="Rechnung erstellen">
        <i class="fas fa-file-invoice"></i>
      </button>
    `
        : ""
    }
  </div>
</td>
        </tr>
      `;
      })
      .join("");

    addSearchToTable("auftraege-table", "auftraege-search");
  } catch (error) {
    showNotification("Fehler beim Laden der Aufträge", "error");
  }
}

async function updateAuftragStatus(id, status) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${id}`);

    // Prüfe ob Status bereits final ist
    if (auftrag.status === "abgeschlossen" || auftrag.status === "storniert") {
      const statusNames = {
        abgeschlossen: "Abgeschlossene",
        storniert: "Stornierte",
      };

      showNotification(
        `⚠️ ${
          statusNames[auftrag.status]
        } Aufträge können nicht mehr geändert werden`,
        "warning"
      );

      // Status-Dropdown zurücksetzen
      const dropdown = document.querySelector(`select[onchange*="${id}"]`);
      if (dropdown) {
        dropdown.value = auftrag.status;
      }
      return;
    }

    // Bestätigung für finale Status
    const finalStates = ["abgeschlossen", "storniert"];
    if (finalStates.includes(status)) {
      function getKundenName(auftrag) {
        // Versuche verschiedene mögliche Feldnamen
        return (
          auftrag.kunde_name ||
          auftrag.name ||
          auftrag.kundenname ||
          auftrag.customer_name ||
          auftrag.kunde?.name ||
          "Unbekannt"
        );
      }

      // Dann verwende in den confirmMessages:
      const kundenName = getKundenName(auftrag);

      const confirmMessages = {
        abgeschlossen: `✅ Auftrag als ABGESCHLOSSEN markieren?

Auftrag: ${auftrag.auftrag_nr}
Kunde: ${kundenName}

⚠️ Nach dieser Änderung kann der Auftrag nicht mehr bearbeitet werden!`,
        storniert: `❌ Auftrag als STORNIERT markieren?

Auftrag: ${auftrag.auftrag_nr}
Kunde: ${kundenName}

⚠️ Nach dieser Änderung kann der Auftrag nicht mehr bearbeitet werden!

Dies sollte nur bei ungültigen oder abgebrochenen Aufträgen verwendet werden.`,
      };

      // DEBUG: Um herauszufinden welches Feld den Kundennamen enthält
      console.log("🔍 DEBUG Auftrag-Objekt:", auftrag);
      console.log("🔍 Verfügbare Felder:", Object.keys(auftrag));
      console.log("🔍 Kunde-Felder:", {
        kunde_name: auftrag.kunde_name,
        name: auftrag.name,
        kundenname: auftrag.kundenname,
      });

      const confirmed = await customConfirm(
        confirmMessages[status],
        `${
          status === "abgeschlossen" ? "✅" : "❌"
        } Auftrag als ${status} markieren`
      );

      if (!confirmed) {
        // Status-Dropdown zurücksetzen
        const dropdown = document.querySelector(`select[onchange*="${id}"]`);
        if (dropdown) {
          dropdown.value = auftrag.status;
        }
        return;
      }
    }

    // Status aktualisieren
    auftrag.status = status;
    await apiCall(`/api/auftraege/${id}`, "PUT", auftrag);

    // Status-spezifische Erfolgsmeldungen
    const successMessages = {
      offen: "🟡 Auftrag als offen markiert",
      in_bearbeitung: "🔵 Auftrag in Bearbeitung gesetzt",
      abgeschlossen: "✅ Auftrag als abgeschlossen markiert",
      storniert: "❌ Auftrag als storniert markiert",
    };

    showNotification(
      successMessages[status] ||
        `✅ Status erfolgreich auf "${status}" geändert`,
      "success"
    );

    loadAuftraege(); // Tabelle neu laden
  } catch (error) {
    console.error("❌ Fehler beim Aktualisieren des Auftrag-Status:", error);
    showNotification("❌ Fehler beim Aktualisieren des Status", "error");
    loadAuftraege();
  }
}

function generateAuftragStatusHtml(auftrag) {
  // Finale Status: Nur Badge anzeigen
  if (auftrag.status === "abgeschlossen" || auftrag.status === "storniert") {
    let statusText = "";
    let statusColor = "";
    let statusIcon = "";

    switch (auftrag.status) {
      case "abgeschlossen":
        statusText = "Abgeschlossen";
        statusColor = "#10b981";
        statusIcon = "🟢";
        break;
      case "storniert":
        statusText = "Storniert";
        statusColor = "#ef4444";
        statusIcon = "❌";
        break;
    }

    return `<span class="status-badge status-${auftrag.status}" style="
             font-weight: 600; 
             border-radius: 20px; 
             padding: 0.35rem 0.75rem;
             font-size: 0.85rem;
             background: rgba(${
               statusColor === "#10b981" ? "16, 185, 129" : "239, 68, 68"
             }, 0.1);
             color: ${statusColor};
             border: 2px solid ${statusColor};
             display: inline-block;
           ">${statusIcon} ${statusText}</span>`;
  }

  // Bearbeitbare Status: Dropdown anzeigen
  return `<select class="form-select status-dropdown status-${auftrag.status}" 
                 onchange="updateAuftragStatus(${auftrag.id}, this.value)" 
                 onclick="event.stopPropagation()"
                 style="
                   font-weight: 600; 
                   border-radius: 20px; 
                   padding: 0.25rem 0.75rem;
                   font-size: 0.85rem;
                   border: 2px solid;
                   background: ${getStatusBackground(auftrag.status)};
                   color: ${getStatusColor(auftrag.status)};
                   border-color: ${getStatusColor(auftrag.status)};
                 ">
            <option value="offen" ${
              auftrag.status === "offen" ? "selected" : ""
            }>🟡 Offen</option>
            <option value="in_bearbeitung" ${
              auftrag.status === "in_bearbeitung" ? "selected" : ""
            }>🔵 In Bearbeitung</option>
            <option value="abgeschlossen" ${
              auftrag.status === "abgeschlossen" ? "selected" : ""
            }>🟢 Abgeschlossen</option>
            <option value="storniert" ${
              auftrag.status === "storniert" ? "selected" : ""
            }>❌ Storniert</option>
          </select>`;
}

// 4. HILFSFUNKTIONEN für Status-Styling
function getStatusColor(status) {
  const colors = {
    offen: "#f59e0b",
    in_bearbeitung: "#3b82f6",
    abgeschlossen: "#10b981",
    storniert: "#ef4444",
  };
  return colors[status] || "#6b7280";
}

function getStatusBackground(status) {
  const backgrounds = {
    offen: "rgba(245, 158, 11, 0.1)",
    in_bearbeitung: "rgba(59, 130, 246, 0.1)",
    abgeschlossen: "rgba(16, 185, 129, 0.1)",
    storniert: "rgba(239, 68, 68, 0.1)",
  };
  return backgrounds[status] || "transparent";
}

window.updateAuftragStatus = updateAuftragStatus;
window.generateAuftragStatusHtml = generateAuftragStatusHtml;
window.getStatusColor = getStatusColor;
window.getStatusBackground = getStatusBackground;

async function showAuftragModal(auftragId = null) {
  const isEdit = !!auftragId;
  let auftrag = null;

  if (auftragId) {
    const auftrag = await apiCall(`/api/auftraege/${auftragId}`);
    if (auftrag.status === "abgeschlossen" || auftrag.status === "storniert") {
      showNotification(
        `⚠️ ${
          auftrag.status === "abgeschlossen" ? "Abgeschlossene" : "Stornierte"
        } Aufträge können nicht bearbeitet werden!`,
        "warning"
      );
      viewAuftrag(auftragId);
      return;
    }
  }

  if (isEdit) {
    auftrag = await apiCall(`/api/auftraege/${auftragId}`);
  }

  if (!window.kunden || window.kunden.length === 0) {
    await ensureKundenFunctions();
    await loadKunden();
  }

  const kundenOptions = window.kunden
    .map(
      (k) =>
        `<option value="${k.id}" ${
          k.id === auftrag?.kunden_id ? "selected" : ""
        }>${k.name}</option>`
    )
    .join("");

  // Standard-Arbeitsschritte aus Einstellungen holen
  const standardArbeitsschritte = getSetting(
    "standard_arbeitsschritte",
    "Demontage/Vorbereitung\nSchleifen/Spachteln\nGrundierung\nZwischenschliff\nBasislack\nKlarlack\nPolieren/Finish\nMontage"
  )
    .split("\n")
    .filter((s) => s.trim());

  // Basis-Stundenpreis aus Einstellungen
  const basisStundenpreis = parseFloat(
    getSetting("basis_stundenpreis", "110.00")
  );

  // Zuschläge aus Einstellungen laden
  const anfahrtspauschale = parseFloat(getSetting("anfahrtspauschale", "0"));
  const expressZuschlag = parseFloat(getSetting("express_zuschlag", "0"));
  const wochenendZuschlag = parseFloat(getSetting("wochenend_zuschlag", "0"));

  // Initiale Arbeitsschritte generieren (wie im Rechnungsmodal)
  const anzahlArbeitsschritte = Math.max(
    auftrag?.positionen?.length || 0,
    standardArbeitsschritte.length,
    5 // Mindestens 5 Zeilen
  );

  const arbeitsschritteRows = Array.from(
    { length: anzahlArbeitsschritte },
    (_, index) => {
      const position = auftrag?.positionen?.[index];
      const standardSchritt = standardArbeitsschritte[index] || "";

      return `
      <tr id="position-row-${index}">
        <td>
          <input type="text" class="form-input" 
                 value="${position?.beschreibung || standardSchritt}" 
                 name="beschreibung_${index}" 
                 placeholder="Arbeitsschritt...">
        </td>
        <td>
          <input type="number" step="0.01" class="form-input" 
                 value="${position?.stundenpreis || basisStundenpreis}" 
                 name="stundenpreis_${index}" 
                 onchange="calculateAuftragRow(${index})"
                 placeholder="${basisStundenpreis}">
        </td>
        <td>
          <input type="number" step="0.1" class="form-input" 
                 value="${position?.zeit || ""}" 
                 name="zeit_${index}" 
                 onchange="calculateAuftragRow(${index})"
                 placeholder="0.0">
        </td>
        <td>
          <select class="form-select" name="einheit_${index}">
            <option value="Std." ${
              (position?.einheit || "Std.") === "Std." ? "selected" : ""
            }>Std.</option>
            <option value="Min." ${
              (position?.einheit || "") === "Min." ? "selected" : ""
            }>Min.</option>
            <option value="Stk." ${
              (position?.einheit || "") === "Stk." ? "selected" : ""
            }>Stk.</option>
            <option value="Pauschal" ${
              (position?.einheit || "") === "Pauschal" ? "selected" : ""
            }>Pauschal</option>
            <option value="Liter" ${
              (position?.einheit || "") === "Liter" ? "selected" : ""
            }>Liter</option>
            <option value="kg" ${
              (position?.einheit || "") === "kg" ? "selected" : ""
            }>kg</option>
            <option value="m²" ${
              (position?.einheit || "") === "m²" ? "selected" : ""
            }>m²</option>
          </select>
        </td>
        <td>
          <input type="number" step="0.01" class="form-input" 
                 value="${position?.gesamt || ""}" 
                 name="gesamt_${index}" 
                 readonly
                 placeholder="0,00">
        </td>
        <td>
          ${
            index >= standardArbeitsschritte.length
              ? `
            <button type="button" class="btn btn-sm btn-danger" 
                    onclick="removePosition(${index})" 
                    title="Position entfernen">
              <i class="fas fa-times"></i>
            </button>
          `
              : ""
          }
        </td>
      </tr>
    `;
    }
  ).join("");

  const content = `
  <form id="auftrag-form" novalidate>
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
        onchange="loadKundenFahrzeuge(this.value); validateKundeSelection();"
        oninvalid="this.setCustomValidity('Bitte wählen Sie einen Kunden aus')"
        oninput="this.setCustomValidity('')">
        <option value="">Kunde auswählen...</option>
        ${kundenOptions}
      </select>
      <div class="field-error" id="kunden-error"></div>
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
        id="fahrzeug-select"
        onchange="validateFahrzeugSelection();"
        oninvalid="this.setCustomValidity('Bitte wählen Sie ein Fahrzeug aus')"
        oninput="this.setCustomValidity('')"
        disabled>
        <option value="">Zuerst Kunde auswählen...</option>
      </select>
      <div class="field-error" id="fahrzeug-error"></div>
    </div>
    
    <div class="form-group">
      <label class="form-label">
        Datum
        <span class="required-indicator">*</span>
      </label>
      <input 
        type="date" 
        class="form-input" 
        name="datum" 
        required 
        value="${auftrag?.datum || new Date().toISOString().split("T")[0]}"
        oninvalid="this.setCustomValidity('Bitte geben Sie ein Datum an')"
        oninput="this.setCustomValidity('')">
      <div class="field-error" id="datum-error"></div>
    </div>
    
    <div class="form-group">
      <label class="form-label">Status</label>
      <select class="form-select" name="status">
        <option value="offen" ${
          auftrag?.status === "offen" ? "selected" : ""
        }>Offen</option>
        <option value="in_bearbeitung" ${
          auftrag?.status === "in_bearbeitung" ? "selected" : ""
        }>In Bearbeitung</option>
        <option value="abgeschlossen" ${
          auftrag?.status === "abgeschlossen" ? "selected" : ""
        }>Abgeschlossen</option>
      </select>
    </div>
  </div>

  <!-- Validation Summary -->
  <div id="validation-summary" class="validation-summary" style="display: none;">
    <div class="validation-header">
      <i class="fas fa-exclamation-triangle"></i>
      Bitte korrigieren Sie folgende Fehler:
    </div>
    <ul id="validation-errors"></ul>
  </div>

    <h3 style="margin: 2rem 0 1rem 0; color: var(--accent-primary); display: flex; align-items: center; gap: 0.5rem;">
      <i class="fas fa-plus-circle"></i>
      Zuschläge und Zusatzleistungen
    </h3>

    <div class="zuschlag-container">
      <!-- Anfahrtspauschale -->
      <div class="zuschlag-card">
        <div class="zuschlag-checkbox-container">
          <input type="checkbox" 
                 id="anfahrt_aktiv" 
                 name="anfahrt_aktiv" 
                 class="zuschlag-checkbox"
                 ${auftrag?.anfahrt_aktiv ? "checked" : ""} 
                 onchange="updateAuftragCalculations()">
          <label for="anfahrt_aktiv" class="zuschlag-label">
            <div class="zuschlag-icon">
              <i class="fas fa-route"></i>
            </div>
            <div class="zuschlag-content">
              <div class="zuschlag-title">Anfahrtspauschale</div>
              <div class="zuschlag-amount">${formatCurrency(
                anfahrtspauschale
              )}</div>
              <div class="zuschlag-description">Einmaliger Aufschlag für Anfahrt</div>
            </div>
            <div class="zuschlag-toggle">
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
      </div>

      <!-- Express-Zuschlag -->
      <div class="zuschlag-card">
        <div class="zuschlag-checkbox-container">
          <input type="checkbox" 
                 id="express_aktiv" 
                 name="express_aktiv" 
                 class="zuschlag-checkbox"
                 ${auftrag?.express_aktiv ? "checked" : ""} 
                 onchange="updateAuftragCalculations()">
          <label for="express_aktiv" class="zuschlag-label">
            <div class="zuschlag-icon express">
              <i class="fas fa-bolt"></i>
            </div>
            <div class="zuschlag-content">
              <div class="zuschlag-title">Express-Zuschlag</div>
              <div class="zuschlag-amount">+${expressZuschlag}%</div>
              <div class="zuschlag-description">Aufschlag auf Arbeitszeiten</div>
            </div>
            <div class="zuschlag-toggle">
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
      </div>

      <!-- Wochenend-Zuschlag -->
      <div class="zuschlag-card">
        <div class="zuschlag-checkbox-container">
          <input type="checkbox" 
                 id="wochenend_aktiv" 
                 name="wochenend_aktiv" 
                 class="zuschlag-checkbox"
                 ${auftrag?.wochenend_aktiv ? "checked" : ""} 
                 onchange="updateAuftragCalculations()">
          <label for="wochenend_aktiv" class="zuschlag-label">
            <div class="zuschlag-icon weekend">
              <i class="fas fa-calendar-week"></i>
            </div>
            <div class="zuschlag-content">
              <div class="zuschlag-title">Wochenend-Zuschlag</div>
              <div class="zuschlag-amount">+${wochenendZuschlag}%</div>
              <div class="zuschlag-description">Aufschlag für Wochenendarbeit</div>
            </div>
            <div class="zuschlag-toggle">
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
      </div>
    </div>

    <h3>Arbeitszeiten</h3>
  
  <div class="table-container">
    <table class="table" id="arbeitszeiten-table">
      <thead>
        <tr>
          <th>Beschreibung</th>
          <th>Stundenpreis</th>
          <th>Zeit</th>
          <th>Einheit</th>
          <th>Gesamt</th>
          <th>
            <button type="button" class="btn btn-sm btn-success" 
                    onclick="addNewPosition()" 
                    title="Neue Position hinzufügen">
              <i class="fas fa-plus"></i>
            </button>
          </th>
        </tr>
      </thead>
      <tbody id="arbeitszeiten-tbody">
        ${arbeitsschritteRows}
      </tbody>
    </table>
  </div>
  
  <div class="form-group">
    <label class="form-label">Bemerkungen</label>
    <textarea class="form-textarea" name="bemerkungen" rows="3" placeholder="Zusätzliche Hinweise zum Auftrag...">${
      auftrag?.bemerkungen || ""
    }</textarea>
  </div>
    
    <div class="cost-summary">
      <div class="cost-row">
        <span>Arbeitszeiten (netto):</span>
        <span id="arbeitszeiten-netto">€ 0,00</span>
      </div>
      <div class="cost-row" id="anfahrt-row" style="display: none;">
        <span>Anfahrtspauschale:</span>
        <span id="anfahrt-betrag">€ 0,00</span>
      </div>
      <div class="cost-row" id="express-row" style="display: none;">
        <span>Express-Zuschlag:</span>
        <span id="express-betrag">€ 0,00</span>
      </div>
      <div class="cost-row" id="wochenend-row" style="display: none;">
        <span>Wochenend-Zuschlag:</span>
        <span id="wochenend-betrag">€ 0,00</span>
      </div>
      <hr>
      <div class="cost-row">
        <span><strong>Gesamtkosten (netto):</strong></span>
        <span id="gesamt-kosten"><strong>€ 0,00</strong></span>
      </div>
      <div class="cost-row">
        <span>Inkl. MwSt (${getSetting("mwst_satz", "19")}%):</span>
        <span id="gesamt-mwst">€ 0,00</span>
      </div>
    </div>

    <style>
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
  }

  .validation-summary {
    background: linear-gradient(135deg, 
      rgba(239, 68, 68, 0.1) 0%, 
      rgba(239, 68, 68, 0.05) 100%);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
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
    
    /* SCHÖNE ZUSCHLAG-STYLES */
    .zuschlag-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .zuschlag-card {
      background: linear-gradient(135deg, 
        var(--clr-surface-a10, #2a2a2a) 0%, 
        var(--clr-surface-a20, #333333) 100%);
      border-radius: 12px;
      border: 1px solid var(--border-color, #555);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      position: relative;
    }

    .zuschlag-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      border-color: var(--accent-primary, #afeab4);
    }

    .zuschlag-checkbox-container {
      position: relative;
    }

    .zuschlag-checkbox {
      position: absolute;
      opacity: 0;
      cursor: pointer;
      width: 100%;
      height: 100%;
      margin: 0;
      z-index: 2;
    }

    .zuschlag-label {
      display: flex;
      align-items: center;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.3s ease;
      gap: 1rem;
      position: relative;
    }

    .zuschlag-icon {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      color: white;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .zuschlag-icon.express {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }

    .zuschlag-icon.weekend {
      background: linear-gradient(135deg, #10b981, #059669);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .zuschlag-content {
      flex: 1;
    }

    .zuschlag-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary, #caf1cd);
      margin-bottom: 0.25rem;
    }

    .zuschlag-amount {
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--accent-primary, #afeab4);
      margin-bottom: 0.25rem;
    }

    .zuschlag-description {
      font-size: 0.9rem;
      color: var(--text-secondary, #a1e6a8);
      opacity: 0.8;
    }

    .zuschlag-toggle {
      width: 60px;
      height: 32px;
      background: var(--clr-surface-a30, #555);
      border-radius: 16px;
      position: relative;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    }

    .toggle-slider {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 24px;
      height: 24px;
      background: white;
      border-radius: 50%;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    /* AKTIVE ZUSTÄNDE */
    .zuschlag-checkbox:checked + .zuschlag-label {
      background: linear-gradient(135deg, 
        rgba(175, 234, 180, 0.1) 0%, 
        rgba(175, 234, 180, 0.05) 100%);
    }

    .zuschlag-checkbox:checked + .zuschlag-label .zuschlag-toggle {
      background: var(--accent-primary, #afeab4);
      border-color: var(--accent-primary, #afeab4);
    }

    .zuschlag-checkbox:checked + .zuschlag-label .toggle-slider {
      transform: translateX(28px);
      background: white;
    }

    .zuschlag-checkbox:checked + .zuschlag-label .zuschlag-icon {
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }

    .zuschlag-checkbox:checked + .zuschlag-label .zuschlag-icon.express {
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
    }

    .zuschlag-checkbox:checked + .zuschlag-label .zuschlag-icon.weekend {
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
    }

    /* HOVER-EFFEKTE */
    .zuschlag-card:hover .zuschlag-icon {
      transform: scale(1.05);
    }

    .zuschlag-checkbox:checked + .zuschlag-label:hover .zuschlag-icon {
      transform: scale(1.15);
    }

    /* MOBILE RESPONSIVE */
    @media (max-width: 768px) {
      .zuschlag-container {
        grid-template-columns: 1fr;
      }
      
      .zuschlag-label {
        padding: 1rem;
      }
      
      .zuschlag-icon {
        width: 40px;
        height: 40px;
        font-size: 1.2rem;
      }
    }

    /* ANIMATIONEN */
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }

    .zuschlag-checkbox:checked + .zuschlag-label .zuschlag-icon {
      animation: pulse 0.6s ease-in-out;
    }
    </style>
  </form>
`;

  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button type="button" class="btn btn-primary" onclick="saveAuftrag(${
      auftragId || "null"
    })">
      ${isEdit ? "Aktualisieren" : "Erstellen"}
    </button>
  `;

  createModal(isEdit ? "Auftrag bearbeiten" : "Neuer Auftrag", content, footer);

  // Fahrzeuge laden falls Kunde bereits ausgewählt
  if (auftrag?.kunden_id) {
    await loadKundenFahrzeuge(auftrag.kunden_id, auftrag.fahrzeug_id);
  }

  // Berechnungen aktualisieren
  setTimeout(updateAuftragCalculations, 100);
}

window.addNewPosition = function () {
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
  <option value="Stk.">Stk.</option>
  <option value="Pauschal">Pauschal</option>
  <option value="Liter">Liter</option>
  <option value="kg">kg</option>
  <option value="m²">m²</option>
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
  <option value="Std." selected>Std.</option>
  <option value="Min.">Min.</option>
  <option value="Stk.">Stk.</option>
  <option value="Pauschal">Pauschal</option>
  <option value="Liter">Liter</option>
  <option value="kg">kg</option>
  <option value="m²">m²</option>
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

window.calculateAuftragRow = function (index) {
  const stundenpreis =
    parseFloat(
      document.querySelector(`[name="stundenpreis_${index}"]`)?.value
    ) || 0;
  const zeit =
    parseFloat(document.querySelector(`[name="zeit_${index}"]`)?.value) || 0;
  const gesamt = stundenpreis * zeit;

  const gesamtInput = document.querySelector(`[name="gesamt_${index}"]`);
  if (gesamtInput) {
    gesamtInput.value = gesamt.toFixed(2);
  }
  updateAuftragCalculations();
};

window.updateAuftragCalculations = function () {
  // Basis-Arbeitszeiten berechnen
  let arbeitszeitenNetto = 0;
  const inputs = document.querySelectorAll('[name^="gesamt_"]');

  inputs.forEach((input) => {
    arbeitszeitenNetto += parseFloat(input.value) || 0;
  });

  // Zuschläge aus Einstellungen
  const anfahrtspauschale = parseFloat(getSetting("anfahrtspauschale", "0"));
  const expressZuschlag = parseFloat(getSetting("express_zuschlag", "0")) / 100;
  const wochenendZuschlag =
    parseFloat(getSetting("wochenend_zuschlag", "0")) / 100;

  // Checkboxen prüfen
  const anfahrtAktiv =
    document.querySelector('[name="anfahrt_aktiv"]')?.checked || false;
  const expressAktiv =
    document.querySelector('[name="express_aktiv"]')?.checked || false;
  const wochenendAktiv =
    document.querySelector('[name="wochenend_aktiv"]')?.checked || false;

  // Zuschläge berechnen
  let anfahrtBetrag = 0;
  let expressBetrag = 0;
  let wochenendBetrag = 0;

  if (anfahrtAktiv) {
    anfahrtBetrag = anfahrtspauschale;
  }

  if (expressAktiv) {
    expressBetrag = arbeitszeitenNetto * expressZuschlag;
  }

  if (wochenendAktiv) {
    wochenendBetrag = arbeitszeitenNetto * wochenendZuschlag;
  }

  // Gesamtkosten
  const gesamtKosten =
    arbeitszeitenNetto + anfahrtBetrag + expressBetrag + wochenendBetrag;
  const mwstSatz = parseFloat(getSetting("mwst_satz", "19")) / 100;
  const gesamtMitMwst = gesamtKosten * (1 + mwstSatz);

  // UI aktualisieren
  const arbeitszeitenEl = document.getElementById("arbeitszeiten-netto");
  if (arbeitszeitenEl)
    arbeitszeitenEl.textContent = formatCurrency(arbeitszeitenNetto);

  // Anfahrt
  const anfahrtRow = document.getElementById("anfahrt-row");
  if (anfahrtRow) {
    if (anfahrtAktiv && anfahrtBetrag > 0) {
      anfahrtRow.style.display = "flex";
      const anfahrtBetragEl = document.getElementById("anfahrt-betrag");
      if (anfahrtBetragEl)
        anfahrtBetragEl.textContent = formatCurrency(anfahrtBetrag);
    } else {
      anfahrtRow.style.display = "none";
    }
  }

  // Express
  const expressRow = document.getElementById("express-row");
  if (expressRow) {
    if (expressAktiv && expressBetrag > 0) {
      expressRow.style.display = "flex";
      const expressBetragEl = document.getElementById("express-betrag");
      if (expressBetragEl)
        expressBetragEl.textContent = formatCurrency(expressBetrag);
    } else {
      expressRow.style.display = "none";
    }
  }

  // Wochenend
  const wochenendRow = document.getElementById("wochenend-row");
  if (wochenendRow) {
    if (wochenendAktiv && wochenendBetrag > 0) {
      wochenendRow.style.display = "flex";
      const wochenendBetragEl = document.getElementById("wochenend-betrag");
      if (wochenendBetragEl)
        wochenendBetragEl.textContent = formatCurrency(wochenendBetrag);
    } else {
      wochenendRow.style.display = "none";
    }
  }

  // Gesamtbeträge
  const gesamtKostenEl = document.getElementById("gesamt-kosten");
  const gesamtMwstEl = document.getElementById("gesamt-mwst");

  if (gesamtKostenEl) gesamtKostenEl.textContent = formatCurrency(gesamtKosten);
  if (gesamtMwstEl) gesamtMwstEl.textContent = formatCurrency(gesamtMitMwst);
};

window.saveAuftrag = async function (auftragId = null) {
  console.log("💾 Speichere Auftrag...");

  const form = document.getElementById("auftrag-form");
  if (!form) {
    showNotification("Fehler: Formular nicht gefunden", "error");
    return;
  }

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

  const formData = new FormData(form);

  const kundenId = parseInt(formData.get("kunden_id"));
  const fahrzeugId = parseInt(formData.get("fahrzeug_id"));
  const datum = formData.get("datum");

  // Validierungsfehler sammeln
  const errors = [];

  if (!kundenId || kundenId <= 0) {
    errors.push("Kunde muss ausgewählt werden");
    // Visuelles Feedback
    const kundenSelect = document.querySelector('[name="kunden_id"]');
    if (kundenSelect) {
      kundenSelect.style.borderColor = "#ef4444";
      setTimeout(() => (kundenSelect.style.borderColor = ""), 3000);
    }
  }

  if (!fahrzeugId || fahrzeugId <= 0) {
    errors.push("Fahrzeug muss ausgewählt werden");
    // Visuelles Feedback
    const fahrzeugSelect = document.querySelector('[name="fahrzeug_id"]');
    if (fahrzeugSelect) {
      fahrzeugSelect.style.borderColor = "#ef4444";
      setTimeout(() => (fahrzeugSelect.style.borderColor = ""), 3000);
    }
  }

  if (!datum || datum.trim() === "") {
    errors.push("Datum muss angegeben werden");
    // Visuelles Feedback
    const datumInput = document.querySelector('[name="datum"]');
    if (datumInput) {
      datumInput.style.borderColor = "#ef4444";
      setTimeout(() => (datumInput.style.borderColor = ""), 3000);
    }
  }

  const beschreibungInputs = document.querySelectorAll(
    '[name^="beschreibung_"]'
  );
  const positionen = [];
  let hasValidPositions = false;

  beschreibungInputs.forEach((input) => {
    const index = input.name.split("_")[1];
    const beschreibung = input.value?.trim();
    const stundenpreis =
      parseFloat(
        document.querySelector(`[name="stundenpreis_${index}"]`)?.value
      ) || 0;
    const zeit =
      parseFloat(document.querySelector(`[name="zeit_${index}"]`)?.value) || 0;
    const einheit =
      document.querySelector(`[name="einheit_${index}"]`)?.value || "Std.";
    const gesamt =
      parseFloat(document.querySelector(`[name="gesamt_${index}"]`)?.value) ||
      0;

    if (beschreibung && (zeit > 0 || gesamt > 0)) {
      positionen.push({
        beschreibung,
        stundenpreis,
        zeit,
        einheit,
        gesamt,
      });
      hasValidPositions = true;
    }
  });

  if (!hasValidPositions) {
    errors.push("Mindestens eine Arbeitsposition muss ausgefüllt werden");
  }

  if (errors.length > 0) {
    console.error("❌ Validierungsfehler:", errors);
    showNotification(`Validierungsfehler:\n• ${errors.join("\n• ")}`, "error");
    return;
  }

  const anfahrtAktiv =
    document.querySelector('[name="anfahrt_aktiv"]')?.checked || false;
  const expressAktiv =
    document.querySelector('[name="express_aktiv"]')?.checked || false;
  const wochenendAktiv =
    document.querySelector('[name="wochenend_aktiv"]')?.checked || false;

  const data = {
    kunden_id: kundenId,
    fahrzeug_id: fahrzeugId,
    datum,
    status: formData.get("status") || "offen",
    positionen,
    bemerkungen: formData.get("bemerkungen")?.trim() || "",
    // Zuschläge
    anfahrt_aktiv: anfahrtAktiv,
    express_aktiv: expressAktiv,
    wochenend_aktiv: wochenendAktiv,
  };

  console.log("📋 Auftragsdaten:", data);

  try {
    // Loading-Zustand anzeigen
    const saveButton = document.querySelector('button[onclick*="saveAuftrag"]');
    const originalText = saveButton?.textContent;
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Speichert...';
    }

    if (auftragId) {
      console.log(`📝 Aktualisiere Auftrag ${auftragId}`);
      await apiCall(`/api/auftraege/${auftragId}`, "PUT", data);
      showNotification("Auftrag erfolgreich aktualisiert", "success");
    } else {
      console.log("➕ Erstelle neuen Auftrag");
      const result = await apiCall("/api/auftraege", "POST", data);
      console.log("✅ Auftrag erstellt:", result);
      showNotification("Auftrag erfolgreich erstellt", "success");
    }

    closeModal();
    loadAuftraege();
  } catch (error) {
    console.error("❌ Speicherfehler:", error);
    showNotification(
      `Fehler beim Speichern: ${error.message || "Unbekannter Fehler"}`,
      "error"
    );
  } finally {
    // Loading-Zustand zurücksetzen
    const saveButton = document.querySelector('button[onclick*="saveAuftrag"]');
    if (saveButton && originalText) {
      saveButton.disabled = false;
      saveButton.textContent = originalText;
    }
  }
};

// Feld als fehlerhaft markieren
function markFieldAsError(fieldName, message) {
  const field = document.querySelector(`[name="${fieldName}"]`);
  if (field) {
    field.style.borderColor = "#ef4444";
    field.style.boxShadow = "0 0 0 2px rgba(239, 68, 68, 0.2)";

    // Tooltip mit Fehlermeldung
    field.title = message;

    // Nach 3 Sekunden zurücksetzen
    setTimeout(() => {
      field.style.borderColor = "";
      field.style.boxShadow = "";
      field.title = "";
    }, 3000);
  }
}

// Echtzeit-Validierung für Kunde-Auswahl
window.validateKundeSelection = function () {
  const kundenSelect = document.querySelector('[name="kunden_id"]');
  const fahrzeugSelect = document.querySelector('[name="fahrzeug_id"]');

  if (kundenSelect && kundenSelect.value) {
    kundenSelect.style.borderColor = "#10b981";

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
    }
  }
};

// Echtzeit-Validierung für Fahrzeug-Auswahl
window.validateFahrzeugSelection = function () {
  const fahrzeugSelect = document.querySelector('[name="fahrzeug_id"]');

  if (fahrzeugSelect && fahrzeugSelect.value) {
    fahrzeugSelect.style.borderColor = "#10b981";
  } else {
    markFieldAsError("fahrzeug_id", "Fahrzeug muss ausgewählt werden");
  }
};

window.loadKundenFahrzeuge = async function (
  kundenId,
  selectedFahrzeugId = null
) {
  console.log(`🚗 Lade Fahrzeuge für Kunde ${kundenId}`);

  // Validierung
  validateKundeSelection();

  if (!kundenId) {
    console.warn("Keine Kunden-ID angegeben");
    return;
  }

  try {
    await ensureKundenFunctions();

    const fahrzeuge = await apiCall(`/api/fahrzeuge?kunden_id=${kundenId}`);
    const fahrzeugSelect = document.getElementById("fahrzeug-select");

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
      validateFahrzeugSelection();
    }
  } catch (error) {
    console.error("❌ Fehler beim Laden der Fahrzeuge:", error);
    showNotification("Fehler beim Laden der Fahrzeuge", "error");
  }
};

async function createRechnungFromAuftrag(auftragId) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${auftragId}`);
    const mwstSatz = parseFloat(getSetting("mwst_satz", "19"));

    // Validierung
    if (!auftrag || !auftrag.id) {
      throw new Error(`Auftrag mit ID ${auftragId} nicht gefunden`);
    }

    if (!auftrag.auftrag_nr) {
      throw new Error(`Auftrag ${auftrag.id} hat keine gültige Auftragsnummer`);
    }

    console.log(
      `📋 Erstelle Rechnung aus Auftrag ${auftrag.auftrag_nr} (ID: ${auftrag.id})`
    );

    // Rechnungspositionen zusammenstellen
    let rechnungsPositionen = [];

    if (auftrag.positionen && auftrag.positionen.length > 0) {
      auftrag.positionen.forEach((pos) => {
        rechnungsPositionen.push({
          kategorie: "ARBEITSZEITEN",
          beschreibung: pos.beschreibung,
          menge: pos.zeit,
          einheit: pos.einheit,
          einzelpreis: pos.stundenpreis,
          mwst_prozent: mwstSatz,
          gesamt: pos.gesamt,
        });
      });
    }

    if (auftrag.anfahrt_aktiv) {
      const anfahrtspauschale = parseFloat(
        getSetting("anfahrtspauschale", "0")
      );
      if (anfahrtspauschale > 0) {
        rechnungsPositionen.push({
          kategorie: "ZUSATZ",
          beschreibung: "Anfahrtspauschale",
          menge: 1,
          einheit: "Pauschal",
          einzelpreis: anfahrtspauschale,
          mwst_prozent: mwstSatz,
          gesamt: anfahrtspauschale,
        });
      }
    }

    if (auftrag.express_aktiv) {
      const expressZuschlag = parseFloat(getSetting("express_zuschlag", "0"));
      const arbeitsKosten = (auftrag.positionen || []).reduce(
        (sum, pos) => sum + (pos.gesamt || 0),
        0
      );
      const expressBetrag = arbeitsKosten * (expressZuschlag / 100);

      if (expressBetrag > 0) {
        rechnungsPositionen.push({
          kategorie: "ZUSATZ",
          beschreibung: `Express-Zuschlag (+${expressZuschlag}%)`,
          menge: 1,
          einheit: "Pauschal",
          einzelpreis: expressBetrag,
          mwst_prozent: mwstSatz,
          gesamt: expressBetrag,
        });
      }
    }

    if (auftrag.wochenend_aktiv) {
      const wochenendZuschlag = parseFloat(
        getSetting("wochenend_zuschlag", "0")
      );
      const arbeitsKosten = (auftrag.positionen || []).reduce(
        (sum, pos) => sum + (pos.gesamt || 0),
        0
      );
      const wochenendBetrag = arbeitsKosten * (wochenendZuschlag / 100);

      if (wochenendBetrag > 0) {
        rechnungsPositionen.push({
          kategorie: "ZUSATZ",
          beschreibung: `Wochenend-Zuschlag (+${wochenendZuschlag}%)`,
          menge: 1,
          einheit: "Pauschal",
          einzelpreis: wochenendBetrag,
          mwst_prozent: mwstSatz,
          gesamt: wochenendBetrag,
        });
      }
    }

    // Auftrag in Rechnung umwandeln
    const rechnungsData = {
      auftrag_id: auftrag.id,
      kunden_id: auftrag.kunden_id,
      fahrzeug_id: auftrag.fahrzeug_id,
      rechnungsdatum: new Date().toISOString().split("T")[0],
      auftragsdatum: auftrag.datum,
      positionen: rechnungsPositionen,
      rabatt_prozent: 0,
      status: "offen",
    };

    console.log(
      `📊 Rechnung wird erstellt mit ${rechnungsPositionen.length} Positionen:`,
      rechnungsPositionen
    );

    const result = await apiCall("/api/rechnungen", "POST", rechnungsData);

    showNotification(
      `Rechnung ${result.rechnung_nr} erfolgreich aus Auftrag ${auftrag.auftrag_nr} erstellt (inkl. Zuschläge)`,
      "success"
    );

    // Auftrag als abgeschlossen markieren
    auftrag.status = "abgeschlossen";
    await apiCall(`/api/auftraege/${auftragId}`, "PUT", auftrag);

    loadAuftraege();
    showSection("rechnungen");
  } catch (error) {
    console.error("❌ Fehler in createRechnungFromAuftrag:", error);
    showNotification(
      `Fehler beim Erstellen der Rechnung: ${error.message}`,
      "error"
    );
  }
}

// Bestehende Funktionen beibehalten...
async function ensureKundenFunctions() {
  if (!window.loadKunden) {
    try {
      const kundenModule = await import("./kunden.js");
      window.loadKunden = kundenModule.loadKunden;
    } catch (error) {
      console.warn("Kunden-Modul konnte nicht geladen werden:", error);
    }
  }
}

// View-Funktion bleibt unverändert
async function viewAuftrag(id) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${id}`);
    const positionenHtml =
      auftrag.positionen
        ?.map(
          (pos) => `
      <tr>
        <td>${pos.beschreibung}</td>
        <td>${pos.zeit} ${pos.einheit}</td>
        <td>${formatCurrency(pos.stundenpreis)}</td>
        <td>${formatCurrency(pos.gesamt)}</td>
      </tr>
    `
        )
        .join("") || '<tr><td colspan="4">Keine Positionen</td></tr>';

    const mwstSatz = getSetting("mwst_satz", "19");
    const gesamtBrutto =
      auftrag.gesamt_kosten * (1 + parseFloat(mwstSatz) / 100);

    const content = `
      <div style="text-align: center; margin-bottom: 2rem;">
        <h2 style="color: #007bff; margin-bottom: 0;">AUFTRAG</h2>
        <div style="font-size: 18px; font-weight: bold;">${
          auftrag.auftrag_nr
        }</div>
      </div>
      
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Kunde:</label><div>${
          auftrag.name
        }</div></div>
        <div class="form-group"><label class="form-label">Fahrzeug:</label><div>${
          auftrag.kennzeichen
        } - ${auftrag.marke} ${auftrag.modell}</div></div>
        <div class="form-group"><label class="form-label">Datum:</label><div>${formatDate(
          auftrag.datum
        )}</div></div>
        <div class="form-group"><label class="form-label">Status:</label><div><span class="status status-${auftrag.status.replace(
          "_",
          "-"
        )}">${
      auftrag.status === "in_bearbeitung"
        ? "In Bearbeitung"
        : auftrag.status === "offen"
        ? "Offen"
        : auftrag.status === "abgeschlossen"
        ? "Abgeschlossen"
        : auftrag.status
    }</span></div></div>
        <div class="form-group"><label class="form-label">Netto:</label><div>${formatCurrency(
          auftrag.gesamt_kosten
        )}</div></div>
        <div class="form-group"><label class="form-label">Brutto (inkl. ${mwstSatz}% MwSt.):</label><div style="font-weight: bold; color: #007bff;">${formatCurrency(
      gesamtBrutto
    )}</div></div>
      </div>
      <h3>Positionen</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Beschreibung</th>
            <th>Zeit</th>
            <th>Stundenpreis</th>
            <th>Gesamt</th>
          </tr>
        </thead>
        <tbody>${positionenHtml}</tbody>
      </table>
      ${
        auftrag.bemerkungen
          ? `<div class="form-group"><label class="form-label">Bemerkungen:</label><div>${auftrag.bemerkungen}</div></div>`
          : ""
      }
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Schließen</button>
      <button type="button" class="btn btn-primary" onclick="editAuftrag(${id})">
        <i class="fas fa-edit"></i> Bearbeiten
      </button>
      <button type="button" class="btn btn-info" onclick="printAuftrag(${id})">
        <i class="fas fa-print"></i> Drucken
      </button>
      <button type="button" class="btn btn-success" onclick="createRechnungFromAuftrag(${id})">
        <i class="fas fa-file-invoice"></i> Rechnung erstellen
      </button>
    `;

    createModal(`Auftrag ${auftrag.auftrag_nr}`, content, footer);
  } catch (error) {
    showNotification("Fehler beim Laden des Auftrags", "error");
  }
}

// Delete-Funktion
async function deleteAuftrag(id) {
  try {
    // Versuche Auftrag-Details zu laden für bessere Bestätigung
    let auftrag = null;
    try {
      auftrag = await apiCall(`/api/auftraege/${id}`);
    } catch (loadError) {
      console.warn("Auftrag-Details konnten nicht geladen werden:", loadError);
    }

    // Prüfe auch auf verknüpfte Rechnungen
    let hasInvoices = false;
    try {
      const rechnungen = await apiCall("/api/rechnungen");
      hasInvoices = rechnungen.some((r) => r.auftrag_id === id);
    } catch (invoiceError) {
      console.warn("Rechnungen konnten nicht geprüft werden:", invoiceError);
    }

    // Bestätigungs-Dialog erstellen
    let confirmMessage;
    let dialogTitle;

    if (auftrag) {
      // Mit Auftrag-Details
      confirmMessage = `Auftrag wirklich löschen?

Auftrag-Details:
• Auftrag-Nr: ${auftrag.auftrag_nr || auftrag.nummer || id}
• Kunde: ${auftrag.name || auftrag.kunde_name || "Unbekannt"}
• Fahrzeug: ${
        auftrag.kennzeichen || auftrag.fahrzeug_kennzeichen || "Unbekannt"
      }
• Status: ${auftrag.status || "Unbekannt"}
• Erstellt: ${
        auftrag.erstellt_am
          ? new Date(auftrag.erstellt_am).toLocaleDateString("de-DE")
          : "Unbekannt"
      }`;

      if (hasInvoices) {
        confirmMessage += `\n\n⚠️ WARNUNG: Verknüpfte Rechnungen gefunden!
• Alle zugehörigen Rechnungen werden ebenfalls gelöscht
• Buchhaltungsdaten gehen verloren`;
        dialogTitle = "⚠️ Auftrag mit Rechnungen löschen";
      } else {
        dialogTitle = "Auftrag löschen";
      }

      confirmMessage += `\n\nDiese Aktion kann NICHT rückgängig gemacht werden.`;
    } else {
      // Ohne Details (Fallback)
      confirmMessage = `Auftrag (ID: ${id}) wirklich löschen?`;

      if (hasInvoices) {
        confirmMessage += `\n\n⚠️ WARNUNG: Verknüpfte Rechnungen werden ebenfalls gelöscht!`;
        dialogTitle = "⚠️ Auftrag mit Rechnungen löschen";
      } else {
        dialogTitle = "Auftrag löschen";
      }

      confirmMessage += `\n\nDiese Aktion kann nicht rückgängig gemacht werden.`;
    }

    const confirmed = await customConfirm(confirmMessage, dialogTitle);

    if (confirmed) {
      // Loading-Notification während Löschung
      if (typeof showNotification === "function") {
        showNotification("Auftrag wird gelöscht...", "info");
      }

      await apiCall(`/api/auftraege/${id}`, "DELETE");

      // Erfolgs-Dialog
      await customAlert(
        `Auftrag erfolgreich gelöscht!${
          auftrag?.nummer ? `\n\nAuftrag-Nr: ${auftrag.nummer}` : ""
        }${
          hasInvoices
            ? "\n\nVerknüpfte Rechnungen wurden ebenfalls entfernt."
            : ""
        }`,
        "success",
        "Auftrag gelöscht"
      );

      if (typeof showNotification === "function") {
        showNotification("Auftrag erfolgreich gelöscht", "success");
      }

      loadAuftraege();
    }
  } catch (error) {
    console.error("Fehler beim Löschen des Auftrags:", error);

    // Fehler-Dialog mit Details
    await customAlert(
      `Fehler beim Löschen des Auftrags:

${error.message || "Unbekannter Fehler"}

Mögliche Ursachen:
• Netzwerk-Problem
• Server-Fehler  
• Auftrag wird noch von anderen Daten referenziert
• Unzureichende Berechtigung

Versuchen Sie es erneut oder kontaktieren Sie den Support.`,
      "error",
      "Löschung fehlgeschlagen"
    );

    if (typeof showNotification === "function") {
      showNotification("Fehler beim Löschen des Auftrags", "error");
    }
  }
}

// Print-Funktion (Platzhalter - kann erweitert werden)
async function printAuftrag(id) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${id}`);
    // Hier würde die Drucklogik kommen
    showNotification("Druckfunktion noch nicht implementiert", "info");
  } catch (error) {
    showNotification("Fehler beim Drucken", "error");
  }
}

// Export und globale Funktionen
window.showAuftragModal = showAuftragModal;
window.viewAuftrag = viewAuftrag;
window.editAuftrag = showAuftragModal;
window.deleteAuftrag = deleteAuftrag;
window.printAuftrag = printAuftrag;
window.createRechnungFromAuftrag = createRechnungFromAuftrag;

// Kunden-Funktionen global verfügbar machen
window.loadKundenFahrzeuge = async function (
  kundenId,
  selectedFahrzeugId = null
) {
  await ensureKundenFunctions();
  return loadKundenFahrzeuge(kundenId, selectedFahrzeugId);
};

// Load-Funktion exportieren
export { loadAuftraege };
