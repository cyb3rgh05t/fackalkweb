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
      const errorData = await response.json();
      throw new Error(
        errorData.error || "HTTP error! status: " + response.status
      );
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
                    })" title="Bearbeiten">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteKunde(${
                      kunde.id
                    })" title="Löschen">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `
      )
      .join("");

    // Suchfunktionalität aktivieren
    setTimeout(() => addSearchToTable("kunden-table", "kunden-search"), 100);
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
                    })" title="Bearbeiten">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteFahrzeug(${
                      fahrzeug.id
                    })" title="Löschen">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `
      )
      .join("");

    // Suchfunktionalität aktivieren
    setTimeout(
      () => addSearchToTable("fahrzeuge-table", "fahrzeuge-search"),
      100
    );
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
                <td>
                    <select class="status status-${
                      auftrag.status
                    }" onchange="updateAuftragStatus(${
          auftrag.id
        }, this.value)" style="background: transparent; border: none; color: inherit;">
                        <option value="offen" ${
                          auftrag.status === "offen" ? "selected" : ""
                        }>Offen</option>
                        <option value="bearbeitung" ${
                          auftrag.status === "bearbeitung" ? "selected" : ""
                        }>In Bearbeitung</option>
                        <option value="abgeschlossen" ${
                          auftrag.status === "abgeschlossen" ? "selected" : ""
                        }>Abgeschlossen</option>
                    </select>
                </td>
                <td>${formatCurrency(auftrag.gesamt_kosten)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewAuftrag(${
                      auftrag.id
                    })" title="Anzeigen">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="editAuftrag(${
                      auftrag.id
                    })" title="Bearbeiten">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="createRechnungFromAuftrag(${
                      auftrag.id
                    })" title="Rechnung erstellen">
                        <i class="fas fa-file-invoice"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAuftrag(${
                      auftrag.id
                    })" title="Löschen">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `
      )
      .join("");

    // Suchfunktionalität aktivieren
    setTimeout(
      () => addSearchToTable("auftraege-table", "auftraege-search"),
      100
    );
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

    // Suchfunktionalität aktivieren
    setTimeout(
      () => addSearchToTable("rechnungen-table", "rechnungen-search"),
      100
    );
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

// Status Update Functions
async function updateAuftragStatus(id, status) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${id}`);
    auftrag.status = status;
    await apiCall(`/api/auftraege/${id}`, "PUT", auftrag);
    showNotification("Status erfolgreich aktualisiert", "success");
    loadAuftraege();
  } catch (error) {
    showNotification("Fehler beim Aktualisieren des Status", "error");
    loadAuftraege(); // Reload to reset the select
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
    loadRechnungen(); // Reload to reset the select
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
      await apiCall(`/api/kunden/${kundeId}`, "PUT", data);
      showNotification("Kunde erfolgreich aktualisiert", "success");
    } else {
      await apiCall("/api/kunden", "POST", data);
      showNotification("Kunde erfolgreich erstellt", "success");
    }
    closeModal();
    loadKunden();
  } catch (error) {
    showNotification("Fehler beim Speichern des Kunden", "error");
  }
}

async function deleteKunde(id) {
  if (
    confirm(
      "Kunde wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    )
  ) {
    try {
      await apiCall(`/api/kunden/${id}`, "DELETE");
      showNotification("Kunde erfolgreich gelöscht", "success");
      loadKunden();
    } catch (error) {
      showNotification("Fehler beim Löschen des Kunden", "error");
    }
  }
}

// Fahrzeug Modal
async function showFahrzeugModal(fahrzeugId = null) {
  // Sicherstellen, dass Kunden geladen sind
  if (kunden.length === 0) {
    await loadKunden();
  }

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
      await apiCall(`/api/fahrzeuge/${fahrzeugId}`, "PUT", data);
      showNotification("Fahrzeug erfolgreich aktualisiert", "success");
    } else {
      await apiCall("/api/fahrzeuge", "POST", data);
      showNotification("Fahrzeug erfolgreich erstellt", "success");
    }
    closeModal();
    loadFahrzeuge();
  } catch (error) {
    showNotification("Fehler beim Speichern des Fahrzeugs", "error");
  }
}

async function deleteFahrzeug(id) {
  if (
    confirm(
      "Fahrzeug wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    )
  ) {
    try {
      await apiCall(`/api/fahrzeuge/${id}`, "DELETE");
      showNotification("Fahrzeug erfolgreich gelöscht", "success");
      loadFahrzeuge();
    } catch (error) {
      showNotification("Fehler beim Löschen des Fahrzeugs", "error");
    }
  }
}

// Auftrag Modal
async function showAuftragModal(auftragId = null) {
  // Sicherstellen, dass Kunden geladen sind
  if (kunden.length === 0) {
    await loadKunden();
  }

  const isEdit = !!auftragId;

  if (isEdit) {
    // Für Bearbeitung: Lade Auftragsdaten vom Server
    loadAuftragForEdit(auftragId);
  } else {
    // Für neuen Auftrag: Zeige leeres Formular
    displayAuftragModal(null);
  }
}

async function loadAuftragForEdit(auftragId) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${auftragId}`);
    displayAuftragModal(auftrag);
  } catch (error) {
    showNotification("Fehler beim Laden des Auftrags", "error");
  }
}

function displayAuftragModal(auftrag = null) {
  const isEdit = !!auftrag;

  const kundenOptions = kunden
    .map(
      (k) =>
        `<option value="${k.id}" ${
          k.id === auftrag?.kunden_id ? "selected" : ""
        }>${k.name}</option>`
    )
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
    .map((schritt, index) => {
      const position = auftrag?.positionen?.[index] || {};
      return `
        <tr>
            <td><input type="text" class="form-input" value="${
              position.beschreibung || schritt
            }" name="beschreibung_${index}"></td>
            <td><input type="number" step="0.01" class="form-input" value="${
              position.stundenpreis || 110
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
                        <option value="bearbeitung" ${
                          auftrag?.status === "bearbeitung" ? "selected" : ""
                        }>In Bearbeitung</option>
                        <option value="abgeschlossen" ${
                          auftrag?.status === "abgeschlossen" ? "selected" : ""
                        }>Abgeschlossen</option>
                    </select>
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
                <textarea class="form-textarea" name="bemerkungen" rows="3">${
                  auftrag?.bemerkungen || ""
                }</textarea>
            </div>
        </form>
    `;

  const footer = `
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
        <button type="button" class="btn btn-primary" onclick="saveAuftrag(${
          auftrag?.id || null
        })">
            <i class="fas fa-save"></i> ${
              isEdit ? "Aktualisieren" : "Erstellen"
            }
        </button>
    `;

  createModal(isEdit ? "Auftrag bearbeiten" : "Neuer Auftrag", content, footer);

  // Fahrzeuge für bereits ausgewählten Kunden laden
  if (auftrag?.kunden_id) {
    loadKundenFahrzeuge(auftrag.kunden_id, auftrag.fahrzeug_id);
  }

  // Berechnungen aktualisieren
  setTimeout(() => {
    for (let i = 0; i < 8; i++) {
      calculateAuftragRow(i);
    }
  }, 100);
}

async function loadKundenFahrzeuge(kundenId, selectedFahrzeugId = null) {
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
}

function calculateAuftragRow(index) {
  const stundenpreis =
    parseFloat(
      document.querySelector(`[name="stundenpreis_${index}"]`)?.value
    ) || 0;
  const zeit =
    parseFloat(document.querySelector(`[name="zeit_${index}"]`)?.value) || 0;
  const gesamt = stundenpreis * zeit;

  const gesamtInput = document.querySelector(`[name="gesamt_${index}"]`);
  if (gesamtInput) {
    gesamtInput.value = gesamt.toFixed(2);
  }

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

  const gesamtZeitEl = document.getElementById("gesamt-zeit");
  const gesamtKostenEl = document.getElementById("gesamt-kosten");
  const gesamtMwstEl = document.getElementById("gesamt-mwst");

  if (gesamtZeitEl) gesamtZeitEl.textContent = gesamtZeit.toFixed(2) + " Std.";
  if (gesamtKostenEl) gesamtKostenEl.textContent = formatCurrency(gesamtKosten);
  if (gesamtMwstEl)
    gesamtMwstEl.textContent = formatCurrency(gesamtKosten * 1.19);
}

async function saveAuftrag(auftragId = null) {
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
    }
    closeModal();
    loadAuftraege();
  } catch (error) {
    showNotification("Fehler beim Speichern des Auftrags", "error");
  }
}

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

// Rechnung Modal
async function showRechnungModal(rechnungId = null) {
  // Sicherstellen, dass Kunden geladen sind
  if (kunden.length === 0) {
    await loadKunden();
  }

  const isEdit = !!rechnungId;

  if (isEdit) {
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

  const kundenOptions = kunden
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

  // Fahrzeuge für bereits ausgewählten Kunden laden
  if (rechnung?.kunden_id) {
    loadKundenFahrzeuge(rechnung.kunden_id, rechnung.fahrzeug_id);
  }

  // Berechnungen aktualisieren
  setTimeout(() => {
    for (let i = 0; i < 8; i++) {
      calculateRechnungRow(i);
    }
  }, 100);
}

function calculateRechnungRow(index) {
  const menge =
    parseFloat(document.querySelector(`[name="menge_${index}"]`)?.value) || 0;
  const einzelpreis =
    parseFloat(
      document.querySelector(`[name="einzelpreis_${index}"]`)?.value
    ) || 0;
  const gesamt = menge * einzelpreis;

  const gesamtInput = document.querySelector(`[name="gesamt_${index}"]`);
  if (gesamtInput) {
    gesamtInput.value = gesamt.toFixed(2);
  }
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
}

async function saveRechnung(rechnungId = null) {
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
}

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

// View functions
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

    const content = `
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Auftrag-Nr.:</label>
          <div>${auftrag.auftrag_nr}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Kunde:</label>
          <div>${auftrag.name}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Fahrzeug:</label>
          <div>${auftrag.kennzeichen} - ${auftrag.marke} ${auftrag.modell}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Datum:</label>
          <div>${formatDate(auftrag.datum)}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Status:</label>
          <div><span class="status status-${auftrag.status}">${
      auftrag.status
    }</span></div>
        </div>
        <div class="form-group">
          <label class="form-label">Gesamt:</label>
          <div>${formatCurrency(auftrag.gesamt_kosten)}</div>
        </div>
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

    createModal(`Auftrag ${auftrag.auftrag_nr}`, content);
  } catch (error) {
    showNotification("Fehler beim Laden des Auftrags", "error");
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
        <div class="form-group">
          <label class="form-label">Rechnung-Nr.:</label>
          <div>${rechnung.rechnung_nr}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Kunde:</label>
          <div>${rechnung.kunde_name}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Fahrzeug:</label>
          <div>${rechnung.kennzeichen} - ${rechnung.marke} ${
      rechnung.modell
    }</div>
        </div>
        <div class="form-group">
          <label class="form-label">Rechnungsdatum:</label>
          <div>${formatDate(rechnung.rechnungsdatum)}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Status:</label>
          <div><span class="status status-${rechnung.status}">${
      rechnung.status
    }</span></div>
        </div>
        <div class="form-group">
          <label class="form-label">Gesamtbetrag:</label>
          <div><strong>${formatCurrency(rechnung.gesamtbetrag)}</strong></div>
        </div>
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

function editAuftrag(id) {
  showAuftragModal(id);
}

function editRechnung(id) {
  showRechnungModal(id);
}

function editKunde(id) {
  showKundenModal(id);
}

function editFahrzeug(id) {
  showFahrzeugModal(id);
}

async function createRechnungFromAuftrag(auftragId) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${auftragId}`);

    // Auftrag in Rechnung konvertieren
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
        mwst_prozent: 19,
        gesamt: pos.gesamt,
      })),
      rabatt_prozent: 0,
      status: "offen",
    };

    // Rechnung erstellen
    const result = await apiCall("/api/rechnungen", "POST", rechnungsData);

    showNotification(
      `Rechnung ${result.rechnung_nr} erfolgreich aus Auftrag erstellt`,
      "success"
    );

    // Auftrag als abgeschlossen markieren
    auftrag.status = "abgeschlossen";
    await apiCall(`/api/auftraege/${auftragId}`, "PUT", auftrag);

    // Listen aktualisieren
    loadAuftraege();
    loadRechnungen();

    // Zur Rechnungssektion wechseln
    showSection("rechnungen");
  } catch (error) {
    showNotification("Fehler beim Erstellen der Rechnung aus Auftrag", "error");
  }
}

// Search functionality
function addSearchToTable(tableId, searchInputId) {
  const searchInput = document.getElementById(searchInputId);
  const table = document.getElementById(tableId);

  if (!searchInput || !table) return;

  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase();
    const rows = table.querySelectorAll("tbody tr");

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? "" : "none";
    });
  });
}

// Initialize search for all tables
function initializeSearch() {
  // Diese Funktion wird nach dem Laden der Daten aufgerufen
  addSearchToTable("kunden-table", "kunden-search");
  addSearchToTable("fahrzeuge-table", "fahrzeuge-search");
  addSearchToTable("auftraege-table", "auftraege-search");
  addSearchToTable("rechnungen-table", "rechnungen-search");
}

// Initialize app
document.addEventListener("DOMContentLoaded", function () {
  loadDashboard();
  loadKunden();
  loadFahrzeuge();
});
