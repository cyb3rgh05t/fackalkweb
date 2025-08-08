import {
  apiCall,
  showNotification,
  formatDate,
  formatCurrency,
} from "./utils.js";
import { addSearchToTable } from "./search.js";
import { createModal, closeModal } from "./modals.js";
import { getSetting, getSettings } from "./einstellungen.js";

async function updateRechnungStatus(id, status) {
  try {
    const rechnung = await apiCall(`/api/rechnungen/${id}`);
    if (
      rechnung.status === "bezahlt" ||
      rechnung.status === "storniert" ||
      rechnung.status === "mahnung"
    ) {
      const statusNames = {
        bezahlt: "Bezahlte",
        storniert: "Stornierte",
        mahnung: "Mahnungs-",
      };

      showNotification(
        `⚠️ ${
          statusNames[rechnung.status]
        }rechnungen können nicht mehr geändert werden`,
        "warning"
      );

      // Status-Dropdown zurücksetzen
      const dropdown = document.querySelector(`select[onchange*="${id}"]`);
      if (dropdown) {
        dropdown.value = rechnung.status;
      }
      return;
    }

    const finalStates = ["bezahlt", "storniert", "mahnung"];
    if (finalStates.includes(status)) {
      const confirmMessages = {
        bezahlt: `🟢 Rechnung als BEZAHLT markieren?\n\nRechnung: ${
          rechnung.rechnung_nr
        }\nBetrag: ${formatCurrency(
          rechnung.gesamtbetrag
        )}\n\n⚠️ Nach dieser Änderung kann die Rechnung nicht mehr bearbeitet werden!`,
        storniert: `❌ Rechnung als STORNIERT markieren?\n\nRechnung: ${
          rechnung.rechnung_nr
        }\nBetrag: ${formatCurrency(
          rechnung.gesamtbetrag
        )}\n\n⚠️ Nach dieser Änderung kann die Rechnung nicht mehr bearbeitet werden!\n\nDies sollte nur bei ungültigen oder zurückgenommenen Rechnungen verwendet werden.`,
        mahnung: `⚠️ Rechnung als MAHNUNG markieren?\n\nRechnung: ${
          rechnung.rechnung_nr
        }\nBetrag: ${formatCurrency(
          rechnung.gesamtbetrag
        )}\n\n⚠️ Nach dieser Änderung kann die Rechnung nicht mehr bearbeitet werden!\n\nDies markiert die Rechnung als überfällig und wird auf dem Ausdruck angezeigt.`,
      };

      const confirmed = await customConfirm(
        confirmMessages[status],
        `${
          status === "bezahlt" ? "💰" : status === "storniert" ? "❌" : "⚠️"
        } Rechnung als ${status} markieren`
      );

      if (!confirmed) {
        // Status-Dropdown zurücksetzen
        const dropdown = document.querySelector(`select[onchange*="${id}"]`);
        if (dropdown) {
          dropdown.value = rechnung.status;
        }
        return;
      }
    }

    rechnung.status = status;

    if (status === "bezahlt") {
      // Anzahlung auf Gesamtbetrag setzen, damit Restbetrag = 0 wird
      rechnung.anzahlung_betrag = rechnung.gesamtbetrag;
      rechnung.restbetrag = 0;
      // Anzahlungsdatum setzen, falls noch nicht vorhanden
      if (!rechnung.anzahlung_datum) {
        rechnung.anzahlung_datum = new Date().toISOString().split("T")[0];
      }
    } else if (status === "storniert") {
      // Bei Stornierung Restbetrag auf 0 setzen (keine Zahlung mehr erforderlich)
      rechnung.restbetrag = 0;
    }

    await apiCall(`/api/rechnungen/${id}`, "PUT", rechnung);

    // Status-spezifische Erfolgsmeldungen
    const successMessages = {
      bezahlt: "✅ Rechnung als bezahlt markiert",
      storniert: "❌ Rechnung als storniert markiert",
      mahnung: "⚠️ Rechnung als Mahnung markiert",
      offen: "🟡 Rechnung als offen markiert",
      teilbezahlt: "🔵 Rechnung als teilbezahlt markiert",
    };

    showNotification(
      successMessages[status] ||
        `✅ Status erfolgreich auf "${status}" geändert`,
      "success"
    );
    loadRechnungen(); // Tabelle neu laden
  } catch (error) {
    console.error("❌ Fehler beim Aktualisieren des Status:", error);
    showNotification("❌ Fehler beim Aktualisieren des Status", "error");
    loadRechnungen(); // Tabelle neu laden
  }
}

function generateRechnungActionButtons(rechnung) {
  // Wenn Status final ist (bezahlt, storniert, mahnung), nur eingeschränkte Buttons anzeigen
  if (
    rechnung.status === "bezahlt" ||
    rechnung.status === "storniert" ||
    rechnung.status === "mahnung"
  ) {
    let statusText = "";
    let statusColor = "";
    let statusIcon = "";

    switch (rechnung.status) {
      case "bezahlt":
        statusText = "Bezahlt";
        statusColor = "#10b981";
        statusIcon = "&#10004";
        break;
      case "storniert":
        statusText = "Storniert";
        statusColor = "#ef4444";
        statusIcon = "❌";
        break;
      case "mahnung":
        statusText = "Mahnung";
        statusColor = "#f59e0b";
        statusIcon = "⚠️";
        break;
    }

    return `
      <div class="action-buttons">
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); viewRechnung(${rechnung.id})" title="Anzeigen">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); printRechnung(${rechnung.id})" title="Drucken">
          <i class="fas fa-print"></i>
        </button>
      </div>
    `;
  }

  // Normale Action-Buttons für alle anderen Status
  return `
    <div class="action-buttons">
      <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editRechnung(${rechnung.id})" title="Bearbeiten">
        <i class="fas fa-edit"></i>
      </button>
      <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); viewRechnung(${rechnung.id})" title="Anzeigen">
        <i class="fas fa-eye"></i>
      </button>
      <button class="btn btn-sm btn-info" onclick="event.stopPropagation(); printRechnung(${rechnung.id})" title="Drucken">
        <i class="fas fa-print"></i>
      </button>
      
    </div>
  `;
}

// Rechnungen laden und Tabelle füllen
export async function loadRechnungen() {
  try {
    console.log("🔄 Lade Rechnungen...");

    const tableBody = document.querySelector("#rechnungen-table tbody");
    if (tableBody) {
      tableBody.innerHTML =
        '<tr><td colspan="7" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Laden...</td></tr>';
    }

    const cacheBuster = Date.now();
    window.rechnungen = await apiCall(`/api/rechnungen?_=${cacheBuster}`);

    console.log(`📊 ${window.rechnungen.length} Rechnungen geladen`);

    if (!tableBody) {
      console.error("❌ Tabellen-Body nicht gefunden!");
      return;
    }

    function addAnzahlungsInfoToRow(rechnung) {
      // Bei bezahlten Rechnungen keine Anzahlungsinfo anzeigen
      if (rechnung.status === "bezahlt") {
        return "";
      }

      // Nur bei nicht-bezahlten Rechnungen Anzahlungsinfo anzeigen
      if (rechnung.anzahlung_betrag > 0) {
        return `
          <div class="anzahlung-info" style="font-size: 0.9em; color: var(--primary); margin-top: 0.25rem;">
            Anzahlung: ${formatCurrency(rechnung.anzahlung_betrag)}
            ${
              rechnung.restbetrag > 0
                ? `<br>Restbetrag: ${formatCurrency(rechnung.restbetrag)}`
                : ""
            }
          </div>
        `;
      }
      return "";
    }

    const newTableHTML = window.rechnungen
      .map(
        (rechnung) => `
            <tr onclick="viewRechnung(${
              rechnung.id
            })" style="cursor: pointer;" title="Klicken zum Anzeigen">
                <td>${rechnung.rechnung_nr}</td>
                <td>${rechnung.kunde_name || "-"}</td>
                <td>${rechnung.kennzeichen || ""} ${rechnung.marke || ""} ${
          rechnung.modell || ""
        }</td>
                <td>${formatDate(rechnung.rechnungsdatum)}</td>
                <td>
                  ${
                    rechnung.status === "bezahlt" ||
                    rechnung.status === "storniert" ||
                    rechnung.status === "mahnung"
                      ? `<span class="status-badge status-${
                          rechnung.status
                        }" style="
                           font-weight: 600; 
                           border-radius: 20px; 
                           padding: 0.35rem 0.75rem;
                           font-size: 0.85rem;
                           background: ${
                             rechnung.status === "bezahlt"
                               ? "rgba(34, 197, 94, 0.1)"
                               : rechnung.status === "storniert"
                               ? "rgba(239, 68, 68, 0.1)"
                               : "rgba(245, 158, 11, 0.1)"
                           };
                           color: ${
                             rechnung.status === "bezahlt"
                               ? "#22c55e"
                               : rechnung.status === "storniert"
                               ? "#ef4444"
                               : "#f59e0b"
                           };
                           border: 2px solid ${
                             rechnung.status === "bezahlt"
                               ? "#22c55e"
                               : rechnung.status === "storniert"
                               ? "#ef4444"
                               : "#f59e0b"
                           };
                           display: inline-block;
                         ">${
                           rechnung.status === "bezahlt"
                             ? "🟢 Bezahlt"
                             : rechnung.status === "storniert"
                             ? "❌ Storniert"
                             : "⚠️ Mahnung"
                         }</span>`
                      : `<select class="form-select status-dropdown status-${
                          rechnung.status
                        }" 
                               onchange="updateRechnungStatus(${
                                 rechnung.id
                               }, this.value)" 
                               onclick="event.stopPropagation()"
                               style="
                                 font-weight: 600; 
                                 border-radius: 20px; 
                                 padding: 0.25rem 0.75rem;
                                 font-size: 0.85rem;
                                 border: 2px solid;
                                 background: ${
                                   rechnung.status === "offen"
                                     ? "rgba(245, 158, 11, 0.1)"
                                     : rechnung.status === "teilbezahlt"
                                     ? "rgba(59, 130, 246, 0.1)"
                                     : "transparent"
                                 };
                                 color: ${
                                   rechnung.status === "offen"
                                     ? "#f59e0b"
                                     : rechnung.status === "teilbezahlt"
                                     ? "#3b82f6"
                                     : "#6b7280"
                                 };
                                 border-color: ${
                                   rechnung.status === "offen"
                                     ? "#f59e0b"
                                     : rechnung.status === "teilbezahlt"
                                     ? "#3b82f6"
                                     : "#d1d5db"
                                 };
                               ">
                               <option value="offen" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;" ${
                                 rechnung.status === "offen" ? "selected" : ""
                               }>🟡 Offen</option>
                               <option value="teilbezahlt" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;" ${
                                 rechnung.status === "teilbezahlt"
                                   ? "selected"
                                   : ""
                               }>🔵 Teilbezahlt</option>
                               <option value="bezahlt" style="background: rgba(34, 197, 94, 0.1); color: #22c55e;" ${
                                 rechnung.status === "bezahlt" ? "selected" : ""
                               }>🟢 Bezahlt</option>
                               <option value="mahnung" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;" ${
                                 rechnung.status === "mahnung" ? "selected" : ""
                               }>⚠️ Mahnung</option>
                               <option value="storniert" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;" ${
                                 rechnung.status === "storniert"
                                   ? "selected"
                                   : ""
                               }>❌ Storniert</option>
                           </select>`
                  }
                </td>
                <td>
                  ${formatCurrency(rechnung.gesamtbetrag)}
                  ${addAnzahlungsInfoToRow(rechnung)}
                </td>
                <td>
                  ${generateRechnungActionButtons(rechnung)}
                </td>
            </tr>
        `
      )
      .join("");

    tableBody.innerHTML = newTableHTML;

    await new Promise((resolve) => {
      // RequestAnimationFrame für sicheren DOM-Update
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            addSearchToTable("rechnungen-table", "rechnungen-search");
            console.log("✅ Such-Funktionalität aktiviert");
          } catch (searchError) {
            console.warn(
              "⚠️ Suchfunktion konnte nicht aktiviert werden:",
              searchError
            );
          }
          resolve();
        });
      });
    });

    console.log(
      "✅ Rechnungen-Tabelle erfolgreich aktualisiert (mit Action-Button-Logik)"
    );

    // Event für andere Module dispatchen
    document.dispatchEvent(
      new CustomEvent("rechnungenLoaded", {
        detail: { count: window.rechnungen.length },
      })
    );
  } catch (error) {
    console.error("❌ Fehler beim Laden der Rechnungen:", error);

    // Fallback bei Fehlern
    const tableBody = document.querySelector("#rechnungen-table tbody");
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 20px; color: #ef4444;">
            <i class="fas fa-exclamation-triangle"></i> 
            Fehler beim Laden der Rechnungen
            <br><small style="color: #6b7280; margin-top: 8px;">${error.message}</small>
          </td>
        </tr>
      `;
    }

    showNotification("Fehler beim Laden der Rechnungen", "error");
  }
}

// Für Inline-Events
window.editRechnung = showRechnungModal;
window.viewRechnung = viewRechnung;
window.deleteRechnung = deleteRechnung;
window.updateRechnungStatus = updateRechnungStatus;
window.printRechnung = printRechnung;
window.calculateAnzahlung = calculateAnzahlung;
window.toggleAnzahlungSection = toggleAnzahlungSection;
window.quickAnzahlungUpdate = quickAnzahlungUpdate;
window.updateAnzahlung = updateAnzahlung;
window.generateRechnungActionButtons = generateRechnungActionButtons;

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
  <select class="form-select" name="einheit_${index}" onchange="calculateRechnungRow(${index})">
    <option value="Std." ${
      (position.einheit || standardPos.einheit) === "Std." ? "selected" : ""
    }>Std.</option>
    <option value="Min." ${
      (position.einheit || standardPos.einheit) === "Min." ? "selected" : ""
    }>Min.</option>
    <option value="Stk." ${
      (position.einheit || standardPos.einheit) === "Stk." ? "selected" : ""
    }>Stk.</option>
    <option value="Pauschal" ${
      (position.einheit || standardPos.einheit) === "Pauschal" ? "selected" : ""
    }>Pauschal</option>
    <option value="Liter" ${
      (position.einheit || standardPos.einheit) === "Liter" ? "selected" : ""
    }>Liter</option>
    <option value="kg" ${
      (position.einheit || standardPos.einheit) === "kg" ? "selected" : ""
    }>kg</option>
    <option value="m²" ${
      (position.einheit || standardPos.einheit) === "m²" ? "selected" : ""
    }>m²</option>
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
  const baseZahlungsbedingungen = getSetting("zahlungstext", "");
  const skontoText =
    skontoTage && skontoProzent
      ? `\nBei Zahlung innerhalb von ${skontoTage} Tagen ${skontoProzent}% Skonto.`
      : "";
  const zahlungsbedingungenMitSkonto = baseZahlungsbedingungen;

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

  <div class="payment-options-container" style="margin-top: 2rem;">
    <h3 style="margin-bottom: 1.5rem; color: #007bff;">💳 Zahlungsoptionen</h3>
    
    <div class="options-grid">
      ${
        skontoTage && skontoProzent
          ? `
      <div class="option-card skonto-card">
        <div class="option-checkbox-container">
          <input type="checkbox" 
                 id="skonto_aktiv" 
                 name="skonto_aktiv" 
                 class="option-checkbox"
                 ${rechnung?.skonto_aktiv ? "checked" : ""} 
                 onchange="toggleSkontoSection(); updateSkontoText();">
          <label for="skonto_aktiv" class="option-label">
            <div class="option-icon skonto">
              <i class="fas fa-percentage"></i>
            </div>
            <div class="option-content">
              <div class="option-title">Skonto</div>
              <div class="option-amount">${skontoProzent}% in ${skontoTage} Tagen</div>
              <div class="option-description">Frühzahlerrabatt verfügbar</div>
            </div>
            <div class="option-toggle">
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
      </div>
      `
          : ""
      }
      <div class="option-card anzahlung-card">
        <div class="option-checkbox-container">
          <input type="checkbox" 
                 id="anzahlung_aktiv" 
                 name="anzahlung_aktiv" 
                 class="option-checkbox"
                 ${rechnung?.anzahlung_betrag > 0 ? "checked" : ""} 
                 onchange="toggleAnzahlungSection(); calculateAnzahlung();">
          <label for="anzahlung_aktiv" class="option-label">
            <div class="option-icon anzahlung">
              <i class="fas fa-coins"></i>
            </div>
            <div class="option-content">
              <div class="option-title">Anzahlung</div>
              <div class="option-amount" id="anzahlung-display-amount">
                ${
                  rechnung?.anzahlung_betrag
                    ? formatCurrency(rechnung.anzahlung_betrag)
                    : "Betrag eingeben"
                }
              </div>
              <div class="option-description">Vorauszahlung erhalten</div>
            </div>
            <div class="option-toggle">
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
        
        <div id="anzahlung-details" class="option-details" 
             style="display: ${
               rechnung?.anzahlung_betrag > 0 ? "block" : "none"
             };">
          <div class="details-grid">
            <div class="detail-group">
              <label for="anzahlung-betrag" class="detail-label">
                <i class="fas fa-euro-sign"></i> Betrag
              </label>
              <input type="number" 
                     id="anzahlung-betrag" 
                     name="anzahlung_betrag" 
                     class="detail-input" 
                     step="0.01" 
                     min="0" 
                     value="${rechnung?.anzahlung_betrag || ""}"
                     placeholder="0,00"
                     oninput="calculateAnzahlung(); updateAnzahlungDisplay();">
            </div>
            
            <div class="detail-group">
              <label for="anzahlung-datum" class="detail-label">
                <i class="fas fa-calendar"></i> Datum
              </label>
              <input type="date" 
                     id="anzahlung-datum" 
                     name="anzahlung_datum" 
                     class="detail-input" 
                     value="${rechnung?.anzahlung_datum || ""}"
                     max="${new Date().toISOString().split("T")[0]}">
            </div>
            
            <div class="detail-group">
              <label class="detail-label">
                <i class="fas fa-calculator"></i> Restbetrag
              </label>
              <div class="restbetrag-display" id="restbetrag-display">
                ${formatCurrency(rechnung?.restbetrag || 0)}
              </div>
              <div class="anzahlung-status" id="anzahlung-status">
                ${
                  rechnung?.anzahlung_betrag > 0
                    ? rechnung.restbetrag <= 0
                      ? "Vollständig bezahlt"
                      : "Teilbezahlt"
                    : "Offen"
                }
              </div>
            </div>
          </div>
        </div>
      </div>
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

  .payment-options-container {
    background: var(--clr-surface-tonal-a10);
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    margin: 2rem 0;
  }

  .payment-options-container h3 {
    color: var(--accent-primary);
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .option-card {
    background: var(--clr-surface-a20);
    border-radius: 12px;
    border: 2px solid transparent;
    transition: all 0.3s ease;
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  .option-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    border-color: var(--clr-surface-a30);
  }

  .option-checkbox-container {
    position: relative;
  }

  .option-checkbox {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .option-label {
    display: flex;
    align-items: center;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border-radius: 12px;
  }

  .option-label:hover {
    background: var(--clr-surface-tonal-a10);
  }

  .option-icon {
    width: 50px;
    height: 50px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    margin-right: 1rem;
    transition: all 0.3s ease;
  }

  .option-icon.skonto {
    background: linear-gradient(135deg, var(--clr-primary-a20), var(--clr-primary-a30));
    color: var(--clr-dark-a0);
  }

  .option-icon.anzahlung {
    background: linear-gradient(135deg, var(--accent-warning), #f59e0b);
    color: var(--clr-dark-a0);
  }

  .option-content {
    flex: 1;
  }

  .option-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .option-amount {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--accent-primary);
    margin-bottom: 0.25rem;
  }

  .option-description {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .option-toggle {
    width: 60px;
    height: 32px;
    background: var(--clr-surface-a30);
    border-radius: 16px;
    position: relative;
    transition: all 0.3s ease;
  }

  .toggle-slider {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 28px;
    height: 28px;
    background: var(--clr-surface-a50);
    border-radius: 50%;
    transition: all 0.3s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  /* AKTIVIERTE STATES */
  .option-checkbox:checked + .option-label {
    background: var(--clr-surface-tonal-a20);
  }

  .option-checkbox:checked + .option-label .option-card {
    border-color: var(--accent-primary);
  }

  .option-checkbox:checked + .option-label .option-toggle {
    background: var(--accent-primary);
  }

  .option-checkbox:checked + .option-label .toggle-slider {
    transform: translateX(28px);
    background: var(--clr-dark-a0);
  }

  .option-checkbox:checked + .option-label .option-icon {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(131, 222, 143, 0.3);
  }

  /* ANZAHLUNG DETAILS */
  .option-details {
    padding: 0 1.25rem 1.25rem 1.25rem;
    border-top: 1px solid var(--border-color);
    background: var(--clr-surface-tonal-a10);
    animation: slideDown 0.3s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      max-height: 0;
      padding-top: 0;
      padding-bottom: 0;
    }
    to {
      opacity: 1;
      max-height: 200px;
      padding-top: 1.25rem;
      padding-bottom: 1.25rem;
    }
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1rem;
    margin-top: 1rem;
  }

  .detail-group {
    display: flex;
    flex-direction: column;
  }

  .detail-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .detail-label i {
    color: var(--accent-primary);
    font-size: 0.8rem;
  }

  .detail-input {
    padding: 0.75rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    font-size: 0.9rem;
    transition: all 0.3s ease;
    background: var(--clr-surface-a20);
    color: var(--text-primary);
  }

  .detail-input:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px rgba(131, 222, 143, 0.18);
    background: var(--clr-surface-a10);
  }

  .restbetrag-display {
    padding: 0.75rem;
    background: var(--clr-surface-tonal-a20);
    border: 2px solid var(--accent-success);
    border-radius: 8px;
    font-weight: 600;
    color: var(--accent-success);
    text-align: center;
  }

  .anzahlung-status {
    margin-top: 0.5rem;
    padding: 0.5rem;
    border-radius: 6px;
    text-align: center;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .anzahlung-status.status-offen {
    background: var(--clr-surface-tonal-a20);
    color: var(--text-muted);
    border: 1px solid var(--border-color);
  }

  .anzahlung-status.status-teilbezahlt {
    background: rgba(245, 158, 11, 0.2);
    color: var(--accent-warning);
    border: 1px solid var(--accent-warning);
  }

  .anzahlung-status.status-bezahlt {
    background: rgba(131, 222, 143, 0.2);
    color: var(--accent-success);
    border: 1px solid var(--accent-success);
  }

  /* MOBILE RESPONSIVE */
  @media (max-width: 768px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
    
    .options-grid {
      grid-template-columns: 1fr;
    }
    
    .details-grid {
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
    
    .option-label {
      flex-direction: column;
      text-align: center;
      gap: 1rem;
    }
    
    .option-icon {
      margin-right: 0;
      margin-bottom: 0.5rem;
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
          <option value="Std.">Std.</option>
  <option value="Min.">Min.</option>
  <option value="Stk." selected>Stk.</option>
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
          <option value="Std.">Std.</option>
  <option value="Min.">Min.</option>
  <option value="Stk." selected>Stk.</option>
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

function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

window.saveRechnung = async function (rechnungId = null) {
  console.log("💾 Speichere Rechnung...");

  const form = document.getElementById("rechnung-form");
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

  // 4. Button-Referenz und originalText RICHTIG definieren
  const saveButton = document.querySelector('button[onclick*="saveRechnung"]');
  let originalText = null; // ✅ WICHTIG: Hier richtig deklarieren

  if (saveButton) {
    originalText = saveButton.textContent; // ✅ Text vor Änderung speichern
  }

  const errors = [];

  // Kunde validieren
  const kundenId = parseInt(formData.get("kunden_id"));
  if (!kundenId || kundenId <= 0) {
    errors.push("Bitte wählen Sie einen Kunden aus");
    markFieldAsError("kunden_id", "Kunde ist erforderlich");
  }

  // Fahrzeug validieren
  const fahrzeugId = parseInt(formData.get("fahrzeug_id"));
  if (!fahrzeugId || fahrzeugId <= 0) {
    errors.push("Bitte wählen Sie ein Fahrzeug aus");
    markFieldAsError("fahrzeug_id", "Fahrzeug ist erforderlich");
  }

  // Rechnungsdatum validieren
  const rechnungsdatum = formData.get("rechnungsdatum");
  if (!rechnungsdatum) {
    errors.push("Rechnungsdatum ist erforderlich");
    markFieldAsError("rechnungsdatum", "Datum ist erforderlich");
  }

  // Positionen sammeln und validieren
  const positionen = [];
  const tbody = document.getElementById("positionen-tbody");

  if (tbody) {
    Array.from(tbody.children).forEach((row, index) => {
      const beschreibung =
        row
          .querySelector(`input[name="beschreibung_${index}"]`)
          ?.value?.trim() || "";
      const menge =
        parseFloat(row.querySelector(`input[name="menge_${index}"]`)?.value) ||
        0;
      const einheitElement = row.querySelector(
        `select[name="einheit_${index}"]`
      );
      const einheit = einheitElement?.value?.trim() || "Stk.";

      // Debugging hinzufügen:
      console.log(`Position ${index}:`, {
        einheitElement: einheitElement,
        selectedValue: einheitElement?.value,
        finalEinheit: einheit,
      });
      const einzelpreis =
        parseFloat(
          row.querySelector(`input[name="einzelpreis_${index}"]`)?.value
        ) || 0;
      const mwstProzent =
        parseInt(row.querySelector(`select[name="mwst_${index}"]`)?.value) ||
        19;
      const gesamt =
        parseFloat(row.querySelector(`input[name="gesamt_${index}"]`)?.value) ||
        0;

      if (beschreibung && menge > 0) {
        positionen.push({
          beschreibung,
          menge,
          einheit,
          einzelpreis,
          mwst_prozent: mwstProzent,
          gesamt,
        });
      }
    });
  }

  // Mindestens eine Position erforderlich
  if (positionen.length === 0) {
    errors.push(
      "Mindestens eine Position mit Beschreibung und Menge > 0 ist erforderlich"
    );
  }

  if (errors.length > 0) {
    console.error("❌ Validierungsfehler:", errors);
    showNotification(`Validierungsfehler:\n• ${errors.join("\n• ")}`, "error");
    return;
  }

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
    skonto_aktiv: formData.get("skonto_aktiv") === "on",
    skonto_betrag: 0,
    anzahlung_aktiv: formData.get("anzahlung_aktiv") === "on",
    anzahlung_betrag: parseFloat(formData.get("anzahlung_betrag")) || 0,
    anzahlung_datum: formData.get("anzahlung_datum") || null,
    restbetrag:
      parseFloat(
        document
          .getElementById("restbetrag-display")
          ?.textContent?.replace(/[^\d,-]/g, "")
          .replace(",", ".")
      ) || 0,
    positionen,
  };

  console.log("📋 Rechnungsdaten:", data);

  try {
    // Loading-Zustand anzeigen
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
    // ✅ Variablen außerhalb der if-Blöcke deklarieren (Function-Scope)
    let rechnung = null;
    let statusWert = null;
    let betragWert = null;
    let nummerWert = id; // Fallback zur ID
    let kundenname = "Kunde unbekannt";

    // Versuche Rechnung-Details zu laden für bessere Bestätigung
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
      statusWert = "Status unbekannt";

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
• Status: ${statusWert}

🔥 DIESE AKTION KANN NICHT RÜCKGÄNGIG GEMACHT WERDEN!

Trotzdem löschen?`;
      dialogTitle = "🧾 Rechnung löschen";
    } else {
      confirmMessage = `Rechnung (ID: ${id}) wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`;
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
          `Letzte Warnung für bezahlte Rechnung!\n\nRechnung: ${
            nummerWert || id
          }\nBetrag: ${betragText}\n\nSind Sie sich absolut sicher?`,
          "🚨 Finale Warnung"
        );

        if (!secondConfirm) {
          await customAlert("Löschung abgebrochen.", "info", "Abgebrochen");
          return;
        }
      }

      if (typeof showNotification === "function") {
        showNotification("Rechnung wird gelöscht...", "info");
      }

      await apiCall(`/api/rechnungen/${id}`, "DELETE");

      const erfolgsBetrag = betragWert
        ? `\nBetrag: € ${parseFloat(betragWert).toFixed(2)}`
        : "";

      await customAlert(
        `Rechnung erfolgreich gelöscht!${
          nummerWert && nummerWert !== id
            ? `\n\nRechnung-Nr: ${nummerWert}`
            : ""
        }${erfolgsBetrag}`,
        "success",
        "Rechnung gelöscht"
      );

      console.log("🔄 Aktualisiere Tabelle nach Löschung...");

      if (typeof showNotification === "function") {
        showNotification("Rechnung erfolgreich gelöscht", "success");
      }

      await loadRechnungen();

      if (typeof window.loadDashboard === "function") {
        setTimeout(() => window.loadDashboard(), 500);
      }

      console.log("✅ Tabelle erfolgreich nach Löschung aktualisiert");
    }
  } catch (error) {
    console.error("Fehler beim Löschen der Rechnung:", error);

    await customAlert(
      `Fehler beim Löschen der Rechnung:\n\n${
        error.message || "Unbekannter Fehler"
      }\n\nDie Rechnung wurde möglicherweise NICHT gelöscht.`,
      "error",
      "Löschung fehlgeschlagen"
    );

    if (typeof showNotification === "function") {
      showNotification("Fehler beim Löschen der Rechnung", "error");
    }

    setTimeout(() => loadRechnungen(), 1000);
  }
}

window.deleteRechnung = deleteRechnung;

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
      <div style="text-align: center; margin-bottom: 2rem;">
        <h2 style="color: #007bff; margin-bottom: 0;">RECHNUNG</h2>
        <div style="font-size: 18px; font-weight: bold;">${
          rechnung.rechnung_nr
        }</div>
      </div>
      
      <!-- Grid-Layout wie bei viewAuftrag -->
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Kunde:</label>
          <div><strong>${rechnung.kunde_name}</strong></div>
        </div>
        <div class="form-group">
          <label class="form-label">Fahrzeug:</label>
          <div>${rechnung.kennzeichen} - ${rechnung.marke} ${
      rechnung.modell
    }</div>
        </div>
        <div class="form-group">
          <label class="form-label">Rechnungsdatum:</label>
          <div>${formatDate(rechnung.rechnungsdatum)}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Status:</label>
          <div><span class="status status-${rechnung.status}">${
      rechnung.status === "offen"
        ? "Offen"
        : rechnung.status === "bezahlt"
        ? "Bezahlt"
        : rechnung.status === "mahnung"
        ? "Mahnung"
        : rechnung.status === "storniert"
        ? "Storniert"
        : rechnung.status
    }</span></div>
        </div>
        ${
          rechnung.auftrag_nr
            ? `
        <div class="form-group">
          <label class="form-label">Auftrag-Nr.:</label>
          <div>${rechnung.auftrag_nr}</div>
        </div>`
            : ""
        }
        <div class="form-group">
          <label class="form-label">Gesamtbetrag:</label>
          <div><strong>${formatCurrency(rechnung.gesamtbetrag)}</strong></div>
        </div>
      </div>

      <!-- Rechnungsempfänger und Fahrzeug nebeneinander -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 2rem 0;">
        <!-- Rechnungsempfänger -->
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--accent-primary);">Empfänger:</h3>
          <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 8px;">
            <strong style="font-size: 1.1rem;">${rechnung.kunde_name}</strong>
            ${
              rechnung.kunden_nr
                ? `<span><small style="color: var(--text-muted);">(Kd.-Nr.: ${rechnung.kunden_nr})</small>`
                : ""
            }<span><br>
            <div style="line-height: 1.5;">
              ${rechnung.strasse || ""}<br>
              ${rechnung.plz || ""} ${rechnung.ort || ""}<br>
              ${
                rechnung.telefon
                  ? `<span style="color: var(--text-muted);">Tel:</span> ${rechnung.telefon}`
                  : ""
              }
            </div>
          </div>
        </div>

        <!-- Fahrzeug -->
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--accent-primary);">Fahrzeug:</h3>
          <div style="background: var(--bg-tertiary); padding: 1.25rem; border-radius: 8px;">
            <strong style="font-size: 1.1rem;">${rechnung.kennzeichen} - ${
      rechnung.marke
    } ${rechnung.modell}</strong><br><br>
            <div style="line-height: 1.5;">
              ${
                rechnung.vin
                  ? `<span style="color: var(--text-muted);">VIN:</span> ${rechnung.vin}<br>`
                  : ""
              }
              ${
                rechnung.farbe || rechnung.farbcode
                  ? `<span style="color: var(--text-muted);">Farbe:</span> ${
                      rechnung.farbe || ""
                    } ${rechnung.farbcode ? `(${rechnung.farbcode})` : ""}`
                  : ""
              }
            </div>
          </div>
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

      <!-- Rechnungssumme Grid -->
      <div style="margin: 2rem 0; padding: 1.5rem; background: var(--bg-tertiary); border-radius: 8px;">
        <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: center;">
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Zwischensumme netto:</span>
              <span>${formatCurrency(rechnung.zwischensumme)}</span>
            </div>
            ${
              rechnung.rabatt_prozent > 0
                ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--accent-danger);">
              <span>Rabatt (${rechnung.rabatt_prozent}%):</span>
              <span>-${formatCurrency(rechnung.rabatt_betrag)}</span>
            </div>`
                : ""
            }
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>MwSt. (${rechnung.mwst_prozent}%):</span>
              <span>${formatCurrency(rechnung.mwst_betrag)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
              <span>Gesamtbetrag:</span>
              <span>${formatCurrency(rechnung.gesamtbetrag)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Firmen-/Zahlungsinfos -->
      <div style="margin-top: 2rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px; font-size: 0.9rem;">
        <strong>${firmenname}</strong><br>
        ${firmenStrasse}<br>
        ${firmenPlz} ${firmenOrt}<br>
        ${firmenTelefon ? `Tel: ${firmenTelefon}<br>` : ""}
        ${firmenEmail ? `E-Mail: ${firmenEmail}` : ""}
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="closeModal()">Schließen</button>
      <button class="btn btn-primary" onclick="printRechnung(${id})">
        <i class="fas fa-print"></i> Drucken
      </button>
    `;

    createModal(`Rechnung ${rechnung.rechnung_nr}`, content, footer);
  } catch (error) {
    console.error("Fehler beim Laden der Rechnung:", error);
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

function updateAnzahlungDisplay() {
  console.log("🔄 updateAnzahlungDisplay() aufgerufen");

  const betragInput = document.getElementById("anzahlung-betrag");
  const displayAmount = document.getElementById("anzahlung-display-amount");

  console.log("📋 Elements gefunden:", {
    betragInput: !!betragInput,
    displayAmount: !!displayAmount,
    betragValue: betragInput?.value,
  });

  if (betragInput && displayAmount) {
    const betrag = parseFloat(betragInput.value) || 0;
    const displayText = betrag > 0 ? formatCurrency(betrag) : "Betrag eingeben";
    displayAmount.textContent = displayText;

    console.log("✅ Display aktualisiert:", displayText);
  } else {
    console.warn("⚠️ Anzahlung Display Elemente nicht gefunden");
  }
}

// Skonto Section Toggle
function toggleSkontoSection() {
  console.log("🔄 toggleSkontoSection() aufgerufen");

  const checkbox = document.getElementById("skonto_aktiv");
  const card = checkbox?.closest(".option-card");

  if (card && checkbox) {
    if (checkbox.checked) {
      card.style.borderColor = "var(--accent-primary)";
      card.style.background = "var(--clr-surface-tonal-a20)";
      console.log("✅ Skonto aktiviert");
    } else {
      card.style.borderColor = "transparent";
      card.style.background = "var(--clr-surface-a20)";
      console.log("✅ Skonto deaktiviert");
    }
  }
}

// Anzahlung Section Toggle
function toggleAnzahlungSection() {
  console.log("🔄 toggleAnzahlungSection() aufgerufen");

  const checkbox = document.getElementById("anzahlung_aktiv");
  const details = document.getElementById("anzahlung-details");
  const card = checkbox?.closest(".option-card");

  console.log("📋 Toggle Elements:", {
    checkbox: !!checkbox,
    details: !!details,
    card: !!card,
    checked: checkbox?.checked,
  });

  if (!checkbox || !details) {
    console.error("❌ Anzahlung Toggle Elemente nicht gefunden");
    return;
  }

  if (checkbox.checked) {
    details.style.display = "block";
    if (card) {
      card.style.borderColor = "var(--accent-primary)";
      card.style.background = "var(--clr-surface-tonal-a20)";
    }

    const datumField = document.getElementById("anzahlung-datum");
    if (datumField && !datumField.value) {
      datumField.value = new Date().toISOString().split("T")[0];
    }

    console.log("✅ Anzahlung Details eingeblendet");
  } else {
    details.style.display = "none";
    if (card) {
      card.style.borderColor = "transparent";
      card.style.background = "var(--clr-surface-a20)";
    }

    const betragField = document.getElementById("anzahlung-betrag");
    const datumField = document.getElementById("anzahlung-datum");
    if (betragField) betragField.value = "";
    if (datumField) datumField.value = "";

    updateAnzahlungDisplay();
    calculateAnzahlung();

    console.log("✅ Anzahlung Details ausgeblendet");
  }
}

function calculateAnzahlung() {
  console.log("🔄 calculateAnzahlung() aufgerufen");

  const gesamtbetragElements = [
    document.getElementById("gesamtbetrag"),
    document.querySelector("#gesamtbetrag"),
    document.querySelector("[id*='gesamtbetrag']"),
    document.querySelector(".total-amount"),
    document.querySelector("#rechnung-gesamtbetrag"),
  ].filter((el) => el !== null);

  const anzahlungInput = document.getElementById("anzahlung-betrag");
  const restbetragElement = document.getElementById("restbetrag-display");
  const statusElement = document.getElementById("anzahlung-status");

  console.log("📋 Calculate Elements:", {
    gesamtbetragElements: gesamtbetragElements.length,
    anzahlungInput: !!anzahlungInput,
    restbetragElement: !!restbetragElement,
    statusElement: !!statusElement,
  });

  if (!anzahlungInput || !restbetragElement) {
    console.error("❌ Wichtige Anzahlung-Elemente nicht gefunden");
    return;
  }

  let gesamtbetrag = 0;
  let gesamtbetragText = "";

  if (gesamtbetragElements.length > 0) {
    const gesamtbetragElement = gesamtbetragElements[0];
    gesamtbetragText =
      gesamtbetragElement.textContent || gesamtbetragElement.value || "0";

    gesamtbetrag =
      parseFloat(gesamtbetragText.replace(/[^\d,-]/g, "").replace(",", ".")) ||
      0;

    if (gesamtbetrag === 0) {
      const numbers = gesamtbetragText.match(/[\d,\.]+/);
      if (numbers) {
        gesamtbetrag = parseFloat(numbers[0].replace(",", ".")) || 0;
      }
    }

    console.log("💰 Gesamtbetrag ermittelt:", {
      originalText: gesamtbetragText,
      parsedAmount: gesamtbetrag,
      element: gesamtbetragElement.id || gesamtbetragElement.className,
    });
  } else {
    console.warn("⚠️ Kein Gesamtbetrag-Element gefunden - verwende 0");
  }

  const anzahlung = parseFloat(anzahlungInput.value) || 0;

  console.log("📊 Berechnung:", {
    gesamtbetrag,
    anzahlung,
    isValid: gesamtbetrag > 0,
  });

  if (anzahlung > gesamtbetrag && gesamtbetrag > 0) {
    anzahlungInput.value = gesamtbetrag.toFixed(2);
    console.log("⚠️ Anzahlung auf Gesamtbetrag begrenzt");

    if (typeof showNotification === "function") {
      showNotification("Anzahlung auf Gesamtbetrag begrenzt", "warning");
    }

    return calculateAnzahlung();
  }

  const restbetrag = gesamtbetrag - anzahlung;

  try {
    if (typeof formatCurrency === "function") {
      restbetragElement.textContent = formatCurrency(restbetrag);
    } else {
      // Fallback Formatierung
      restbetragElement.textContent = `${restbetrag
        .toFixed(2)
        .replace(".", ",")} €`;
    }
    console.log("💰 Restbetrag aktualisiert:", restbetrag);
  } catch (error) {
    console.error("❌ Fehler bei Restbetrag-Formatierung:", error);
    restbetragElement.textContent = `${restbetrag.toFixed(2)} €`;
  }

  // STATUS AKTUALISIEREN
  if (statusElement) {
    let status = "Offen";
    let statusClass = "status-offen";

    if (anzahlung > 0) {
      if (restbetrag <= 0) {
        status = "Vollständig bezahlt";
        statusClass = "status-bezahlt";
      } else {
        status = "Teilbezahlt";
        statusClass = "status-teilbezahlt";
      }
    }

    statusElement.textContent = status;
    statusElement.className = `anzahlung-status ${statusClass}`;

    console.log("📋 Status aktualisiert:", status);
  }

  updateAnzahlungDisplay();

  console.log("✅ calculateAnzahlung() abgeschlossen");
}

const originalCalculateRechnungGesamt = window.calculateRechnungGesamt;
window.calculateRechnungGesamt = function () {
  console.log(
    "🔄 calculateRechnungGesamt() aufgerufen - auch Anzahlung neu berechnen"
  );

  // Ursprüngliche Funktion aufrufen
  if (typeof originalCalculateRechnungGesamt === "function") {
    originalCalculateRechnungGesamt();
  }

  // Kurz warten, dann Anzahlung neu berechnen
  setTimeout(() => {
    calculateAnzahlung();
  }, 100);
};

async function quickAnzahlungUpdate(rechnungId) {
  console.log("🔄 quickAnzahlungUpdate() für Rechnung:", rechnungId);

  try {
    const rechnung = await apiCall(`/api/rechnungen/${rechnungId}`);

    const content = `
      <div class="form-group">
        <label class="form-label">Gesamtbetrag: ${formatCurrency(
          rechnung.gesamtbetrag
        )}</label>
        <label class="form-label">Aktuelle Anzahlung: ${formatCurrency(
          rechnung.anzahlung_betrag || 0
        )}</label>
        <label class="form-label">Restbetrag: ${formatCurrency(
          rechnung.restbetrag || rechnung.gesamtbetrag
        )}</label>
      </div>
      
      <div class="form-group">
        <label for="quick-anzahlung-betrag" class="form-label">Neue Anzahlung</label>
        <input type="number" id="quick-anzahlung-betrag" class="form-input" 
               step="0.01" min="0" max="${rechnung.gesamtbetrag}"
               value="${rechnung.anzahlung_betrag || 0}">
      </div>
      
      <div class="form-group">
        <label for="quick-anzahlung-datum" class="form-label">Datum</label>
        <input type="date" id="quick-anzahlung-datum" class="form-input" 
               value="${
                 rechnung.anzahlung_datum ||
                 new Date().toISOString().split("T")[0]
               }">
      </div>
    `;

    createModal({
      title: `💰 Anzahlung - ${rechnung.rechnung_nr}`,
      content,
      size: "medium",
      buttons: [
        { text: "Abbrechen", class: "btn-secondary", action: "close" },
        {
          text: "Speichern",
          class: "btn-primary",
          action: async () => {
            const betrag = document.getElementById(
              "quick-anzahlung-betrag"
            ).value;
            const datum = document.getElementById(
              "quick-anzahlung-datum"
            ).value;
            await updateAnzahlung(rechnungId, betrag, datum);
          },
        },
      ],
    });
  } catch (error) {
    console.error("❌ Fehler beim quickAnzahlungUpdate:", error);
    if (typeof showNotification === "function") {
      showNotification("Fehler beim Laden der Rechnung", "error");
    }
  }
}

// Anzahlung API Update
async function updateAnzahlung(rechnungId, betrag, datum) {
  console.log("🔄 updateAnzahlung() API Call:", { rechnungId, betrag, datum });

  try {
    const response = await apiCall(
      `/api/rechnungen/${rechnungId}/anzahlung`,
      "PUT",
      {
        anzahlung_betrag: betrag,
        anzahlung_datum: datum,
      }
    );

    console.log("✅ Anzahlung API Response:", response);

    if (typeof showNotification === "function") {
      showNotification("Anzahlung erfolgreich aktualisiert", "success");
    }

    if (typeof closeModal === "function") {
      closeModal();
    }

    if (typeof loadRechnungen === "function") {
      loadRechnungen();
    }
  } catch (error) {
    console.error("❌ API Fehler bei updateAnzahlung:", error);
    if (typeof showNotification === "function") {
      showNotification(`Fehler: ${error.message}`, "error");
    }
  }
}

// GLOBALE FUNKTIONEN REGISTRIEREN
window.updateAnzahlungDisplay = updateAnzahlungDisplay;
window.toggleSkontoSection = toggleSkontoSection;
window.toggleAnzahlungSection = toggleAnzahlungSection;
window.calculateAnzahlung = calculateAnzahlung;
window.quickAnzahlungUpdate = quickAnzahlungUpdate;
window.updateAnzahlung = updateAnzahlung;

// DEBUG: Funktionen testen
console.log("🔧 Anzahlungs-Funktionen registriert:", {
  updateAnzahlungDisplay: typeof window.updateAnzahlungDisplay,
  toggleAnzahlungSection: typeof window.toggleAnzahlungSection,
  calculateAnzahlung: typeof window.calculateAnzahlung,
  formatCurrency: typeof window.formatCurrency || typeof formatCurrency,
  showNotification: typeof window.showNotification || typeof showNotification,
});

// DEINE BESTEHENDEN FUNKTIONEN (unverändert lassen)
window.updateSkontoText = function () {
  const skontoAktiv =
    document.querySelector('[name="skonto_aktiv"]')?.checked || false;
  const zahlungsbedingungenField = document.querySelector(
    '[name="zahlungsbedingungen"]'
  );

  if (!zahlungsbedingungenField) return;

  const baseText = getSetting("zahlungstext", "");
  const skontoTage = getSetting("skonto_tage", "");
  const skontoProzent = getSetting("skonto_prozent", "");

  let finalText = baseText;

  if (skontoAktiv && skontoTage && skontoProzent) {
    finalText += `\n\nBei Zahlung innerhalb von ${skontoTage} Tagen gewähren wir ${skontoProzent}% Skonto.`;
  }

  zahlungsbedingungenField.value = finalText;
};

window.addEventListener("settingsUpdated", () => {
  console.log("Einstellungen wurden aktualisiert - Rechnungen-Modul reagiert");
});

window.showRechnungModal = showRechnungModal;
