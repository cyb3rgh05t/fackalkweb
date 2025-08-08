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
    // Einstellungen aus window.einstellungen abrufen
    if (window.einstellungen && window.einstellungen[key] !== undefined) {
      return window.einstellungen[key];
    }
    return defaultValue;
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
    layout_font_size_normal: "10px",
    layout_font_size_small: "8px",
    layout_font_size_large: "12px",
    layout_font_size_h1: "20px",
    layout_font_size_h2: "16px",
    layout_font_size_h3: "14px",
    layout_line_height: "1.2",
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
    layout_footer_font_size: "9px",
    layout_footer_alignment: "center",
    layout_footer_margin_top: "2rem",
    layout_footer_print_margin_bottom: "1cm",

    // Unterschriften-Bereich
    layout_signature_enabled: "true",
    layout_signature_height: "4cm",
    layout_signature_border: "1px solid #333",
    layout_signature_margin_top: "1.5rem",

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

    printWithIframe(html, title) {
      // Verstecktes iframe erstellen
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.style.width = "210mm"; // A4 Breite
      iframe.style.height = "297mm"; // A4 Höhe
      iframe.style.border = "none";

      document.body.appendChild(iframe);

      // HTML in iframe laden
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.write(html);
      doc.close();

      // Drucken wenn geladen
      iframe.onload = () => {
        setTimeout(() => {
          try {
            // Fokus auf iframe setzen
            iframe.contentWindow.focus();

            // Drucken
            iframe.contentWindow.print();

            // iframe nach dem Drucken entfernen
            setTimeout(() => {
              if (iframe.parentNode) {
                document.body.removeChild(iframe);
              }
            }, 1000);
          } catch (e) {
            console.warn("iframe-Print fehlgeschlagen:", e);
            // iframe trotzdem entfernen
            if (iframe.parentNode) {
              document.body.removeChild(iframe);
            }
          }
        }, 500);
      };

      // Fallback: iframe nach 5 Sekunden entfernen
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 5000);
    }

    // Dann in printDocumentDirect verwenden:
    async printDocumentDirect(type, id) {
      try {
        console.log(`Direkter Druck von ${type} mit ID: ${id}`);
        const data = await this.loadDocumentData(type, id);
        const html = this.generatePrintHTMLDirect(type, data);

        // ✅ Wähle zwischen Window oder iframe:
        // this.directPrintWithHiddenWindow(html, title); // Fenster-Methode
        this.printWithIframe(html, this.getDocumentTitle(type, data)); // iframe-Methode
      } catch (error) {
        console.error(`Fehler beim direkten Drucken von ${type}:`, error);
        safeShowNotification(
          `Fehler beim Drucken des ${type}s: ${error.message}`,
          "error"
        );
      }
    }

    // ✅ DIREKTES DRUCKEN MIT NORMALEM FENSTER
    directPrintWithHiddenWindow(html, title) {
      // Normales Print-Fenster öffnen (nicht versteckt für besseres Rendering)
      const printWindow = window.open(
        "",
        "_blank",
        "width=1024,height=768,scrollbars=yes,resizable=yes"
      );

      if (!printWindow) {
        safeShowNotification(
          "Popup-Blocker verhindert das Drucken. Bitte Popup-Blocker für diese Seite deaktivieren.",
          "error"
        );
        return;
      }

      // HTML ohne Print-Controls für direkten Druck
      printWindow.document.write(html);
      printWindow.document.close();

      // Fenster fokussieren für bessere UX
      printWindow.focus();

      // Sofort drucken wenn geladen
      printWindow.onload = () => {
        setTimeout(() => {
          // Druckdialog sofort öffnen
          printWindow.print();

          // Event-Listener für nach dem Drucken
          printWindow.addEventListener("afterprint", () => {
            setTimeout(() => {
              if (!printWindow.closed) {
                printWindow.close();
              }
            }, 500);
          });

          // Fallback: Fenster nach 3 Sekunden schließen falls nicht gedruckt
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
          }, 3000);
        }, 250); // Kurze Verzögerung für vollständiges Rendering
      };

      // Fallback für den Fall, dass onload nicht funktioniert
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          try {
            printWindow.print();
            // Auto-Close nach 3 Sekunden
            setTimeout(() => {
              if (!printWindow.closed) {
                printWindow.close();
              }
            }, 3000);
          } catch (e) {
            console.warn("Fallback-Print fehlgeschlagen:", e);
            // Bei Fehler das Fenster trotzdem schließen
            setTimeout(() => {
              if (!printWindow.closed) {
                printWindow.close();
              }
            }, 1000);
          }
        }
      }, 1000);
    }

    // ✅ SEPARATE HTML-GENERIERUNG FÜR DIREKTDRUCK (ohne Print-Controls)
    generatePrintHTMLDirect(type, data) {
      const css = this.generateLayoutCSS();
      const header = this.generateHeader(type, data);
      const customerInfo = this.generateCustomerInfo(data);
      const positions = this.generatePositions(type, data);
      const summary = this.generateSummary(type, data);

      // Footer nur für Rechnung anzeigen, nie für Auftrag
      const footer =
        this.layoutSettings.layout_footer_enabled === "true" &&
        type !== "auftrag"
          ? this.generateFooter()
          : "";

      // Signature nur für Auftrag anzeigen, wenn aktiviert
      const signature =
        this.layoutSettings.layout_signature_enabled === "true" &&
        type === "auftrag"
          ? this.generateSignature(type)
          : "";

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
        <div class="document-container">
          ${header}
          ${customerInfo}
          ${positions}
          ${summary}
          ${signature}
          ${footer}
        </div>
      </body>
    </html>
  `;
    }

    // Universelle Print-Funktion (für Browser-Vorschau, falls noch benötigt)
    async printDocument(type, id) {
      try {
        console.log(`Drucke ${type} mit ID: ${id}`);
        const data = await this.loadDocumentData(type, id);

        // Debug: Ausgabe der geladenen Daten
        console.log(`${type} Daten geladen:`, {
          auftrag_nr: data.auftrag_nr,
          kunden_nr: data.kunden_nr,
          farbe: data.farbe,
          farbcode: data.farbcode,
          auftragsdatum: data.auftragsdatum,
        });

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

    // ✅ VERBESSERTE CSS-Generierung mit Print-optimiertem Footer
    generateLayoutCSS() {
      const settings = this.layoutSettings;

      return `
        /* Layout-generiertes CSS */
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
        
        * {
          margin: 0;
          padding: 0;
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
          /* ✅ ENTFERNT: min-height und padding-bottom um zusätzliche Seite zu vermeiden */
        }
        
        .document-container {
          max-width: 100%;
          margin: 0 auto;
          padding: 0;
          background: white;
          position: relative;
        }
        
        @media print {
          body {
            margin: ${
              settings.layout_print_margin ||
              DEFAULT_LAYOUT_SETTINGS.layout_print_margin
            } !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            padding-bottom: 4cm !important; /* Weniger Padding beim Drucken */
          }
          
          .document-container {
            margin: 0;
            padding: 0;
            box-shadow: none;
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
          position: absolute;
          bottom: ${
            settings.layout_footer_print_margin_bottom ||
            DEFAULT_LAYOUT_SETTINGS.layout_footer_print_margin_bottom
          };
          left: 0;
          right: 0;
          width: 100%;
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
          z-index: 1;
        }

        @media print {
          .footer {
            position: fixed !important; /* Für Print verwenden wir doch fixed */
            bottom: 1cm !important;
            left: 1cm !important;
            right: 1cm !important;
            width: auto !important;
            page-break-inside: avoid;
          }
          
          .signature-section {
            page-break-inside: avoid;
          }
          
          .no-print {
            display: none !important;
          }
          
          /* Print Controls ausblenden */
          #print-controls {
            display: none !important;
          }
          
          /* Bessere Seitenumbruch-Kontrolle */
          .page-break-before {
            page-break-before: always;
          }
          
          .page-break-after {
            page-break-after: always;
          }
          
          .page-break-inside-avoid {
            page-break-inside: avoid;
          }
        }
        
        .signature-section {
          margin-top: ${
            settings.layout_signature_margin_top ||
            DEFAULT_LAYOUT_SETTINGS.layout_signature_margin_top
          };
          page-break-inside: auto;
          break-inside: auto;
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
          position: relative;
          display: flex;
          justify-content: space-between;
          gap: 2rem;
          margin-top: 0;
          }

        .signature-boxes .signature-box {
          flex: 1;
          min-width: 0;
        }

        @media (max-width: 480px) {
        .signature-boxes {
          flex-direction: column;
          gap: 1rem;
          }
        }

        @media print {
        .signature-section {
          orphans: 2;
          widows: 2;
        }
  
       .signature-boxes {
         break-inside: avoid;
         gap: 1rem;
         display: flex !important; /* ✅ Sicherstellen dass nebeneinander bleibt */
         flex-direction: row !important;
         }
        }
        
        
        .signature-label {
          position: absolute;
          bottom: 8px;
          left: 12px;
          font-weight: 500;
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
        
        /* Print Controls für Vorschau */
        #print-controls {
          position: fixed;
          top: 10px;
          right: 10px;
          background: rgba(255, 255, 255, 0.95);
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 5px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          z-index: 1000;
          display: flex;
          gap: 5px;
        }
        
        #print-controls button {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        #print-controls button:hover {
          opacity: 0.8;
        }
        
        #print-controls button.secondary {
          background: #6c757d;
        }
      `;
    }

    // Print-HTML generieren (für Browser-Vorschau)
    generatePrintHTML(type, data) {
      const css = this.generateLayoutCSS();
      const header = this.generateHeader(type, data);
      const customerInfo = this.generateCustomerInfo(data);
      const positions = this.generatePositions(type, data);
      const summary = this.generateSummary(type, data);

      // ✅ Footer nur für Rechnung anzeigen, nie für Auftrag
      const footer =
        this.layoutSettings.layout_footer_enabled === "true" &&
        type !== "auftrag"
          ? this.generateFooter()
          : "";

      // Signature nur für Auftrag anzeigen, wenn aktiviert
      const signature =
        this.layoutSettings.layout_signature_enabled === "true" &&
        type === "auftrag"
          ? this.generateSignature(type)
          : "";

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
        <div class="document-container">
          ${header}
          ${customerInfo}
          ${positions}
          ${summary}
          ${signature}
          ${footer}
        </div>
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

      let additionalHeaderInfo = "";

      // Bei Rechnungen: Auftragsnummer und Auftragsdatum anzeigen (falls vorhanden)
      if (type === "rechnung") {
        if (data.kunden_nr) {
          additionalHeaderInfo += `<p style="margin: 0.25rem 0; color: ${this.layoutSettings.layout_color_muted}; font-size: ${this.layoutSettings.layout_font_size_small};">Kunden Nr.: <strong>${data.kunden_nr}</strong></p>`;
        }

        if (data.auftrag_nr) {
          additionalHeaderInfo += `<p style="margin: 0.25rem 0; color: ${this.layoutSettings.layout_color_muted}; font-size: ${this.layoutSettings.layout_font_size_small};">Auftrag-Nr.: <strong>${data.auftrag_nr}</strong></p>`;
        }

        if (data.auftragsdatum) {
          additionalHeaderInfo += `<p style="margin: 0.25rem 0; color: ${
            this.layoutSettings.layout_color_muted
          }; font-size: ${
            this.layoutSettings.layout_font_size_small
          };">Auftragsdatum: <strong>${formatDate(
            data.auftragsdatum
          )}</strong></p>`;
        }
      }

      // ✅ NEUER STATUS-BANNER FÜR STORNIERT/MAHNUNG
      let statusBanner = "";
      if (
        type === "rechnung" &&
        (data.status === "storniert" || data.status === "mahnung")
      ) {
        const statusConfig = {
          storniert: {
            text: "STORNIERT",
            icon: "❌",
            bgColor: "#fee2e2",
            borderColor: "#ef4444",
            textColor: "#dc2626",
            message: "Diese Rechnung wurde storniert und ist ungültig.",
          },
          mahnung: {
            text: "MAHNUNG",
            icon: "⚠️",
            bgColor: "#fef3c7",
            borderColor: "#f59e0b",
            textColor: "#d97706",
            message: "Dies ist eine Mahnung - Zahlung überfällig!",
          },
        };

        const config = statusConfig[data.status];

        statusBanner = `
      <div style="
        margin: 1rem 0 2rem 0;
        padding: 1rem;
        background: ${config.bgColor};
        border: 3px solid ${config.borderColor};
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      ">
        <div style="
          font-size: 24px;
          font-weight: bold;
          color: ${config.textColor};
          margin-bottom: 0.5rem;
          letter-spacing: 2px;
        ">
          ${config.icon} ${config.text} ${config.icon}
        </div>
        <p style="
          margin: 0;
          font-size: 14px;
          color: ${config.textColor};
          font-weight: 500;
        ">
          ${config.message}
        </p>
      </div>
    `;
      }

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
        ${additionalHeaderInfo}
      </div>
    </div>
    <hr style="border: none; border-top: ${
      this.layoutSettings.layout_header_border
    } ${this.layoutSettings.layout_color_primary}; margin: ${
        this.layoutSettings.layout_section_spacing
      } 0;">
    
    <!-- ✅ STATUS-BANNER FÜR STORNIERT/MAHNUNG -->
    ${statusBanner}
  `;
    }

    // Kundeninformationen generieren - ERWEITERT mit Kundennummer und Fahrzeugfarbe
    generateCustomerInfo(data) {
      let customerName = data.kunde_name || data.name || "Unbekannter Kunde";
      //let customerNumber = data.kunden_nr || "Unbekannte Kundennr.";

      let vehicleInfo = `Marke - Modell: <strong>${data.marke || ""} - ${
        data.modell || ""
      }</strong><br>`;
      vehicleInfo += `Kennz: <strong>${data.kennzeichen || ""}</strong><br>`;
      if (data.vin) {
        vehicleInfo += `VIN: <strong>${data.vin}</strong><br>`;
      }
      if (data.farbe || data.farbcode) {
        let colorInfo = `Farbe: <strong>`;
        if (data.farbe) colorInfo += data.farbe;
        if (data.farbcode) colorInfo += ` (${data.farbcode})`;
        vehicleInfo += `${colorInfo}</strong><br>`;
      }

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
              ${customerName}<br>
              ${data.strasse || ""}<br>
              ${data.plz || ""} ${data.ort || ""}${
        data.telefon ? `<br>Tel: ${data.telefon}` : ""
      }${data.email ? `<br>E-Mail: ${data.email}` : ""}
            </p>
          </div>
          
          ${
            data.kennzeichen
              ? `
          <div class="vehicle-info" style="flex: 1; text-align: right;">
            <h3 style="color: ${this.layoutSettings.layout_color_primary}; margin-bottom: 0.5rem;">Fahrzeug:</h3>
            <p style="margin: 0; line-height: ${this.layoutSettings.layout_line_height};">
              ${vehicleInfo}
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
          ? `<th>Beschreibung</th><th>Menge</th><th>Einzelpreis</th><th>MwSt.</th><th>Gesamt</th>`
          : `<th>Beschreibung</th><th>Zeit</th><th>Stundenpreis</th><th>Gesamt</th>`;

      // Normale Positionen
      let positionsHtml = data.positionen
        .map((pos) => {
          const menge = pos.zeit || pos.menge || 0;
          const preis = pos.stundenpreis || pos.einzelpreis || 0;
          const gesamt = pos.gesamt || menge * preis;

          if (type === "rechnung") {
            return `
        <tr>
          <td>${pos.beschreibung || ""}</td>
          <td>${menge} ${pos.einheit || ""}</td>
          <td style="text-align: right;">${this.formatCurrency(preis)}</td>
          <td style="text-align: center;">${pos.mwst_prozent || 19}%</td>
          <td style="text-align: right;">${this.formatCurrency(gesamt)}</td>
        </tr>`;
          } else {
            return `
        <tr>
          <td>${pos.beschreibung || ""}</td>
          <td style="text-align: center;">${menge} ${pos.einheit || ""}</td>
          <td style="text-align: right;">${this.formatCurrency(preis)}</td>
          <td style="text-align: right;">${this.formatCurrency(gesamt)}</td>
        </tr>`;
          }
        })
        .join("");

      // ZUSCHLÄGE für Aufträge hinzufügen
      if (type === "auftrag") {
        const zuschlaege = this.generateZuschlaegeRows(data);
        if (zuschlaege) {
          positionsHtml +=
            `
        <tr style="border-top: 2px solid #007bff;">
          <td colspan="4" style="padding: 0.5rem 0; font-weight: bold; color: #007bff;">
            ➕ Zuschläge und Zusatzleistungen
          </td>
        </tr>` + zuschlaege;
        }
      }

      return `
    <h3 style="color: ${
      this.layoutSettings.layout_color_primary
    }; margin-bottom: 1rem;">
      ${
        type === "rechnung"
          ? "Rechnungspositionen:"
          : "Arbeitszeiten und Leistungen:"
      }
    </h3>
    <table class="positions-table" style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
      <thead>
        <tr style="background-color: ${
          this.layoutSettings.layout_color_primary
        }; color: white;">
          ${headers}
        </tr>
      </thead>
      <tbody>${positionsHtml}</tbody>
    </table>`;
    }

    generateZuschlaegeRows(data) {
      let html = "";

      // Anfahrtspauschale
      if (data.anfahrt_aktiv && data.anfahrt_betrag > 0) {
        html += `
      <tr style="background-color: #f8f9fa; border-left: 4px solid #28a745;">
        <td>Anfahrtspauschale</td>
        <td style="text-align: center;">1 Pauschal</td>
        <td style="text-align: right;">${this.formatCurrency(
          data.anfahrt_betrag
        )}</td>
        <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
          data.anfahrt_betrag
        )}</td>
      </tr>`;
      }

      // Express-Zuschlag
      if (data.express_aktiv && data.express_betrag > 0) {
        const expressProz = this.layoutSettings.express_zuschlag || "25";
        html += `
      <tr style="background-color: #f8f9fa; border-left: 4px solid #ffc107;">
        <td>⚡ Express-Zuschlag (+${expressProz}%)</td>
        <td style="text-align: center;">1 Pauschal</td>
        <td style="text-align: right;">${this.formatCurrency(
          data.express_betrag
        )}</td>
        <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
          data.express_betrag
        )}</td>
      </tr>`;
      }

      // Wochenend-Zuschlag
      if (data.wochenend_aktiv && data.wochenend_betrag > 0) {
        const wochenendProz = this.layoutSettings.wochenend_zuschlag || "20";
        html += `
      <tr style="background-color: #f8f9fa; border-left: 4px solid #dc3545;">
        <td>Wochenend-Zuschlag (+${wochenendProz}%)</td>
        <td style="text-align: center;">1 Pauschal</td>
        <td style="text-align: right;">${this.formatCurrency(
          data.wochenend_betrag
        )}</td>
        <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
          data.wochenend_betrag
        )}</td>
      </tr>`;
      }

      return html;
    }

    formatCurrency(amount) {
      if (typeof amount !== "number") {
        amount = parseFloat(amount) || 0;
      }
      return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(amount);
    }

    // Zusammenfassung generieren
    generateSummary(type, data) {
      if (type === "rechnung") {
        // SKonto-Einstellungen prüfen (nur wenn beide gesetzt)
        const skontoTage = getSetting("skonto_tage", "").trim();
        const skontoProzent = getSetting("skonto_prozent", "").trim();
        const showSkonto =
          data.skonto_aktiv &&
          skontoTage &&
          skontoProzent &&
          skontoTage !== "" &&
          skontoProzent !== "";

        // SKonto-HTML nur generieren wenn Einstellungen vorhanden
        let skontoHtml = "";
        if (showSkonto) {
          skontoHtml = `
        <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 1rem; margin: 1rem 0; color: #1976d2;">
          <strong>Skonto-Vorteil:</strong> Bei Zahlung innerhalb von ${skontoTage} Tagen erhalten Sie ${skontoProzent}% Skonto.
        </div>
      `;
        }

        // Rechnungshinweise nur anzeigen wenn vorhanden
        let rechnungshinweiseHtml = "";
        if (data.rechnungshinweise && data.rechnungshinweise.trim() !== "") {
          rechnungshinweiseHtml = `
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 1rem; margin: 1rem 0; color: #856404;">
          <strong>Hinweise:</strong><br>
          ${data.rechnungshinweise}
        </div>
      `;
        }

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
          ${
            data.mwst_7 > 0
              ? `
          <tr>
            <td>MwSt. 7%:</td>
            <td style="text-align: right;">${formatCurrency(
              data.mwst_7 || 0
            )}</td>
          </tr>
          `
              : ""
          }
          <tr style="border-top: 2px solid black; font-weight: bold;">
            <td>Gesamtbetrag:</td>
            <td style="text-align: right;" class="total-amount">${formatCurrency(
              data.gesamtbetrag || 0
            )}</td>
          </tr>
        </table>
        
        <!-- SKonto-Hinweis (nur wenn gesetzt) -->
        ${skontoHtml}
        
        <!-- Rechnungshinweise (nur wenn vorhanden) -->
        ${rechnungshinweiseHtml}
        
        <div style="margin-top: 2rem; font-size: ${
          this.layoutSettings.layout_font_size_small
        }; color: #666; line-height: 1.4;">
          <p><strong style="font-size: ${
            this.layoutSettings.layout_font_size_normal
          }; color: #444;">Zahlungsbedingungen:</strong><br>
            ${
              data.zahlungsbedingungen ||
              getSetting(
                "zahlungstext",
                "Zahlbar innerhalb von 14 Tagen ohne Abzug."
              )
            }
          </p>
          
          <p><strong style="font-size: ${
            this.layoutSettings.layout_font_size_normal
          }; color: #444;">Gewährleistung:</strong><br>
            ${
              data.gewaehrleistung ||
              getSetting(
                "gewaehrleistung",
                "12 Monate Gewährleistung auf alle Arbeiten."
              )
            }
          </p>
        </div>
      </div>
    `;
      } else {
        // Auftrag bleibt unverändert
        return `
      <div class="summary-section">
        <table style="width: 300px; margin-left: auto;">
          <tr>
            <td>Gesamtzeit:</td>
            <td style="text-align: right;">${data.gesamt_zeit || 0} Std.</td>
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

    // ✅ VERBESSERTE Footer-Generierung
    generateFooter() {
      const firmenname = getSetting("firmenname", "Meine Firma");
      const rechtsform = getSetting("rechtsform", "");
      const geschaeftsfuehrer = getSetting("geschaeftsfuehrer", "");
      const steuernummer = getSetting("steuernummer", "");
      const umsatzsteuerId = getSetting("umsatzsteuer_id", "");
      const bankname = getSetting("bank_name", "");
      const iban = getSetting("bank_iban", "");
      const bic = getSetting("bank_bic", "");

      let footerContent = `<p><strong>${firmenname}</strong>`;

      if (rechtsform || geschaeftsfuehrer) {
        footerContent += ` | ${rechtsform} ${geschaeftsfuehrer}`.trim();
      }

      footerContent += "</p>";

      // Bankdaten hinzufügen (falls vorhanden)
      if (bankname && iban) {
        footerContent += `<p><strong>Bankverbindung:</strong> ${bankname} | IBAN: ${iban}`;
        if (bic) {
          footerContent += ` | BIC: ${bic}`;
        }
        footerContent += "</p>";
      }

      // Steuerdaten hinzufügen (falls vorhanden)
      if (steuernummer || umsatzsteuerId) {
        footerContent += "<p>";
        if (steuernummer) {
          footerContent += `Steuernr.: ${steuernummer}`;
        }
        if (steuernummer && umsatzsteuerId) {
          footerContent += " | ";
        }
        if (umsatzsteuerId) {
          footerContent += `USt-IdNr.: ${umsatzsteuerId}`;
        }
        footerContent += "</p>";
      }

      return `<div class="footer">${footerContent}</div>`;
    }

    // Unterschriften-Bereich generieren
    generateSignature(type) {
      if (type !== "auftrag") return "";

      const settings = this.layoutSettings;

      return `
    <div class="signature-section">
    <div style="margin-bottom: 0.5rem; font-size: ${
      settings.layout_font_size_small ||
      DEFAULT_LAYOUT_SETTINGS.layout_font_size_small
    }; color: ${
        settings.layout_color_muted ||
        DEFAULT_LAYOUT_SETTINGS.layout_color_muted
      } line-height: 1.3;">
        Mit der Unterschrift bestätigen beide Parteien die Richtigkeit der Angaben und stimmen den Bedingungen zu.
      </div>
      <div class="signature-boxes">
        <div class="signature-box">
          <div class="signature-label">Auftraggeber / Kunde</div>
        </div>
        <div class="signature-box">
          <div class="signature-label">Auftragnehmer / ${getSetting(
            "firmenname",
            "Meine Firma"
          )}</div>
        </div>
      </div>
      
    </div>
  `;
    }

    // Dokument-Titel generieren
    getDocumentTitle(type, data) {
      const documentType = type === "rechnung" ? "Rechnung" : "Auftrag";
      const number = type === "rechnung" ? data.rechnung_nr : data.auftrag_nr;
      return `${documentType} ${number} - ${getSetting(
        "firmenname",
        "Meine Firma"
      )}`;
    }

    // ✅ VERBESSERTE Print-Fenster-Funktion (für Browser-Vorschau)
    openPrintWindow(html, title) {
      // Print-Controls zu HTML hinzufügen
      const printControls = `
    <div id="print-controls" class="no-print">
      <button onclick="window.print()" title="Drucken (Strg+P)">
        🖨️ Drucken
      </button>
      <button class="secondary" onclick="window.close()" title="Fenster schließen">
        ❌ Schließen
      </button>
    </div>
  `;

      // HTML mit Print-Controls erweitern
      const fullHtml = html.replace("</body>", printControls + "</body>");

      const printWindow = window.open(
        "",
        "_blank",
        "width=1024,height=768,scrollbars=yes,resizable=yes"
      );

      if (!printWindow) {
        safeShowNotification(
          "Popup-Blocker verhindert das Öffnen des Druckfensters",
          "error"
        );
        return;
      }

      printWindow.document.write(fullHtml);
      printWindow.document.close();

      // Warten bis das Fenster vollständig geladen ist
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

  // ✅ VIEW-FUNKTIONEN FÜR RECHNUNG MIT ERWEITERUNGEN (unverändert beibehalten)

  async function viewRechnungMitSkonto(id) {
    try {
      const rechnung = await safeApiCall(`/api/rechnungen/${id}`);

      if (!rechnung) {
        safeShowNotification("Rechnung nicht gefunden", "error");
        return;
      }

      // Positionen HTML generieren
      const positionenHtml = rechnung.positionen
        .map(
          (pos) => `
      <tr>
        <td>${pos.beschreibung}</td>
        <td class="text-right">${pos.menge}</td>
        <td class="text-right">${formatCurrency(pos.einzelpreis)}</td>
        <td class="text-right">${pos.mwst_prozent}%</td>
        <td class="text-right">${formatCurrency(pos.gesamt)}</td>
      </tr>
    `
        )
        .join("");

      // SKonto-Einstellungen prüfen (nur wenn beide gesetzt)
      const skontoTage = getSetting("skonto_tage", "").trim();
      const skontoProzent = getSetting("skonto_prozent", "").trim();
      const showSkonto =
        rechnung.skonto_aktiv &&
        skontoTage &&
        skontoProzent &&
        skontoTage !== "" &&
        skontoProzent !== "";

      // SKonto-Hinweis nur generieren wenn Einstellungen vorhanden
      let skontoHinweis = "";
      if (showSkonto) {
        skontoHinweis = `
        <div style="background: rgba(33, 150, 243, 0.1); 
                    border: 1px solid #2196f3; 
                    border-radius: 8px; 
                    padding: 0.75rem 1rem; 
                    margin: 1rem 0; 
                    font-size: 0.9em; 
                    color: #1976d2;">
          <i class="fas fa-percentage" style="margin-right: 0.5rem;"></i>
          <strong>Skonto:</strong> Bei Zahlung innerhalb von ${skontoTage} Tagen erhalten Sie ${skontoProzent}% Skonto.
        </div>
      `;
      }

      // Rechnungshinweise nur anzeigen wenn vorhanden
      let rechnungshinweiseHtml = "";
      if (
        rechnung.rechnungshinweise &&
        rechnung.rechnungshinweise.trim() !== ""
      ) {
        rechnungshinweiseHtml = `
        <div style="margin: 1.5rem 0; padding: 1rem; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
          <h4 style="margin: 0 0 0.5rem 0; color: #856404;">
            <i class="fas fa-info-circle" style="margin-right: 0.5rem;"></i>Hinweise
          </h4>
          <p style="margin: 0; line-height: 1.6; color: #856404;">${rechnung.rechnungshinweise}</p>
        </div>
      `;
      }

      // Firmen-/Steuerinformationen
      const steuernummer = getSetting("steuernummer", "");
      const umsatzsteuerId = getSetting("umsatzsteuer_id", "");

      const content = `
      <!-- Rechnungskopf -->
      <div style="text-align: center; margin-bottom: 2rem;">
        <h2 style="color: #007bff; margin-bottom: 0;">RECHNUNG</h2>
        <div style="font-size: 18px; font-weight: bold;">${
          rechnung.rechnung_nr
        }</div>
      </div>
      
      <!-- Grid-Layout wie bei viewAuftrag - 2 Spalten -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
        <div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Kunde:</label>
            <div><strong>${rechnung.kunde_name}</strong></div>
          </div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Rechnungsdatum:</label>
            <div>${formatDate(rechnung.rechnungsdatum)}</div>
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
        </div>
        <div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Fahrzeug:</label>
            <div>${rechnung.kennzeichen} - ${rechnung.marke} ${
        rechnung.modell
      }</div>
          </div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
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
          <div class="form-group">
            <label class="form-label">Gesamtbetrag:</label>
            <div><strong>${formatCurrency(rechnung.gesamtbetrag)}</strong></div>
          </div>
        </div>
      </div>

      <!-- Rechnungsempfänger und Fahrzeug nebeneinander -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 2rem 0;">
        <!-- Rechnungsempfänger -->
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--accent-primary);">Empfänger:</h3>
          <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1rem;">
            <strong style="font-size: 1.1rem;">${rechnung.kunde_name}</strong>
            ${
              rechnung.kunden_nr
                ? `<br><small style="color: var(--text-muted);">(Kd.-Nr.: ${rechnung.kunden_nr})</small>`
                : ""
            }<br>
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
          <div style="background: var(--bg-tertiary);  border-radius: 8px; padding: 1rem;">
            <strong style="font-size: 1.1rem;">${rechnung.kennzeichen} - ${
        rechnung.marke
      } ${rechnung.modell}</strong><br>
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
              <span>MwSt. 19%:</span>
              <span>${formatCurrency(rechnung.mwst_19)}</span>
            </div>
            ${
              rechnung.mwst_7 > 0
                ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>MwSt. 7%:</span>
              <span>${formatCurrency(rechnung.mwst_7)}</span>
            </div>`
                : ""
            }
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
              <span>Gesamtbetrag:</span>
              <span>${formatCurrency(rechnung.gesamtbetrag)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SKonto-Hinweis (nur wenn gesetzt) -->
      ${skontoHinweis}

      <!-- Rechnungshinweise (nur wenn vorhanden) -->
      ${rechnungshinweiseHtml}

      <!-- Zahlungsbedingungen und Gewährleistung -->
      <div style="margin: 1.5rem 0;">
        <h4>Zahlungsbedingungen:</h4>
        <p style="line-height: 1.6;">${
          rechnung.zahlungsbedingungen ||
          getSetting(
            "zahlungstext",
            "Zahlbar innerhalb von 14 Tagen ohne Abzug."
          )
        }</p>
      </div>

      <div style="margin: 1.5rem 0;">
        <h4>Gewährleistung:</h4>
        <p style="line-height: 1.6;">${
          rechnung.gewaehrleistung ||
          getSetting(
            "gewaehrleistung",
            "12 Monate Gewährleistung auf alle Arbeiten."
          )
        }</p>
      </div>

      <!-- Footer mit Steuerinformationen -->
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
      <button type="button" class="btn btn-success" onclick="printRechnungDirect(${id})">
        <i class="fas fa-print"></i> Drucken
      </button>
    `;

      // createModal verwenden (sollte global verfügbar sein)
      if (window.createModal && typeof window.createModal === "function") {
        createModal(`Rechnung ${rechnung.rechnung_nr}`, content, footer);
      } else {
        console.error("createModal Funktion nicht verfügbar");
        safeShowNotification("Modal-System nicht verfügbar", "error");
      }
    } catch (error) {
      console.error("Fehler beim Laden der Rechnung:", error);
      safeShowNotification("Fehler beim Laden der Rechnung", "error");
    }
  }

  async function viewRechnungMitAnzahlung(id) {
    try {
      const rechnung = await safeApiCall(`/api/rechnungen/${id}`);

      if (!rechnung) {
        safeShowNotification("Rechnung nicht gefunden", "error");
        return;
      }

      // Positionen HTML generieren
      const positionenHtml = rechnung.positionen
        .map(
          (pos) => `
      <tr>
        <td>${pos.beschreibung}</td>
        <td class="text-right">${pos.menge}</td>
        <td class="text-right">${formatCurrency(pos.einzelpreis)}</td>
        <td class="text-right">${pos.mwst_prozent}%</td>
        <td class="text-right">${formatCurrency(pos.gesamt)}</td>
      </tr>
    `
        )
        .join("");

      // SKonto-Einstellungen prüfen (nur wenn beide gesetzt)
      const skontoTage = getSetting("skonto_tage", "").trim();
      const skontoProzent = getSetting("skonto_prozent", "").trim();
      const showSkonto =
        rechnung.skonto_aktiv &&
        skontoTage &&
        skontoProzent &&
        skontoTage !== "" &&
        skontoProzent !== "";

      // SKonto-Hinweis nur generieren wenn Einstellungen vorhanden
      let skontoHinweis = "";
      if (showSkonto) {
        skontoHinweis = `
        <div style="background: rgba(33, 150, 243, 0.1); 
                    border: 1px solid #2196f3; 
                    border-radius: 8px; 
                    padding: 0.75rem 1rem; 
                    margin: 1rem 0; 
                    font-size: 0.9em; 
                    color: #1976d2;">
          <i class="fas fa-percentage" style="margin-right: 0.5rem;"></i>
          <strong>Skonto:</strong> Bei Zahlung innerhalb von ${skontoTage} Tagen erhalten Sie ${skontoProzent}% Skonto.
        </div>
      `;
      }

      // ✅ NEUE ANZAHLUNGSDETAILS GENERIEREN - KORRIGIERT FÜR TEILBEZAHLT + THEME-STYLE
      let anzahlungsBereich = "";
      // Erweiterte Bedingung: Anzahlung > 0 ODER anzahlung_aktiv ODER Status ist teilbezahlt
      if (
        rechnung.anzahlung_betrag > 0 ||
        rechnung.anzahlung_aktiv ||
        rechnung.status === "teilbezahlt"
      ) {
        const anzahlungsBetrag = parseFloat(rechnung.anzahlung_betrag) || 0;
        const restbetrag =
          parseFloat(rechnung.restbetrag) ||
          parseFloat(rechnung.gesamtbetrag) - anzahlungsBetrag;
        const anzahlungsDatum = rechnung.anzahlung_datum;

        anzahlungsBereich = `
        <div style="margin: 1.5rem 0; padding: 1.5rem; background: var(--clr-surface-a10); border: 1px solid var(--accent-success); border-radius: 8px;">
          <h4 style="margin: 0 0 1rem 0; color: var(--accent-success); display: flex; align-items: center;">
            <i class="fas fa-coins" style="margin-right: 0.5rem;"></i>
            Anzahlungsdetails
          </h4>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div style="text-align: center; padding: 0.75rem; background: var(--clr-surface-a20); border-radius: 6px; border: 1px solid var(--border-color);">
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Gesamtbetrag</div>
              <div style="font-size: 1.1rem; font-weight: bold; color: var(--text-primary);">${formatCurrency(
                rechnung.gesamtbetrag
              )}</div>
            </div>
            
            <div style="text-align: center; padding: 0.75rem; background: var(--clr-surface-a20); border-radius: 6px; border: 1px solid var(--accent-success);">
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Anzahlung</div>
              <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-success);">${formatCurrency(
                anzahlungsBetrag
              )}</div>
              ${
                anzahlungsDatum
                  ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">${formatDate(
                      anzahlungsDatum
                    )}</div>`
                  : ""
              }
            </div>
            
            <div style="text-align: center; padding: 0.75rem; background: var(--clr-surface-a20); border-radius: 6px; border: 1px solid ${
              restbetrag > 0 ? "var(--accent-warning)" : "var(--accent-success)"
            };">
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Restbetrag</div>
              <div style="font-size: 1.1rem; font-weight: bold; color: ${
                restbetrag > 0
                  ? "var(--accent-warning)"
                  : "var(--accent-success)"
              };">
                ${formatCurrency(restbetrag)}
              </div>
              ${
                restbetrag <= 0
                  ? '<div style="font-size: 0.75rem; color: var(--accent-success); margin-top: 0.25rem;">✅ Vollständig bezahlt</div>'
                  : ""
              }
            </div>
          </div>
          
          ${
            restbetrag > 0
              ? `
            <div style="background: var(--clr-surface-tonal-a10); border: 1px solid var(--accent-warning); border-radius: 6px; padding: 0.75rem; text-align: center;">
              <strong style="color: var(--accent-warning);">⚠️ Noch zu zahlen: ${formatCurrency(
                restbetrag
              )}</strong>
            </div>
          `
              : `
            <div style="background: var(--clr-surface-tonal-a10); border: 1px solid var(--accent-success); border-radius: 6px; padding: 0.75rem; text-align: center;">
              <strong style="color: var(--accent-success);">✅ Rechnung vollständig beglichen</strong>
            </div>
          `
          }
        </div>
      `;
      }

      // Rechnungshinweise nur anzeigen wenn vorhanden
      let rechnungshinweiseHtml = "";
      if (
        rechnung.rechnungshinweise &&
        rechnung.rechnungshinweise.trim() !== ""
      ) {
        rechnungshinweiseHtml = `
        <div style="margin: 1.5rem 0; padding: 1rem; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
          <h4 style="margin: 0 0 0.5rem 0; color: #856404;">
            <i class="fas fa-info-circle" style="margin-right: 0.5rem;"></i>Hinweise
          </h4>
          <p style="margin: 0; line-height: 1.6; color: #856404;">${rechnung.rechnungshinweise}</p>
        </div>
      `;
      }

      // Firmen-/Steuerinformationen
      const steuernummer = getSetting("steuernummer", "");
      const umsatzsteuerId = getSetting("umsatzsteuer_id", "");

      const content = `
      <!-- Rechnungskopf -->
      <div style="text-align: center; margin-bottom: 2rem;">
        <h2 style="color: #007bff; margin-bottom: 0;">RECHNUNG</h2>
        <div style="font-size: 18px; font-weight: bold;">${
          rechnung.rechnung_nr
        }</div>
      </div>
      
      <!-- Grid-Layout wie bei viewAuftrag - 2 Spalten -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
        <div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Kunde:</label>
            <div><strong>${rechnung.kunde_name}</strong></div>
          </div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Rechnungsdatum:</label>
            <div>${formatDate(rechnung.rechnungsdatum)}</div>
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
        </div>
        <div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Fahrzeug:</label>
            <div>${rechnung.kennzeichen} - ${rechnung.marke} ${
        rechnung.modell
      }</div>
          </div>
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Status:</label>
            <div><span class="status status-${rechnung.status}">${
        rechnung.status === "offen"
          ? "Offen"
          : rechnung.status === "bezahlt"
          ? "Bezahlt"
          : rechnung.status === "teilbezahlt"
          ? "Teilbezahlt"
          : rechnung.status === "mahnung"
          ? "Mahnung"
          : rechnung.status === "storniert"
          ? "Storniert"
          : rechnung.status
      }</span></div>
          </div>
          <div class="form-group">
            <label class="form-label">Gesamtbetrag:</label>
            <div><strong>${formatCurrency(rechnung.gesamtbetrag)}</strong></div>
          </div>
        </div>
      </div>

      <!-- ✅ ANZAHLUNGSBEREICH (NEU) -->
      ${anzahlungsBereich}

      <!-- Rechnungsempfänger und Fahrzeug nebeneinander -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 2rem 0;">
        <!-- Rechnungsempfänger -->
        <div>
          <h3 style="margin-bottom: 1rem; color: var(--accent-primary);">Empfänger:</h3>
          <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1rem;">
            <strong style="font-size: 1.1rem;">${rechnung.kunde_name}</strong>
            ${
              rechnung.kunden_nr
                ? `<br><small style="color: var(--text-muted);">(Kd.-Nr.: ${rechnung.kunden_nr})</small>`
                : ""
            }<br>
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
          <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1rem;">
            <strong style="font-size: 1.1rem;">${rechnung.kennzeichen} - ${
        rechnung.marke
      } ${rechnung.modell}</strong><br>
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
              <span>MwSt. 19%:</span>
              <span>${formatCurrency(rechnung.mwst_19)}</span>
            </div>
            ${
              rechnung.mwst_7 > 0
                ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>MwSt. 7%:</span>
              <span>${formatCurrency(rechnung.mwst_7)}</span>
            </div>`
                : ""
            }
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
              <span>Gesamtbetrag:</span>
              <span>${formatCurrency(rechnung.gesamtbetrag)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SKonto-Hinweis (nur wenn gesetzt) -->
      ${skontoHinweis}

      <!-- Rechnungshinweise (nur wenn vorhanden) -->
      ${rechnungshinweiseHtml}

      <!-- Zahlungsbedingungen und Gewährleistung -->
      <div style="margin: 1.5rem 0;">
        <h4>Zahlungsbedingungen:</h4>
        <p style="line-height: 1.6;">${
          rechnung.zahlungsbedingungen ||
          getSetting(
            "zahlungstext",
            "Zahlbar innerhalb von 14 Tagen ohne Abzug."
          )
        }</p>
      </div>

      <div style="margin: 1.5rem 0;">
        <h4>Gewährleistung:</h4>
        <p style="line-height: 1.6;">${
          rechnung.gewaehrleistung ||
          getSetting(
            "gewaehrleistung",
            "12 Monate Gewährleistung auf alle Arbeiten."
          )
        }</p>
      </div>

      <!-- Footer mit Steuerinformationen -->
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
      <button type="button" class="btn btn-success" onclick="printRechnungDirect(${id})">
        <i class="fas fa-print"></i> Drucken
      </button>
    `;

      // createModal verwenden (sollte global verfügbar sein)
      if (window.createModal && typeof window.createModal === "function") {
        createModal(`Rechnung ${rechnung.rechnung_nr}`, content, footer);
      } else {
        console.error("createModal Funktion nicht verfügbar");
        safeShowNotification("Modal-System nicht verfügbar", "error");
      }
    } catch (error) {
      console.error("Fehler beim Laden der Rechnung:", error);
      safeShowNotification("Fehler beim Laden der Rechnung", "error");
    }
  }

  // ✅ GLOBALE INSTANZ ERSTELLEN
  const enhancedPrint = new EnhancedPrintSystem();

  // ✅ OPTION 1: HAUPTFUNKTIONEN AUF DIREKTDRUCK UMSTELLEN
  window.printRechnung = function (id) {
    console.log("printRechnung called with id (DIREKTDRUCK):", id);
    enhancedPrint.printDocumentDirect("rechnung", id);
  };

  window.printAuftrag = function (id) {
    console.log("printAuftrag called with id (DIREKTDRUCK):", id);
    enhancedPrint.printDocumentDirect("auftrag", id);
  };

  // ✅ ZUSÄTZLICHE FUNKTIONEN (falls Browser-Vorschau noch benötigt wird)
  window.printRechnungMitVorschau = function (id) {
    enhancedPrint.printDocument("rechnung", id);
  };

  window.printAuftragMitVorschau = function (id) {
    enhancedPrint.printDocument("auftrag", id);
  };

  // ✅ ERWEITERTE PRINT-FUNKTIONEN (unverändert beibehalten)
  window.printRechnungEnhanced = function (id, options = {}) {
    enhancedPrint.layoutSettings = {
      ...enhancedPrint.layoutSettings,
      ...options,
    };
    enhancedPrint.printDocumentDirect("rechnung", id);
  };

  window.printAuftragEnhanced = function (id, options = {}) {
    enhancedPrint.layoutSettings = {
      ...enhancedPrint.layoutSettings,
      ...options,
    };
    enhancedPrint.printDocumentDirect("auftrag", id);
  };

  // ✅ DIREKTER DRUCK OHNE PREVIEW (jetzt als Aliase)
  window.printRechnungDirect = function (id) {
    console.log("printRechnungDirect called with id:", id);
    enhancedPrint.printDocumentDirect("rechnung", id);
  };

  window.printAuftragDirect = function (id) {
    console.log("printAuftragDirect called with id:", id);
    enhancedPrint.printDocumentDirect("auftrag", id);
  };

  // ✅ BULK-PRINT-FUNKTIONEN (unverändert beibehalten)
  window.printMultipleDocuments = async function (documents) {
    for (const doc of documents) {
      await enhancedPrint.printDocumentDirect(doc.type, doc.id);
      // Kurze Verzögerung zwischen den Dokumenten
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  };

  // ✅ ZUSÄTZLICHE DIREKT-PRINT-FUNKTIONEN
  window.printRechnungSofort = function (id) {
    console.log("Direkter Rechnungsdruck, ID:", id);
    enhancedPrint.printDocumentDirect("rechnung", id);
  };

  window.printAuftragSofort = function (id) {
    console.log("Direkter Auftragsdruck, ID:", id);
    enhancedPrint.printDocumentDirect("auftrag", id);
  };

  // ✅ MODUS-UMSCHALTUNG
  window.setDirectPrintMode = function (enabled = true) {
    if (enabled) {
      // Alle Hauptfunktionen auf Direktdruck umstellen
      window.printRechnung = function (id) {
        enhancedPrint.printDocumentDirect("rechnung", id);
      };
      window.printAuftrag = function (id) {
        enhancedPrint.printDocumentDirect("auftrag", id);
      };
    } else {
      // Zurück zu Browser-Vorschau
      window.printRechnung = function (id) {
        enhancedPrint.printDocument("rechnung", id);
      };
      window.printAuftrag = function (id) {
        enhancedPrint.printDocument("auftrag", id);
      };
    }

    console.log(
      "Print-Modus geändert:",
      enabled ? "Direktdruck aktiviert" : "Browser-Vorschau aktiviert"
    );
  };

  // ✅ EVENT-LISTENER FÜR EINSTELLUNGEN (unverändert beibehalten)
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

  // ✅ VIEW-RECHNUNG FUNKTION ÜBERSCHREIBEN (unverändert beibehalten)
  if (typeof window.viewRechnung === "function") {
    window.viewRechnungOriginal = window.viewRechnung; // Backup
  }
  window.viewRechnung = viewRechnungMitAnzahlung;

  // ✅ EXPORT FÜR DEBUGGING (unverändert beibehalten)
  window.enhancedPrint = enhancedPrint;

  // ✅ HILFSFUNKTIONEN FÜR ENTWICKLER
  window.printDebugInfo = function () {
    console.log("=== Enhanced Print System - Debug Info ===");
    console.log("Direktdruck-Modus:", "AKTIVIERT (Option 1)");
    console.log("Verfügbare Funktionen:");
    console.log("- printRechnung(id): Hauptfunktion - Direktdruck");
    console.log("- printAuftrag(id): Hauptfunktion - Direktdruck");
    console.log("- printRechnungMitVorschau(id): Mit Browser-Vorschau");
    console.log("- printAuftragMitVorschau(id): Mit Browser-Vorschau");
    console.log("- printRechnungSofort(id): Direktdruck (Alias)");
    console.log("- printAuftragSofort(id): Direktdruck (Alias)");
    console.log("Layout-Einstellungen:", enhancedPrint.layoutSettings);
    console.log("===========================================");
  };

  // ✅ SCHNELL-TEST FUNKTION
  window.testPrint = function (type = "rechnung", id = 1) {
    console.log(`🧪 Test-Print: ${type} mit ID ${id}`);

    if (type === "rechnung") {
      printRechnung(id);
    } else if (type === "auftrag") {
      printAuftrag(id);
    } else {
      console.error('Ungültiger Type. Verwende "rechnung" oder "auftrag"');
    }
  };

  console.log(
    "✅ Enhanced Print System - Option 1 (Direktdruck für alle Funktionen) geladen"
  );
  console.log("🎯 Alle Hauptfunktionen verwenden jetzt Direktdruck!");
  console.log("📞 Verwende printDebugInfo() für Debug-Informationen");
  console.log("🧪 Verwende testPrint('rechnung', 1) zum Testen");
})();
