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
                <td>${formatCurrency(rechnung.gesamtbetrag || 0)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="showRechnungModal(${
                      rechnung.id
                    })" title="Anzeigen">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="editRechnung(${
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
  } catch (err) {
    console.error("Failed to load invoices:", err);
  }
}

window.viewRechnung = function (id) {
  showRechnungModal(id);
};

window.editRechnung = function (id) {
  showRechnungFormModal(id);
};

window.deleteRechnung = async function (id) {
  if (confirm("Rechnung wirklich löschen?")) {
    try {
      await apiCall(`/api/rechnungen/${id}`, "DELETE");
      showNotification("Rechnung erfolgreich gelöscht", "success");
      loadRechnungen();
    } catch (error) {
      showNotification("Fehler beim Löschen der Rechnung", "error");
    }
  }
};

window.updateRechnungStatus = async function (id, status) {
  try {
    await apiCall(`/api/rechnungen/${id}/status`, "PUT", { status });
    showNotification("Status erfolgreich aktualisiert", "success");
    loadRechnungen();
  } catch (error) {
    showNotification("Fehler beim Aktualisieren des Status", "error");
  }
};

window.showRechnungFormModal = function (rechnungId = null) {
  showRechnungFormModal(rechnungId);
};

// Neue Rechnung erstellen oder bearbeiten
async function showRechnungFormModal(rechnungId = null) {
  try {
    // Benötigte Daten laden - WICHTIG: Einstellungen zuerst laden!
    if (
      !window.einstellungen ||
      Object.keys(window.einstellungen).length === 0
    ) {
      console.log("Lade Einstellungen...");
      await import("./utils.js").then((m) => m.loadGlobalSettings());
    }

    if (!window.kunden) window.kunden = await apiCall("/api/kunden");
    const rechnung = rechnungId
      ? await apiCall(`/api/rechnungen/${rechnungId}`)
      : null;
    const isEdit = !!rechnung;

    const kundenOptions = window.kunden
      .map(
        (k) =>
          `<option value="${k.id}" ${
            k.id === rechnung?.kunden_id ? "selected" : ""
          }>${k.name}</option>`
      )
      .join("");

    // Einstellungen aus dem System holen - mit Debugging
    const mwstSatz = parseFloat(getSetting("mwst_satz", "19"));
    console.log(
      "MwSt-Satz aus Einstellungen:",
      mwstSatz,
      "Alle Einstellungen:",
      window.einstellungen
    );

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
              <td><span class="mwst-display">${
                position.mwst_prozent || pos.mwst
              } %</span></td>
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
                      <input type="text" class="form-input" value="${mwstSatz} %" readonly>
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
                      <span>MwSt. ${mwstSatz} %:</span>
                      <span id="mwst-betrag">0,00 €</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em; border-top: 1px solid var(--border-color); padding-top: 0.5rem; margin-top: 1rem;">
                      <span>GESAMTBETRAG:</span>
                      <span id="gesamtbetrag">0,00 €</span>
                  </div>
              </div>
              
              <div class="form-grid" style="margin-top: 2rem;">
                  <div class="form-group">
                      <label class="form-label">Rabatt (%)</label>
                      <input type="number" step="0.1" class="form-input" name="rabatt_prozent" value="${
                        rechnung?.rabatt_prozent || 0
                      }" onchange="calculateRechnungTotal()">
                  </div>
                  <div class="form-group">
                      <label class="form-label">Zahlungsbedingungen</label>
                      <textarea class="form-textarea" name="zahlungsbedingungen" rows="2">${
                        rechnung?.zahlungsbedingungen || zahlungsbedingungen
                      }</textarea>
                  </div>
                  <div class="form-group">
                      <label class="form-label">Gewährleistung</label>
                      <textarea class="form-textarea" name="gewaehrleistung" rows="2">${
                        rechnung?.gewaehrleistung || gewaehrleistung
                      }</textarea>
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
      isEdit ? `Rechnung ${rechnung.rechnung_nr} bearbeiten` : "Neue Rechnung",
      content,
      footer
    );

    // Fahrzeuge laden wenn Kunde bereits ausgewählt
    if (rechnung?.kunden_id) {
      loadKundenFahrzeuge(rechnung.kunden_id);
    }

    // Berechnungen aktualisieren
    setTimeout(calculateRechnungTotal, 100);
  } catch (error) {
    console.error("Fehler beim Laden der Rechnungsformular:", error);
    showNotification("Fehler beim Laden der Rechnungsformular", "error");
  }
}

// Rechnung anzeigen
window.showRechnungModal = async function (id) {
  try {
    const rechnung = await apiCall(`/api/rechnungen/${id}`);
    const settings = getSettings();

    // Firmendaten aus Einstellungen
    const firmenname = getSetting("firmenname", "");
    const strasse = getSetting("firmen_strasse", "");
    const plz = getSetting("firmen_plz", "");
    const ort = getSetting("firmen_ort", "");
    const telefon = getSetting("firmen_telefon", "");
    const email = getSetting("firmen_email", "");
    const steuernummer = getSetting("steuernummer", "");
    const umsatzsteuerId = getSetting("umsatzsteuer_id", "");
    const bankName = getSetting("bank_name", "");
    const bankIban = getSetting("bank_iban", "");
    const bankBic = getSetting("bank_bic", "");

    const positionenHtml = (rechnung.positionen || [])
      .map(
        (pos) => `
        <tr>
          <td>${pos.beschreibung}</td>
          <td>${pos.menge}</td>
          <td>${formatCurrency(pos.einzelpreis)}</td>
          <td>${pos.mwst_prozent} %</td>
          <td>${formatCurrency(pos.gesamt)}</td>
        </tr>
      `
      )
      .join("");

    const content = `
        <!-- Firmenkopf -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid var(--primary-color);">
          <div>
            ${
              getSetting("firmen_logo")
                ? `<img src="${getSetting(
                    "firmen_logo"
                  )}" alt="Logo" style="max-height: 80px; margin-bottom: 1rem;">`
                : ""
            }
            <h2 style="margin: 0; color: var(--primary-color);">${firmenname}</h2>
            <div style="margin-top: 0.5rem; color: var(--text-muted);">
              ${strasse ? `${strasse}<br>` : ""}
              ${plz || ort ? `${plz} ${ort}<br>` : ""}
              ${telefon ? `Tel: ${telefon}<br>` : ""}
              ${email ? `E-Mail: ${email}` : ""}
            </div>
          </div>
          <div style="text-align: right;">
            <div><strong>Rechnung Nr.:</strong> ${rechnung.rechnung_nr}</div>
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
            <strong>${rechnung.kunde_name}</strong><br>
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
            <span>MwSt. ${getSetting("mwst_satz", "19")} %:</span>
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
};

// Verbesserte Druckfunktion - diese überschreibt die alte
window.printRechnung = async function (id) {
  try {
    console.log("Drucke Rechnung mit ID:", id);
    const rechnung = await apiCall(`/api/rechnungen/${id}`);
    const settings = getSettings();

    // Firmendaten aus Einstellungen
    const firmenname = getSetting("firmenname", "");
    const strasse = getSetting("firmen_strasse", "");
    const plz = getSetting("firmen_plz", "");
    const ort = getSetting("firmen_ort", "");
    const telefon = getSetting("firmen_telefon", "");
    const email = getSetting("firmen_email", "");
    const steuernummer = getSetting("steuernummer", "");
    const umsatzsteuerId = getSetting("umsatzsteuer_id", "");
    const bankName = getSetting("bank_name", "");
    const bankIban = getSetting("bank_iban", "");
    const bankBic = getSetting("bank_bic", "");

    const positionenHtml = (rechnung.positionen || [])
      .map(
        (pos) => `
        <tr>
          <td>${pos.beschreibung}</td>
          <td>${pos.menge}</td>
          <td>${formatCurrency(pos.einzelpreis)}</td>
          <td>${pos.mwst_prozent} %</td>
          <td style="text-align: right">${formatCurrency(pos.gesamt)}</td>
        </tr>
      `
      )
      .join("");

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rechnung ${rechnung.rechnung_nr}</title>
          <meta charset="utf-8">
          <style>
            @page {
              margin: 2cm;
              size: A4;
            }
            
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 0;
              line-height: 1.4;
              color: #333;
            }
            
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 2rem;
              padding-bottom: 1rem;
              border-bottom: 2px solid #2563eb;
            }
            
            .header h1 {
              margin: 0;
              color: #2563eb;
              font-size: 24px;
            }
            
            .header .logo {
              max-height: 80px;
              margin-bottom: 1rem;
            }
            
            .invoice-info {
              text-align: right;
              font-size: 14px;
            }
            
            .invoice-info div {
              margin-bottom: 4px;
            }
            
            .customer-info {
              background: #f8f9fa;
              padding: 1rem;
              border-radius: 8px;
              margin-bottom: 2rem;
            }
            
            .customer-info h3 {
              margin-top: 0;
              margin-bottom: 0.5rem;
            }
            
            .vehicle-info {
              background: #f8f9fa;
              padding: 1rem;
              border-radius: 8px;
              margin-bottom: 2rem;
            }
            
            .vehicle-info h3 {
              margin-top: 0;
              margin-bottom: 0.5rem;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 1rem 0;
            }
            
            th, td {
              padding: 12px 8px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            
            th {
              background-color: #f8f9fa;
              font-weight: 600;
            }
            
            .amount-right {
              text-align: right;
            }
            
            .total-section {
              background: #f8f9fa;
              padding: 1rem;
              border-radius: 8px;
              margin: 2rem 0;
              width: 50%;
              margin-left: auto;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 0.5rem;
            }
            
            .total-final {
              font-weight: bold;
              font-size: 1.2em;
              border-top: 1px solid #ddd;
              padding-top: 0.5rem;
              margin-top: 1rem;
            }
            
            .payment-info {
              margin-top: 2rem;
              padding-top: 1rem;
              border-top: 1px solid #ddd;
            }
            
            .payment-info h4 {
              margin-bottom: 0.5rem;
            }
            
            .bank-info {
              background: #f8f9fa;
              padding: 1rem;
              border-radius: 8px;
              margin-top: 0.5rem;
            }
            
            .footer {
              margin-top: 2rem;
              padding-top: 1rem;
              border-top: 1px solid #ddd;
              text-align: center;
              color: #666;
              font-size: 0.9em;
            }
            
            @media print {
              body { 
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
              .header {
                border-bottom: 2px solid #2563eb !important;
              }
            }
          </style>
        </head>
        <body>
          <!-- Firmenkopf -->
          <div class="header">
            <div>
              ${
                getSetting("firmen_logo")
                  ? `<img src="${getSetting(
                      "firmen_logo"
                    )}" alt="Logo" class="logo">`
                  : ""
              }
              <h1>${firmenname}</h1>
              <div style="color: #666; margin-top: 0.5rem;">
                ${strasse ? `${strasse}<br>` : ""}
                ${plz || ort ? `${plz} ${ort}<br>` : ""}
                ${telefon ? `Tel: ${telefon}<br>` : ""}
                ${email ? `E-Mail: ${email}` : ""}
              </div>
            </div>
            <div class="invoice-info">
              <div><strong>Rechnung Nr.:</strong> ${rechnung.rechnung_nr}</div>
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
          <div class="customer-info">
            <h3>Rechnungsempfänger:</h3>
            <strong>${rechnung.kunde_name}</strong><br>
            ${rechnung.strasse || ""}<br>
            ${rechnung.plz || ""} ${rechnung.ort || ""}<br>
            ${rechnung.telefon ? `Tel: ${rechnung.telefon}` : ""}
          </div>

          <!-- Fahrzeugdaten -->
          <div class="vehicle-info">
            <h3>Fahrzeug:</h3>
            <strong>${rechnung.kennzeichen} - ${rechnung.marke} ${
      rechnung.modell
    }</strong><br>
            ${rechnung.vin ? `VIN: ${rechnung.vin}` : ""}
          </div>

          <!-- Positionen -->
          <h3>Erbrachte Leistungen:</h3>
          <table>
            <thead>
              <tr>
                <th>Beschreibung</th>
                <th>Menge</th>
                <th>Einzelpreis</th>
                <th>MwSt.</th>
                <th class="amount-right">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              ${positionenHtml}
            </tbody>
          </table>

          <!-- Rechnungssumme -->
          <div class="total-section">
            <div class="total-row">
              <span>Zwischensumme netto:</span>
              <span>${formatCurrency(rechnung.zwischensumme)}</span>
            </div>
            ${
              rechnung.rabatt_prozent > 0
                ? `
            <div class="total-row">
              <span>Rabatt (${rechnung.rabatt_prozent}%):</span>
              <span>-${formatCurrency(rechnung.rabatt_betrag)}</span>
            </div>
            <div class="total-row">
              <span>Netto nach Rabatt:</span>
              <span>${formatCurrency(rechnung.netto_nach_rabatt)}</span>
            </div>
            `
                : ""
            }
            <div class="total-row">
              <span>MwSt. ${getSetting("mwst_satz", "19")} %:</span>
              <span>${formatCurrency(
                rechnung.mwst_19 || rechnung.mwst_7 || 0
              )}</span>
            </div>
            <div class="total-row total-final">
              <span>GESAMTBETRAG:</span>
              <span>${formatCurrency(rechnung.gesamtbetrag)}</span>
            </div>
          </div>

          <!-- Zahlungsinformationen -->
          ${
            rechnung.zahlungsbedingungen || rechnung.gewaehrleistung || bankIban
              ? `
          <div class="payment-info">
            ${
              rechnung.zahlungsbedingungen
                ? `
            <div style="margin-bottom: 1rem;">
              <h4>Zahlungsbedingungen:</h4>
              <p>${rechnung.zahlungsbedingungen}</p>
            </div>
            `
                : ""
            }
            
            ${
              bankIban
                ? `
            <div style="margin-bottom: 1rem;">
              <h4>Bankverbindung:</h4>
              <div class="bank-info">
                ${
                  bankName
                    ? `<div><strong>Bank:</strong> ${bankName}</div>`
                    : ""
                }
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
              <p>${rechnung.gewaehrleistung}</p>
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
          <div class="footer">
            ${steuernummer ? `Steuernummer: ${steuernummer}` : ""}
            ${steuernummer && umsatzsteuerId ? " | " : ""}
            ${umsatzsteuerId ? `USt-IdNr.: ${umsatzsteuerId}` : ""}
          </div>
          `
              : ""
          }
        </body>
      </html>
    `;

    // Neues Fenster für Druck öffnen
    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();

    // Kurz warten bis Inhalt geladen ist, dann drucken
    printWindow.addEventListener("load", function () {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        // Fenster automatisch schließen nach dem Drucken
        printWindow.addEventListener("afterprint", function () {
          printWindow.close();
        });
      }, 500);
    });

    showNotification("Druckvorschau geöffnet", "success");
  } catch (error) {
    console.error("Druckfehler:", error);
    showNotification("Fehler beim Drucken der Rechnung", "error");
  }
};

// Kundenfarzeuge laden
window.loadKundenFahrzeuge = async function (kundenId) {
  try {
    const fahrzeuge = await apiCall(`/api/kunden/${kundenId}/fahrzeuge`);
    const fahrzeugSelect = document.querySelector('[name="fahrzeug_id"]');

    fahrzeugSelect.innerHTML = '<option value="">Fahrzeug auswählen</option>';
    fahrzeuge.forEach((f) => {
      fahrzeugSelect.innerHTML += `<option value="${f.id}">${f.kennzeichen} - ${f.marke} ${f.modell}</option>`;
    });
  } catch (error) {
    console.error("Fehler beim Laden der Fahrzeuge:", error);
  }
};

// Berechnung für eine Zeile
window.calculateRechnungRow = function (index) {
  const menge = parseFloat(
    document.querySelector(`[name="menge_${index}"]`)?.value || 0
  );
  const einzelpreis = parseFloat(
    document.querySelector(`[name="einzelpreis_${index}"]`)?.value || 0
  );
  const gesamt = menge * einzelpreis;

  const gesamtInput = document.querySelector(`[name="gesamt_${index}"]`);
  if (gesamtInput) {
    gesamtInput.value = gesamt.toFixed(2);
  }

  calculateRechnungTotal();
};

// Gesamtberechnung
window.calculateRechnungTotal = function () {
  const mwstSatz = parseFloat(getSetting("mwst_satz", "19")) / 100;
  let zwischensumme = 0;

  // Alle Positionen durchgehen
  document.querySelectorAll('[name^="gesamt_"]').forEach((input) => {
    zwischensumme += parseFloat(input.value || 0);
  });

  const rabattProzent = parseFloat(
    document.querySelector('[name="rabatt_prozent"]')?.value || 0
  );
  const rabattBetrag = zwischensumme * (rabattProzent / 100);
  const nettoNachRabatt = zwischensumme - rabattBetrag;
  const mwstBetrag = nettoNachRabatt * mwstSatz;
  const gesamtbetrag = nettoNachRabatt + mwstBetrag;

  // Anzeigen aktualisieren
  document.getElementById("zwischensumme").textContent =
    formatCurrency(zwischensumme);
  document.getElementById("rabatt-betrag").textContent =
    formatCurrency(rabattBetrag);
  document.getElementById("netto-nach-rabatt").textContent =
    formatCurrency(nettoNachRabatt);
  document.getElementById("mwst-betrag").textContent =
    formatCurrency(mwstBetrag);
  document.getElementById("gesamtbetrag").textContent =
    formatCurrency(gesamtbetrag);
};

// Rechnung speichern
window.saveRechnung = async function (rechnungId = null) {
  try {
    const form = document.getElementById("rechnung-form");
    const formData = new FormData(form);

    const mwstSatz = parseFloat(getSetting("mwst_satz", "19"));
    const positionen = [];

    // Positionen sammeln
    for (let i = 0; i < 8; i++) {
      const beschreibung = formData.get(`beschreibung_${i}`);
      const menge = parseFloat(formData.get(`menge_${i}`) || 0);
      const einzelpreis = parseFloat(formData.get(`einzelpreis_${i}`) || 0);
      const gesamt = parseFloat(formData.get(`gesamt_${i}`) || 0);

      if (beschreibung && (menge > 0 || einzelpreis > 0)) {
        positionen.push({
          kategorie: formData.get(`kategorie_${i}`),
          beschreibung,
          menge,
          einheit: formData.get(`einheit_${i}`),
          einzelpreis,
          mwst_prozent: mwstSatz,
          gesamt,
        });
      }
    }

    const rechnungsData = {
      kunden_id: parseInt(formData.get("kunden_id")),
      fahrzeug_id: parseInt(formData.get("fahrzeug_id")),
      rechnungsdatum: formData.get("rechnungsdatum"),
      auftragsdatum: formData.get("auftragsdatum") || null,
      status: formData.get("status"),
      positionen,
      rabatt_prozent: parseFloat(formData.get("rabatt_prozent") || 0),
      zahlungsbedingungen: formData.get("zahlungsbedingungen"),
      gewaehrleistung: formData.get("gewaehrleistung"),
    };

    const url = rechnungId
      ? `/api/rechnungen/${rechnungId}`
      : "/api/rechnungen";
    const method = rechnungId ? "PUT" : "POST";

    const result = await apiCall(url, method, rechnungsData);

    showNotification(
      `Rechnung ${result.rechnung_nr || "erfolgreich"} ${
        rechnungId ? "aktualisiert" : "erstellt"
      }`,
      "success"
    );

    closeModal();
    loadRechnungen();
  } catch (error) {
    showNotification("Fehler beim Speichern der Rechnung", "error");
  }
};

// Event Listener für Einstellungsänderungen
window.addEventListener("settingsUpdated", () => {
  console.log("Einstellungen wurden aktualisiert - Rechnungen-Modul reagiert");
  loadRechnungen(); // Rechnungen neu laden um aktualisierte Einstellungen zu verwenden
});

// Globale Funktionen für HTML onclick events - diese überschreiben alle vorherigen
window.showRechnungModal = showRechnungModal;
window.showRechnungFormModal = showRechnungFormModal;
window.editRechnung = editRechnung;
window.viewRechnung = viewRechnung;
window.deleteRechnung = deleteRechnung;
window.updateRechnungStatus = updateRechnungStatus;
window.loadKundenFahrzeuge = loadKundenFahrzeuge;
window.calculateRechnungRow = calculateRechnungRow;
window.calculateRechnungTotal = calculateRechnungTotal;
window.saveRechnung = saveRechnung;

// Exportiere für andere Module
export { loadRechnungen, showRechnungModal, showRechnungFormModal };
