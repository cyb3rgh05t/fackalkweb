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

  const positionenRows = standardPositionen
    .map((pos, index) => {
      const position = rechnung?.positionen?.[index] || {};
      return `
        <tr>
            <td><input type="text" class="form-input" value="${
              position.beschreibung || pos.beschreibung
            }" name="beschreibung_${index}"></td>
            <td><input type="number" step="0.01" class="form-input" value="${
              position.menge || 0
            }" name="menge_${index}" onchange="calculateRechnungRow(${index})"></td>
            <td>${position.einheit || pos.einheit}</td>
            <td><input type="number" step="0.01" class="form-input" value="${
              position.einzelpreis || pos.einzelpreis
            }" name="einzelpreis_${index}" onchange="calculateRechnungRow(${index})"></td>
            <td>${position.mwst_prozent || pos.mwst}%</td>
            <td><input type="number" step="0.01" class="form-input" value="${
              position.gesamt || 0
            }" name="gesamt_${index}" readonly></td>
            <input type="hidden" name="kategorie_${index}" value="${
        position.kategorie || pos.kategorie
      }">
            <input type="hidden" name="einheit_${index}" value="${
        position.einheit || pos.einheit
      }">
            <input type="hidden" name="mwst_${index}" value="${
        position.mwst_prozent || pos.mwst
      }">
        </tr>
      `;
    })
    .join("");

  // Zahlungsbedingungen und Gewährleistung aus Einstellungen
  const zahlungsbedingungen = getSetting("zahlungsbedingungen", "");
  const gewaehrleistung = getSetting("gewaehrleistung", "");
  const zahlungszielTage = getSetting("zahlungsziel_tage", "14");

  const content = `
        <form id="rechnung-form">
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">Kunde *</label>
                    <select class="form-select" name="kunden_id" required onchange="loadKundenFahrzeuge(this.value)">
                        <option value="">Kunde auswählen</option>
                        ${kundenOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Fahrzeug *</label>
                    <select class="form-select" name="fahrzeug_id" required>
                        <option value="">Erst Kunde auswählen</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Rechnungsdatum *</label>
                    <input type="date" class="form-input" name="rechnungsdatum" value="${
                      rechnung?.rechnungsdatum ||
                      new Date().toISOString().split("T")[0]
                    }" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Auftragsdatum</label>
                    <input type="date" class="form-input" name="auftragsdatum" value="${
                      rechnung?.auftragsdatum || ""
                    }">
                </div>
                <div class="form-group">
                    <label class="form-label">Rabatt (%)</label>
                    <input type="number" step="0.01" class="form-input" name="rabatt_prozent" value="${
                      rechnung?.rabatt_prozent || 0
                    }" onchange="calculateRechnungTotal()">
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
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Beschreibung</th>
                            <th>Menge</th>
                            <th>Einheit</th>
                            <th>Einzelpreis (€)</th>
                            <th>MwSt %</th>
                            <th>Gesamt (€)</th>
                        </tr>
                    </thead>
                    <tbody>
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

            <h3 style="margin: 2rem 0 1rem 0;">Zahlungsbedingungen & Gewährleistung</h3>
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">Zahlungsbedingungen</label>
                    <textarea class="form-textarea" name="zahlungsbedingungen" rows="3">${zahlungsbedingungen}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Gewährleistung</label>
                    <textarea class="form-textarea" name="gewaehrleistung" rows="2">${gewaehrleistung}</textarea>
                </div>
            </div>
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
    for (let i = 0; i < 8; i++) {
      calculateRechnungRow(i);
    }
  }, 100);
}

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
  const menge =
    parseFloat(document.querySelector(`[name="menge_${index}"]`)?.value) || 0;
  const einzelpreis =
    parseFloat(
      document.querySelector(`[name="einzelpreis_${index}"]`)?.value
    ) || 0;
  const gesamt = menge * einzelpreis;
  const gesamtInput = document.querySelector(`[name="gesamt_${index}"]`);
  if (gesamtInput) gesamtInput.value = gesamt.toFixed(2);
  calculateRechnungTotal();
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

window.saveRechnung = async function (rechnungId = null) {
  const form = document.getElementById("rechnung-form");
  const formData = new FormData(form);
  const positionen = [];

  for (let i = 0; i < 8; i++) {
    const beschreibung = formData.get(`beschreibung_${i}`);
    const menge = parseFloat(formData.get(`menge_${i}`)) || 0;
    const einzelpreis = parseFloat(formData.get(`einzelpreis_${i}`)) || 0;
    const gesamt = parseFloat(formData.get(`gesamt_${i}`)) || 0;
    if (beschreibung && (menge > 0 || gesamt > 0)) {
      positionen.push({
        kategorie: formData.get(`kategorie_${i}`),
        beschreibung,
        menge,
        einheit: formData.get(`einheit_${i}`),
        einzelpreis,
        mwst_prozent: parseFloat(formData.get(`mwst_${i}`)),
        gesamt,
      });
    }
  }

  const data = {
    kunden_id: parseInt(formData.get("kunden_id")),
    fahrzeug_id: parseInt(formData.get("fahrzeug_id")),
    rechnungsdatum: formData.get("rechnungsdatum"),
    auftragsdatum: formData.get("auftragsdatum"),
    rabatt_prozent: parseFloat(formData.get("rabatt_prozent")) || 0,
    status: formData.get("status"),
    zahlungsbedingungen: formData.get("zahlungsbedingungen"),
    gewaehrleistung: formData.get("gewaehrleistung"),
    positionen,
  };

  try {
    if (rechnungId) {
      await apiCall(`/api/rechnungen/${rechnungId}`, "PUT", data);
      showNotification("Rechnung erfolgreich aktualisiert", "success");
    } else {
      await apiCall("/api/rechnungen", "POST", data);
      showNotification("Rechnung erfolgreich erstellt", "success");
    }
    closeModal();
    loadRechnungen();
  } catch (error) {
    showNotification("Fehler beim Speichern der Rechnung", "error");
  }
};

async function deleteRechnung(id) {
  if (
    confirm(
      "Rechnung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    )
  ) {
    try {
      await apiCall(`/api/rechnungen/${id}`, "DELETE");
      showNotification("Rechnung erfolgreich gelöscht", "success");
      loadRechnungen();
    } catch (error) {
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
    const bankIban = getSetting("bank_iban", "");
    const bankBic = getSetting("bank_bic", "");

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

// Hilfsfunktion: Rechnung direkt drucken (ohne Modal)
async function printRechnungDirect(id) {
  try {
    const rechnung = await apiCall(`/api/rechnungen/${id}`);

    // Einstellungen importieren falls nicht verfügbar
    if (!window.getSetting) {
      const einstellungenModule = await import("./einstellungen.js");
      window.getSetting = einstellungenModule.getSetting;
    }

    // Firmendaten aus Einstellungen laden
    const firmenname = getSetting("firmenname", "Meine Firma");
    const firmenStrasse = getSetting("firmen_strasse", "");
    const firmenPlz = getSetting("firmen_plz", "");
    const firmenOrt = getSetting("firmen_ort", "");
    const firmenTelefon = getSetting("firmen_telefon", "");
    const firmenEmail = getSetting("firmen_email", "");
    const firmenLogo =
      getSetting("firmen_logo", "") || getSetting("layout_logo", "");
    const steuernummer = getSetting("steuernummer", "");
    const umsatzsteuerId = getSetting("umsatzsteuer_id", "");
    const bankName = getSetting("bank_name", "");
    const bankIban = getSetting("bank_iban", "");
    const bankBic = getSetting("bank_bic", "");

    // LAYOUT-EINSTELLUNGEN LADEN
    const layoutSettings = {
      // Farben
      primaryColor: getSetting("layout_color_primary", "#007bff"),
      textColor: getSetting("layout_color_text", "#333333"),
      borderColor: getSetting("layout_color_border", "#ddd"),
      backgroundLight: getSetting("layout_color_background_light", "#f8f9fa"),

      // Schriften
      fontFamily: getSetting("layout_font_family", "Arial, sans-serif"),
      fontSize: getSetting("layout_font_size", "14px"),
      fontSizeSmall: getSetting("layout_font_size_small", "12px"),
      fontSizeLarge: getSetting("layout_font_size_large", "18px"),

      // Abstände
      margin: getSetting("layout_margin", "2cm"),
      padding: getSetting("layout_padding", "1rem"),
      sectionSpacing: getSetting("layout_section_spacing", "2rem"),

      // Kopfbereich
      headerEnabled: getSetting("layout_header_enabled", "true"),
      headerBorder: getSetting("layout_header_border_bottom", "true"),

      // Logo
      logoEnabled: getSetting("layout_logo_enabled", "true"),
      logoHeight: getSetting("layout_logo_height", "80px"),
      logoWidth: getSetting("layout_logo_width", "auto"),
      logoPosition: getSetting("layout_logo_position", "left"),

      // Tabellen
      tableHeaderBg: getSetting("layout_table_header_bg", "#f5f5f5"),
      tablePadding: getSetting("layout_table_padding", "12px 8px"),
      tableBorder: getSetting("layout_table_border", "1px solid #ddd"),
    };

    // Dynamisches CSS basierend auf Layout-Einstellungen generieren
    const layoutCSS = `
      body { 
        font-family: ${layoutSettings.fontFamily}; 
        margin: ${layoutSettings.margin}; 
        color: ${layoutSettings.textColor};
        font-size: ${layoutSettings.fontSize};
      }
      
      .header-section {
        display: flex; 
        justify-content: space-between; 
        align-items: start; 
        margin-bottom: ${layoutSettings.sectionSpacing}; 
        padding-bottom: ${layoutSettings.padding}; 
        ${
          layoutSettings.headerBorder === "true"
            ? `border-bottom: 2px solid ${layoutSettings.primaryColor};`
            : ""
        }
      }
      
      .company-logo {
        height: ${layoutSettings.logoHeight};
        width: ${layoutSettings.logoWidth};
        max-height: ${layoutSettings.logoHeight};
        object-fit: contain;
        margin-bottom: 1rem;
      }
      
      .company-title {
        color: ${layoutSettings.primaryColor}; 
        margin-bottom: 0.5rem; 
        font-size: 24px;
        font-weight: bold;
      }
      
      .company-details {
        color: #666; 
        line-height: 1.4; 
        font-size: ${layoutSettings.fontSize};
      }
      
      .document-title {
        color: ${layoutSettings.primaryColor}; 
        margin-bottom: 1rem; 
        font-size: 20px;
        font-weight: bold;
      }
      
      .info-section {
        margin-bottom: ${layoutSettings.sectionSpacing};
      }
      
      .info-box {
        background: ${layoutSettings.backgroundLight}; 
        padding: ${layoutSettings.padding}; 
        border-radius: 8px; 
        font-size: ${layoutSettings.fontSize};
      }
      
      .section-title {
        font-size: 16px; 
        margin-bottom: 0.5rem;
        color: ${layoutSettings.textColor};
        font-weight: bold;
      }
      
      .data-table {
        width: 100%; 
        border-collapse: collapse; 
        margin-bottom: ${layoutSettings.sectionSpacing}; 
        font-size: ${layoutSettings.fontSize};
      }
      
      .table-header {
        background-color: ${layoutSettings.tableHeaderBg};
      }
      
      .table-cell {
        padding: ${layoutSettings.tablePadding}; 
        border-bottom: ${layoutSettings.tableBorder}; 
        font-weight: normal;
      }
      
      .table-header-cell {
        padding: ${layoutSettings.tablePadding}; 
        text-align: left; 
        border-bottom: ${layoutSettings.tableBorder}; 
        font-weight: bold;
      }
      
      .summary-section {
        margin: ${layoutSettings.sectionSpacing} 0; 
        padding: ${layoutSettings.padding}; 
        background: ${layoutSettings.backgroundLight}; 
        border-radius: 8px; 
        font-size: ${layoutSettings.fontSize};
      }
      
      .total-row {
        display: flex; 
        justify-content: space-between; 
        padding-top: 1rem; 
        border-top: 2px solid ${layoutSettings.primaryColor}; 
        margin-top: 1rem; 
        font-size: ${layoutSettings.fontSizeLarge};
        font-weight: bold;
      }
      
      .footer-info {
        margin-top: ${layoutSettings.sectionSpacing}; 
        padding-top: 1rem; 
        border-top: 1px solid ${layoutSettings.borderColor}; 
        text-align: center; 
        color: #666; 
        font-size: ${layoutSettings.fontSizeSmall};
      }
      
      @media print { 
        body { margin: 1cm; }
        button { display: none; }
      }
      
      @page {
        margin: 1cm;
      }
    `;

    // HTML für Rechnung generieren
    const positionenHtml =
      rechnung.positionen
        ?.map(
          (pos) => `
        <tr>
          <td class="table-cell">${pos.beschreibung}</td>
          <td class="table-cell">${pos.menge} ${pos.einheit}</td>
          <td class="table-cell" style="text-align: right;">${formatCurrency(
            pos.einzelpreis
          )}</td>
          <td class="table-cell" style="text-align: center;">${
            pos.mwst_prozent
          }%</td>
          <td class="table-cell" style="text-align: right;">${formatCurrency(
            pos.gesamt
          )}</td>
        </tr>
      `
        )
        .join("") ||
      '<tr><td colspan="5" class="table-cell">Keine Positionen</td></tr>';

    const rechnungsHtml = `
  <!-- Firmen-Header -->
  <div class="header-section">
    <!-- Left section for company details -->
    <div>
      ${
        firmenLogo && layoutSettings.logoEnabled === "true"
          ? `<img src="${firmenLogo}" alt="${firmenname}" class="company-logo">`
          : ""
      }
      <h1 class="company-title">${firmenname}</h1>
      <div class="company-details">
        ${firmenStrasse}<br>
        ${firmenPlz} ${firmenOrt}<br>
        Tel: ${firmenTelefon}<br>
        E-Mail: ${firmenEmail}
      </div>
    </div>

    <!-- Right section for document title and details -->
    <div style="text-align: right;">
      <h2 class="document-title">RECHNUNG</h2>
      <div style="font-size: ${
        layoutSettings.fontSize
      };"><strong>Rechnung-Nr.:</strong> ${rechnung.rechnung_nr}</div>
      ${
        rechnung.auftrag_nr
          ? `<div style="font-size: ${layoutSettings.fontSize};"><strong>Auftragsnr.:</strong> ${rechnung.auftrag_nr}</div>`
          : ""
      }
      <div style="font-size: ${
        layoutSettings.fontSize
      };"><strong>Datum:</strong> ${formatDate(rechnung.rechnungsdatum)}</div>
      ${
        rechnung.auftragsdatum
          ? `<div style="font-size: ${
              layoutSettings.fontSize
            };"><strong>Auftragsdatum:</strong> ${formatDate(
              rechnung.auftragsdatum
            )}</div>`
          : ""
      }
    </div>
  </div>

  <!-- Kundendaten und Fahrzeugdaten nebeneinander -->
  <div class="info-section" style="display: flex; justify-content: space-between;">
    <!-- Left section for customer details -->
    <div style="width: 48%;">
      <h3 class="section-title">Rechnungsempfänger:</h3>
      <div class="info-box">
        <strong>${rechnung.kunde_name}</strong>${
      rechnung.kunden_nr
        ? ` <span style="color: #666;">(Kd.-Nr.: ${rechnung.kunden_nr})</span>`
        : ""
    }<br>
        ${rechnung.strasse || ""}<br>
        ${rechnung.plz || ""} ${rechnung.ort || ""}<br>
        ${rechnung.telefon ? `Tel: ${rechnung.telefon}` : ""}
      </div>
    </div>

    <!-- Right section for vehicle details -->
    <div style="width: 48%; text-align: right;">
      <h3 class="section-title">Fahrzeug:</h3>
      <div class="info-box">
        <strong>${rechnung.kennzeichen} - ${rechnung.marke} ${
      rechnung.modell
    }</strong><br>
        ${rechnung.vin ? `VIN: ${rechnung.vin}` : ""}${
      rechnung.vin && (rechnung.farbe || rechnung.farbcode) ? "<br>" : ""
    }
        ${rechnung.farbe ? `Farbe: ${rechnung.farbe}` : ""}${
      rechnung.farbcode ? ` (${rechnung.farbcode})` : ""
    }
      </div>
    </div>
  </div>

      <!-- Positionen -->
      <h3 class="section-title">Leistungen:</h3>
      <table class="data-table">
        <thead>
          <tr class="table-header">
            <th class="table-header-cell">Beschreibung</th>
            <th class="table-header-cell">Menge</th>
            <th class="table-header-cell" style="text-align: right;">Einzelpreis</th>
            <th class="table-header-cell" style="text-align: center;">MwSt.</th>
            <th class="table-header-cell" style="text-align: right;">Gesamt</th>
          </tr>
        </thead>
        <tbody>${positionenHtml}</tbody>
      </table>

      <!-- Rechnungssumme -->
      <div class="summary-section">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>Zwischensumme netto:</span>
          <span><strong>${formatCurrency(
            rechnung.zwischensumme
          )}</strong></span>
        </div>
        ${
          rechnung.rabatt_prozent > 0
            ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #dc3545;">
          <span>Rabatt ${rechnung.rabatt_prozent}%:</span>
          <span><strong>-${formatCurrency(
            rechnung.rabatt_betrag
          )}</strong></span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>Netto nach Rabatt:</span>
          <span><strong>${formatCurrency(
            rechnung.netto_nach_rabatt
          )}</strong></span>
        </div>
        `
            : ""
        }
        ${
          rechnung.mwst_19 > 0
            ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>zzgl. 19% MwSt.:</span>
          <span><strong>${formatCurrency(rechnung.mwst_19)}</strong></span>
        </div>
        `
            : ""
        }
        ${
          rechnung.mwst_7 > 0
            ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>zzgl. 7% MwSt.:</span>
          <span><strong>${formatCurrency(rechnung.mwst_7)}</strong></span>
        </div>
        `
            : ""
        }
        <div class="total-row">
          <span><strong>Gesamtbetrag:</strong></span>
          <span><strong>${formatCurrency(rechnung.gesamtbetrag)}</strong></span>
        </div>
      </div>

      <!-- Zahlungsbedingungen -->
      ${
        rechnung.zahlungsbedingungen
          ? `
      <div class="info-section">
        <h3 class="section-title">Zahlungsbedingungen:</h3>
        <p style="font-size: ${layoutSettings.fontSize}; line-height: 1.4;">${rechnung.zahlungsbedingungen}</p>
      </div>
      `
          : ""
      }

      <!-- Gewährleistung -->
      ${
        rechnung.gewaehrleistung
          ? `
      <div class="info-section">
        <h3 class="section-title">Gewährleistung:</h3>
        <p style="font-size: ${layoutSettings.fontSize}; line-height: 1.4;">${rechnung.gewaehrleistung}</p>
      </div>
      `
          : ""
      }

      <!-- Bankverbindung -->
      ${
        bankName || bankIban
          ? `
      <div class="info-section">
        <h3 class="section-title">Bankverbindung:</h3>
        <div class="info-box">
          ${bankName ? `${bankName}<br>` : ""}
          ${bankIban ? `IBAN: ${bankIban}<br>` : ""}
          ${bankBic ? `BIC: ${bankBic}` : ""}
        </div>
      </div>
      `
          : ""
      }

      <!-- Steuerinformationen -->
      ${
        steuernummer || umsatzsteuerId
          ? `
      <div class="footer-info">
        ${steuernummer ? `Steuernummer: ${steuernummer}` : ""}
        ${steuernummer && umsatzsteuerId ? " | " : ""}
        ${umsatzsteuerId ? `USt-IdNr.: ${umsatzsteuerId}` : ""}
      </div>
      `
          : ""
      }
    `;

    // Print-Fenster öffnen
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Rechnung ${rechnung.rechnung_nr}</title>
          <style>
            ${layoutCSS}
          </style>
        </head>
        <body>
          ${rechnungsHtml}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Kurz warten bis das Fenster vollständig geladen ist, dann drucken
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  } catch (error) {
    console.error("Error loading invoice for print:", error);
    showNotification("Fehler beim Laden der Rechnung für Druck", "error");
  }
}

// Event Listener für Einstellungsänderungen
window.addEventListener("settingsUpdated", () => {
  console.log("Einstellungen wurden aktualisiert - Rechnungen-Modul reagiert");
});
console.log("printRechnung v2.0 loaded - " + new Date().toISOString());
window.showRechnungModal = showRechnungModal;
