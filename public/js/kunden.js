import { apiCall, showNotification } from "./utils.js";
import { addSearchToTable } from "./search.js";
import { createModal, closeModal } from "./modals.js";
import { getSetting } from "./einstellungen.js";

export async function loadKunden() {
  try {
    window.kunden = await apiCall("/api/kunden");
    const tbody = document.querySelector("#kunden-table tbody");
    tbody.innerHTML = window.kunden
      .map(
        (k) => `
        <tr onclick="viewKundenDetails(${
          k.id
        })" style="cursor: pointer;" onmouseover="this.style.backgroundColor='var(--clr-surface-a10)'" onmouseout="this.style.backgroundColor=''">
          <td>
            <strong>${k.kunden_nr}</strong>
          </td>
          <td>
            <strong>${k.name}</strong>
          </td>
          <td>
            <div>${k.strasse || ""}</div>
            ${
              k.plz || k.ort
                ? `<small style="color: var(--text-muted);">${k.plz || ""} ${
                    k.ort || ""
                  }</small>`
                : ""
            }
          </td>
          <td>
            <div>${k.telefon || "-"}</div>
            ${
              k.telefon
                ? `<small style="color: var(--text-muted);">Tel</small>`
                : ""
            }
          </td>
          <td>
            <div>${k.email || "-"}</div>
            ${
              k.email
                ? `<small style="color: var(--text-muted);">E-Mail</small>`
                : ""
            }
          </td>
          <td onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editKunde(${
              k.id
            })" title="Bearbeiten">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); viewKundenDetails(${
              k.id
            })" title="Details anzeigen">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); createAuftragForKunde(${
              k.id
            })" title="Neuen Auftrag erstellen">
              <i class="fas fa-plus-circle"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteKunde(${
              k.id
            })" title="Löschen">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `
      )
      .join("");
    setTimeout(() => addSearchToTable("kunden-table", "kunden-search"), 100);
  } catch (err) {
    console.error("Failed to load customers:", err);
  }
}

window.editKunde = function (id) {
  showKundenModal(id);
};

window.viewKunde = function (id) {
  viewKundenDetails(id);
};

window.createAuftragForKunde = function (id) {
  // Weiterleitung zu Aufträge mit vorausgewähltem Kunden
  window.showSection("auftraege");
  setTimeout(() => {
    window.showAuftragModal();
    // Kunde vorauswählen
    setTimeout(() => {
      const kundenSelect = document.querySelector('[name="kunden_id"]');
      if (kundenSelect) {
        kundenSelect.value = id;
        kundenSelect.dispatchEvent(new Event("change"));
      }
    }, 100);
  }, 300);
};

function showKundenModal(kundeId = null) {
  const k = kundeId ? window.kunden.find((k) => k.id === kundeId) : {};
  const isEdit = !!kundeId;

  // Standard-Werte aus Einstellungen für neue Kunden
  const defaultPlz = getSetting("firmen_plz", "");
  const defaultOrt = getSetting("firmen_ort", "");

  const content = `
    <form id="kunde-form">
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input type="text" class="form-input" name="name" value="${
            k?.name || ""
          }" required>
        </div>
        <div class="form-group">
          <label class="form-label">Straße, Hausnummer</label>
          <input type="text" class="form-input" name="strasse" value="${
            k?.strasse || ""
          }">
        </div>
        <div class="form-group">
          <label class="form-label">PLZ</label>
          <input type="text" class="form-input" name="plz" value="${
            k?.plz || (isEdit ? "" : defaultPlz)
          }" placeholder="${defaultPlz}">
        </div>
        <div class="form-group">
          <label class="form-label">Ort</label>
          <input type="text" class="form-input" name="ort" value="${
            k?.ort || (isEdit ? "" : defaultOrt)
          }" placeholder="${defaultOrt}">
        </div>
        <div class="form-group">
          <label class="form-label">Telefon</label>
          <input type="tel" class="form-input" name="telefon" value="${
            k?.telefon || ""
          }">
        </div>
        <div class="form-group">
          <label class="form-label">E-Mail</label>
          <input type="email" class="form-input" name="email" value="${
            k?.email || ""
          }">
        </div>
      </div>
      ${
        !isEdit
          ? `
      <div class="form-group" style="margin-top: 2rem;">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="create-vehicle-checkbox" onchange="toggleVehicleForm()">
          <span>Gleichzeitig Fahrzeug anlegen</span>
        </label>
      </div>
      <div id="vehicle-form-section" style="display: none; margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
        <h4 style="margin-bottom: 1rem;">Fahrzeugdaten</h4>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Kennzeichen *</label>
            <input type="text" class="form-input" name="vehicle_kennzeichen">
          </div>
          <div class="form-group">
            <label class="form-label">Marke</label>
            <input type="text" class="form-input" name="vehicle_marke">
          </div>
          <div class="form-group">
            <label class="form-label">Modell</label>
            <input type="text" class="form-input" name="vehicle_modell">
          </div>
          <div class="form-group">
            <label class="form-label">VIN</label>
            <input type="text" class="form-input" name="vehicle_vin">
          </div>
          <div class="form-group">
            <label class="form-label">Baujahr</label>
            <input type="number" class="form-input" name="vehicle_baujahr" min="1900" max="${
              new Date().getFullYear() + 1
            }">
          </div>
          <div class="form-group">
            <label class="form-label">Farbe</label>
            <input type="text" class="form-input" name="vehicle_farbe">
          </div>
        </div>
      </div>
      `
          : ""
      }
    </form>`;

  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button type="button" class="btn btn-primary" onclick="saveKunde(${kundeId})">
      <i class="fas fa-save"></i> ${isEdit ? "Aktualisieren" : "Erstellen"}
    </button>
  `;

  createModal(isEdit ? "Kunde bearbeiten" : "Neuer Kunde", content, footer);
}

// Toggle-Funktion für Fahrzeugformular
window.toggleVehicleForm = function () {
  const checkbox = document.getElementById("create-vehicle-checkbox");
  const vehicleSection = document.getElementById("vehicle-form-section");
  vehicleSection.style.display = checkbox.checked ? "block" : "none";

  // Required-Attribut für Kennzeichen setzen/entfernen
  const kennzeichenInput = document.querySelector(
    '[name="vehicle_kennzeichen"]'
  );
  if (kennzeichenInput) {
    if (checkbox.checked) {
      kennzeichenInput.setAttribute("required", "required");
    } else {
      kennzeichenInput.removeAttribute("required");
    }
  }
};

window.saveKunde = async function (kundeId = null) {
  const form = document.getElementById("kunde-form");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  // Fahrzeugdaten separieren
  const vehicleData = {};
  const createVehicle = document.getElementById(
    "create-vehicle-checkbox"
  )?.checked;

  if (createVehicle && !kundeId) {
    Object.keys(data).forEach((key) => {
      if (key.startsWith("vehicle_")) {
        vehicleData[key.replace("vehicle_", "")] = data[key];
        delete data[key];
      }
    });
  }

  try {
    let result;
    if (kundeId) {
      await apiCall(`/api/kunden/${kundeId}`, "PUT", data);
      showNotification("Kunde erfolgreich aktualisiert", "success");
    } else {
      result = await apiCall("/api/kunden", "POST", data);
      showNotification("Kunde erfolgreich erstellt", "success");

      // Fahrzeug erstellen falls gewünscht
      if (createVehicle && result.id && vehicleData.kennzeichen) {
        try {
          vehicleData.kunden_id = result.id;
          await apiCall("/api/fahrzeuge", "POST", vehicleData);
          showNotification(
            "Fahrzeug wurde ebenfalls erfolgreich erstellt",
            "success"
          );
        } catch (vehicleError) {
          showNotification(
            "Kunde erstellt, aber Fehler beim Fahrzeug: " +
              vehicleError.message,
            "warning"
          );
        }
      }
    }

    closeModal();
    loadKunden();
  } catch (err) {
    showNotification("Fehler beim Speichern des Kunden", "error");
  }
};

window.viewKundenDetails = async function (id) {
  try {
    const kunde = await apiCall(`/api/kunden/${id}`);
    const fahrzeuge = await apiCall(`/api/fahrzeuge?kunden_id=${id}`);
    const auftraege = await apiCall("/api/auftraege");
    const rechnungen = await apiCall("/api/rechnungen");

    // Aufträge und Rechnungen für diesen Kunden filtern
    const kundenAuftraege = auftraege.filter((a) => a.kunden_id === id);
    const kundenRechnungen = rechnungen.filter((r) => r.kunden_id === id);

    // Statistiken berechnen
    const offeneAuftraege = kundenAuftraege.filter(
      (a) => a.status === "offen" || a.status === "in-bearbeitung"
    ).length;
    const offeneRechnungen = kundenRechnungen.filter(
      (r) => r.status === "offen"
    ).length;
    const gesamtumsatz = kundenRechnungen
      .filter((r) => r.status === "bezahlt")
      .reduce((sum, r) => sum + (r.gesamtbetrag || 0), 0);

    // Fahrzeuge HTML (für die linke Spalte)
    const fahrzeugeHtml =
      fahrzeuge.length > 0
        ? fahrzeuge
            .map(
              (f) => `
        <div style="background: var(--clr-surface-a10); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid var(--accent-primary);">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <strong>${f.kennzeichen}</strong>
              <br><small style="color: var(--text-muted);">${f.marke} ${
                f.modell
              }</small>
            </div>
            <div style="text-align: right;">
              <small style="color: var(--text-muted);">${
                f.baujahr || "Baujahr unbekannt"
              }</small>
              ${
                f.farbe
                  ? `<br><small style="color: var(--text-secondary);">${f.farbe}</small>`
                  : ""
              }
            </div>
          </div>
          ${
            f.vin
              ? `<div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); font-family: monospace;">VIN: ${f.vin}</div>`
              : ""
          }
        </div>
      `
            )
            .join("")
        : `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">
           <i class="fas fa-car" style="font-size: 2rem; opacity: 0.5; margin-bottom: 1rem;"></i>
           <div>Noch keine Fahrzeuge registriert</div>
         </div>`;

    // Letzte Aufträge HTML (für die rechte Spalte)
    const letzteAuftraegeHtml =
      kundenAuftraege.length > 0
        ? kundenAuftraege
            .sort((a, b) => new Date(b.datum) - new Date(a.datum))
            .slice(0, 5)
            .map(
              (a) => `
        <div style="background: var(--clr-surface-a10); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid var(--accent-primary);">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <strong>${a.auftrag_nr}</strong>
              <br><small style="color: var(--text-muted);">${new Date(
                a.datum
              ).toLocaleDateString("de-DE")}</small>
            </div>
            <div style="text-align: right;">
              <span class="status status-${a.status}">${a.status}</span>
              <br><small>${new Intl.NumberFormat("de-DE", {
                style: "currency",
                currency: "EUR",
              }).format(a.gesamt_kosten || 0)}</small>
            </div>
          </div>
          ${
            a.bemerkungen
              ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">${a.bemerkungen}</div>`
              : ""
          }
        </div>
      `
            )
            .join("")
        : `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">
           <i class="fas fa-info-circle" style="font-size: 2rem; opacity: 0.5; margin-bottom: 1rem;"></i>
           <div>Noch keine Aufträge vorhanden</div>
         </div>`;

    // MAIN CONTENT - EXAKT wie im Screenshot mit Grid-Layout
    const content = `
      <!-- Grid-Layout wie im Screenshot -->
      <div style="display: grid; grid-template-columns: auto auto; gap: 2rem; margin-bottom: 2rem;">
        <div>
          <div style="margin-bottom: 1.5rem;">
            <label class="form-label">Kunden-Nr.:</label>
            <div>${kunde.kunden_nr}</div>
          </div>
          <div>
          <label class="form-label">Adresse:</label>
          <div>
            ${kunde.strasse || ""}<br>
            ${kunde.plz || ""} ${kunde.ort || ""}
          </div>
        </div>
        </div>
        <div>
          <div style="margin-bottom: 1.5rem;">
            <label class="form-label">Name:</label>
            <div><strong>${kunde.name}</strong></div>
          </div>
          <div>
            <label class="form-label">Kontakt:</label>
            <div>
              ${kunde.telefon ? `Tel: ${kunde.telefon}<br>` : ""}
              ${kunde.email ? `E-Mail: ${kunde.email}` : ""}
            </div>
          </div>
        </div>
        <div>
          <label class="form-label">Kunde seit:</label>
          <div>${new Date(kunde.erstellt_am).toLocaleDateString("de-DE")}</div>
        </div>
      </div>
      
      <!-- Statistiken (wie im Kundendetails) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <div style="background: var(--accent-primary); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold;">${
            fahrzeuge.length
          }</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Fahrzeuge</div>
        </div>
        <div style="background: var(--accent-warning); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold;">${offeneAuftraege}</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Offene Aufträge</div>
        </div>
        <div style="background: var(--accent-danger); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold;">${offeneRechnungen}</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Offene Rechnungen</div>
        </div>
        <div style="background: var(--accent-success); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.2rem; font-weight: bold;">${new Intl.NumberFormat(
            "de-DE",
            { style: "currency", currency: "EUR" }
          ).format(gesamtumsatz)}</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Gesamtumsatz</div>
        </div>
      </div>
      
      <!-- Zwei-Spalten Layout für Fahrzeuge und Letzte Aufträge -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        <div>
          <h4><i class="fas fa-car"></i> Fahrzeuge</h4>
          ${fahrzeugeHtml}
        </div>
        <div>
          <h4><i class="fas fa-history"></i> Letzte Aufträge</h4>
          ${letzteAuftraegeHtml}
        </div>
      </div>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Schließen</button>
      <button type="button" class="btn btn-primary" onclick="editKunde(${id})">
        <i class="fas fa-edit"></i> Bearbeiten
      </button>
      <button type="button" class="btn btn-success" onclick="createAuftragForKunde(${id})">
        <i class="fas fa-plus"></i> Neuer Auftrag
      </button>
    `;

    createModal(`Kundendetails: ${kunde.name}`, content, footer);
  } catch (error) {
    showNotification("Fehler beim Laden der Kundendetails", "error");
    console.error("Fehler:", error);
  }
};

window.deleteKunde = async function (id) {
  const kunde = window.kunden.find((k) => k.id === id);

  try {
    // Sammle Informationen über verknüpfte Daten
    let fahrzeugCount = 0;
    let auftragCount = 0;
    let rechnungCount = 0;
    let fahrzeugDetails = [];

    try {
      // Fahrzeuge zählen
      const fahrzeuge = await apiCall("/api/fahrzeuge");
      const kundenFahrzeuge = fahrzeuge.filter((f) => f.kunde_id === id);
      fahrzeugCount = kundenFahrzeuge.length;
      fahrzeugDetails = kundenFahrzeuge.map((f) => f.kennzeichen).slice(0, 3); // Nur erste 3 anzeigen

      // Aufträge zählen
      const auftraege = await apiCall("/api/auftraege");
      auftragCount = auftraege.filter((a) => a.kunde_id === id).length;

      // Rechnungen zählen
      const rechnungen = await apiCall("/api/rechnungen");
      rechnungCount = rechnungen.filter((r) => r.kunde_id === id).length;
    } catch (dataError) {
      console.warn(
        "Konnte verknüpfte Daten nicht vollständig laden:",
        dataError
      );
    }

    // Bestätigungs-Dialog erstellen
    let confirmMessage = `🚨 KUNDE KOMPLETT LÖSCHEN

Kunde: "${kunde?.name || "Unbekannt"}"
${kunde?.email ? `E-Mail: ${kunde.email}` : ""}
${kunde?.telefon ? `Telefon: ${kunde.telefon}` : ""}

⚠️ WARNUNG: ALLE DATEN GEHEN VERLOREN!

Dies wird unwiderruflich löschen:`;

    if (fahrzeugCount > 0) {
      confirmMessage += `\n• ${fahrzeugCount} Fahrzeug${
        fahrzeugCount > 1 ? "e" : ""
      }`;
      if (fahrzeugDetails.length > 0) {
        confirmMessage += ` (${fahrzeugDetails.join(", ")}${
          fahrzeugCount > 3 ? "..." : ""
        })`;
      }
    }

    if (auftragCount > 0) {
      confirmMessage += `\n• ${auftragCount} Auftrag/Aufträge`;
    }

    if (rechnungCount > 0) {
      confirmMessage += `\n• ${rechnungCount} Rechnung${
        rechnungCount > 1 ? "en" : ""
      }`;
    }

    const totalItems = fahrzeugCount + auftragCount + rechnungCount;

    if (totalItems === 0) {
      confirmMessage += `\n• Nur Kundendaten (keine verknüpften Daten)`;
    } else {
      confirmMessage += `\n\nGESAMT: ${totalItems} verknüpfte Datensätze werden gelöscht!`;
    }

    confirmMessage += `\n\n🔥 DIESE AKTION KANN NICHT RÜCKGÄNGIG GEMACHT WERDEN!

Alle Buchhaltungsdaten, Reparatur-Historie und Kundenkommunikation gehen permanent verloren.

Wirklich fortfahren?`;

    const dialogTitle =
      totalItems > 0 ? `🚨 ${totalItems} Datensätze löschen` : "Kunde löschen";

    const confirmed = await customConfirm(confirmMessage, dialogTitle);

    if (confirmed) {
      // Zusätzliche Sicherheitsabfrage bei vielen Daten
      if (totalItems > 5) {
        const secondConfirm = await customConfirm(
          `Letzte Warnung!

Sie sind dabei ${totalItems} Datensätze zu löschen für:
"${kunde?.name}"

Geben Sie zur Bestätigung den Kundennamen ein:`,
          "Sicherheitsabfrage"
        );

        const nameConfirmation = await customPrompt(
          `Geben Sie "${kunde?.name}" ein um fortzufahren:`,
          "",
          "Name zur Bestätigung"
        );

        if (nameConfirmation !== kunde?.name) {
          await customAlert(
            "Löschung abgebrochen - Name stimmt nicht überein.",
            "info",
            "Abgebrochen"
          );
          return;
        }
      }

      // Loading-Notification während Löschung
      if (typeof showNotification === "function") {
        showNotification("Kunde wird gelöscht...", "info");
      }

      await apiCall(`/api/kunden/${id}`, "DELETE");

      // Erfolgs-Dialog
      await customAlert(
        `Kunde "${kunde?.name}" wurde erfolgreich gelöscht!

Gelöschte Daten:
• Kundendaten
${
  fahrzeugCount > 0
    ? `• ${fahrzeugCount} Fahrzeug${fahrzeugCount > 1 ? "e" : ""}`
    : ""
}
${auftragCount > 0 ? `• ${auftragCount} Auftrag/Aufträge` : ""}
${
  rechnungCount > 0
    ? `• ${rechnungCount} Rechnung${rechnungCount > 1 ? "en" : ""}`
    : ""
}

Alle verknüpften Daten wurden entfernt.`,
        "success",
        "Kunde gelöscht"
      );

      if (typeof showNotification === "function") {
        showNotification("Kunde erfolgreich gelöscht", "success");
      }

      loadKunden();
    }
  } catch (err) {
    console.error("Fehler beim Löschen des Kunden:", err);

    // Fehler-Dialog mit Details
    await customAlert(
      `Fehler beim Löschen des Kunden "${kunde?.name}":

${err.message || "Unbekannter Fehler"}

Mögliche Ursachen:
• Netzwerk-Problem
• Server-Fehler
• Datenbank-Constraints verhindern Löschung
• Unzureichende Berechtigung
• Kunde wird von anderen Systemen referenziert

WICHTIG: Es wurden möglicherweise keine oder nur teilweise Daten gelöscht.
Prüfen Sie den Kundenstatus und versuchen Sie es erneut.

Bei wiederholten Problemen kontaktieren Sie den Support.`,
      "error",
      "Löschung fehlgeschlagen"
    );

    if (typeof showNotification === "function") {
      showNotification("Fehler beim Löschen des Kunden", "error");
    }
  }
};

window.showKundenModal = showKundenModal;
