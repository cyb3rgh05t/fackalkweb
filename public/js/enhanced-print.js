// Erweiterte Print-Funktionen mit Layout-Editor Integration
// Ersetzt und erweitert die bestehenden Print-Funktionen

import { getSetting } from "./einstellungen.js";
import { generateLayoutCSS, DEFAULT_LAYOUT_SETTINGS } from "./layout-editor.js";
import { formatCurrency } from "./utils.js";

// Enhanced Print-System
class EnhancedPrintSystem {
  constructor() {
    this.layoutSettings = {};
    this.loadLayoutSettings();
  }

  // Layout-Einstellungen laden
  loadLayoutSettings() {
    this.layoutSettings = window.einstellungen || {};

    // Fallback auf Standardwerte
    Object.keys(DEFAULT_LAYOUT_SETTINGS).forEach((key) => {
      if (!this.layoutSettings[key]) {
        this.layoutSettings[key] = DEFAULT_LAYOUT_SETTINGS[key];
      }
    });
  }

  // Universelle Print-Funktion
  async printDocument(type, id) {
    try {
      const data = await this.loadDocumentData(type, id);
      const html = this.generatePrintHTML(type, data);
      this.openPrintWindow(html, `${type} ${data.number}`);
    } catch (error) {
      console.error(`Fehler beim Drucken von ${type}:`, error);
      showNotification(`Fehler beim Drucken des ${type}s`, "error");
    }
  }

  // Dokument-Daten laden
  async loadDocumentData(type, id) {
    const apiCall = window.apiCall;

    if (type === "rechnung") {
      return await apiCall(`/api/rechnungen/${id}`);
    } else if (type === "auftrag") {
      return await apiCall(`/api/auftraege/${id}`);
    }

    throw new Error(`Unbekannter Dokumenttyp: ${type}`);
  }

  // Print-HTML generieren
  generatePrintHTML(type, data) {
    const css = generateLayoutCSS();
    const header = this.generateHeader(type, data);
    const customerInfo = this.generateCustomerInfo(data);
    const positions = this.generatePositions(type, data);
    const summary = this.generateSummary(type, data);
    const footer = this.generateFooter();
    const signature = this.generateSignature(type);

    return `
      <!DOCTYPE html>
      <html lang="de">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${this.getDocumentTitle(type, data)}</title>
          <style>
            ${css}
            /* Zusätzliche Print-Optimierungen */
            @media print {
              body { 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .no-print { display: none !important; }
              .page-break-before { page-break-before: always; }
              .page-break-after { page-break-after: always; }
              .page-break-inside-avoid { page-break-inside: avoid; }
            }
            
            /* Layout-spezifische Anpassungen */
            .document-header {
              ${this.getHeaderStyles()}
            }
            
            .company-info {
              ${this.getCompanyInfoStyles()}
            }
            
            .document-title {
              ${this.getDocumentTitleStyles()}
            }
            
            .customer-section {
              ${this.getCustomerSectionStyles()}
            }
            
            .positions-table {
              ${this.getPositionsTableStyles()}
            }
            
            .summary-section {
              ${this.getSummarySectionStyles()}
            }
          </style>
        </head>
        <body>
          <div class="no-print print-controls">
            <button onclick="window.print()" class="btn btn-primary">
              <i class="fas fa-print"></i> Drucken
            </button>
            <button onclick="window.close()" class="btn btn-secondary">
              <i class="fas fa-times"></i> Schließen
            </button>
          </div>
          
          <div class="document-container">
            ${header}
            ${customerInfo}
            ${positions}
            ${summary}
            ${footer}
            ${signature}
          </div>
          
          <script>
            // Auto-Print nach kurzer Verzögerung
            setTimeout(() => {
              if (${this.layoutSettings.layout_auto_print === "true"}) {
                window.print();
              }
            }, 1000);
            
            // Fenster nach Druck schließen
            window.addEventListener('afterprint', () => {
              if (${this.layoutSettings.layout_close_after_print === "true"}) {
                setTimeout(() => window.close(), 1000);
              }
            });
          </script>
        </body>
      </html>
    `;
  }

  // Header-Bereich generieren
  generateHeader(type, data) {
    const firmenname = getSetting("firmenname", "FAF Lackiererei");
    const firmenStrasse = getSetting("firmen_strasse", "");
    const firmenPlz = getSetting("firmen_plz", "");
    const firmenOrt = getSetting("firmen_ort", "");
    const firmenTelefon = getSetting("firmen_telefon", "");
    const firmenEmail = getSetting("firmen_email", "");
    const logo = getSetting("firmen_logo", "");

    const logoHtml = logo
      ? `
      <div class="company-logo">
        <img src="${logo}" alt="${firmenname}" style="max-width: ${this.layoutSettings.layout_logo_max_width}; max-height: ${this.layoutSettings.layout_logo_max_height};">
      </div>
    `
      : "";

    const documentTitle = type === "rechnung" ? "RECHNUNG" : "AUFTRAG";
    const documentNumber =
      type === "rechnung" ? data.rechnung_nr : data.auftrag_nr;
    const documentDate = type === "rechnung" ? data.rechnungsdatum : data.datum;

    return `
      <div class="document-header header-section">
        <div class="company-info">
          ${logoHtml}
          <h1>${firmenname}</h1>
          <div class="company-address text-muted">
            ${firmenStrasse ? `${firmenStrasse}<br>` : ""}
            ${firmenPlz || firmenOrt ? `${firmenPlz} ${firmenOrt}<br>` : ""}
            ${firmenTelefon ? `Tel: ${firmenTelefon}<br>` : ""}
            ${firmenEmail ? `E-Mail: ${firmenEmail}` : ""}
          </div>
        </div>
        <div class="document-title">
          <h2>${documentTitle}</h2>
          <div class="document-meta">
            <div><strong>${
              type === "rechnung" ? "Rechnung-Nr." : "Auftrag-Nr."
            }:</strong> ${documentNumber}</div>
            <div><strong>Datum:</strong> ${new Date(
              documentDate
            ).toLocaleDateString("de-DE")}</div>
            ${
              type === "rechnung" && data.auftragsdatum
                ? `<div><strong>Auftragsdatum:</strong> ${new Date(
                    data.auftragsdatum
                  ).toLocaleDateString("de-DE")}</div>`
                : ""
            }
          </div>
        </div>
      </div>
    `;
  }

  // Kundeninformationen generieren
  generateCustomerInfo(data) {
    const kunde = data.kunde || {};
    const fahrzeug = data.fahrzeug || {};

    return `
      <div class="customer-section">
        <div class="customer-info">
          <h4>Rechnungsadresse</h4>
          <div class="customer-details">
            ${kunde.name || "Kunde"}<br>
            ${kunde.strasse || ""}<br>
            ${kunde.plz || ""} ${kunde.ort || ""}<br>
            ${kunde.telefon ? `Tel: ${kunde.telefon}<br>` : ""}
            ${kunde.email ? `E-Mail: ${kunde.email}` : ""}
          </div>
        </div>
        
        <div class="vehicle-info">
          <h4>Fahrzeugdaten</h4>
          <div class="vehicle-details">
            ${fahrzeug.marke || ""} ${fahrzeug.modell || ""}<br>
            ${
              fahrzeug.kennzeichen
                ? `Kennzeichen: ${fahrzeug.kennzeichen}<br>`
                : ""
            }
            ${fahrzeug.farbe ? `Farbe: ${fahrzeug.farbe}<br>` : ""}
            ${fahrzeug.vin ? `VIN: ${fahrzeug.vin}` : ""}
          </div>
        </div>
      </div>
    `;
  }

  // Positionen-Tabelle generieren
  generatePositions(type, data) {
    const positionen = data.positionen || [];

    if (!positionen.length) {
      return `
        <div class="positions-section">
          <h3>${
            type === "rechnung" ? "Rechnungspositionen" : "Arbeitsschritte"
          }</h3>
          <div class="no-positions">Keine Positionen vorhanden</div>
        </div>
      `;
    }

    const tableHeaders =
      type === "rechnung"
        ? ["Beschreibung", "Menge", "Einzelpreis", "MwSt", "Gesamt"]
        : ["Beschreibung", "Zeit", "Stundenpreis", "Gesamt"];

    const positionenHtml = positionen
      .map((pos) => {
        if (type === "rechnung") {
          return `
          <tr>
            <td>${pos.beschreibung || ""}</td>
            <td>${pos.menge || ""} ${pos.einheit || ""}</td>
            <td class="text-right">${formatCurrency(pos.einzelpreis || 0)}</td>
            <td class="text-center">${pos.mwst_prozent || 0}%</td>
            <td class="text-right">${formatCurrency(pos.gesamt || 0)}</td>
          </tr>
        `;
        } else {
          return `
          <tr>
            <td>${pos.beschreibung || ""}</td>
            <td class="text-center">${pos.zeit || ""} ${
            pos.einheit || "Std"
          }</td>
            <td class="text-right">${formatCurrency(pos.stundenpreis || 0)}</td>
            <td class="text-right">${formatCurrency(pos.gesamt || 0)}</td>
          </tr>
        `;
        }
      })
      .join("");

    return `
      <div class="positions-section">
        <h3>${
          type === "rechnung" ? "Rechnungspositionen" : "Arbeitsschritte"
        }</h3>
        <table class="positions-table">
          <thead>
            <tr>
              ${tableHeaders.map((header) => `<th>${header}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${positionenHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // Summen-Bereich generieren
  generateSummary(type, data) {
    if (type === "rechnung") {
      return this.generateRechnungsSummary(data);
    } else {
      return this.generateAuftragsSummary(data);
    }
  }

  // Rechnungs-Summe generieren
  generateRechnungsSummary(data) {
    const zwischensumme = data.zwischensumme || 0;
    const rabattProzent = data.rabatt_prozent || 0;
    const rabattBetrag = data.rabatt_betrag || 0;
    const nettoNachRabatt = data.netto_nach_rabatt || zwischensumme;
    const mwst19 = data.mwst_19 || 0;
    const mwst7 = data.mwst_7 || 0;
    const gesamtbetrag = data.gesamtbetrag || 0;

    return `
      <div class="summary-section">
        <div class="summary-calculations">
          <div class="summary-row">
            <label>Zwischensumme:</label>
            <span>${formatCurrency(zwischensumme)}</span>
          </div>
          
          ${
            rabattProzent > 0
              ? `
            <div class="summary-row">
              <label>Rabatt (${rabattProzent}%):</label>
              <span>-${formatCurrency(rabattBetrag)}</span>
            </div>
            <div class="summary-row">
              <label>Netto nach Rabatt:</label>
              <span>${formatCurrency(nettoNachRabatt)}</span>
            </div>
          `
              : ""
          }
          
          ${
            mwst19 > 0
              ? `
            <div class="summary-row">
              <label>zzgl. 19% MwSt:</label>
              <span>${formatCurrency(mwst19)}</span>
            </div>
          `
              : ""
          }
          
          ${
            mwst7 > 0
              ? `
            <div class="summary-row">
              <label>zzgl. 7% MwSt:</label>
              <span>${formatCurrency(mwst7)}</span>
            </div>
          `
              : ""
          }
          
          <div class="summary-row total-row">
            <label><strong>Gesamtbetrag:</strong></label>
            <span><strong>${formatCurrency(gesamtbetrag)}</strong></span>
          </div>
        </div>
        
        ${this.generatePaymentTerms()}
      </div>
    `;
  }

  // Auftrags-Summe generieren
  generateAuftragsSummary(data) {
    const gesamtNetto = data.gesamt_kosten || 0;
    const mwstSatz = parseFloat(getSetting("mwst_satz", "19"));
    const mwstBetrag = gesamtNetto * (mwstSatz / 100);
    const gesamtBrutto = gesamtNetto + mwstBetrag;

    return `
      <div class="summary-section">
        <div class="summary-calculations">
          <div class="summary-row">
            <label>Gesamtkosten (netto):</label>
            <span>${formatCurrency(gesamtNetto)}</span>
          </div>
          <div class="summary-row">
            <label>zzgl. ${mwstSatz}% MwSt:</label>
            <span>${formatCurrency(mwstBetrag)}</span>
          </div>
          <div class="summary-row total-row">
            <label><strong>Gesamtbetrag (brutto):</strong></label>
            <span><strong>${formatCurrency(gesamtBrutto)}</strong></span>
          </div>
        </div>
        
        ${this.generateWorkConditions()}
      </div>
    `;
  }

  // Zahlungsbedingungen generieren
  generatePaymentTerms() {
    const zahlungsbedingungen = getSetting(
      "zahlungsbedingungen",
      "Zahlbar innerhalb von 14 Tagen ohne Abzug."
    );
    const gewaehrleistung = getSetting(
      "gewaehrleistung",
      "Gewährleistung nach gesetzlichen Bestimmungen."
    );

    return `
      <div class="payment-terms">
        <div class="terms-section">
          <h4>Zahlungsbedingungen</h4>
          <p>${zahlungsbedingungen}</p>
        </div>
        <div class="warranty-section">
          <h4>Gewährleistung</h4>
          <p>${gewaehrleistung}</p>
        </div>
      </div>
    `;
  }

  // Arbeitsbedingungen generieren
  generateWorkConditions() {
    const arbeitsbedingungen = getSetting(
      "arbeitsbedingungen",
      "Alle Arbeiten werden nach bestem Wissen und Gewissen ausgeführt."
    );

    return `
      <div class="work-conditions">
        <div class="conditions-section">
          <h4>Arbeitsbedingungen</h4>
          <p>${arbeitsbedingungen}</p>
        </div>
      </div>
    `;
  }

  // Footer generieren
  generateFooter() {
    if (this.layoutSettings.layout_footer_enabled !== "true") {
      return "";
    }

    const steuernummer = getSetting("steuernummer", "");
    const umsatzsteuerId = getSetting("umsatzsteuer_id", "");
    const bankName = getSetting("bank_name", "");
    const bankIban = getSetting("bank_iban", "");
    const bankBic = getSetting("bank_bic", "");

    const bankInfo =
      bankName || bankIban
        ? `
      <div class="bank-info">
        <h4>Bankverbindung</h4>
        ${bankName ? `${bankName}<br>` : ""}
        ${bankIban ? `IBAN: ${bankIban}<br>` : ""}
        ${bankBic ? `BIC: ${bankBic}` : ""}
      </div>
    `
        : "";

    const taxInfo =
      steuernummer || umsatzsteuerId
        ? `
      <div class="tax-info">
        ${steuernummer ? `Steuernummer: ${steuernummer}` : ""}
        ${steuernummer && umsatzsteuerId ? " | " : ""}
        ${umsatzsteuerId ? `USt-IdNr.: ${umsatzsteuerId}` : ""}
      </div>
    `
        : "";

    return `
      <div class="footer-section">
        ${bankInfo}
        ${taxInfo}
      </div>
    `;
  }

  // Unterschriften-Bereich generieren
  generateSignature(type) {
    if (
      this.layoutSettings.layout_signature_enabled !== "true" ||
      type !== "auftrag"
    ) {
      return "";
    }

    const today = new Date().toLocaleDateString("de-DE");

    return `
      <div class="signature-section page-break-inside-avoid">
        <h3><i class="fas fa-pen"></i> Kundenabnahme</h3>
        <p>Hiermit bestätige ich die ordnungsgemäße Ausführung der oben aufgeführten Arbeiten und erkenne die Rechnung in der angegebenen Höhe an.</p>
        
        <div class="signature-boxes">
          <div class="signature-box">
            <div class="signature-date">Datum: ${today}</div>
            <div class="signature-label">Unterschrift Kunde</div>
          </div>
          <div class="signature-box">
            <div class="signature-date">Datum: ${today}</div>
            <div class="signature-label">Unterschrift FAF Lackiererei</div>
          </div>
        </div>
      </div>
    `;
  }

  // Styling-Hilfsmethoden
  getHeaderStyles() {
    return `
      display: flex;
      justify-content: ${this.layoutSettings.layout_header_alignment};
      align-items: start;
      margin-bottom: ${this.layoutSettings.layout_section_spacing};
      padding: ${this.layoutSettings.layout_header_padding};
      border-bottom: ${this.layoutSettings.layout_header_border} ${this.layoutSettings.layout_color_primary};
    `;
  }

  getCompanyInfoStyles() {
    return `
      flex: 1;
    `;
  }

  getDocumentTitleStyles() {
    return `
      text-align: right;
      flex: 1;
    `;
  }

  getCustomerSectionStyles() {
    return `
      display: flex;
      justify-content: space-between;
      margin: ${this.layoutSettings.layout_section_spacing} 0;
      gap: 2rem;
    `;
  }

  getPositionsTableStyles() {
    return `
      width: 100%;
      border-collapse: ${this.layoutSettings.layout_table_border_collapse};
      margin: ${this.layoutSettings.layout_paragraph_spacing} 0;
    `;
  }

  getSummarySectionStyles() {
    return `
      margin-top: ${this.layoutSettings.layout_section_spacing};
    `;
  }

  // Dokumenttitel generieren
  getDocumentTitle(type, data) {
    const documentType = type === "rechnung" ? "Rechnung" : "Auftrag";
    const number = type === "rechnung" ? data.rechnung_nr : data.auftrag_nr;
    return `${documentType} ${number}`;
  }

  // Print-Fenster öffnen
  openPrintWindow(html, title) {
    const printWindow = window.open("", "_blank", "width=1024,height=768");
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Event-Listener für Auto-Print
    printWindow.addEventListener("load", () => {
      setTimeout(() => {
        if (this.layoutSettings.layout_auto_print === "true") {
          printWindow.print();
        }
      }, 1000);
    });
  }
}

// Globale Instanz erstellen
const enhancedPrint = new EnhancedPrintSystem();

// Bestehende Print-Funktionen ersetzen
window.printRechnung = function (id) {
  enhancedPrint.printDocument("rechnung", id);
};

window.printAuftrag = function (id) {
  enhancedPrint.printDocument("auftrag", id);
};

// Neue erweiterte Print-Funktionen
window.printRechnungEnhanced = function (id, options = {}) {
  enhancedPrint.layoutSettings = {
    ...enhancedPrint.layoutSettings,
    ...options,
  };
  enhancedPrint.printDocument("rechnung", id);
};

window.printAuftragEnhanced = function (id, options = {}) {
  enhancedPrint.layoutSettings = {
    ...enhancedPrint.layoutSettings,
    ...options,
  };
  enhancedPrint.printDocument("auftrag", id);
};

// Bulk-Print-Funktionen
window.printMultipleDocuments = async function (documents) {
  for (const doc of documents) {
    await enhancedPrint.printDocument(doc.type, doc.id);
    // Kurze Verzögerung zwischen den Dokumenten
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

// Layout-Einstellungen bei Änderungen aktualisieren
window.addEventListener("layoutSettingsUpdated", (event) => {
  enhancedPrint.loadLayoutSettings();
  console.log("Enhanced Print System: Layout-Einstellungen aktualisiert");
});

// Beim Laden der Einstellungen Layout aktualisieren
window.addEventListener("settingsLoaded", () => {
  enhancedPrint.loadLayoutSettings();
});

// Export für andere Module
export { EnhancedPrintSystem, enhancedPrint };

console.log("Enhanced Print System geladen - " + new Date().toISOString());
