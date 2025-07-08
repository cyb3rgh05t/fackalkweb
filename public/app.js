// Global state
let currentSection = "dashboard";
let kunden = [];
let fahrzeuge = [];
let auftraege = [];
let rechnungen = [];
let einstellungen = {};

// API Helper
async function apiCall(url, method = "GET", data = null) {
  try {
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error("HTTP error! status: " + response.status);
    }

    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    showNotification(
      "Fehler bei der Serververbindung: " + error.message,
      "error"
    );
    throw error;
  }
}

// Notification system
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
        box-shadow: var(--shadow-lg);
    `;

  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };

  notification.style.background = colors[type] || colors.info;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Date formatting
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE");
}

function formatCurrency(amount) {
  if (!amount) return "0,00 €";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

// Section navigation
function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
  });

  // Remove active class from nav items
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Show selected section
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.add("active");
    section.classList.add("fade-in");
  }

  // Add active class to corresponding nav item
  const navItem = Array.from(document.querySelectorAll(".nav-item")).find(
    (item) => item.onclick && item.onclick.toString().includes(sectionId)
  );
  if (navItem) {
    navItem.classList.add("active");
  }

  currentSection = sectionId;

  // Load section data
  switch (sectionId) {
    case "dashboard":
      loadDashboard();
      break;
    case "auftraege":
      loadAuftraege();
      break;
    case "rechnungen":
      loadRechnungen();
      break;
    case "kunden":
      loadKunden();
      break;
    case "fahrzeuge":
      loadFahrzeuge();
      break;
    case "einstellungen":
      loadEinstellungen();
      break;
  }
}

// Load functions
async function loadDashboard() {
  try {
    const [auftraegeData, rechnungenData, kundenData] = await Promise.all([
      apiCall("/api/auftraege"),
      apiCall("/api/rechnungen"),
      apiCall("/api/kunden"),
    ]);

    // Update statistics
    document.getElementById("stat-auftraege").textContent =
      auftraegeData.filter((a) => a.status === "offen").length;
    document.getElementById("stat-rechnungen").textContent =
      rechnungenData.filter((r) => r.status === "offen").length;
    document.getElementById("stat-kunden").textContent = kundenData.length;

    // Calculate monthly revenue
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyRevenue = rechnungenData
      .filter((r) => {
        const rDate = new Date(r.rechnungsdatum);
        return (
          rDate.getMonth() === currentMonth &&
          rDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, r) => sum + (r.gesamtbetrag || 0), 0);

    document.getElementById("stat-umsatz").textContent =
      formatCurrency(monthlyRevenue);

    // Load recent orders
    const recentAuftraege = auftraegeData.slice(0, 5);
    const tableBody = document.querySelector("#dashboard-auftraege tbody");
    tableBody.innerHTML = recentAuftraege
      .map(
        (auftrag) => `
            <tr>
                <td>${auftrag.auftrag_nr}</td>
                <td>${auftrag.kunde_name || "-"}</td>
                <td>${auftrag.kennzeichen} ${auftrag.marke || ""}</td>
                <td>${formatDate(auftrag.datum)}</td>
                <td><span class="status status-${auftrag.status}">${
          auftrag.status
        }</span></td>
                <td>${formatCurrency(auftrag.gesamt_kosten)}</td>
            </tr>
        `
      )
      .join("");
  } catch (error) {
    console.error("Failed to load dashboard:", error);
  }
}

async function loadKunden() {
  try {
    kunden = await apiCall("/api/kunden");
    const tableBody = document.querySelector("#kunden-table tbody");
    tableBody.innerHTML = kunden
      .map(
        (kunde) => `
            <tr>
                <td>${kunde.kunden_nr}</td>
                <td>${kunde.name}</td>
                <td>${kunde.strasse || ""} ${kunde.plz || ""} ${
          kunde.ort || ""
        }</td>
                <td>${kunde.telefon || "-"}</td>
                <td>${kunde.email || "-"}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editKunde(${
                      kunde.id
                    })">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteKunde(${
                      kunde.id
                    })">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `
      )
      .join("");
  } catch (error) {
    console.error("Failed to load customers:", error);
  }
}

async function loadFahrzeuge() {
  try {
    fahrzeuge = await apiCall("/api/fahrzeuge");
    const tableBody = document.querySelector("#fahrzeuge-table tbody");
    tableBody.innerHTML = fahrzeuge
      .map(
        (fahrzeug) => `
            <tr>
                <td>${fahrzeug.kennzeichen}</td>
                <td>${fahrzeug.marke || ""} ${fahrzeug.modell || ""}</td>
                <td>${fahrzeug.kunde_name || "-"}</td>
                <td>${fahrzeug.vin || "-"}</td>
                <td>${fahrzeug.farbe || "-"} ${
          fahrzeug.farbcode ? "(" + fahrzeug.farbcode + ")" : ""
        }</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editFahrzeug(${
                      fahrzeug.id
                    })">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteFahrzeug(${
                      fahrzeug.id
                    })">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `
      )
      .join("");
  } catch (error) {
    console.error("Failed to load vehicles:", error);
  }
}

async function loadAuftraege() {
  try {
    auftraege = await apiCall("/api/auftraege");
    const tableBody = document.querySelector("#auftraege-table tbody");
    tableBody.innerHTML = auftraege
      .map(
        (auftrag) => `
            <tr>
                <td>${auftrag.auftrag_nr}</td>
                <td>${auftrag.kunde_name || "-"}</td>
                <td>${auftrag.kennzeichen || ""} ${auftrag.marke || ""}</td>
                <td>${formatDate(auftrag.datum)}</td>
                <td><span class="status status-${auftrag.status}">${
          auftrag.status
        }</span></td>
                <td>${formatCurrency(auftrag.gesamt_kosten)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewAuftrag(${
                      auftrag.id
                    })">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="editAuftrag(${
                      auftrag.id
                    })">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="createRechnungFromAuftrag(${
                      auftrag.id
                    })">
                        <i class="fas fa-file-invoice"></i>
                    </button>
                </td>
            </tr>
        `
      )
      .join("");
  } catch (error) {
    console.error("Failed to load orders:", error);
  }
}

async function loadRechnungen() {
  try {
    rechnungen = await apiCall("/api/rechnungen");
    const tableBody = document.querySelector("#rechnungen-table tbody");
    tableBody.innerHTML = rechnungen
      .map(
        (rechnung) => `
            <tr>
                <td>${rechnung.rechnung_nr}</td>
                <td>${rechnung.kunde_name || "-"}</td>
                <td>${rechnung.kennzeichen || ""} ${rechnung.marke || ""}</td>
                <td>${formatDate(rechnung.rechnungsdatum)}</td>
                <td><span class="status status-${rechnung.status}">${
          rechnung.status
        }</span></td>
                <td>${formatCurrency(rechnung.gesamtbetrag)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewRechnung(${
                      rechnung.id
                    })">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="printRechnung(${
                      rechnung.id
                    })">
                        <i class="fas fa-print"></i>
                    </button>
                </td>
            </tr>
        `
      )
      .join("");
  } catch (error) {
    console.error("Failed to load invoices:", error);
  }
}

async function loadEinstellungen() {
  try {
    const settings = await apiCall("/api/einstellungen");
    einstellungen = {};
    settings.forEach((setting) => {
      einstellungen[setting.key] = setting.value;
    });

    const form = document.getElementById("einstellungen-form");
    Object.keys(einstellungen).forEach((key) => {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) {
        input.value = einstellungen[key];
      }
    });
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

// Modal functions
function createModal(title, content, footer = "") {
  const modal = document.createElement("div");
  modal.className = "modal active";
  modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            ${footer ? `<div class="modal-footer">${footer}</div>` : ""}
        </div>
    `;

  document.getElementById("modal-container").appendChild(modal);
  return modal;
}

function closeModal() {
  const modal = document.querySelector(".modal.active");
  if (modal) {
    modal.remove();
  }
}

// Kunde Modal
function showKundenModal(kundeId = null) {
  const kunde = kundeId ? kunden.find((k) => k.id === kundeId) : {};
  const isEdit = !!kundeId;

  const content = `
        <form id="kunde-form">
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">Name *</label>
                    <input type="text" class="form-input" name="name" value="${
                      kunde.name || ""
                    }" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Straße, Hausnummer</label>
                    <input type="text" class="form-input" name="strasse" value="${
                      kunde.strasse || ""
                    }">
                </div>
                <div class="form-group">
                    <label class="form-label">PLZ</label>
                    <input type="text" class="form-input" name="plz" value="${
                      kunde.plz || ""
                    }">
                </div>
                <div class="form-group">
                    <label class="form-label">Ort</label>
                    <input type="text" class="form-input" name="ort" value="${
                      kunde.ort || ""
                    }">
                </div>
                <div class="form-group">
                    <label class="form-label">Telefon</label>
                    <input type="tel" class="form-input" name="telefon" value="${
                      kunde.telefon || ""
                    }">
                </div>
                <div class="form-group">
                    <label class="form-label">E-Mail</label>
                    <input type="email" class="form-input" name="email" value="${
                      kunde.email || ""
                    }">
                </div>
            </div>
        </form>
    `;

  const footer = `
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
        <button type="button" class="btn btn-primary" onclick="saveKunde(${kundeId})">
            <i class="fas fa-save"></i> ${
              isEdit ? "Aktualisieren" : "Erstellen"
            }
        </button>
    `;

  createModal(isEdit ? "Kunde bearbeiten" : "Neuer Kunde", content, footer);
}

async function saveKunde(kundeId = null) {
  const form = document.getElementById("kunde-form");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    if (kundeId) {
      // Update - not implemented in this demo
      showNotification("Update-Funktion noch nicht implementiert", "warning");
    } else {
      await apiCall("/api/kunden", "POST", data);
      showNotification("Kunde erfolgreich erstellt", "success");
      closeModal();
      loadKunden();
    }
  } catch (error) {
    showNotification("Fehler beim Speichern des Kunden", "error");
  }
}

// Fahrzeug Modal
function showFahrzeugModal(fahrzeugId = null) {
  const fahrzeug = fahrzeugId ? fahrzeuge.find((f) => f.id === fahrzeugId) : {};
  const isEdit = !!fahrzeugId;

  const kundenOptions = kunden
    .map(
      (k) =>
        `<option value="${k.id}" ${
          k.id === fahrzeug.kunden_id ? "selected" : ""
        }>${k.name}</option>`
    )
    .join("");

  const content = `
        <form id="fahrzeug-form">
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">Kunde *</label>
                    <select class="form-select" name="kunden_id" required>
                        <option value="">Kunde auswählen</option>
                        ${kundenOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Kennzeichen *</label>
                    <input type="text" class="form-input" name="kennzeichen" value="${
                      fahrzeug.kennzeichen || ""
                    }" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Marke</label>
                    <input type="text" class="form-input" name="marke" value="${
                      fahrzeug.marke || ""
                    }">
                </div>
                <div class="form-group">
                    <label class="form-label">Modell</label>
                    <input type="text" class="form-input" name="modell" value="${
                      fahrzeug.modell || ""
                    }">
                </div>
                <div class="form-group">
                    <label class="form-label">VIN</label>
                    <input type="text" class="form-input" name="vin" value="${
                      fahrzeug.vin || ""
                    }">
                </div>
                <div class="form-group">
                    <label class="form-label">Baujahr</label>
                    <input type="number" class="form-input" name="baujahr" value="${
                      fahrzeug.baujahr || ""
                    }">
                </div>
                <div class="form-group">
                    <label class="form-label">Farbe</label>
                    <input type="text" class="form-input" name="farbe" value="${
                      fahrzeug.farbe || ""
                    }">
                </div>
                <div class="form-group">
                    <label class="form-label">Farbcode</label>
                    <input type="text" class="form-input" name="farbcode" value="${
                      fahrzeug.farbcode || ""
                    }">
                </div>
            </div>
        </form>
    `;

  const footer = `
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
        <button type="button" class="btn btn-primary" onclick="saveFahrzeug(${fahrzeugId})">
            <i class="fas fa-save"></i> ${
              isEdit ? "Aktualisieren" : "Erstellen"
            }
        </button>
    `;

  createModal(
    isEdit ? "Fahrzeug bearbeiten" : "Neues Fahrzeug",
    content,
    footer
  );
}

async function saveFahrzeug(fahrzeugId = null) {
  const form = document.getElementById("fahrzeug-form");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    if (fahrzeugId) {
      showNotification("Update-Funktion noch nicht implementiert", "warning");
    } else {
      await apiCall("/api/fahrzeuge", "POST", data);
      showNotification("Fahrzeug erfolgreich erstellt", "success");
      closeModal();
      loadFahrzeuge();
    }
  } catch (error) {
    showNotification("Fehler beim Speichern des Fahrzeugs", "error");
  }
}

// Auftrag Modal
function showAuftragModal(auftragId = null) {
  const isEdit = !!auftragId;

  const kundenOptions = kunden
    .map((k) => `<option value="${k.id}">${k.name}</option>`)
    .join("");

  const arbeitsschritte = [
    "Demontage/Vorbereitung",
    "Schleifen/Spachteln",
    "Grundierung",
    "Zwischenschliff",
    "Basislack",
    "Klarlack",
    "Polieren/Finish",
    "Montage",
  ];

  const arbeitsschritteRows = arbeitsschritte
    .map(
      (schritt, index) => `
        <tr>
            <td><input type="text" class="form-input" value="${schritt}" name="beschreibung_${index}"></td>
            <td><input type="number" step="0.01" class="form-input" value="110" name="stundenpreis_${index}"></td>
            <td><input type="number" step="0.01" class="form-input" value="0" name="zeit_${index}" onchange="calculateAuftragRow(${index})"></td>
            <td>Std.</td>
            <td><input type="number" step="0.01" class="form-input" value="0" name="gesamt_${index}" readonly></td>
        </tr>
    `
    )
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
                      new Date().toISOString().split("T")[0]
                    }" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Basis-Stundenpreis (€)</label>
                    <input type="number" step="0.01" class="form-input" name="basis_stundenpreis" value="${
                      einstellungen.basis_stundenpreis || 110
                    }">
                </div>
            </div>
            
            <h3 style="margin: 2rem 0 1rem 0;">Arbeitszeiten</h3>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Beschreibung</th>
                            <th>Stundenpreis (€)</th>
                            <th>Zeit</th>
                            <th>Einheit</th>
                            <th>Gesamt (€)</th>
                        </tr>
                    </thead>
                    <tbody id="arbeitszeiten-tbody">
                        ${arbeitsschritteRows}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 2rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <strong>Gesamt Zeit:</strong>
                    <span id="gesamt-zeit">0.00 Std.</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <strong>Gesamt Kosten:</strong>
                    <span id="gesamt-kosten">0,00 €</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Mit 19% MwSt:</strong>
                    <span id="gesamt-mwst">0,00 €</span>
                </div>
            </div>
            
            <div class="form-group" style="margin-top: 2rem;">
                <label class="form-label">Bemerkungen</label>
                <textarea class="form-textarea" name="bemerkungen" rows="3"></textarea>
            </div>
        </form>
    `;

  const footer = `
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
        <button type="button" class="btn btn-primary" onclick="saveAuftrag()">
            <i class="fas fa-save"></i> Auftrag erstellen
        </button>
    `;

  createModal(isEdit ? "Auftrag bearbeiten" : "Neuer Auftrag", content, footer);
}

async function loadKundenFahrzeuge(kundenId) {
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
            `<option value="${f.id}">${f.kennzeichen} - ${f.marke} ${f.modell}</option>`
        )
        .join("");
  } catch (error) {
    console.error("Failed to load customer vehicles:", error);
  }
}

function calculateAuftragRow(index) {
  const stundenpreis =
    parseFloat(
      document.querySelector(`[name="stundenpreis_${index}"]`).value
    ) || 0;
  const zeit =
    parseFloat(document.querySelector(`[name="zeit_${index}"]`).value) || 0;
  const gesamt = stundenpreis * zeit;

  document.querySelector(`[name="gesamt_${index}"]`).value = gesamt.toFixed(2);

  // Gesamtsummen berechnen
  let gesamtZeit = 0;
  let gesamtKosten = 0;

  for (let i = 0; i < 8; i++) {
    const zeitInput = document.querySelector(`[name="zeit_${i}"]`);
    const gesamtInput = document.querySelector(`[name="gesamt_${i}"]`);

    if (zeitInput && gesamtInput) {
      gesamtZeit += parseFloat(zeitInput.value) || 0;
      gesamtKosten += parseFloat(gesamtInput.value) || 0;
    }
  }

  document.getElementById("gesamt-zeit").textContent =
    gesamtZeit.toFixed(2) + " Std.";
  document.getElementById("gesamt-kosten").textContent =
    formatCurrency(gesamtKosten);
  document.getElementById("gesamt-mwst").textContent = formatCurrency(
    gesamtKosten * 1.19
  );
}

async function saveAuftrag() {
  const form = document.getElementById("auftrag-form");
  const formData = new FormData(form);

  const positionen = [];
  for (let i = 0; i < 8; i++) {
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
    positionen,
    bemerkungen: formData.get("bemerkungen"),
  };

  try {
    await apiCall("/api/auftraege", "POST", data);
    showNotification("Auftrag erfolgreich erstellt", "success");
    closeModal();
    loadAuftraege();
  } catch (error) {
    showNotification("Fehler beim Erstellen des Auftrags", "error");
  }
}

// Rechnung Modal
function showRechnungModal(auftragId = null) {
  const kundenOptions = kunden
    .map((k) => `<option value="${k.id}">${k.name}</option>`)
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
    .map(
      (pos, index) => `
        <tr>
            <td><input type="text" class="form-input" value="${pos.beschreibung}" name="beschreibung_${index}"></td>
            <td><input type="number" step="0.01" class="form-input" value="0" name="menge_${index}" onchange="calculateRechnungRow(${index})"></td>
            <td>${pos.einheit}</td>
            <td><input type="number" step="0.01" class="form-input" value="${pos.einzelpreis}" name="einzelpreis_${index}" onchange="calculateRechnungRow(${index})"></td>
            <td>${pos.mwst}%</td>
            <td><input type="number" step="0.01" class="form-input" value="0" name="gesamt_${index}" readonly></td>
            <input type="hidden" name="kategorie_${index}" value="${pos.kategorie}">
            <input type="hidden" name="einheit_${index}" value="${pos.einheit}">
            <input type="hidden" name="mwst_${index}" value="${pos.mwst}">
        </tr>
    `
    )
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
                      new Date().toISOString().split("T")[0]
                    }" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Auftragsdatum</label>
                    <input type="date" class="form-input" name="auftragsdatum">
                </div>
                <div class="form-group">
                    <label class="form-label">Rabatt (%)</label>
                    <input type="number" step="0.01" class="form-input" name="rabatt_prozent" value="0" onchange="calculateRechnungTotal()">
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
        <button type="button" class="btn btn-primary" onclick="saveRechnung()">
            <i class="fas fa-save"></i> Rechnung erstellen
        </button>
    `;

  createModal("Neue Rechnung", content, footer);
}

function calculateRechnungRow(index) {
  const menge =
    parseFloat(document.querySelector(`[name="menge_${index}"]`).value) || 0;
  const einzelpreis =
    parseFloat(document.querySelector(`[name="einzelpreis_${index}"]`).value) ||
    0;
  const gesamt = menge * einzelpreis;

  document.querySelector(`[name="gesamt_${index}"]`).value = gesamt.toFixed(2);
  calculateRechnungTotal();
}

function calculateRechnungTotal() {
  let zwischensumme = 0;
  let mwst19Basis = 0;
  let mwst7Basis = 0;

  for (let i = 0; i < 8; i++) {
    const gesamtInput = document.querySelector(`[name="gesamt_${i}"]`);
    const mwstInput = document.querySelector(`[name="mwst_${i}"]`);

    if (gesamtInput && mwstInput) {
      const gesamt = parseFloat(gesamtInput.value) || 0;
      const mwst = parseFloat(mwstInput.value) || 0;

      zwischensumme += gesamt;

      if (mwst === 19) {
        mwst19Basis += gesamt;
      } else if (mwst === 7) {
        mwst7Basis += gesamt;
      }
    }
  }

  const rabattProzent =
    parseFloat(document.querySelector('[name="rabatt_prozent"]').value) || 0;
  const rabattBetrag = zwischensumme * (rabattProzent / 100);
  const nettoNachRabatt = zwischensumme - rabattBetrag;

  const mwst19 = mwst19Basis * (1 - rabattProzent / 100) * 0.19;
  const mwst7 = mwst7Basis * (1 - rabattProzent / 100) * 0.07;
  const gesamtbetrag = nettoNachRabatt + mwst19 + mwst7;

  document.getElementById("zwischensumme").textContent =
    formatCurrency(zwischensumme);
  document.getElementById("rabatt-betrag").textContent =
    formatCurrency(rabattBetrag);
  document.getElementById("netto-nach-rabatt").textContent =
    formatCurrency(nettoNachRabatt);
  document.getElementById("mwst-19").textContent = formatCurrency(mwst19);
  document.getElementById("mwst-7").textContent = formatCurrency(mwst7);
  document.getElementById("gesamtbetrag").textContent =
    formatCurrency(gesamtbetrag);
}

async function saveRechnung() {
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
    positionen,
  };

  try {
    await apiCall("/api/rechnungen", "POST", data);
    showNotification("Rechnung erfolgreich erstellt", "success");
    closeModal();
    loadRechnungen();
  } catch (error) {
    showNotification("Fehler beim Erstellen der Rechnung", "error");
  }
}

// Settings form handler
document.addEventListener("DOMContentLoaded", function () {
  const settingsForm = document.getElementById("einstellungen-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const formData = new FormData(settingsForm);
      const updates = [];

      for (const [key, value] of formData.entries()) {
        updates.push(apiCall(`/api/einstellungen/${key}`, "PUT", { value }));
      }

      try {
        await Promise.all(updates);
        showNotification("Einstellungen erfolgreich gespeichert", "success");
        loadEinstellungen();
      } catch (error) {
        showNotification("Fehler beim Speichern der Einstellungen", "error");
      }
    });
  }
});

// View functions (placeholder)
function viewAuftrag(id) {
  showNotification("Auftrag-Ansicht noch nicht implementiert", "info");
}

function viewRechnung(id) {
  showNotification("Rechnungs-Ansicht noch nicht implementiert", "info");
}

function printRechnung(id) {
  showNotification("Druck-Funktion noch nicht implementiert", "info");
}

function editAuftrag(id) {
  showNotification("Auftrag-Bearbeitung noch nicht implementiert", "info");
}

function editKunde(id) {
  showKundenModal(id);
}

function editFahrzeug(id) {
  showFahrzeugModal(id);
}

function deleteKunde(id) {
  if (confirm("Kunde wirklich löschen?")) {
    showNotification("Lösch-Funktion noch nicht implementiert", "warning");
  }
}

function deleteFahrzeug(id) {
  if (confirm("Fahrzeug wirklich löschen?")) {
    showNotification("Lösch-Funktion noch nicht implementiert", "warning");
  }
}

function createRechnungFromAuftrag(auftragId) {
  showNotification(
    "Rechnung aus Auftrag erstellen - noch nicht implementiert",
    "info"
  );
}

// Initialize app
document.addEventListener("DOMContentLoaded", function () {
  loadDashboard();
  loadKunden();
  loadFahrzeuge();
});
