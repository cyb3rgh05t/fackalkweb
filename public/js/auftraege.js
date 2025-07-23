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
      .map(
        (auftrag) => `
        <tr onclick="viewAuftrag(${auftrag.id})" style="cursor: pointer;">
          <td>${auftrag.auftrag_nr}</td>
          <td>${auftrag.kunde_name || auftrag.name || "-"}</td>
          <td>${auftrag.kennzeichen || ""} - ${auftrag.marke || ""} ${
          auftrag.modell || ""
        }</td>
          <td>${formatDate(auftrag.datum)}</td>
          <td>
            <span class="status status-${auftrag.status.replace("_", "-")}">${
          auftrag.status === "in_bearbeitung"
            ? "In Bearbeitung"
            : auftrag.status === "offen"
            ? "Offen"
            : auftrag.status === "abgeschlossen"
            ? "Abgeschlossen"
            : auftrag.status
        }</span>
          </td>
          <td>${formatCurrency(auftrag.gesamt_kosten)}</td>
          <td onclick="event.stopPropagation()">
            <button 
              class="btn btn-sm btn-primary" 
              onclick="editAuftrag(${auftrag.id})"
              title="Bearbeiten"
            >
              <i class="fas fa-edit"></i>
            </button>
            <button 
              class="btn btn-sm btn-info" 
              onclick="printAuftrag(${auftrag.id})"
              title="Drucken"
            >
              <i class="fas fa-print"></i>
            </button>
            <button 
              class="btn btn-sm btn-success" 
              onclick="createRechnungFromAuftrag(${auftrag.id})"
              title="Rechnung erstellen"
            >
              <i class="fas fa-file-invoice"></i>
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              onclick="deleteAuftrag(${auftrag.id})"
              title="Löschen"
            >
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `
      )
      .join("");
  } catch (error) {
    showNotification("Fehler beim Laden der Aufträge", "error");
  }
}

// ===== NEUE DRUCKFUNKTIONALITÄT =====

async function printAuftrag(id) {
  try {
    // Prüfen ob bereits ein Modal mit Auftragsinhalt geöffnet ist
    const modalContent = document.querySelector(".modal-body");

    if (modalContent && modalContent.innerHTML.includes("AUFTRAG")) {
      // Modal ist bereits geöffnet - direkt drucken
      printModalContent(modalContent, "auftrag");
    } else {
      // Kein Modal geöffnet - Auftrag laden und drucken
      await printAuftragDirect(id);
    }
  } catch (error) {
    console.error("Print error:", error);
    showNotification("Fehler beim Drucken des Auftrags", "error");
  }
}

// Hilfsfunktion: Modal-Inhalt drucken
function printModalContent(modalContent, type = "auftrag") {
  const title = type === "auftrag" ? "Auftrag" : "Rechnung";
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 2cm; }
          table { width: 100%; border-collapse: collapse; margin: 1em 0; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; }
          .text-right { text-align: right; }
          .signature-section { 
            margin-top: 3cm; 
            page-break-inside: avoid;
            border-top: 2px solid #007bff;
            padding-top: 2rem;
          }
          .signature-box {
            border: 1px solid #333;
            height: 4cm;
            margin-top: 1cm;
            position: relative;
          }
          .signature-label {
            position: absolute;
            bottom: -1.5em;
            left: 0;
            font-size: 12px;
            color: #666;
          }
          @media print { 
            button { display: none; }
            .modal-header, .modal-footer { display: none; }
            body { margin: 1cm; }
          }
          @page {
            margin: 1cm;
            size: A4;
          }
        </style>
      </head>
      <body>
        ${modalContent.innerHTML}
        ${type === "auftrag" ? generateSignatureSection() : ""}
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

// Hilfsfunktion: Auftrag direkt drucken (ohne Modal)
async function printAuftragDirect(id) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${id}`);

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
    const steuernummer = getSetting("steuernummer", "");
    const umsatzsteuerId = getSetting("umsatzsteuer_id", "");
    const mwstSatz = parseFloat(getSetting("mwst_satz", "19"));

    // HTML für Auftragspositionen generieren
    const positionenHtml =
      auftrag.positionen
        ?.map(
          (pos) => `
        <tr>
          <td>${pos.beschreibung}</td>
          <td style="text-align: center;">${pos.zeit} ${pos.einheit}</td>
          <td style="text-align: right;">${formatCurrency(
            pos.stundenpreis
          )}</td>
          <td style="text-align: right;">${formatCurrency(pos.gesamt)}</td>
        </tr>
      `
        )
        .join("") || '<tr><td colspan="4">Keine Positionen</td></tr>';

    // Gesamtkosten berechnen
    const gesamtNetto = auftrag.gesamt_kosten || 0;
    const mwstBetrag = gesamtNetto * (mwstSatz / 100);
    const gesamtBrutto = gesamtNetto + mwstBetrag;

    const auftragsHtml = `
      <!-- Firmen-Header -->
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #007bff;">
        <div>
          <h1 style="color: #007bff; margin-bottom: 0.5rem; font-size: 24px;">${firmenname}</h1>
          <div style="color: #666; line-height: 1.4; font-size: 14px;">
            ${firmenStrasse}<br>
            ${firmenPlz} ${firmenOrt}<br>
            Tel: ${firmenTelefon}<br>
            E-Mail: ${firmenEmail}
          </div>
        </div>
        <div style="text-align: right;">
          <h2 style="color: #007bff; margin-bottom: 1rem; font-size: 20px;">AUFTRAG</h2>
          <div style="font-size: 14px;"><strong>Auftrag-Nr.: ${
            auftrag.auftrag_nr
          }</strong></div>
          <div style="font-size: 14px;">Datum: ${formatDate(
            auftrag.datum
          )}</div>
          <div style="font-size: 14px;">Status: <span style="color: #007bff; font-weight: bold;">${auftrag.status.toUpperCase()}</span></div>
        </div>
      </div>

      <!-- Kunden- und Fahrzeugdaten -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 2rem;">
        <div style="width: 48%;">
          <h3 style="color: #007bff; margin-bottom: 0.5rem; font-size: 16px;">Kunde</h3>
          <div style="line-height: 1.4; font-size: 14px;">
            <strong>${auftrag.name}</strong><br>
            ${auftrag.strasse || ""}<br>
            ${auftrag.plz || ""} ${auftrag.ort || ""}<br>
            ${auftrag.telefon ? `Tel: ${auftrag.telefon}` : ""}
          </div>
        </div>
        <div style="width: 48%;">
          <h3 style="color: #007bff; margin-bottom: 0.5rem; font-size: 16px;">Fahrzeug</h3>
          <div style="line-height: 1.4; font-size: 14px;">
            <strong>${auftrag.kennzeichen}</strong><br>
            ${auftrag.marke} ${auftrag.modell}<br>
            ${auftrag.vin ? `VIN: ${auftrag.vin}` : ""}<br>
            ${auftrag.farbe ? `Farbe: ${auftrag.farbe}` : ""}
          </div>
        </div>
      </div>

      <!-- Arbeitszeiten -->
      <h3 style="color: #007bff; margin-bottom: 1rem; font-size: 16px;">Arbeitszeiten</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Beschreibung</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">Zeit</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Stundenpreis</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          ${positionenHtml}
        </tbody>
      </table>

      <!-- Kostenübersicht -->
      <div style="margin-top: 2rem;">
        <div style="float: right; width: 300px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; text-align: right; font-weight: bold;">Netto:</td>
              <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">${formatCurrency(
                gesamtNetto
              )}</td>
            </tr>
            <tr>
              <td style="padding: 8px; text-align: right;">zzgl. ${mwstSatz}% MwSt:</td>
              <td style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">${formatCurrency(
                mwstBetrag
              )}</td>
            </tr>
            <tr style="background-color: #f8f9fa;">
              <td style="padding: 8px; text-align: right; font-weight: bold; font-size: 16px;">Gesamt:</td>
              <td style="padding: 8px; text-align: right; font-weight: bold; font-size: 16px;">${formatCurrency(
                gesamtBrutto
              )}</td>
            </tr>
          </table>
        </div>
        <div style="clear: both;"></div>
      </div>

      ${
        auftrag.bemerkungen
          ? `
      <!-- Bemerkungen -->
      <div style="margin-top: 2rem;">
        <h3 style="color: #007bff; margin-bottom: 1rem; font-size: 16px;">Bemerkungen</h3>
        <div style="padding: 1rem; background-color: #f8f9fa; border-left: 4px solid #007bff; line-height: 1.4;">
          ${auftrag.bemerkungen.replace(/\n/g, "<br>")}
        </div>
      </div>
      `
          : ""
      }

      <!-- Unterschriftensektion -->
      ${generateSignatureSection()}

      <!-- Steuerinformationen -->
      ${
        steuernummer || umsatzsteuerId
          ? `
      <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
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
          <title>Auftrag ${auftrag.auftrag_nr}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 2cm; 
              color: #333;
            }
            table {
              border-collapse: collapse;
            }
            .signature-section { 
              margin-top: 3cm; 
              page-break-inside: avoid;
              border-top: 2px solid #007bff;
              padding-top: 2rem;
            }
            .signature-row {
              display: flex;
              justify-content: space-between;
              margin-top: 2rem;
            }
            .signature-box {
              width: 45%;
              border: 1px solid #333;
              height: 4cm;
              position: relative;
              background-color: #fafafa;
            }
            .signature-label {
              position: absolute;
              bottom: -1.5em;
              left: 0;
              font-size: 12px;
              color: #666;
              font-weight: bold;
            }
            .signature-date {
              position: absolute;
              top: 0.5em;
              right: 0.5em;
              font-size: 10px;
              color: #999;
            }
            @media print { 
              body { margin: 1cm; }
              button { display: none; }
            }
            @page {
              margin: 1cm;
              size: A4;
            }
          </style>
        </head>
        <body>
          ${auftragsHtml}
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
    console.error("Error loading order for print:", error);
    showNotification("Fehler beim Laden des Auftrags für Druck", "error");
  }
}

// Hilfsfunktion: Unterschriftensektion generieren
function generateSignatureSection() {
  const today = new Date().toLocaleDateString("de-DE");

  return `
    <div class="signature-section">
      <h3 style="color: #007bff; margin-bottom: 1rem; font-size: 16px;">
        <i class="fas fa-pen" style="margin-right: 0.5rem;"></i>
        Kundenabnahme
      </h3>
      
      <p style="margin-bottom: 2rem; line-height: 1.5; color: #555;">
        Hiermit bestätige ich die ordnungsgemäße Ausführung der oben aufgeführten Arbeiten 
        und erkenne die Rechnung in der angegebenen Höhe an.
      </p>
      
      <div class="signature-row" style="display: flex; justify-content: space-between; margin-top: 2rem;">
        <div class="signature-box" style="width: 45%; border: 1px solid #333; height: 4cm; position: relative; background-color: #fafafa;">
          <div class="signature-date" style="position: absolute; top: 0.5em; right: 0.5em; font-size: 10px; color: #999;">
            Datum: ______________
          </div>
          <div class="signature-label" style="position: absolute; bottom: -1.5em; left: 0; font-size: 12px; color: #666; font-weight: bold;">
            Unterschrift Kunde
          </div>
        </div>
        
        <div class="signature-box" style="width: 45%; border: 1px solid #333; height: 4cm; position: relative; background-color: #fafafa;">
          <div class="signature-date" style="position: absolute; top: 0.5em; right: 0.5em; font-size: 10px; color: #999;">
            Datum: ${today}
          </div>
          <div class="signature-label" style="position: absolute; bottom: -1.5em; left: 0; font-size: 12px; color: #666; font-weight: bold;">
            Unterschrift Meine Firma
          </div>
        </div>
      </div>
      
      <div style="margin-top: 3rem; padding: 1rem; background-color: #f8f9fa; border-left: 4px solid #007bff; font-size: 12px; color: #666;">
        <strong>Hinweis:</strong> Diese Unterschrift bestätigt die Abnahme der Arbeiten zum angegebenen Datum. 
        Bei Reklamationen wenden Sie sich bitte umgehend an uns. Gewährleistungsansprüche bleiben hiervon unberührt.
      </div>
    </div>
  `;
}

// ===== VIEWAUFTRAG FUNKTION ERWEITERT =====

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
        <div class="form-group"><label class="form-label">Status:</label><div><span class="status status-${
          auftrag.status
        }">${auftrag.status}</span></div></div>
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

// ===== BESTEHENDE FUNKTIONEN (unverändert) =====

async function showAuftragModal(auftragId = null) {
  const isEdit = !!auftragId;
  let auftrag = null;

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

  const arbeitsschritteRows = standardArbeitsschritte
    .map((schritt, index) => {
      const position = auftrag?.positionen?.[index] || {};
      return `
        <tr>
            <td><input type="text" class="form-input" value="${
              position.beschreibung || schritt
            }" name="beschreibung_${index}"></td>
            <td><input type="number" step="0.01" class="form-input" value="${
              position.stundenpreis || basisStundenpreis
            }" name="stundenpreis_${index}"></td>
            <td><input type="number" step="0.01" class="form-input" value="${
              position.zeit || 0
            }" name="zeit_${index}" onchange="calculateAuftragRow(${index})"></td>
            <td>Std.</td>
            <td><input type="number" step="0.01" class="form-input" value="${
              position.gesamt || 0
            }" name="gesamt_${index}" readonly></td>
        </tr>
      `;
    })
    .join("");

  const content = `
        <form id="auftrag-form">
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
                    <label class="form-label">Auftragsdatum *</label>
                    <input type="date" class="form-input" name="datum" value="${
                      auftrag?.datum || new Date().toISOString().split("T")[0]
                    }" required>
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
            
            <h3>Arbeitszeiten</h3>
            <table class="table">
                <thead>
                    <tr>
                        <th>Beschreibung</th>
                        <th>Stundenpreis</th>
                        <th>Zeit</th>
                        <th>Einheit</th>
                        <th>Gesamt</th>
                    </tr>
                </thead>
                <tbody>
                    ${arbeitsschritteRows}
                </tbody>
            </table>
            
            <div class="form-group">
                <label class="form-label">Bemerkungen</label>
                <textarea class="form-textarea" name="bemerkungen" rows="3">${
                  auftrag?.bemerkungen || ""
                }</textarea>
            </div>
            
            <div class="cost-summary">
                <div class="cost-row">
                    <span>Gesamtkosten (netto):</span>
                    <span id="gesamt-kosten">€ 0,00</span>
                </div>
                <div class="cost-row">
                    <span>Inkl. MwSt (${getSetting("mwst_satz", "19")}%):</span>
                    <span id="gesamt-mwst">€ 0,00</span>
                </div>
            </div>
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

// Weitere bestehende Funktionen bleiben unverändert...
// (calculateAuftragRow, updateAuftragCalculations, saveAuftrag, deleteAuftrag, etc.)

window.calculateAuftragRow = function (index) {
  const stundenpreis =
    parseFloat(
      document.querySelector(`[name="stundenpreis_${index}"]`).value
    ) || 0;
  const zeit =
    parseFloat(document.querySelector(`[name="zeit_${index}"]`).value) || 0;
  const gesamt = stundenpreis * zeit;

  document.querySelector(`[name="gesamt_${index}"]`).value = gesamt.toFixed(2);
  updateAuftragCalculations();
};

const updateAuftragCalculations = () => {
  let gesamtKosten = 0;
  const inputs = document.querySelectorAll('[name^="gesamt_"]');

  inputs.forEach((input) => {
    gesamtKosten += parseFloat(input.value) || 0;
  });

  const mwstSatz = parseFloat(getSetting("mwst_satz", "19")) / 100;
  const gesamtKostenEl = document.getElementById("gesamt-kosten");
  const gesamtMwstEl = document.getElementById("gesamt-mwst");

  if (gesamtKostenEl) gesamtKostenEl.textContent = formatCurrency(gesamtKosten);
  if (gesamtMwstEl)
    gesamtMwstEl.textContent = formatCurrency(gesamtKosten * (1 + mwstSatz));
};

window.saveAuftrag = async function (auftragId = null) {
  const form = document.getElementById("auftrag-form");
  const formData = new FormData(form);
  const positionen = [];

  const maxRows = document.querySelectorAll('[name^="beschreibung_"]').length;

  for (let i = 0; i < maxRows; i++) {
    const beschreibung = formData.get(`beschreibung_${i}`);
    const stundenpreis = parseFloat(formData.get(`stundenpreis_${i}`)) || 0;
    const zeit = parseFloat(formData.get(`zeit_${i}`)) || 0;
    const gesamt = parseFloat(formData.get(`gesamt_${i}`)) || 0;
    if (beschreibung && (zeit > 0 || gesamt > 0)) {
      positionen.push({
        beschreibung,
        stundenpreis,
        zeit,
        einheit: "Std.",
        gesamt,
      });
    }
  }

  const data = {
    kunden_id: parseInt(formData.get("kunden_id")),
    fahrzeug_id: parseInt(formData.get("fahrzeug_id")),
    datum: formData.get("datum"),
    status: formData.get("status"),
    positionen,
    bemerkungen: formData.get("bemerkungen"),
  };

  try {
    if (auftragId) {
      await apiCall(`/api/auftraege/${auftragId}`, "PUT", data);
      showNotification("Auftrag erfolgreich aktualisiert", "success");
    } else {
      await apiCall("/api/auftraege", "POST", data);
      showNotification("Auftrag erfolgreich erstellt", "success");

      // E-Mail-Benachrichtigung senden falls aktiviert
      const emailBenachrichtigung = getSetting("email_benachrichtigung", "0");
      if (emailBenachrichtigung === "1") {
        // Hier würde die E-Mail-Funktionalität implementiert werden
        console.log("E-Mail-Benachrichtigung würde gesendet werden");
      }
    }
    closeModal();
    loadAuftraege();
  } catch (error) {
    showNotification("Fehler beim Speichern des Auftrags", "error");
  }
};

async function deleteAuftrag(id) {
  if (
    confirm(
      "Auftrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    )
  ) {
    try {
      await apiCall(`/api/auftraege/${id}`, "DELETE");
      showNotification("Auftrag erfolgreich gelöscht", "success");
      loadAuftraege();
    } catch (error) {
      showNotification("Fehler beim Löschen des Auftrags", "error");
    }
  }
}

async function updateAuftragStatus(id, status) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${id}`);
    auftrag.status = status;
    await apiCall(`/api/auftraege/${id}`, "PUT", auftrag);
    showNotification("Status erfolgreich aktualisiert", "success");
    loadAuftraege();
  } catch (error) {
    showNotification("Fehler beim Aktualisieren des Status", "error");
    loadAuftraege();
  }
}

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

    // Auftrag in Rechnung umwandeln
    const rechnungsData = {
      auftrag_id: auftrag.id,
      kunden_id: auftrag.kunden_id,
      fahrzeug_id: auftrag.fahrzeug_id,
      rechnungsdatum: new Date().toISOString().split("T")[0],
      auftragsdatum: auftrag.datum,
      positionen: (auftrag.positionen || []).map((pos) => ({
        kategorie: "ARBEITSZEITEN",
        beschreibung: pos.beschreibung,
        menge: pos.zeit,
        einheit: pos.einheit,
        einzelpreis: pos.stundenpreis,
        mwst_prozent: mwstSatz,
        gesamt: pos.gesamt,
      })),
      rabatt_prozent: 0,
      status: "offen",
    };

    const result = await apiCall("/api/rechnungen", "POST", rechnungsData);

    // Validierung: Prüfen ob Rechnung korrekt erstellt wurde
    const neueRechnung = await apiCall(`/api/rechnungen/${result.id}`);
    if (!neueRechnung.auftrag_nr) {
      console.error(
        "❌ Warnung: Neue Rechnung hat keine auftrag_nr!",
        neueRechnung
      );
      showNotification(
        "Warnung: Rechnungserstellung teilweise fehlerhaft",
        "warning"
      );
    } else {
      console.log(
        `✅ Rechnung korrekt erstellt: ${result.rechnung_nr} → ${neueRechnung.auftrag_nr}`
      );
    }

    showNotification(
      `Rechnung ${result.rechnung_nr} erfolgreich aus Auftrag ${auftrag.auftrag_nr} erstellt`,
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

// Event Listener für Einstellungsänderungen
window.addEventListener("settingsUpdated", () => {
  console.log("Einstellungen wurden aktualisiert - Aufträge-Modul reagiert");
  // Hier könnten weitere Aktionen ausgeführt werden
});

// Export der Funktionen
window.showAuftragModal = showAuftragModal;
window.printAuftrag = printAuftrag;
window.viewAuftrag = viewAuftrag;
window.editAuftrag = showAuftragModal; // Alias für editAuftrag
window.deleteAuftrag = deleteAuftrag;
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

console.log(
  "auftraege.js v3.0 mit Druckfunktion und Unterschriftsstelle geladen - " +
    new Date().toISOString()
);
