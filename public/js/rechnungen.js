import {
  apiCall,
  showNotification,
  formatDate,
  formatCurrency,
} from "./utils.js";
import { addSearchToTable } from "./search.js";
import { createModal, closeModal } from "./modals.js";

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
  const standardPositionen = [
    {
      kategorie: "ARBEITSZEITEN",
      beschreibung: "Vorarbeiten/Schleifen",
      einheit: "Std.",
      einzelpreis: 110,
      mwst: 19,
    },
    {
      kategorie: "ARBEITSZEITEN",
      beschreibung: "Grundierung",
      einheit: "Std.",
      einzelpreis: 110,
      mwst: 19,
    },
    {
      kategorie: "ARBEITSZEITEN",
      beschreibung: "Lackierung",
      einheit: "Std.",
      einzelpreis: 110,
      mwst: 19,
    },
    {
      kategorie: "ARBEITSZEITEN",
      beschreibung: "Polieren/Finish",
      einheit: "Std.",
      einzelpreis: 110,
      mwst: 19,
    },
    {
      kategorie: "MATERIALIEN",
      beschreibung: "Grundierung",
      einheit: "Liter",
      einzelpreis: 0,
      mwst: 19,
    },
    {
      kategorie: "MATERIALIEN",
      beschreibung: "Basislack",
      einheit: "Liter",
      einzelpreis: 0,
      mwst: 19,
    },
    {
      kategorie: "MATERIALIEN",
      beschreibung: "Klarlack",
      einheit: "Liter",
      einzelpreis: 0,
      mwst: 19,
    },
    {
      kategorie: "MATERIALIEN",
      beschreibung: "Schleifpapier/Verbrauchsmaterial",
      einheit: "Pauschal",
      einzelpreis: 0,
      mwst: 19,
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
                    <span>MwSt. 19%:</span>
                    <span id="mwst-19">0,00 €</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>MwSt. 7%:</span>
                    <span id="mwst-7">0,00 €</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                    <span>GESAMTBETRAG:</span>
                    <span id="gesamtbetrag">0,00 €</span>
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
  let zwischensumme = 0,
    mwst19Basis = 0,
    mwst7Basis = 0;
  for (let i = 0; i < 8; i++) {
    const gesamtInput = document.querySelector(`[name="gesamt_${i}"]`);
    const mwstInput = document.querySelector(`[name="mwst_${i}"]`);
    if (gesamtInput && mwstInput) {
      const gesamt = parseFloat(gesamtInput.value) || 0;
      const mwst = parseFloat(mwstInput.value) || 0;
      zwischensumme += gesamt;
      if (mwst === 19) mwst19Basis += gesamt;
      else if (mwst === 7) mwst7Basis += gesamt;
    }
  }
  const rabattProzent =
    parseFloat(document.querySelector('[name="rabatt_prozent"]')?.value) || 0;
  const rabattBetrag = zwischensumme * (rabattProzent / 100);
  const nettoNachRabatt = zwischensumme - rabattBetrag;
  const mwst19 = mwst19Basis * (1 - rabattProzent / 100) * 0.19;
  const mwst7 = mwst7Basis * (1 - rabattProzent / 100) * 0.07;
  const gesamtbetrag = nettoNachRabatt + mwst19 + mwst7;
  const elements = {
    zwischensumme: document.getElementById("zwischensumme"),
    "rabatt-betrag": document.getElementById("rabatt-betrag"),
    "netto-nach-rabatt": document.getElementById("netto-nach-rabatt"),
    "mwst-19": document.getElementById("mwst-19"),
    "mwst-7": document.getElementById("mwst-7"),
    gesamtbetrag: document.getElementById("gesamtbetrag"),
  };
  if (elements.zwischensumme)
    elements.zwischensumme.textContent = formatCurrency(zwischensumme);
  if (elements["rabatt-betrag"])
    elements["rabatt-betrag"].textContent = formatCurrency(rabattBetrag);
  if (elements["netto-nach-rabatt"])
    elements["netto-nach-rabatt"].textContent = formatCurrency(nettoNachRabatt);
  if (elements["mwst-19"])
    elements["mwst-19"].textContent = formatCurrency(mwst19);
  if (elements["mwst-7"])
    elements["mwst-7"].textContent = formatCurrency(mwst7);
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
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Rechnung-Nr.:</label><div>${
          rechnung.rechnung_nr
        }</div></div>
        <div class="form-group"><label class="form-label">Kunde:</label><div>${
          rechnung.kunde_name
        }</div></div>
        <div class="form-group"><label class="form-label">Fahrzeug:</label><div>${
          rechnung.kennzeichen
        } - ${rechnung.marke} ${rechnung.modell}</div></div>
        <div class="form-group"><label class="form-label">Rechnungsdatum:</label><div>${formatDate(
          rechnung.rechnungsdatum
        )}</div></div>
        <div class="form-group"><label class="form-label">Status:</label><div><span class="status status-${
          rechnung.status
        }">${rechnung.status}</span></div></div>
        <div class="form-group"><label class="form-label">Gesamtbetrag:</label><div><strong>${formatCurrency(
          rechnung.gesamtbetrag
        )}</strong></div></div>
      </div>
      <h3>Positionen</h3>
      <table class="table">
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
      <div style="margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>Zwischensumme netto:</span>
          <span>${formatCurrency(rechnung.zwischensumme)}</span>
        </div>
        ${
          rechnung.rabatt_prozent > 0
            ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>Rabatt (${rechnung.rabatt_prozent}%):</span>
          <span>${formatCurrency(rechnung.rabatt_betrag)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>Netto nach Rabatt:</span>
          <span>${formatCurrency(rechnung.netto_nach_rabatt)}</span>
        </div>
        `
            : ""
        }
        ${
          rechnung.mwst_19 > 0
            ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>MwSt. 19%:</span>
          <span>${formatCurrency(rechnung.mwst_19)}</span>
        </div>
        `
            : ""
        }
        ${
          rechnung.mwst_7 > 0
            ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span>MwSt. 7%:</span>
          <span>${formatCurrency(rechnung.mwst_7)}</span>
        </div>
        `
            : ""
        }
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
          <span>GESAMTBETRAG:</span>
          <span>${formatCurrency(rechnung.gesamtbetrag)}</span>
        </div>
      </div>
    `;
    createModal(`Rechnung ${rechnung.rechnung_nr}`, content);
  } catch (error) {
    showNotification("Fehler beim Laden der Rechnung", "error");
  }
}

function printRechnung(id) {
  showNotification("Druck-Funktion noch nicht implementiert", "info");
}
window.showRechnungModal = showRechnungModal;
