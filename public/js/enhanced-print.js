// Electron-kompatibles Print-System
class ElectronPrintSystem {
  constructor() {
    this.isElectron =
      typeof window !== "undefined" &&
      window.process &&
      window.process.type === "renderer";
    this.layoutSettings = {
      layout_font_family: "Arial, sans-serif",
      layout_font_size_normal: "14px",
      layout_page_margin: "2cm",
      layout_color_text: "#333",
      layout_color_background: "#fff",
      layout_auto_print: "false",
      layout_close_after_print: "false",
    };

    // Einstellungen aus globalem window.einstellungen laden
    if (window.einstellungen) {
      this.layoutSettings = { ...this.layoutSettings, ...window.einstellungen };
    }
  }

  // Prüft ob wir in Electron sind
  isElectronApp() {
    return this.isElectron || (window.require && window.require("electron"));
  }

  // Dokument drucken
  async printDocument(type, id) {
    try {
      console.log(`ElectronPrintSystem: Drucke ${type} mit ID ${id}`);

      const data = await this.loadDocumentData(type, id);
      if (!data) {
        throw new Error(`${type} mit ID ${id} nicht gefunden`);
      }

      const html = this.generateHTML(type, data);
      const title = this.generateTitle(type, data);

      if (this.isElectronApp()) {
        await this.printInElectron(html, title);
      } else {
        this.printInBrowser(html, title);
      }
    } catch (error) {
      console.error("Fehler beim Drucken:", error);
      this.showError(`Fehler beim Drucken: ${error.message}`);
    }
  }

  // Daten vom Server laden
  async loadDocumentData(type, id) {
    const response = await fetch(`/api/${type}/${id}`);
    if (!response.ok) {
      throw new Error(`Fehler beim Laden der ${type}-Daten`);
    }
    return await response.json();
  }

  // HTML für Druck generieren
  generateHTML(type, data) {
    const einstellungen = window.einstellungen || {};

    // Firmenlogo (falls vorhanden)
    const logoHtml = einstellungen.logo_url
      ? `<img src="${einstellungen.logo_url}" alt="Firmenlogo" style="max-height: 80px; margin-bottom: 20px;">`
      : "";

    // Firmenadresse
    const firmenAdresse = `
      <div style="margin-bottom: 30px;">
        ${logoHtml}
        <h2 style="margin: 0; color: ${this.layoutSettings.layout_color_text};">
          ${einstellungen.firma_name || "Meine Firma"}
        </h2>
        <p style="margin: 5px 0; color: #666;">
          ${einstellungen.firma_adresse || ""}<br>
          ${einstellungen.firma_plz || ""} ${einstellungen.firma_ort || ""}<br>
          ${
            einstellungen.firma_telefon
              ? `Tel: ${einstellungen.firma_telefon}`
              : ""
          }
          ${
            einstellungen.firma_email
              ? ` | Email: ${einstellungen.firma_email}`
              : ""
          }
        </p>
      </div>
    `;

    // Kundenadresse
    const kundenAdresse = `
      <div style="margin-bottom: 30px;">
        <h3>Rechnung an:</h3>
        <p style="margin: 5px 0;">
          ${data.kunde_name || ""}<br>
          ${data.kunde_adresse || ""}<br>
          ${data.kunde_plz || ""} ${data.kunde_ort || ""}
        </p>
      </div>
    `;

    // Rechnungskopf
    const documentType = type === "rechnung" ? "RECHNUNG" : "AUFTRAG";
    const documentNumber =
      type === "rechnung" ? data.rechnung_nr : data.auftrag_nr;
    const documentDate = new Date(data.datum).toLocaleDateString("de-DE");

    const documentHeader = `
      <div style="margin-bottom: 30px; text-align: center;">
        <h1 style="margin: 0; color: ${this.layoutSettings.layout_color_text};">
          ${documentType} ${documentNumber}
        </h1>
        <p style="margin: 10px 0; color: #666;">
          Datum: ${documentDate}
        </p>
      </div>
    `;

    // Positionen
    const positionen = JSON.parse(data.positionen || "[]");
    let positionenHtml = "";
    let gesamtNetto = 0;
    let gesamtMwst = 0;

    if (positionen.length > 0) {
      positionenHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Pos</th>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Beschreibung</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">Menge</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">Einzelpreis</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">Gesamt</th>
            </tr>
          </thead>
          <tbody>
      `;

      positionen.forEach((pos, index) => {
        const menge = parseFloat(pos.menge) || 0;
        const einzelpreis = parseFloat(pos.einzelpreis) || 0;
        const gesamt = menge * einzelpreis;
        gesamtNetto += gesamt;

        positionenHtml += `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${
              index + 1
            }</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${
              pos.beschreibung
            }</td>
            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${menge}</td>
            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${einzelpreis.toFixed(
              2
            )} €</td>
            <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">${gesamt.toFixed(
              2
            )} €</td>
          </tr>
        `;
      });

      positionenHtml += `
          </tbody>
        </table>
      `;
    }

    // Summen berechnen
    const mwstSatz = parseFloat(einstellungen.mwst_satz || 19);
    gesamtMwst = gesamtNetto * (mwstSatz / 100);
    const gesamtBrutto = gesamtNetto + gesamtMwst;

    const summenHtml = `
      <div style="margin-bottom: 30px;">
        <table style="width: 100%; max-width: 300px; margin-left: auto;">
          <tr>
            <td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee;">Netto:</td>
            <td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee;">${gesamtNetto.toFixed(
              2
            )} €</td>
          </tr>
          <tr>
            <td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee;">MwSt. (${mwstSatz}%):</td>
            <td style="padding: 5px; text-align: right; border-bottom: 1px solid #eee;">${gesamtMwst.toFixed(
              2
            )} €</td>
          </tr>
          <tr style="font-weight: bold; background-color: #f8f9fa;">
            <td style="padding: 8px; text-align: right; border-top: 2px solid #333;">Gesamt:</td>
            <td style="padding: 8px; text-align: right; border-top: 2px solid #333;">${gesamtBrutto.toFixed(
              2
            )} €</td>
          </tr>
        </table>
      </div>
    `;

    // Bankverbindung
    const bankHtml =
      einstellungen.bank_name || einstellungen.bank_iban
        ? `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
        <h4>Bankverbindung:</h4>
        <p style="margin: 5px 0; color: #666;">
          ${
            einstellungen.bank_name
              ? `Bank: ${einstellungen.bank_name}<br>`
              : ""
          }
          ${
            einstellungen.bank_iban
              ? `IBAN: ${einstellungen.bank_iban}<br>`
              : ""
          }
          ${einstellungen.bank_bic ? `BIC: ${einstellungen.bank_bic}` : ""}
        </p>
      </div>
    `
        : "";

    // Steuerinfo
    const steuerHtml =
      einstellungen.steuernummer || einstellungen.umsatzsteuer_id
        ? `
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
        ${
          einstellungen.steuernummer
            ? `Steuernummer: ${einstellungen.steuernummer}`
            : ""
        }
        ${
          einstellungen.steuernummer && einstellungen.umsatzsteuer_id
            ? " | "
            : ""
        }
        ${
          einstellungen.umsatzsteuer_id
            ? `USt-IdNr.: ${einstellungen.umsatzsteuer_id}`
            : ""
        }
      </div>
    `
        : "";

    return `
      ${firmenAdresse}
      ${kundenAdresse}
      ${documentHeader}
      ${positionenHtml}
      ${summenHtml}
      ${bankHtml}
      ${steuerHtml}
    `;
  }

  // Titel generieren
  generateTitle(type, data) {
    const documentType = type === "rechnung" ? "Rechnung" : "Auftrag";
    const number = type === "rechnung" ? data.rechnung_nr : data.auftrag_nr;
    return `${documentType} ${number}`;
  }

  // In Electron drucken
  async printInElectron(html, title) {
    try {
      const { ipcRenderer } = window.require("electron");
      await ipcRenderer.invoke("create-print-window", html, title);
    } catch (error) {
      console.error("Electron IPC fehler:", error);
      // Fallback zum Browser-Druck
      this.printInBrowser(html, title);
    }
  }

  // Im Browser drucken (Fallback)
  printInBrowser(html, title) {
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { 
              font-family: ${this.layoutSettings.layout_font_family}; 
              margin: ${this.layoutSettings.layout_page_margin}; 
              color: ${this.layoutSettings.layout_color_text};
              background: ${this.layoutSettings.layout_color_background};
              font-size: ${this.layoutSettings.layout_font_size_normal};
            }
            @media print { 
              body { margin: 1cm; }
              .no-print { display: none; }
            }
            @page {
              margin: 1cm;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1024,height=768");
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      if (this.layoutSettings.layout_auto_print === "true") {
        printWindow.print();
      }

      if (this.layoutSettings.layout_close_after_print === "true") {
        printWindow.addEventListener("afterprint", () => {
          setTimeout(() => printWindow.close(), 1000);
        });
      }
    }, 500);
  }

  // Fehler anzeigen
  showError(message) {
    if (typeof showNotification === "function") {
      showNotification(message, "error");
    } else {
      alert(message);
    }
  }
}

// Globale Instanz erstellen
const electronPrint = new ElectronPrintSystem();

// Globale Print-Funktionen
window.printRechnung = function (id) {
  console.log("printRechnung called with id:", id);
  electronPrint.printDocument("rechnung", id);
};

window.printAuftrag = function (id) {
  console.log("printAuftrag called with id:", id);
  electronPrint.printDocument("auftrag", id);
};

window.printRechnungEnhanced = function (id, options = {}) {
  electronPrint.layoutSettings = {
    ...electronPrint.layoutSettings,
    ...options,
  };
  electronPrint.printDocument("rechnung", id);
};

window.printAuftragEnhanced = function (id, options = {}) {
  electronPrint.layoutSettings = {
    ...electronPrint.layoutSettings,
    ...options,
  };
  electronPrint.printDocument("auftrag", id);
};

window.printRechnungDirect = function (id) {
  electronPrint.layoutSettings.layout_auto_print = "true";
  electronPrint.printDocument("rechnung", id);
};

window.printAuftragDirect = function (id) {
  electronPrint.layoutSettings.layout_auto_print = "true";
  electronPrint.printDocument("auftrag", id);
};

console.log("Electron Print System v3.0 loaded - " + new Date().toISOString());
