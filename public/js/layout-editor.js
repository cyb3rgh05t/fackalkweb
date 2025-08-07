import { apiCall, showNotification } from "./utils.js";
import { getSetting, setSetting } from "./einstellungen.js";

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

  // Abstände und Margins
  layout_page_margin: "2cm",
  layout_print_margin: "1cm",
  layout_section_spacing: "2rem",
  layout_paragraph_spacing: "1rem",
  layout_table_padding: "8px",

  // Logo-Einstellungen
  layout_logo_position: "top-left",
  layout_logo_max_width: "200px",
  layout_logo_max_height: "100px",
  layout_logo_margin: "0 2rem 1rem 0",

  // Header-Layout
  layout_header_alignment: "space-between",
  layout_header_border: "2px solid",
  layout_header_padding: "1rem",

  // Tabellen-Layout
  layout_table_border: "1px solid #ddd",
  layout_table_header_bg: "#f5f5f5",
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
};

// Layout-Editor initialisieren
export function initLayoutEditor() {
  console.log("🎨 Layout-Editor wird initialisiert...");

  // Prüfen ob Layout-Tab existiert, falls nicht erstellen
  addLayoutTabIfNotExists();

  // Event-Listener für Layout-Vorschau
  setupLayoutPreview();

  console.log("✅ Layout-Editor bereit");
}

// Layout-Tab zum Einstellungen-System hinzufügen
function addLayoutTabIfNotExists() {
  const tabsContainer = document.querySelector(".settings-tabs");
  const contentContainer = tabsContainer?.parentElement;

  if (!tabsContainer || document.querySelector('[data-tab="layout"]')) {
    return; // Tab existiert bereits
  }

  // Layout-Tab hinzufügen
  const layoutTab = document.createElement("button");
  layoutTab.className = "settings-tab";
  layoutTab.setAttribute("data-tab", "layout");
  layoutTab.innerHTML = '<i class="fas fa-palette"></i> Layout-Design';
  layoutTab.onclick = () => showSettingsTab("layout");
  tabsContainer.appendChild(layoutTab);

  // Layout-Content hinzufügen
  const layoutContent = createLayoutContent();
  contentContainer.appendChild(layoutContent);
}

// Layout-Einstellungen Content erstellen
function createLayoutContent() {
  const content = document.createElement("div");
  content.id = "layout-settings";
  content.className = "settings-content";

  content.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Layout & Design Konfiguration</h2>
        <div class="layout-actions">
          <button type="button" class="btn btn-info" onclick="previewLayout('rechnung')">
            <i class="fas fa-eye"></i> Rechnungs-Vorschau
          </button>
          <button type="button" class="btn btn-info" onclick="previewLayout('auftrag')">
            <i class="fas fa-eye"></i> Auftrags-Vorschau
          </button>
          <button type="button" class="btn btn-secondary" onclick="resetLayoutDefaults()">
            <i class="fas fa-undo"></i> Zurücksetzen
          </button>
        </div>
      </div>
      
      <form id="layout-form">
        <div class="layout-tabs">
          <button type="button" class="layout-tab-btn active" data-section="typography">
            <i class="fas fa-font"></i> Typographie
          </button>
          <button type="button" class="layout-tab-btn" data-section="spacing">
            <i class="fas fa-expand-arrows-alt"></i> Abstände
          </button>
          <button type="button" class="layout-tab-btn" data-section="colors">
            <i class="fas fa-palette"></i> Farben
          </button>
          <button type="button" class="layout-tab-btn" data-section="elements">
            <i class="fas fa-th-large"></i> Elemente
          </button>
          <!-- <button type="button" class="layout-tab-btn" data-section="print">
            <i class="fas fa-print"></i> Druck
          </button> -->
        </div>
        
        <!-- Typographie Sektion -->
        <div class="layout-section active" id="typography-section">
          <h3><i class="fas fa-font"></i> Schrift & Typographie</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Schriftart</label>
              <select class="form-input" name="layout_font_family">
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Helvetica Neue', sans-serif">Helvetica</option>
                <option value="'Roboto', sans-serif">Roboto</option>
                <option value="'Open Sans', sans-serif">Open Sans</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Normale Schriftgröße</label>
              <input type="text" class="form-input" name="layout_font_size_normal" placeholder="14px">
            </div>
            <div class="form-group">
              <label class="form-label">Kleine Schriftgröße</label>
              <input type="text" class="form-input" name="layout_font_size_small" placeholder="12px">
            </div>
            <div class="form-group">
              <label class="form-label">Große Schriftgröße</label>
              <input type="text" class="form-input" name="layout_font_size_large" placeholder="16px">
            </div>
            <div class="form-group">
              <label class="form-label">Überschrift H1</label>
              <input type="text" class="form-input" name="layout_font_size_h1" placeholder="24px">
            </div>
            <div class="form-group">
              <label class="form-label">Überschrift H2</label>
              <input type="text" class="form-input" name="layout_font_size_h2" placeholder="20px">
            </div>
            <div class="form-group">
              <label class="form-label">Zeilenhöhe</label>
              <input type="text" class="form-input" name="layout_line_height" placeholder="1.5">
            </div>
            <div class="form-group">
              <label class="form-label">Zeichenabstand</label>
              <input type="text" class="form-input" name="layout_letter_spacing" placeholder="0px">
            </div>
          </div>
        </div>
        
        <!-- Abstände Sektion -->
        <div class="layout-section" id="spacing-section">
          <h3><i class="fas fa-expand-arrows-alt"></i> Abstände & Margins</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Seitenabstand (normal)</label>
              <input type="text" class="form-input" name="layout_page_margin" placeholder="2cm">
            </div>
            <div class="form-group">
              <label class="form-label">Seitenabstand (Druck)</label>
              <input type="text" class="form-input" name="layout_print_margin" placeholder="1cm">
            </div>
            <div class="form-group">
              <label class="form-label">Abschnitt-Abstand</label>
              <input type="text" class="form-input" name="layout_section_spacing" placeholder="2rem">
            </div>
            <div class="form-group">
              <label class="form-label">Absatz-Abstand</label>
              <input type="text" class="form-input" name="layout_paragraph_spacing" placeholder="1rem">
            </div>
            <div class="form-group">
              <label class="form-label">Tabellen-Padding</label>
              <input type="text" class="form-input" name="layout_table_padding" placeholder="8px">
            </div>
            <div class="form-group">
              <label class="form-label">Header-Padding</label>
              <input type="text" class="form-input" name="layout_header_padding" placeholder="1rem">
            </div>
          </div>
        </div>
        
        <!-- Farben Sektion -->
        <div class="layout-section" id="colors-section">
          <h3><i class="fas fa-palette"></i> Farben</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Primärfarbe</label>
              <input type="color" class="form-input color-input" name="layout_color_primary" value="#007bff">
            </div>
            <div class="form-group">
              <label class="form-label">Textfarbe</label>
              <input type="color" class="form-input color-input" name="layout_color_text" value="#333333">
            </div>
            <div class="form-group">
              <label class="form-label">Grauer Text</label>
              <input type="color" class="form-input color-input" name="layout_color_muted" value="#666666">
            </div>
            <div class="form-group">
              <label class="form-label">Rahmenfarbe</label>
              <input type="color" class="form-input color-input" name="layout_color_border" value="#dddddd">
            </div>
            <div class="form-group">
              <label class="form-label">Hintergrundfarbe</label>
              <input type="color" class="form-input color-input" name="layout_color_background" value="#ffffff">
            </div>
            <div class="form-group">
              <label class="form-label">Tabellen-Header</label>
              <input type="color" class="form-input color-input" name="layout_table_header_bg" value="#f5f5f5">
            </div>
          </div>
        </div>
        
        <!-- Elemente Sektion -->
        <div class="layout-section" id="elements-section">
          <h3><i class="fas fa-th-large"></i> Layout-Elemente</h3>
          
          
            <h4>Logo-Einstellungen</h4>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Logo-Position</label>
                <select class="form-input" name="layout_logo_position">
                  <option value="none">Kein Logo anzeigen</option>
                  <option value="top-left">Oben Links</option>  
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Logo Max-Breite</label>
                <input type="text" class="form-input" name="layout_logo_max_width" placeholder="200px">
              </div>
              <div class="form-group">
                <label class="form-label">Logo Max-Höhe</label>
                <input type="text" class="form-input" name="layout_logo_max_height" placeholder="100px">
              </div>
            </div>
          
          
          
            <h4>Footer-Einstellungen</h4>
            <div class="form-grid">
              <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" name="layout_footer_enabled" value="true">
                  <span>Footer anzeigen</span>
                </label>
              </div>
              <div class="form-group">
                <label class="form-label">Footer-Ausrichtung</label>
                <select class="form-input" name="layout_footer_alignment">
                  <option value="left">Links</option>
                  <option value="center">Zentriert</option>
                  <option value="right">Rechts</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Footer-Schriftgröße</label>
                <input type="text" class="form-input" name="layout_footer_font_size" placeholder="12px">
              </div>
            </div>
          
          
          
            <h4>Unterschriften-Bereich</h4>
            <div class="form-grid">
              <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" name="layout_signature_enabled" value="true">
                  <span>Unterschriften-Bereich anzeigen</span>
                </label>
              </div>
              <div class="form-group">
                <label class="form-label">Unterschrift-Höhe</label>
                <input type="text" class="form-input" name="layout_signature_height" placeholder="4cm">
              </div>
              <div class="form-group">
                <label class="form-label">Abstand von oben</label>
                <input type="text" class="form-input" name="layout_signature_margin_top" placeholder="3cm">
              </div>
            </div>
          </div>
        
        
        <!-- Druck Sektion
        <div class="layout-section" id="print-section">
          <h3><i class="fas fa-print"></i> Druck-Einstellungen</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Papierformat</label>
              <select class="form-input" name="layout_print_page_size">
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Ausrichtung</label>
              <select class="form-input" name="layout_print_orientation">
                <option value="portrait">Hochformat</option>
                <option value="landscape">Querformat</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Skalierung</label>
              <select class="form-input" name="layout_print_scale">
                <option value="100%">100%</option>
                <option value="90%">90%</option>
                <option value="80%">80%</option>
                <option value="75%">75%</option>
              </select>
            </div>
          </div>
        </div> -->
        
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            <i class="fas fa-save"></i> Layout-Einstellungen speichern
          </button>
        </div>
      </form>
    </div>
  `;

  // Event-Listener hinzufügen
  setupLayoutFormEvents(content);

  return content;
}

// Event-Listener für Layout-Form
function setupLayoutFormEvents(container) {
  // Tab-Navigation
  const tabButtons = container.querySelectorAll(".layout-tab-btn");
  const sections = container.querySelectorAll(".layout-section");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.dataset.section + "-section";

      // Tabs umschalten
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      sections.forEach((section) => section.classList.remove("active"));

      button.classList.add("active");
      container.querySelector(`#${sectionId}`).classList.add("active");
    });
  });

  // Form-Submit
  const form = container.querySelector("#layout-form");
  form.addEventListener("submit", saveLayoutSettings);

  // Live-Preview bei Änderungen
  const inputs = form.querySelectorAll("input, select");
  inputs.forEach((input) => {
    input.addEventListener("change", debounce(updateLivePreview, 500));
  });
}

// Layout-Einstellungen speichern
async function saveLayoutSettings(event) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const updates = {};

  // Formular-Daten sammeln
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("layout_")) {
      updates[key] = value;
    }
  }

  // Checkbox-Werte korrekt verarbeiten
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    if (checkbox.name.startsWith("layout_")) {
      updates[checkbox.name] = checkbox.checked ? "true" : "false";
    }
  });

  try {
    await apiCall("/api/einstellungen/batch", "PUT", { settings: updates });
    showNotification("Layout-Einstellungen erfolgreich gespeichert", "success");

    // Einstellungen global aktualisieren
    Object.assign(window.einstellungen, updates);

    // Event für andere Module
    window.dispatchEvent(
      new CustomEvent("layoutSettingsUpdated", {
        detail: updates,
      })
    );
  } catch (error) {
    console.error("Fehler beim Speichern der Layout-Einstellungen:", error);
    showNotification("Fehler beim Speichern der Layout-Einstellungen", "error");
  }
}

// Layout-Vorschau
window.previewLayout = function (type) {
  const previewWindow = window.open("", "_blank", "width=800,height=1000");
  const layoutCSS = generateLayoutCSS();

  const sampleData =
    type === "rechnung" ? getSampleRechnung() : getSampleAuftrag();

  previewWindow.document.write(`
    <html>
      <head>
        <title>Layout-Vorschau - ${type}</title>
        <style>
          ${layoutCSS}
          body { margin: 0; padding: 20px; }
          .preview-header {
            background: #f8f9fa;
            padding: 10px 20px;
            border-bottom: 1px solid #ddd;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
          }
          .preview-content {
            margin-top: 60px;
          }
        </style>
      </head>
      <body>
        <div class="preview-header">
          <strong>Layout-Vorschau</strong> - ${
            type.charAt(0).toUpperCase() + type.slice(1)
          }
          <button onclick="window.print()" style="float: right;">Drucken</button>
        </div>
        <div class="preview-content">
          ${sampleData}
        </div>
      </body>
    </html>
  `);

  previewWindow.document.close();
};

// CSS aus Layout-Einstellungen generieren
function generateLayoutCSS() {
  const settings = window.einstellungen || {};

  return `
    body { 
      font-family: ${
        settings.layout_font_family ||
        DEFAULT_LAYOUT_SETTINGS.layout_font_family
      }; 
      margin: ${
        settings.layout_page_margin ||
        DEFAULT_LAYOUT_SETTINGS.layout_page_margin
      }; 
      color: ${
        settings.layout_color_text || DEFAULT_LAYOUT_SETTINGS.layout_color_text
      };
      background: ${
        settings.layout_color_background ||
        DEFAULT_LAYOUT_SETTINGS.layout_color_background
      };
      font-size: ${
        settings.layout_font_size_normal ||
        DEFAULT_LAYOUT_SETTINGS.layout_font_size_normal
      };
      line-height: ${
        settings.layout_line_height ||
        DEFAULT_LAYOUT_SETTINGS.layout_line_height
      };
      letter-spacing: ${
        settings.layout_letter_spacing ||
        DEFAULT_LAYOUT_SETTINGS.layout_letter_spacing
      };
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
      margin-bottom: 0.5rem;
    }
    
    h2 { 
      font-size: ${
        settings.layout_font_size_h2 ||
        DEFAULT_LAYOUT_SETTINGS.layout_font_size_h2
      };
      color: ${
        settings.layout_color_primary ||
        DEFAULT_LAYOUT_SETTINGS.layout_color_primary
      };
      margin-bottom: 1rem;
    }
    
    h3 { 
      font-size: ${
        settings.layout_font_size_h3 ||
        DEFAULT_LAYOUT_SETTINGS.layout_font_size_h3
      };
      color: ${
        settings.layout_color_primary ||
        DEFAULT_LAYOUT_SETTINGS.layout_color_primary
      };
    }
    
    .header-section {
      display: flex;
      justify-content: ${
        settings.layout_header_alignment ||
        DEFAULT_LAYOUT_SETTINGS.layout_header_alignment
      };
      align-items: start;
      margin-bottom: ${
        settings.layout_section_spacing ||
        DEFAULT_LAYOUT_SETTINGS.layout_section_spacing
      };
      padding: ${
        settings.layout_header_padding ||
        DEFAULT_LAYOUT_SETTINGS.layout_header_padding
      };
      border-bottom: ${
        settings.layout_header_border ||
        DEFAULT_LAYOUT_SETTINGS.layout_header_border
      } ${
    settings.layout_color_primary ||
    DEFAULT_LAYOUT_SETTINGS.layout_color_primary
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
    }
    
    table {
      width: 100%;
      border-collapse: ${
        settings.layout_table_border_collapse ||
        DEFAULT_LAYOUT_SETTINGS.layout_table_border_collapse
      };
      margin: ${
        settings.layout_paragraph_spacing ||
        DEFAULT_LAYOUT_SETTINGS.layout_paragraph_spacing
      } 0;
    }
    
    th, td {
      padding: ${
        settings.layout_table_padding ||
        DEFAULT_LAYOUT_SETTINGS.layout_table_padding
      };
      text-align: left;
      border-bottom: ${
        settings.layout_table_border ||
        DEFAULT_LAYOUT_SETTINGS.layout_table_border
      };
      border-color: ${
        settings.layout_color_border ||
        DEFAULT_LAYOUT_SETTINGS.layout_color_border
      };
    }
    
    th {
      background-color: ${
        settings.layout_table_header_bg ||
        DEFAULT_LAYOUT_SETTINGS.layout_table_header_bg
      };
      font-weight: bold;
    }
    
    .footer-section {
      margin-top: ${
        settings.layout_footer_margin_top ||
        DEFAULT_LAYOUT_SETTINGS.layout_footer_margin_top
      };
      padding-top: 1rem;
      ${
        settings.layout_footer_border_top === "true"
          ? `border-top: 1px solid ${
              settings.layout_color_border ||
              DEFAULT_LAYOUT_SETTINGS.layout_color_border
            };`
          : ""
      }
      text-align: ${
        settings.layout_footer_alignment ||
        DEFAULT_LAYOUT_SETTINGS.layout_footer_alignment
      };
      font-size: ${
        settings.layout_footer_font_size ||
        DEFAULT_LAYOUT_SETTINGS.layout_footer_font_size
      };
      color: ${
        settings.layout_color_muted ||
        DEFAULT_LAYOUT_SETTINGS.layout_color_muted
      };
    }
    
    .signature-section {
      margin-top: ${
        settings.layout_signature_margin_top ||
        DEFAULT_LAYOUT_SETTINGS.layout_signature_margin_top
      };
      page-break-inside: avoid;
      border-top: 2px solid ${
        settings.layout_color_primary ||
        DEFAULT_LAYOUT_SETTINGS.layout_color_primary
      };
      padding-top: 2rem;
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
      margin-top: 1rem;
      position: relative;
    }
    
    .text-muted {
      color: ${
        settings.layout_color_muted ||
        DEFAULT_LAYOUT_SETTINGS.layout_color_muted
      };
      font-size: ${
        settings.layout_font_size_small ||
        DEFAULT_LAYOUT_SETTINGS.layout_font_size_small
      };
    }
    
    @media print {
      body { 
        margin: ${
          settings.layout_print_margin ||
          DEFAULT_LAYOUT_SETTINGS.layout_print_margin
        };
      }
      button { display: none; }
      @page {
        margin: ${
          settings.layout_print_margin ||
          DEFAULT_LAYOUT_SETTINGS.layout_print_margin
        };
        size: ${
          settings.layout_print_page_size ||
          DEFAULT_LAYOUT_SETTINGS.layout_print_page_size
        } ${
    settings.layout_print_orientation ||
    DEFAULT_LAYOUT_SETTINGS.layout_print_orientation
  };
      }
    }
  `;
}

// Beispiel-Daten für Vorschau
function getSampleRechnung() {
  return `
    <div class="header-section">
      <div>
        <h1>Meine Firma</h1>
        <div class="text-muted">
          Musterstraße 123<br>
          12345 Musterstadt<br>
          Tel: 0123-456789<br>
          E-Mail: info@meine-firma.de
        </div>
      </div>
      <div style="text-align: right;">
        <h2>RECHNUNG</h2>
        <div><strong>Rechnung-Nr.:</strong> R000123</div>
        <div><strong>Datum:</strong> ${new Date().toLocaleDateString(
          "de-DE"
        )}</div>
      </div>
    </div>
    
    <div style="margin: 2rem 0;">
      <div style="display: flex; justify-content: space-between;">
        <div>
          <strong>Kunde:</strong><br>
          Max Mustermann<br>
          Beispielstraße 456<br>
          54321 Beispielstadt
        </div>
        <div style="text-align: right;">
          <strong>Fahrzeug:</strong><br>
          BMW 3er (E90)<br>
          Kennzeichen: MM-123<br>
          Farbe: Alpinweiß
        </div>
      </div>
    </div>
    
    <h3>Rechnungspositionen</h3>
    <table style="text-align: right; margin-top: 2rem; font-size: ${getSetting(
      "layout_font_size_large",
      "12px"
    )};">
      <thead style="text-align: right; margin-top: 2rem; font-size: ${getSetting(
        "layout_font_size_large",
        "12px"
      )};">
        <tr style="text-align: right; margin-top: 2rem; font-size: ${getSetting(
          "layout_font_size_normal",
          "10px"
        )};">
          <th>Beschreibung</th>
          <th>Menge</th>
          <th>Einzelpreis</th>
          <th>MwSt</th>
          <th>Gesamt</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Lackierung Stoßstange vorn</td>
          <td>1</td>
          <td>€ 450,00</td>
          <td>19%</td>
          <td>€ 450,00</td>
        </tr>
        <tr>
          <td>Spachteln und Grundierung</td>
          <td>3 Std</td>
          <td>€ 110,00</td>
          <td>19%</td>
          <td>€ 330,00</td>
        </tr>
      </tbody>
    </table>
    
    <div style="text-align: right; margin-top: 2rem; font-size: ${getSetting(
      "layout_font_size_large",
      "12px"
    )};">
      <div><strong>Zwischensumme: € 780,00</strong></div>
      <div>zzgl. 19% MwSt: € 148,20</div>
      <div style="border-top: 2px solid; padding-top: 0.5rem; margin-top: 0.5rem;">
        <strong>Gesamtbetrag: € 928,20</strong>
      </div>
    </div>
    
    ${
      getSetting("layout_footer_enabled", "true") === "true"
        ? `
      <div class="footer-section">
        Bankverbindung: Sparkasse Musterstadt | IBAN: DE12 3456 7890 1234 5678 90<br>
        Steuernummer: 123/456/78901 | USt-IdNr.: DE123456789
      </div>
    `
        : ""
    }
  `;
}

function getSampleAuftrag() {
  return `
    <div class="header-section">
      <div>
        <h1>Meine Firma</h1>
        <div class="text-muted">
          Musterstraße 123<br>
          12345 Musterstadt<br>
          Tel: 0123-456789<br>
          E-Mail: info@meine-firma.de
        </div>
      </div>
      <div style="text-align: right;">
        <h2>AUFTRAG</h2>
        <div><strong>Auftrag-Nr.:</strong> A000123</div>
        <div><strong>Datum:</strong> ${new Date().toLocaleDateString(
          "de-DE"
        )}</div>
      </div>
    </div>
    
    <div style="margin: 2rem 0;">
      <div style="display: flex; justify-content: space-between;">
        <div>
          <strong>Kunde:</strong><br>
          Max Mustermann<br>
          Beispielstraße 456<br>
          54321 Beispielstadt
        </div>
        <div style="text-align: right;">
          <strong>Fahrzeug:</strong><br>
          BMW 3er (E90)<br>
          Kennzeichen: MM-123<br>
          Farbe: Alpinweiß
        </div>
      </div>
    </div>
    
    <h3>Arbeitsschritte</h3>
    <table style="text-align: right; margin-top: 2rem; font-size: ${getSetting(
      "layout_font_size_large",
      "12px"
    )};">
      <thead style="text-align: right; margin-top: 2rem; font-size: ${getSetting(
        "layout_font_size_large",
        "12px"
      )};">
        <tr style="text-align: right; margin-top: 2rem; font-size: ${getSetting(
          "layout_font_size_normal",
          "10px"
        )};">
          <th>Beschreibung</th>
          <th>Zeit</th>
          <th>Stundenpreis</th>
          <th>Gesamt</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Demontage Stoßstange</td>
          <td>1.0 Std</td>
          <td>€ 110,00</td>
          <td>€ 110,00</td>
        </tr>
        <tr>
          <td>Spachteln und Schleifen</td>
          <td>2.5 Std</td>
          <td>€ 110,00</td>
          <td>€ 275,00</td>
        </tr>
        <tr>
          <td>Grundierung auftragen</td>
          <td>1.5 Std</td>
          <td>€ 110,00</td>
          <td>€ 165,00</td>
        </tr>
        <tr>
          <td>Basislack und Klarlack</td>
          <td>3.0 Std</td>
          <td>€ 110,00</td>
          <td>€ 330,00</td>
        </tr>
        <tr>
          <td>Polieren und Montage</td>
          <td>1.0 Std</td>
          <td>€ 110,00</td>
          <td>€ 110,00</td>
        </tr>
      </tbody>
    </table>
    
    <div style="text-align: right; margin-top: 2rem; font-size: ${getSetting(
      "layout_font_size_large",
      "12px"
    )};">
      <div><strong>Gesamtkosten (netto): € 990,00</strong></div>
      <div>zzgl. 19% MwSt: € 188,10</div>
      <div style="border-top: 2px solid; padding-top: 0.5rem; margin-top: 0.5rem;">
        <strong>Gesamtbetrag (brutto): € 1.178,10</strong>
      </div>
    </div>
    
    ${
      getSetting("layout_signature_enabled", "true") === "true"
        ? `
      <div class="signature-section">
        <h3>Kundenabnahme</h3>
        <p>Hiermit bestätige ich die ordnungsgemäße Ausführung der oben aufgeführten Arbeiten.</p>
        <div class="signature-box"></div>
        <div style="margin-top: 0.5rem; font-size: ${getSetting(
          "layout_font_size_normal",
          "10px"
        )};">
          Datum und Unterschrift Kunde
        </div>
      </div>
    `
        : ""
    }
    
    ${
      getSetting("layout_footer_enabled", "true") === "true"
        ? `
      <div class="footer-section">
        Steuernummer: 123/456/78901 | USt-IdNr.: DE123456789
      </div>
    `
        : ""
    }
  `;
}

// Standard-Layout wiederherstellen
window.resetLayoutDefaults = async function () {
  if (
    !confirm(
      "Möchten Sie wirklich alle Layout-Einstellungen auf die Standardwerte zurücksetzen?"
    )
  ) {
    return;
  }

  try {
    await apiCall("/api/einstellungen/batch", "PUT", {
      settings: DEFAULT_LAYOUT_SETTINGS,
    });

    showNotification("Layout-Einstellungen wurden zurückgesetzt", "success");

    // Form neu laden
    Object.assign(window.einstellungen, DEFAULT_LAYOUT_SETTINGS);
    fillLayoutForm();
  } catch (error) {
    showNotification(
      "Fehler beim Zurücksetzen der Layout-Einstellungen",
      "error"
    );
  }
};

// Layout-Form mit aktuellen Werten füllen
function fillLayoutForm() {
  const form = document.getElementById("layout-form");
  if (!form) return;

  Object.keys(DEFAULT_LAYOUT_SETTINGS).forEach((key) => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input) {
      const value = getSetting(key, DEFAULT_LAYOUT_SETTINGS[key]);

      if (input.type === "checkbox") {
        input.checked = value === "true";
      } else {
        input.value = value;
      }
    }
  });
}

// Live-Vorschau aktualisieren
function updateLivePreview() {
  // Hier könnte eine Live-Vorschau implementiert werden
  console.log("Live-Preview aktualisiert");
}

// Debounce-Hilfsfunktion
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Layout-Vorschau Setup
function setupLayoutPreview() {
  // Event-Listener für Layout-Updates
  window.addEventListener("layoutSettingsUpdated", () => {
    console.log("Layout-Einstellungen wurden aktualisiert");
  });
}

// Layout-Editor beim Laden der Einstellungen initialisieren
window.addEventListener("settingsLoaded", () => {
  initLayoutEditor();
  fillLayoutForm();
});

// Export für andere Module
export {
  generateLayoutCSS,
  getSampleRechnung,
  getSampleAuftrag,
  DEFAULT_LAYOUT_SETTINGS,
};
