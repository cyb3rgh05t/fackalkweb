// Globale Variablen
let userManagementReady = false;

// Hauptinitialisierung
document.addEventListener("DOMContentLoaded", function () {
  console.log("🔄 Modal User-Management wird initialisiert...");
  setTimeout(initUserManagement, 800); // Etwas länger warten
});

// Zentrale Initialisierung
async function initUserManagement() {
  try {
    console.log("🔄 Starte User-Management Initialisierung...");

    // 1. User-Info laden
    const user = await loadCurrentUserInfo();
    if (!user) return;

    // 2. UI basierend auf Rolle anpassen
    if (user.role === "admin") {
      console.log("🔑 Admin erkannt - erstelle User-Management...");
      await setupAdminUserManagement();
      showUserTab(); // Admins können den User-Tab sehen
    } else {
      console.log("🔒 Regular User - verstecke erweiterte Settings...");
      //hideAdvancedSettings();
      hideUserTab(); // Normale Benutzer können den User-Tab nicht sehen
    }

    userManagementReady = true;
    console.log("✅ User-Management erfolgreich initialisiert");
  } catch (error) {
    console.error("❌ User-Management Init Fehler:", error);
  }
}

// User-Info laden
async function loadCurrentUserInfo() {
  try {
    const response = await fetch("/api/auth/status", {
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache" },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.authenticated && data.user) {
        console.log(
          `✅ User geladen: ${data.user.username} (${data.user.role})`
        );
        return data.user;
      }
    }

    console.warn("⚠️ Nicht authentifiziert");
    return null;
  } catch (error) {
    console.error("❌ Fehler beim Laden der User-Info:", error);
    return null;
  }
}

function hideUserTab() {
  const tab = document.querySelector('[data-tab="users"]');
  const content = document.getElementById("users-settings");
  if (tab) tab.style.display = "none";
  if (content) content.style.display = "none";
}

function showUserTab() {
  const tab = document.querySelector('[data-tab="users"]');
  const content = document.getElementById("users-settings");
  if (tab) tab.style.display = "";
  if (content) content.style.display = "";
}

// Erweiterte Settings verstecken für normale User
function hideAdvancedSettings() {
  const settingsTabs = document.querySelectorAll(
    '.settings-tab[data-tab]:not([data-tab="profil"])'
  );
  const settingsContents = document.querySelectorAll(
    ".settings-content:not(#profil-settings)"
  );

  settingsTabs.forEach((tab) => (tab.style.display = "none"));
  settingsContents.forEach((content) => (content.style.display = "none"));

  console.log("🔒 Erweiterte Einstellungen versteckt");
}

// Admin User-Management Setup
async function setupAdminUserManagement() {
  console.log("🔧 Richte Admin User-Management ein...");

  // 1. User-Management Tab erstellen
  createUserManagementTab();

  // 2. Modal CSS sicherstellen
  ensureModalCSS();

  // 3. Globale Funktionen definieren
  setupGlobalModalFunctions();

  console.log("✅ Admin User-Management bereit");
}

// User-Management Tab erstellen
function createUserManagementTab() {
  const tabsContainer = document.querySelector(".settings-tabs");
  if (!tabsContainer) {
    console.error("❌ Settings-Tabs Container nicht gefunden");
    return;
  }

  // Prüfen ob bereits existiert
  if (document.querySelector('[data-tab="users"]')) {
    console.log("ℹ️ User-Management Tab existiert bereits");
    return;
  }

  console.log("🔧 Erstelle User-Management Tab...");

  // Tab Button erstellen
  const userTab = document.createElement("button");
  userTab.className = "settings-tab";
  userTab.setAttribute("data-tab", "users");
  userTab.innerHTML = '<i class="fas fa-users"></i> Benutzer';

  // Event Listener statt onclick
  userTab.addEventListener("click", () => {
    console.log("🖱️ User-Management Tab geklickt");
    showSettingsTab("users");
  });

  tabsContainer.appendChild(userTab);

  // Content Bereich erstellen
  const settingsContainer =
    document.querySelector("#einstellungen") ||
    document.querySelector(".settings-content").parentNode;

  if (settingsContainer) {
    const userContent = document.createElement("div");
    userContent.id = "users-settings";
    userContent.className = "settings-content";
    userContent.innerHTML = getUserManagementHTML();
    settingsContainer.appendChild(userContent);

    console.log("✅ User-Management Tab und Content erstellt");
  } else {
    console.error("❌ Settings Container nicht gefunden");
  }
}

// User-Management HTML
function getUserManagementHTML() {
  return `
        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Benutzerverwaltung</h2>
                <button class="btn btn-primary" id="create-user-btn" type="button">
                    <i class="fas fa-plus"></i> Neuer Benutzer
                </button>
            </div>
            <div class="card-body">
                <div id="users-list-container">
                    <div class="loading" style="text-align: center; padding: 2rem; color: #10b981;">
                        <i class="fas fa-spinner fa-spin"></i> Lade Benutzer...
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Create User Modal -->
        <div id="create-user-modal-fixed" class="modal-fixed" style="display: none;">
            <div class="modal-overlay-fixed"></div>
            <div class="modal-content-fixed">
                <div class="modal-header-fixed">
                    <h3>Neuen Benutzer erstellen</h3>
                    <button class="modal-close-fixed" id="close-modal-btn" type="button">&times;</button>
                </div>
                <form id="create-user-form-fixed">
                    <div style="padding: 25px;">
                        <div class="form-group">
                            <label class="form-label">Benutzername *</label>
                            <input type="text" name="username" class="form-input" required minlength="3" autocomplete="off">
                            <small class="text-muted">Mindestens 3 Zeichen</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Passwort *</label>
                            <input type="password" name="password" class="form-input" required minlength="6" autocomplete="new-password">
                            <small class="text-muted">Mindestens 6 Zeichen</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Rolle</label>
                            <select name="role" class="form-input">
                                <option value="user">Benutzer</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </div>
                        <div class="modal-actions-fixed">
                            <button type="button" class="btn btn-secondary" id="cancel-modal-btn">
                                Abbrechen
                            </button>
                            <button type="submit" class="btn btn-primary" id="submit-user-btn">
                                <i class="fas fa-plus"></i> Benutzer erstellen
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// Modal CSS sicherstellen
function ensureModalCSS() {
  console.log("🎨 Erstelle CSS mit Pointer-Events Fix...");

  const oldCSS = document.getElementById("user-modal-css");
  if (oldCSS) oldCSS.remove();

  const css = `
    .modal-fixed {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 99999 !important;
      display: none !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(0, 0, 0, 0.8) !important;
      backdrop-filter: blur(4px) !important;
    }
    
    .modal-fixed[style*="display: flex"] {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    
    /* KRITISCH: Overlay fängt alle Clicks ab */
    .modal-overlay-fixed {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: transparent !important;
      z-index: 100000 !important;
    }
    
    /* Content ist ÜBER dem Overlay und fängt Events ab */
    .modal-content-fixed {
      position: relative !important;
      background: var(--clr-surface, #2a2a2a) !important;
      border-radius: 12px !important;
      width: 90% !important;
      max-width: 500px !important;
      max-height: 90vh !important;
      overflow-y: auto !important;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5) !important;
      border: 1px solid var(--border-color, #444) !important;
      z-index: 100001 !important; /* HÖHER als Overlay */
      animation: modalSlideIn 0.3s ease-out !important;
      
      /* WICHTIG: Content fängt alle Clicks ab */
      pointer-events: auto !important;
    }
    
    /* Alle anderen CSS-Regeln bleiben gleich */
    @keyframes modalSlideIn {
      from { opacity: 0; transform: scale(0.9) translateY(-20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    
    .modal-header-fixed {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 20px 25px !important;
      border-bottom: 1px solid var(--border-color, #444) !important;
      background: var(--clr-surface-a10, #333) !important;
      border-radius: 12px 12px 0 0 !important;
    }
    
    .modal-header-fixed h3 {
      margin: 0 !important;
      color: var(--text-primary, #e4e4e7) !important;
      font-size: 1.25rem !important;
    }
    
    .modal-close-fixed {
      background: none !important;
      border: none !important;
      font-size: 24px !important;
      color: var(--text-secondary, #9ca3af) !important;
      cursor: pointer !important;
      padding: 5px !important;
      width: 35px !important;
      height: 35px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 6px !important;
      transition: all 0.3s ease !important;
    }
    
    .modal-close-fixed:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      color: var(--text-primary, #e4e4e7) !important;
    }
    
    .modal-actions-fixed {
      display: flex !important;
      gap: 12px !important;
      justify-content: flex-end !important;
      margin-top: 25px !important;
      padding-top: 20px !important;
      border-top: 1px solid var(--border-color, #444) !important;
    }
    
    body.modal-open {
      overflow: hidden !important;
    }
  `;

  const styleSheet = document.createElement("style");
  styleSheet.id = "user-modal-css";
  styleSheet.textContent = css;
  document.head.appendChild(styleSheet);
}

// Globale Modal-Funktionen definieren
function setupGlobalModalFunctions() {
  console.log("🔧 Richte globale Modal-Funktionen ein...");

  // Modal öffnen
  window.openCreateUserModal = function () {
    const modal = document.getElementById("create-user-modal-fixed");
    if (modal) {
      // Body scrollen verhindern
      document.body.classList.add("modal-open");

      // Modal sichtbar machen
      modal.style.display = "flex";
      modal.style.visibility = "visible";
      modal.style.opacity = "1";

      // Debug-Klasse hinzufügen (optional)
      modal.classList.add("modal-debug-visible");

      console.log("✅ Modal geöffnet (VERBESSERT)");
      console.log(
        "📊 Modal computed style:",
        window.getComputedStyle(modal).display
      );
      console.log("📊 Modal z-index:", window.getComputedStyle(modal).zIndex);
      console.log(
        "📊 Modal visibility:",
        window.getComputedStyle(modal).visibility
      );

      // Focus auf erstes Input
      setTimeout(() => {
        const firstInput = modal.querySelector('input[name="username"]');
        if (firstInput) {
          firstInput.focus();
          console.log("🎯 Focus auf Username Input gesetzt");
        }
      }, 100);
    } else {
      console.error("❌ Modal nicht gefunden");
    }
  };

  // VERBESSERTE Modal Schließen Funktion
  window.closeCreateUserModal = function () {
    const modal = document.getElementById("create-user-modal-fixed");
    const form = document.getElementById("create-user-form-fixed");

    if (modal) {
      // Modal verstecken
      modal.style.display = "none";
      modal.style.visibility = "hidden";
      modal.style.opacity = "0";

      // Debug-Klasse entfernen
      modal.classList.remove("modal-debug-visible");

      // Body scrollen wieder erlauben
      document.body.classList.remove("modal-open");
    }

    if (form) {
      form.reset();
      console.log("✅ Form zurückgesetzt");
    }
  };

  // Event Listeners setzen - DEFINITIVE VERSION
  setTimeout(() => {
    // Button Event Listeners (bleiben gleich)
    const openBtn = document.getElementById("create-user-btn");
    const closeBtn = document.getElementById("close-modal-btn");
    const cancelBtn = document.getElementById("cancel-modal-btn");
    const form = document.getElementById("create-user-form-fixed");

    if (openBtn) {
      openBtn.addEventListener("click", function (e) {
        e.preventDefault();
        window.openCreateUserModal();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        window.closeCreateUserModal();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function (e) {
        e.preventDefault();
        window.closeCreateUserModal();
      });
    }

    if (form) {
      form.addEventListener("submit", handleCreateUserSubmit);
    }

    const overlay = document.querySelector(".modal-overlay-fixed");
    if (overlay) {
      overlay.addEventListener("click", function (e) {
        console.log("🖱️ Overlay direkt geklickt - Modal schließen");
        window.closeCreateUserModal();
      });
      console.log("✅ Overlay Click Event Listener gesetzt");
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        const modal = document.getElementById("create-user-modal-fixed");
        if (modal && modal.style.display === "flex") {
          window.closeCreateUserModal();
        }
      }
    });

    loadUsersData();
  }, 500);
}

// Create User Form Submit Handler
async function handleCreateUserSubmit(event) {
  event.preventDefault();
  console.log("🔄 Create User Form Submit");

  const form = event.target;
  const formData = new FormData(form);
  const submitBtn = document.getElementById("submit-user-btn");
  const originalText = submitBtn.innerHTML;

  const userData = {
    username: formData.get("username").trim(),
    password: formData.get("password"),
    role: formData.get("role"),
  };

  console.log("📤 User Data:", { ...userData, password: "[HIDDEN]" });

  // Hilfsfunktion für sichere Dialoge mit Fallback
  async function safeAlert(message, type = "info", title = null) {
    try {
      if (typeof customAlert === "function") {
        console.log("🎨 Verwende Custom Dialog");
        await customAlert(message, type, title);
      } else {
        console.log("⚠️ Custom Dialog nicht verfügbar - verwende Fallback");
        alert(message);
      }
    } catch (error) {
      console.error("❌ Dialog-Fehler:", error);
      alert(message); // Ultimate Fallback
    }
  }

  // Validierung mit sicheren Dialogs
  if (!userData.username || userData.username.length < 3) {
    await safeAlert(
      `Ungültiger Benutzername!\n\nEingabe: "${userData.username}"\nErforderlich: Mindestens 3 Zeichen\n\nErlaubt sind:\n• Buchstaben (A-Z, a-z)\n• Zahlen (0-9)\n• Unterstriche (_)\n\nBitte korrigieren Sie die Eingabe.`,
      "warning",
      "Benutzername zu kurz"
    );
    return;
  }

  if (!userData.password || userData.password.length < 6) {
    await safeAlert(
      `Unsicheres Passwort!\n\nPasswort-Länge: ${
        userData.password ? userData.password.length : 0
      } Zeichen\nErforderlich: Mindestens 6 Zeichen\n\nFür bessere Sicherheit verwenden Sie:\n• Mindestens 8 Zeichen\n• Groß- und Kleinbuchstaben\n• Zahlen und Sonderzeichen`,
      "warning",
      "Passwort zu schwach"
    );
    return;
  }

  // Zusätzliche Validierung für Benutzername-Format
  if (!/^[a-zA-Z0-9_]+$/.test(userData.username)) {
    await safeAlert(
      `Ungültiges Benutzername-Format!\n\nBenutzername: "${userData.username}"\n\nNur folgende Zeichen sind erlaubt:\n• Buchstaben (A-Z, a-z)\n• Zahlen (0-9)\n• Unterstriche (_)\n\nKeine Leerzeichen oder Sonderzeichen!`,
      "error",
      "Format-Fehler"
    );
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Wird erstellt...';

    console.log("🔄 Sende Create User Request...");

    const response = await fetch("/api/auth/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(userData),
    });

    console.log("📊 Create User Response Status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Benutzer erfolgreich erstellt:", result);

      // SOFORT Button zurücksetzen und Modal schließen
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      // Modal schließen BEVOR Dialog angezeigt wird
      if (typeof window.closeCreateUserModal === "function") {
        console.log("🔄 Schließe Modal...");
        window.closeCreateUserModal();
      }

      // Daten neu laden
      if (typeof loadUsersData === "function") {
        console.log("🔄 Lade Benutzer-Daten neu...");
        await loadUsersData();
      }

      // Normale Notification verwenden statt Dialog
      if (typeof showNotification === "function") {
        showNotification(
          `Benutzer "${userData.username}" erfolgreich erstellt!`,
          "success"
        );
      }

      // Erfolgs-Dialog NACH Modal-Schließung (optional)
      setTimeout(async () => {
        try {
          await safeAlert(
            `✅ Benutzer erfolgreich erstellt!\n\nBenutzer-Details:\n• Benutzername: ${userData.username}\n• Rolle: ${userData.role}\n• Status: Aktiv\n\nDer neue Benutzer kann sich jetzt anmelden.`,
            "success",
            "Benutzer erstellt"
          );
        } catch (dialogError) {
          console.warn("⚠️ Erfolgs-Dialog Fehler:", dialogError);
          // Ignorieren, da Benutzer bereits erstellt und Modal geschlossen
        }
      }, 500);
    } else {
      const error = await response.json();
      console.error("❌ Create User Error:", error);

      // Button zurücksetzen bei Fehler
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;

      // Fehler-spezifische Behandlung
      let errorMessage = "Fehler beim Erstellen des Benutzers:\n\n";

      if (
        response.status === 409 ||
        error.error?.includes("bereits") ||
        error.error?.includes("exists")
      ) {
        errorMessage += `Benutzername "${userData.username}" ist bereits vergeben!\n\nWählen Sie einen anderen Benutzernamen.`;
      } else if (response.status === 403 || response.status === 401) {
        errorMessage += `Keine Berechtigung!\n\nSie haben nicht die erforderlichen Rechte um Benutzer zu erstellen.`;
      } else {
        errorMessage += `${
          error.error || "Unbekannter Server-Fehler"
        }\n\nHTTP Status: ${response.status}`;
      }

      await safeAlert(
        errorMessage,
        "error",
        "Benutzer-Erstellung fehlgeschlagen"
      );
    }
  } catch (error) {
    console.error("❌ Network Error beim Erstellen des Benutzers:", error);

    // Button zurücksetzen bei Netzwerk-Fehler
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;

    await safeAlert(
      `Netzwerk-Fehler beim Erstellen des Benutzers:\n\n${
        error.message || "Verbindung fehlgeschlagen"
      }\n\nPrüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.`,
      "error",
      "Verbindungs-Fehler"
    );
  }

  // Sicherheits-Fallback: Button immer zurücksetzen
  setTimeout(() => {
    if (submitBtn.disabled) {
      console.log("🛡️ Sicherheits-Fallback: Button zurücksetzen");
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }, 10000); // Nach 10 Sekunden
}

// Users Daten laden
async function loadUsersData() {
  const container = document.getElementById("users-list-container");
  if (!container) {
    console.error("❌ Users List Container nicht gefunden");
    return;
  }

  try {
    console.log("🔄 Lade Benutzer...");

    const response = await fetch("/api/auth/users", {
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache" },
    });

    console.log("📊 Users API Response Status:", response.status);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const users = await response.json();
    console.log("📊 Users API Response:", users);

    displayUsersTable(users, container);
    console.log(`✅ ${users.length} Benutzer geladen`);
  } catch (error) {
    console.error("❌ Fehler beim Laden der Benutzer:", error);
    container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #ef4444;">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Fehler beim Laden der Benutzer</p>
                <small>${error.message}</small>
                <br><br>
                <button class="btn btn-secondary" onclick="loadUsersData()">
                    <i class="fas fa-redo"></i> Erneut versuchen
                </button>
            </div>
        `;
  }
}

// Users Tabelle anzeigen
function displayUsersTable(users, container) {
  const tableHTML = `
    <table class="table">
        <thead>
            <tr>
                <th>Benutzername</th>
                <th>Rolle</th>
                <th>Erstellt</th>
                <th>Letzter Login</th>
                <th>Status</th>
                <th>Aktionen</th>
            </tr>
        </thead>
        <tbody>
            ${users
              .map(
                (user) => `
                <tr>
                    <td>
                        ${escapeHtml(user.username)}
                        ${
                          user.role === "admin"
                            ? '<i class="fas fa-crown" style="color: #f59e0b; margin-left: 8px;" title="Administrator"></i>'
                            : ""
                        }
                    </td>
                    <td>
                        <span class="badge ${
                          user.role === "admin" ? "badge-warning" : "badge-info"
                        }">
                            ${user.role === "admin" ? "Admin" : "User"}
                        </span>
                    </td>
                    <td>${formatDate(user.created_at)}</td>
                    <td>${
                      user.last_login_at
                        ? formatDate(user.last_login_at)
                        : "Nie"
                    }</td>
                    <td>
                        <span class="badge ${
                          user.is_active ? "badge-success" : "badge-danger"
                        }">
                            ${user.is_active ? "Aktiv" : "Deaktiviert"}
                        </span>
                    </td>
                    <td>
                        ${generateUserActions(user)}
                    </td>
                </tr>
            `
              )
              .join("")}
        </tbody>
    </table>
  `;

  container.innerHTML = tableHTML;
}

function generateUserActions(user) {
  if (user.role === "admin") {
    return `
      <span class="text-muted" title="Administrator-Accounts sind geschützt">
        <i class="fas fa-shield-alt"></i> Geschützt
      </span>
    `;
  }

  return `
    <div class="btn-group">
      <button 
        class="btn btn-sm ${user.is_active ? "btn-warning" : "btn-success"}" 
        onclick="toggleUserStatus(${user.id}, ${user.is_active})"
        title="${
          user.is_active ? "Benutzer deaktivieren" : "Benutzer aktivieren"
        }"
      >
        <i class="fas ${
          user.is_active ? "fa-user-slash" : "fa-user-check"
        }"></i>
        ${user.is_active ? "Deaktivieren" : "Aktivieren"}
      </button>
      <button 
        class="btn btn-sm btn-danger" 
        onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')"
        title="Benutzer löschen"
      >
        <i class="fas fa-trash"></i>
        Löschen
      </button>
    </div>
  `;
}

// User Status ändern
window.toggleUserStatus = async function (userId, currentStatus) {
  console.log(`🔄 Toggle User Status: ID=${userId}, Current=${currentStatus}`);

  const action = currentStatus ? "deaktivieren" : "aktivieren";
  const confirmed = await customConfirm(
    `Möchten Sie diesen Benutzer wirklich ${action}?

Dies wird ${
      currentStatus ? "den Zugang sperren" : "den Zugang wieder freigeben"
    }.`,
    `Benutzer ${action}`
  );

  if (!confirmed) return;

  try {
    console.log(`🔄 Sende ${action} Request für User ${userId}...`);

    const response = await fetch(
      `/api/auth/user/${userId}/${currentStatus ? "deactivate" : "activate"}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      }
    );

    console.log(`📊 Toggle Status Response: ${response.status}`);

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Status erfolgreich geändert:`, result);

      if (typeof showNotification === "function") {
        showNotification(`Benutzer erfolgreich ${action}t`, "success");
      } else {
        alert(`Benutzer erfolgreich ${action}t`);
      }

      // Tabelle neu laden
      await loadUsersData();
    } else {
      const error = await response.json();
      console.error(`❌ Status Change Error:`, error);

      if (typeof showNotification === "function") {
        showNotification(
          `Fehler beim ${action}: ${error.error || "Unbekannter Fehler"}`,
          "error"
        );
      } else {
        alert(`Fehler beim ${action}: ${error.error || "Unbekannter Fehler"}`);
      }
    }
  } catch (error) {
    console.error(`❌ Network Error beim ${action}:`, error);

    if (typeof showNotification === "function") {
      showNotification(`Netzwerkfehler beim ${action} des Benutzers`, "error");
    } else {
      alert(`Netzwerkfehler beim ${action} des Benutzers`);
    }
  }
};

window.deleteUser = async function (userId, username) {
  console.log(`🔄 Delete User: ID=${userId}, Username=${username}`);

  // Doppelte Bestätigung für Löschung
  const confirmed1 = await customConfirm(
    `⚠️ WARNUNG: Benutzer "${username}" löschen?

Diese Aktion kann NICHT rückgängig gemacht werden!

Alle Daten dieses Benutzers gehen verloren.`,
    "Benutzer löschen - Schritt 1"
  );

  if (!confirmed1) return;

  const confirmed2 = await customConfirm(
    `🚨 LETZTE WARNUNG!

Sie sind dabei "${username}" PERMANENT zu löschen.

Sind Sie sich absolut sicher?`,
    "Benutzer löschen - Schritt 2"
  );

  if (!confirmed2) return;

  try {
    console.log(`🔄 Sende Delete Request für User ${userId}...`);

    const response = await fetch(`/api/auth/user/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    });

    console.log(`📊 Delete User Response: ${response.status}`);

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Benutzer erfolgreich gelöscht:`, result);

      if (typeof showNotification === "function") {
        showNotification(
          `Benutzer "${username}" erfolgreich gelöscht`,
          "success"
        );
      } else {
        alert(`Benutzer "${username}" erfolgreich gelöscht`);
      }

      // Tabelle neu laden
      await loadUsersData();
    } else {
      const error = await response.json();
      console.error(`❌ Delete User Error:`, error);

      if (typeof showNotification === "function") {
        showNotification(
          `Fehler beim Löschen: ${error.error || "Unbekannter Fehler"}`,
          "error"
        );
      } else {
        alert(`Fehler beim Löschen: ${error.error || "Unbekannter Fehler"}`);
      }
    }
  } catch (error) {
    console.error(`❌ Network Error beim Löschen:`, error);

    if (typeof showNotification === "function") {
      showNotification("Netzwerkfehler beim Löschen des Benutzers", "error");
    } else {
      alert("Netzwerkfehler beim Löschen des Benutzers");
    }
  }
};

// Hilfsfunktionen
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return "Nie";
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Settings Tab Navigation erweitern
if (typeof window.showSettingsTab === "undefined") {
  window.showSettingsTab = function (tabName) {
    console.log("🔄 showSettingsTab:", tabName);

    // Alle Tabs und Content verstecken
    document.querySelectorAll(".settings-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    document.querySelectorAll(".settings-content").forEach((content) => {
      content.classList.remove("active");
    });

    // Aktiven Tab und Content anzeigen
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}-settings`);

    if (activeTab) {
      activeTab.classList.add("active");
      console.log("✅ Tab aktiviert:", tabName);
    }
    if (activeContent) {
      activeContent.classList.add("active");
      console.log("✅ Content aktiviert:", tabName);
    }

    // Spezielle Aktionen
    if (tabName === "users" && userManagementReady) {
      setTimeout(() => {
        console.log("🔄 Lade Users für Tab...");
        loadUsersData();
      }, 100);
    }
  };
}

// Debug-Funktionen
window.debugModalFixed = function () {
  console.log("=== MODAL DEBUG FIXED ===");
  console.log("User Management Ready:", userManagementReady);
  console.log(
    "Modal exists:",
    !!document.getElementById("create-user-modal-fixed")
  );
  console.log("Open function exists:", typeof window.openCreateUserModalFixed);
  console.log("Button exists:", !!document.getElementById("create-user-btn"));

  // Test Modal öffnen
  console.log("Testing modal open...");
  if (window.openCreateUserModalFixed) {
    window.openCreateUserModalFixed();
  }
};

window.testModalFix = function () {
  console.log("🧪 Teste Modal Fix...");

  // Modal erstellen falls nicht vorhanden
  if (!document.getElementById("create-user-modal-fixed")) {
    const testModal = document.createElement("div");
    testModal.id = "create-user-modal-fixed";
    testModal.className = "modal-fixed";
    testModal.innerHTML = `
                    <div class="modal-overlay-fixed"></div>
                    <div class="modal-content-fixed">
                        <div class="modal-header-fixed">
                            <h3>Test Modal</h3>
                            <button class="modal-close-fixed" onclick="closeCreateUserModalFixed()">&times;</button>
                        </div>
                        <div style="padding: 25px;">
                            <p>Dies ist ein Test Modal!</p>
                            <button onclick="closeCreateUserModalFixed()">Schließen</button>
                        </div>
                    </div>
                `;
    document.body.appendChild(testModal);
    console.log("🧪 Test Modal erstellt");
  }

  // CSS sicherstellen
  ensureModalCSS();

  // Modal öffnen
  setTimeout(() => {
    window.openCreateUserModalFixed();
  }, 100);
};
window.debugModalElements = function () {
  console.log("=== MODAL DEBUG ===");

  const modal = document.getElementById("create-user-modal-fixed");
  console.log("Modal Element:", modal);

  if (modal) {
    console.log("Modal classList:", modal.classList.toString());
    console.log("Modal style.display:", modal.style.display);
    console.log(
      "Modal computed display:",
      window.getComputedStyle(modal).display
    );
    console.log(
      "Modal computed z-index:",
      window.getComputedStyle(modal).zIndex
    );
    console.log(
      "Modal computed visibility:",
      window.getComputedStyle(modal).visibility
    );
    console.log("Modal offsetWidth:", modal.offsetWidth);
    console.log("Modal offsetHeight:", modal.offsetHeight);
    console.log("Modal parentElement:", modal.parentElement);
  }

  // Alle Elemente mit hohem z-index finden
  const allElements = document.querySelectorAll("*");
  const highZElements = [];

  allElements.forEach((el) => {
    const zIndex = window.getComputedStyle(el).zIndex;
    if (zIndex !== "auto" && parseInt(zIndex) > 9000) {
      highZElements.push({
        element: el,
        zIndex: zIndex,
        tagName: el.tagName,
        className: el.className,
      });
    }
  });

  console.log("Elemente mit hohem z-index:", highZElements);
};

console.log("✅ Modal Fix Script geladen");
console.log("🧪 Verwende testModalFix() zum Testen");
console.log("🔍 Verwende debugModalElements() für Debug-Info");

// Globale Funktionen verfügbar machen
window.loadUsersData = loadUsersData;

console.log("✅ Modal-Fix User-Management Script geladen");
