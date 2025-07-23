// Enhanced Print System - Fixed für direkte Script-Integration
// Erweiterte Print-Funktionen mit Layout-Editor Integration

(function () {
  "use strict";

  // Hilfsfunktionen - Fallback falls nicht global verfügbar
  function safeApiCall(url, method = "GET", data = null) {
    // Versuche die globale apiCall Funktion zu verwenden
    if (window.apiCall && typeof window.apiCall === "function") {
      return window.apiCall(url, method, data);
    }

    // Fallback: eigene Implementierung
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (data) options.body = JSON.stringify(data);

    return fetch(url, options).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    });
  }

  function safeShowNotification(message, type = "info") {
    // Versuche die globale showNotification Funktion zu verwenden
    if (
      window.showNotification &&
      typeof window.showNotification === "function"
    ) {
      window.showNotification(message, type);
      return;
    }

    // Fallback: console log mit Stil
    const styles = {
      error: "color: red; font-weight: bold;",
      success: "color: green; font-weight: bold;",
      warning: "color: orange; font-weight: bold;",
      info: "color: blue; font-weight: bold;",
    };

    console.log(
      `%c${type.toUpperCase()}: ${message}`,
      styles[type] || styles.info
    );

    // Optional: einfaches alert als Fallback
    if (type === "error") {
      alert(`Fehler: ${message}`);
    }
  }

  function getSetting(key, defaultValue = "") {
    // DEBUG: Einstellungen-Status loggen
    if (!window.einstellungen) {
      console.error(
        `❌ enhanced-print.js: window.einstellungen ist undefined! Key: ${key}`
      );
      return defaultValue;
    }

    if (window.einstellungen[key] === undefined) {
      console.warn(
        `⚠️ enhanced-print.js: Key '${key}' nicht gefunden in:`,
        Object.keys(window.einstellungen)
      );
      return defaultValue;
    }

    // SUCCESS
    const value = window.einstellungen[key];
    console.log(
      `✅ enhanced-print.js: ${key} = ${
        key === "firmen_logo" ? `[${value.length} chars]` : value
      }`
    );
    return value;
  }

  function formatCurrency(amount) {
    // Versuche die globale formatCurrency Funktion zu verwenden
    if (window.formatCurrency && typeof window.formatCurrency === "function") {
      return window.formatCurrency(amount);
    }

    // Fallback: einfache Formatierung
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(amount || 0);
  }

  function formatDate(dateString) {
    // Versuche die globale formatDate Funktion zu verwenden
    if (window.formatDate && typeof window.formatDate === "function") {
      return window.formatDate(dateString);
    }

    // Fallback: einfache Formatierung
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE");
  }

  // Layout-Standardwerte
  const DEFAULT_LAYOUT_SETTINGS = {
    // Schrift und Typographie
    layout_font_family: "Arial, sans-serif",
    layout_font_size_normal: "14px",
    layout_font_size_small: "12px",
    layout_font_size_large: "16px",
    layout_font_size_h1: "24px",
    layout_font_size_h2: "20px",
    layout_font_size_h3: "18px",
    layout_line_height: "1.5",
    layout_letter_spacing: "0px",

    // Farben
    layout_color_primary: "#007bff",
    layout_color_text: "#333333",
    layout_color_muted: "#666666",
    layout_color_border: "#dddddd",
    layout_color_background: "#ffffff",
    layout_table_header_bg: "#f5f5f5",

    // Abstände und Margins
    layout_page_margin: "2cm",
    layout_print_margin: "1cm",
    layout_section_spacing: "2rem",
    layout_paragraph_spacing: "1rem",
    layout_table_padding: "8px",
    layout_header_padding: "1rem",

    // Logo-Einstellungen
    layout_logo_position: "top-left",
    layout_logo_max_width: "200px",
    layout_logo_max_height: "100px",
    layout_logo_margin: "0 2rem 1rem 0",

    // Header-Layout
    layout_header_alignment: "space-between",
    layout_header_border: "2px solid",

    // Tabellen-Layout
    layout_table_border: "1px solid #ddd",
    layout_table_stripe: "disabled",
    layout_table_border_collapse: "collapse",

    // Footer-Layout
    layout_footer_enabled: "true",
    layout_footer_position: "bottom",
    layout_footer_border_top: "true",
    layout_footer_font_size: "12px",
    layout_footer_alignment: "center",
    layout_footer_margin_top: "2rem",

    // Unterschriften-Bereich
    layout_signature_enabled: "true",
    layout_signature_height: "4cm",
    layout_signature_border: "1px solid #333",
    layout_signature_margin_top: "3cm",

    // Druckoptionen
    layout_print_page_size: "A4",
    layout_print_orientation: "portrait",
    layout_print_scale: "100%",
    layout_auto_print: "false",
    layout_close_after_print: "false",
  };

  // Enhanced Print-System Class
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
        console.log(`Drucke ${type} mit ID: ${id}`);
        const data = await this.loadDocumentData(type, id);
        const html = this.generatePrintHTML(type, data);
        this.openPrintWindow(html, this.getDocumentTitle(type, data));
      } catch (error) {
        console.error(`Fehler beim Drucken von ${type}:`, error);
        safeShowNotification(
          `Fehler beim Drucken des ${type}s: ${error.message}`,
          "error"
        );
      }
    }

    // Dokument-Daten laden
    async loadDocumentData(type, id) {
      if (type === "rechnung") {
        return await safeApiCall(`/api/rechnungen/${id}`);
      } else if (type === "auftrag") {
        return await safeApiCall(`/api/auftraege/${id}`);
      }
      throw new Error(`Unbekannter Dokumenttyp: ${type}`);
    }

    // CSS für Layout generieren
    generateLayoutCSS() {
      const settings = this.layoutSettings;

      return `
        /* Layout-generiertes CSS */
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: ${
            settings.layout_font_family ||
            DEFAULT_LAYOUT_SETTINGS.layout_font_family
          };
          font-size: ${
            settings.layout_font_size_normal ||
            DEFAULT_LAYOUT_SETTINGS.layout_font_size_normal
          };
          line-height: ${
            settings.layout_line_height ||
            DEFAULT_LAYOUT_SETTINGS.layout_line_height
          };
          color: ${
            settings.layout_color_text ||
            DEFAULT_LAYOUT_SETTINGS.layout_color_text
          };
          background-color: ${
            settings.layout_color_background ||
            DEFAULT_LAYOUT_SETTINGS.layout_color_background
          };
          margin: ${
            settings.layout_page_margin ||
            DEFAULT_LAYOUT_SETTINGS.layout_page_margin
          };
          padding: 0;
        }
        
        @media print {
          body {
            margin: ${
              settings.layout_print_margin ||
              DEFAULT_LAYOUT_SETTINGS.layout_print_margin
            } !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            size: ${
              settings.layout_print_page_size ||
              DEFAULT_LAYOUT_SETTINGS.layout_print_page_size
            };
            margin: ${
              settings.layout_print_margin ||
              DEFAULT_LAYOUT_SETTINGS.layout_print_margin
            };
          }
        }
        
        h1 {
          font-size: ${
            settings.layout_font_size_h1 ||
            DEFAULT_LAYOUT_SETTINGS.layout_font_size_h1
          };
          color: ${
            settings.layout_color_primary ||
            DEFAULT_LAYOUT_SETTINGS.layout_color_primary
          };
          margin-bottom: ${
            settings.layout_paragraph_spacing ||
            DEFAULT_LAYOUT_SETTINGS.layout_paragraph_spacing
          };
        }
        
        h2 {
          font-size: ${
            settings.layout_font_size_h2 ||
            DEFAULT_LAYOUT_SETTINGS.layout_font_size_h2
          };
          margin-bottom: ${
            settings.layout_paragraph_spacing ||
            DEFAULT_LAYOUT_SETTINGS.layout_paragraph_spacing
          };
        }
        
        h3 {
          font-size: ${
            settings.layout_font_size_h3 ||
            DEFAULT_LAYOUT_SETTINGS.layout_font_size_h3
          };
          margin-bottom: ${
            settings.layout_paragraph_spacing ||
            DEFAULT_LAYOUT_SETTINGS.layout_paragraph_spacing
          };
        }
        
        .document-header {
          display: flex;
          justify-content: ${
            settings.layout_header_alignment ||
            DEFAULT_LAYOUT_SETTINGS.layout_header_alignment
          };
          align-items: flex-start;
          margin-bottom: ${
            settings.layout_section_spacing ||
            DEFAULT_LAYOUT_SETTINGS.layout_section_spacing
          };
          padding: ${
            settings.layout_header_padding ||
            DEFAULT_LAYOUT_SETTINGS.layout_header_padding
          };
        }
        
        .company-logo {
          max-width: ${
            settings.layout_logo_max_width ||
            DEFAULT_LAYOUT_SETTINGS.layout_logo_max_width
          };
          max-height: ${
            settings.layout_logo_max_height ||
            DEFAULT_LAYOUT_SETTINGS.layout_logo_max_height
          };
          margin: ${
            settings.layout_logo_margin ||
            DEFAULT_LAYOUT_SETTINGS.layout_logo_margin
          };
          display: block;
        }
        
        .company-info {
          text-align: ${
            settings.layout_logo_position === "top-center"
              ? "center"
              : settings.layout_logo_position === "top-right"
              ? "right"
              : "left"
          };
          flex: 1;
        }
        
        .document-title {
          text-align: right;
          flex-shrink: 0;
        }
        
        .customer-vehicle-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: ${
            settings.layout_section_spacing ||
            DEFAULT_LAYOUT_SETTINGS.layout_section_spacing
          };
          page-break-inside: avoid;
        }
        
        .customer-info {
          flex: 1;
          margin-right: 2rem;
        }
        
        .vehicle-info {
          flex: 1;
          text-align: right;
        }
        
        @media print {
          .customer-vehicle-section {
            display: flex !important;
          }
        }
        
        table {
          width: 100%;
          border-collapse: ${
            settings.layout_table_border_collapse ||
            DEFAULT_LAYOUT_SETTINGS.layout_table_border_collapse
          };
          margin-bottom: ${
            settings.layout_section_spacing ||
            DEFAULT_LAYOUT_SETTINGS.layout_section_spacing
          };
          page-break-inside: avoid;
        }
        
        th, td {
          padding: ${
            settings.layout_table_padding ||
            DEFAULT_LAYOUT_SETTINGS.layout_table_padding
          };
          border: ${
            settings.layout_table_border ||
            DEFAULT_LAYOUT_SETTINGS.layout_table_border
          };
          vertical-align: top;
        }
        
        th {
          background-color: ${
            settings.layout_table_header_bg ||
            DEFAULT_LAYOUT_SETTINGS.layout_table_header_bg
          };
          font-weight: bold;
          color: ${
            settings.layout_color_text ||
            DEFAULT_LAYOUT_SETTINGS.layout_color_text
          };
        }
        
        tbody tr:nth-child(even) {
          background-color: ${
            settings.layout_table_stripe === "enabled"
              ? "#fafafa"
              : "transparent"
          };
        }
        
        .positions-section table {
          font-size: ${
            settings.layout_font_size_normal ||
            DEFAULT_LAYOUT_SETTINGS.layout_font_size_normal
          };
        }
        
        .customer-section {
          margin-bottom: ${
            settings.layout_section_spacing ||
            DEFAULT_LAYOUT_SETTINGS.layout_section_spacing
          };
        }
        
        .summary-section {
          margin-top: ${
            settings.layout_section_spacing ||
            DEFAULT_LAYOUT_SETTINGS.layout_section_spacing
          };
        }
        
        .footer {
          margin-top: ${
            settings.layout_footer_margin_top ||
            DEFAULT_LAYOUT_SETTINGS.layout_footer_margin_top
          };
          font-size: ${
            settings.layout_footer_font_size ||
            DEFAULT_LAYOUT_SETTINGS.layout_footer_font_size
          };
          text-align: ${
            settings.layout_footer_alignment ||
            DEFAULT_LAYOUT_SETTINGS.layout_footer_alignment
          };
          color: ${
            settings.layout_color_muted ||
            DEFAULT_LAYOUT_SETTINGS.layout_color_muted
          };
          ${
            settings.layout_footer_border_top === "true"
              ? `border-top: 1px solid ${
                  settings.layout_color_border ||
                  DEFAULT_LAYOUT_SETTINGS.layout_color_border
                }; padding-top: 1rem;`
              : ""
          }
        }
        
        .signature-section {
          margin-top: ${
            settings.layout_signature_margin_top ||
            DEFAULT_LAYOUT_SETTINGS.layout_signature_margin_top
          };
          page-break-inside: avoid;
        }
        
        .signature-box {
          border: ${
            settings.layout_signature_border ||
            DEFAULT_LAYOUT_SETTINGS.layout_signature_border
          };
          height: ${
            settings.layout_signature_height ||
            DEFAULT_LAYOUT_SETTINGS.layout_signature_height
          };
          margin-bottom: 1rem;
          position: relative;
        }
        
        .signature-label {
          position: absolute;
          bottom: 5px;
          left: 10px;
          font-size: ${
            settings.layout_font_size_small ||
            DEFAULT_LAYOUT_SETTINGS.layout_font_size_small
          };
        }
        
        .total-amount {
          font-size: ${
            settings.layout_font_size_large ||
            DEFAULT_LAYOUT_SETTINGS.layout_font_size_large
          };
          font-weight: bold;
          color: ${
            settings.layout_color_primary ||
            DEFAULT_LAYOUT_SETTINGS.layout_color_primary
          };
        }
      `;
    }

    // Print-HTML generieren
    generatePrintHTML(type, data) {
      const css = this.generateLayoutCSS();
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
            <style>${css}</style>
          </head>
          <body>
            ${header}
            ${customerInfo}
            ${positions}
            ${summary}
            ${
              this.layoutSettings.layout_footer_enabled === "true" ? footer : ""
            }
            ${
              this.layoutSettings.layout_signature_enabled === "true" &&
              type === "auftrag"
                ? signature
                : ""
            }
          </body>
        </html>
      `;
    }

    // Header generieren
    generateHeader(type, data) {
      const firmenname = getSetting("firmenname", "Meine Firma");
      const logoData = getSetting("firmen_logo", "");
      const logoPosition = getSetting("layout_logo_position", "top-left");

      // Debug-Ausgabe für Logo
      console.log("Logo Debug:", {
        hasLogo: !!logoData,
        logoLength: logoData ? logoData.length : 0,
        logoPosition: logoPosition,
        showLogo: logoPosition !== "none" && !!logoData,
      });

      // Logo nur generieren wenn Position nicht "none" ist und Logo vorhanden
      let logoHtml = "";
      if (logoPosition !== "none" && logoData && logoData.length > 0) {
        let logoSrc = "";

        // Prüfen ob bereits ein Data-URL
        if (logoData.startsWith("data:")) {
          // Bereits vollständiger Data-URL
          logoSrc = logoData;
          console.log("✅ Logo: Vollständiger Data-URL erkannt");
        } else {
          // Nur Base64-Daten, Präfix hinzufügen
          const base64Data = logoData.replace(/^data:image\/[^;]+;base64,/, ""); // Eventuell vorhandenes Präfix entfernen
          const isValidBase64 = base64Data.match(/^[A-Za-z0-9+/]*={0,2}$/);

          if (isValidBase64) {
            logoSrc = `data:image/png;base64,${base64Data}`;
            console.log("✅ Logo: Base64-Daten mit Präfix versehen");
          } else {
            console.warn("❌ Logo: Base64-Format ungültig");
          }
        }

        if (logoSrc) {
          logoHtml = `<img src="${logoSrc}" alt="Firmenlogo" class="company-logo" 
                           style="max-width: ${this.layoutSettings.layout_logo_max_width}; max-height: ${this.layoutSettings.layout_logo_max_height}; display: block;"
                           onerror="this.style.display='none'; console.error('Logo konnte nicht geladen werden');">`;
        }
      } else {
        console.log("ℹ️ Logo: Kein Logo in Einstellungen gefunden");
      }

      const documentTitle = type === "rechnung" ? "RECHNUNG" : "AUFTRAG";
      const documentNumber =
        type === "rechnung" ? data.rechnung_nr : data.auftrag_nr;

      return `
        <div class="document-header">
          <div class="company-info">
            ${logoHtml}
            <h1 style="color: ${
              this.layoutSettings.layout_color_primary
            }; margin: ${logoHtml ? "0.5rem 0 0 0" : "0"}; font-size: ${
        this.layoutSettings.layout_font_size_h1
      };">${firmenname}</h1>
            <div style="margin-top: 0.5rem; line-height: ${
              this.layoutSettings.layout_line_height
            };">
              ${getSetting("firmen_strasse", "Musterstraße 123")}<br>
              ${getSetting("firmen_plz", "12345")} ${getSetting(
        "firmen_ort",
        "Musterstadt"
      )}<br>
              Tel: ${getSetting("firmen_telefon", "+49 123 456789")}<br>
              E-Mail: ${getSetting("firmen_email", "info@meine-firma.de")}
            </div>
          </div>
          <div class="document-title" style="text-align: right;">
            <h1 style="color: ${
              this.layoutSettings.layout_color_primary
            }; margin: 0; font-size: ${
        this.layoutSettings.layout_font_size_h1
      };">${documentTitle}</h1>
            <h2 style="margin: 0.5rem 0; font-size: ${
              this.layoutSettings.layout_font_size_h2
            };">Nr. ${documentNumber}</h2>
            <p style="margin: 0; color: ${
              this.layoutSettings.layout_color_muted
            };">Datum: ${formatDate(data.rechnungsdatum || data.datum)}</p>
          </div>
        </div>
        <hr style="border: none; border-top: ${
          this.layoutSettings.layout_header_border
        } ${this.layoutSettings.layout_color_primary}; margin: ${
        this.layoutSettings.layout_section_spacing
      } 0;">
      `;
    }

    // Kundeninformationen generieren
    generateCustomerInfo(data) {
      return `
        <div class="customer-vehicle-section" style="display: flex; justify-content: space-between; margin-bottom: ${
          this.layoutSettings.layout_section_spacing
        };">
          <div class="customer-info" style="flex: 1; margin-right: 2rem;">
            <h3 style="color: ${
              this.layoutSettings.layout_color_primary
            }; margin-bottom: 0.5rem;">Kunde:</h3>
            <p style="margin: 0; line-height: ${
              this.layoutSettings.layout_line_height
            };">
              ${data.kunde_name || data.name || "Unbekannter Kunde"}<br>
              ${data.strasse || ""}<br>
              ${data.plz || ""} ${data.ort || ""}
            </p>
          </div>
          
          ${
            data.kennzeichen
              ? `
          <div class="vehicle-info" style="flex: 1; text-align: right;">
            <h3 style="color: ${
              this.layoutSettings.layout_color_primary
            }; margin-bottom: 0.5rem;">Fahrzeug:</h3>
            <p style="margin: 0; line-height: ${
              this.layoutSettings.layout_line_height
            };">
              ${data.kennzeichen} - ${data.marke || ""} ${data.modell || ""}<br>
              ${data.vin ? `VIN: ${data.vin}` : ""}
              ${data.farbe ? `<br>Farbe: ${data.farbe}` : ""}
            </p>
          </div>
          `
              : ""
          }
        </div>
      `;
    }

    // Positionen generieren
    generatePositions(type, data) {
      if (!data.positionen || data.positionen.length === 0) {
        return "<p>Keine Positionen vorhanden.</p>";
      }

      const headers =
        type === "rechnung"
          ? [
              "Beschreibung",
              "Menge",
              "Einheit",
              "Einzelpreis",
              "MwSt.",
              "Gesamt",
            ]
          : ["Beschreibung", "Zeit", "Stundenpreis", "Gesamt"];

      const positionsRows = data.positionen
        .map((pos) => {
          if (type === "rechnung") {
            return `
            <tr>
              <td style="text-align: left;">${pos.beschreibung || ""}</td>
              <td style="text-align: center;">${pos.menge || 0}</td>
              <td style="text-align: center;">${pos.einheit || ""}</td>
              <td style="text-align: right;">${formatCurrency(
                pos.einzelpreis
              )}</td>
              <td style="text-align: center;">${pos.mwst_prozent || 0}%</td>
              <td style="text-align: right; font-weight: bold;">${formatCurrency(
                pos.gesamt
              )}</td>
            </tr>
          `;
          } else {
            return `
            <tr>
              <td style="text-align: left;">${pos.beschreibung || ""}</td>
              <td style="text-align: center;">${pos.zeit || 0} Std.</td>
              <td style="text-align: right;">${formatCurrency(
                pos.stundenpreis
              )}</td>
              <td style="text-align: right; font-weight: bold;">${formatCurrency(
                pos.gesamt || pos.kosten || 0
              )}</td>
            </tr>
          `;
          }
        })
        .join("");

      return `
        <div class="positions-section" style="margin-bottom: ${
          this.layoutSettings.layout_section_spacing
        };">
          <h3 style="color: ${
            this.layoutSettings.layout_color_primary
          }; margin-bottom: 1rem; font-size: ${
        this.layoutSettings.layout_font_size_h3
      };">
            ${type === "rechnung" ? "Rechnungspositionen" : "Arbeitsleistungen"}
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: ${
            this.layoutSettings.layout_section_spacing
          };">
            <thead>
              <tr style="background-color: ${
                this.layoutSettings.layout_table_header_bg
              };">
                ${headers
                  .map(
                    (h) =>
                      `<th style="padding: ${
                        this.layoutSettings.layout_table_padding
                      }; border: ${
                        this.layoutSettings.layout_table_border
                      }; font-weight: bold; text-align: ${
                        h === "Beschreibung"
                          ? "left"
                          : h.includes("preis") || h === "Gesamt"
                          ? "right"
                          : "center"
                      };">${h}</th>`
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${positionsRows}
            </tbody>
          </table>
        </div>
      `;
    }

    // Zusammenfassung generieren
    generateSummary(type, data) {
      if (type === "rechnung") {
        return `
          <div class="summary-section">
            <table style="width: 300px; margin-left: auto;">
              <tr>
                <td>Zwischensumme:</td>
                <td style="text-align: right;">${formatCurrency(
                  data.zwischensumme || 0
                )}</td>
              </tr>
              ${
                data.rabatt_betrag > 0
                  ? `
              <tr>
                <td>Rabatt (${data.rabatt_prozent || 0}%):</td>
                <td style="text-align: right;">-${formatCurrency(
                  data.rabatt_betrag || 0
                )}</td>
              </tr>
              <tr>
                <td>Netto nach Rabatt:</td>
                <td style="text-align: right;">${formatCurrency(
                  data.netto_nach_rabatt || 0
                )}</td>
              </tr>
              `
                  : ""
              }
              <tr>
                <td>MwSt. 19%:</td>
                <td style="text-align: right;">${formatCurrency(
                  data.mwst_19 || 0
                )}</td>
              </tr>
              <tr>
                <td>MwSt. 7%:</td>
                <td style="text-align: right;">${formatCurrency(
                  data.mwst_7 || 0
                )}</td>
              </tr>
              <tr style="border-top: 2px solid black; font-weight: bold;">
                <td>Gesamtbetrag:</td>
                <td style="text-align: right;" class="total-amount">${formatCurrency(
                  data.gesamtbetrag || 0
                )}</td>
              </tr>
            </table>
            
            <div style="margin-top: 2rem;">
              <p><strong>Zahlungsbedingungen:</strong><br>
              ${
                data.zahlungsbedingungen ||
                getSetting(
                  "zahlungstext",
                  "Zahlbar innerhalb von 14 Tagen ohne Abzug."
                )
              }</p>
              
              <p><strong>Gewährleistung:</strong><br>
              ${
                data.gewaehrleistung ||
                getSetting(
                  "gewaehrleistung",
                  "12 Monate Gewährleistung auf alle Arbeiten."
                )
              }</p>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="summary-section">
            <table style="width: 300px; margin-left: auto;">
              <tr>
                <td>Gesamtzeit:</td>
                <td style="text-align: right;">${
                  data.gesamt_zeit || 0
                } Std.</td>
              </tr>
              <tr>
                <td>Netto-Betrag:</td>
                <td style="text-align: right;">${formatCurrency(
                  data.gesamt_kosten || 0
                )}</td>
              </tr>
              <tr>
                <td>MwSt. (${getSetting("mwst_satz", "19")}%):</td>
                <td style="text-align: right;">${formatCurrency(
                  data.mwst_betrag || 0
                )}</td>
              </tr>
              <tr style="border-top: 2px solid black; font-weight: bold;">
                <td>Gesamtbetrag:</td>
                <td style="text-align: right;" class="total-amount">${formatCurrency(
                  (data.gesamt_kosten || 0) + (data.mwst_betrag || 0)
                )}</td>
              </tr>
            </table>
            
            <div style="margin-top: 2rem;">
              <p><strong>Bemerkungen:</strong><br>
              ${data.bemerkungen || "Keine Bemerkungen"}</p>
            </div>
          </div>
        `;
      }
    }

    // Footer generieren
    generateFooter() {
      return `
        <div class="footer">
          <p>
            ${getSetting("firmenname", "Meine Firma")} | 
            ${getSetting("rechtsform", "")} ${getSetting(
        "geschaeftsfuehrer",
        ""
      )}<br>
            Steuernr.: ${getSetting("steuernummer", "")} | 
            USt-IdNr.: ${getSetting("umsatzsteuer_id", "")}<br>
            ${getSetting("bank_name", "")} | 
            IBAN: ${getSetting("bank_iban", "")} | 
            BIC: ${getSetting("bank_bic", "")}
          </p>
        </div>
      `;
    }

    // Unterschriften-Bereich generieren
    generateSignature(type) {
      if (type !== "auftrag") return "";

      return `
        <div class="signature-section">
          <h3>Unterschriften:</h3>
          <div style="display: flex; gap: 2rem;">
            <div style="flex: 1;">
              <div class="signature-box">
                <div class="signature-label">Auftraggeber</div>
              </div>
            </div>
            <div style="flex: 1;">
              <div class="signature-box">
                <div class="signature-label">Auftragnehmer</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Dokument-Titel generieren
    getDocumentTitle(type, data) {
      const documentType = type === "rechnung" ? "Rechnung" : "Auftrag";
      const number = type === "rechnung" ? data.rechnung_nr : data.auftrag_nr;
      return `${documentType} ${number}`;
    }

    // Print-Fenster öffnen
    openPrintWindow(html, title) {
      // Print-Controls zu HTML hinzufügen
      const printControls = `
        <div id="print-controls" style="position: fixed; top: 10px; right: 10px; background: white; padding: 10px; border: 1px solid #ccc; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 1000;">
          <button onclick="window.print()" style="background: #007bff; color: white; border: none; padding: 8px 16px; margin-right: 5px; border-radius: 3px; cursor: pointer;">
            🖨️ Drucken
          </button>
          <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer;">
            ❌ Schließen
          </button>
        </div>
        
        <style>
          @media print {
            #print-controls { display: none !important; }
          }
          
          #print-controls button:hover {
            opacity: 0.8;
          }
        </style>
      `;

      // HTML mit Print-Controls erweitern
      const fullHtml = html.replace("</body>", printControls + "</body>");

      const printWindow = window.open(
        "",
        "_blank",
        "width=1024,height=768,scrollbars=yes,resizable=yes"
      );
      printWindow.document.write(fullHtml);
      printWindow.document.close();

      // Warten bis Fenster vollständig geladen ist
      printWindow.onload = () => {
        printWindow.focus();

        // Kurze Verzögerung für vollständiges Rendering
        setTimeout(() => {
          // Auto-Print wenn aktiviert, sonst manuell über Button
          if (this.layoutSettings.layout_auto_print === "true") {
            printWindow.print();
          } else {
            // Nutzer über Druckmöglichkeit informieren
            console.log(
              'Print-Fenster bereit. Klicken Sie auf "Drucken" oder drücken Sie Strg+P'
            );
          }

          // Auto-Close nach dem Drucken
          if (this.layoutSettings.layout_close_after_print === "true") {
            printWindow.addEventListener("afterprint", () => {
              setTimeout(() => printWindow.close(), 1000);
            });
          }
        }, 500);
      };

      // Fallback falls onload nicht funktioniert
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.focus();

          // Keyboard-Shortcut für Drucken aktivieren
          printWindow.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "p") {
              e.preventDefault();
              printWindow.print();
            }
          });
        }
      }, 1000);
    }
  }

  // Globale Instanz erstellen
  const enhancedPrint = new EnhancedPrintSystem();

  // Bestehende Print-Funktionen ersetzen
  window.printRechnung = function (id) {
    console.log("printRechnung called with id:", id);
    enhancedPrint.printDocument("rechnung", id);
  };

  window.printAuftrag = function (id) {
    console.log("printAuftrag called with id:", id);
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

  // Direkter Druck ohne Preview
  window.printRechnungDirect = function (id) {
    enhancedPrint.layoutSettings.layout_auto_print = "true";
    enhancedPrint.printDocument("rechnung", id);
  };

  window.printAuftragDirect = function (id) {
    enhancedPrint.layoutSettings.layout_auto_print = "true";
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

  // Einstellungen beim Start laden
  if (window.einstellungen) {
    enhancedPrint.loadLayoutSettings();
  }

  // Export für debugging
  window.enhancedPrint = enhancedPrint;

  console.log("Enhanced Print System geladen - " + new Date().toISOString());
})();
