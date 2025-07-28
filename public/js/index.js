// User-Informationen laden und anzeigen
async function loadUserInfo() {
  try {
    const response = await fetch("/api/auth/status", {
      credentials: "same-origin",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.authenticated && data.user) {
      // User-Info anzeigen
      const usernameElement = document.getElementById("current-username");
      if (usernameElement) {
        usernameElement.textContent = data.user.username;
      }

      if (data.user.role === "admin") {
        const userInfo = document.getElementById("user-info");
        if (userInfo && !userInfo.querySelector(".admin-badge")) {
          const adminBadge = document.createElement("span");
          adminBadge.className = "admin-badge";
          adminBadge.textContent = "Admin";
          adminBadge.style.cssText = `
            background: #e74c3c;
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.7rem;
            margin-left: 8px;
          `;
          userInfo.appendChild(adminBadge);
        }
      }

      console.log("✅ Benutzer-Info geladen:", data.user.username);
    } else {
      console.warn("⚠️ Nicht authentifiziert - Weiterleitung zur Login-Seite");
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("❌ Fehler beim Laden der Benutzer-Informationen:", error);

    console.warn("⚠️ Schwerer Fehler - Weiterleitung zur Login-Seite");
    window.location.href = "/login";
  }
}

// Logout-Funktionalität
async function handleLogout() {
  // Bestätigung mit Custom Dialog anzeigen
  const confirmed = await customConfirm(
    `Möchten Sie sich wirklich abmelden?

Dies beendet:
• Ihre aktuelle Sitzung
• Alle gespeicherten Daten in diesem Browser
• Automatische Anmeldung

Sie müssen sich anschließend neu anmelden.`,
    "Abmeldung bestätigen"
  );

  if (!confirmed) {
    return;
  }

  try {
    console.log("🔄 Logout wird eingeleitet...");

    // Loading-Indikator
    const logoutBtn = document.querySelector(".logout-btn");
    const originalText = logoutBtn.innerHTML;
    logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Abmelden...';
    logoutBtn.disabled = true;

    try {
      const logoutResponse = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      });

      if (logoutResponse.ok) {
        console.log("✅ Server-seitige Abmeldung erfolgreich");
      } else {
        console.warn(
          "⚠️ Server-seitiger Logout hatte Probleme, fahre trotzdem fort"
        );
      }
    } catch (logoutError) {
      console.warn("⚠️ Logout-API-Call fehlgeschlagen:", logoutError);
    }

    // Lokale Daten löschen
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.clear();
      }
      if (typeof localStorage !== "undefined") {
        localStorage.clear();
      }

      // Globale Variablen zurücksetzen
      if (window.kunden) window.kunden = [];
      if (window.fahrzeuge) window.fahrzeuge = [];
      if (window.auftraege) window.auftraege = [];
      if (window.rechnungen) window.rechnungen = [];
      if (window.einstellungen) window.einstellungen = {};

      console.log("✅ Lokale Daten gelöscht");
    } catch (cleanupError) {
      console.warn("⚠️ Fehler beim Löschen lokaler Daten:", cleanupError);
    }

    // Erfolgs-Nachricht
    if (typeof showNotification === "function") {
      showNotification("Erfolgreich abgemeldet", "success");
    }

    setTimeout(() => {
      console.log("🔄 Weiterleitung zur Login-Seite...");

      const isElectron =
        typeof window !== "undefined" &&
        window.process &&
        window.process.type === "renderer";

      if (isElectron) {
        console.log("🔧 Electron erkannt - verwende optimierte Navigation");

        // Erst den Cache für die aktuelle Seite leeren
        if (window.webContents && window.webContents.session) {
          window.webContents.session.clearCache();
        }

        // Dann zur Login-Seite navigieren mit Cache-Buster
        const timestamp = Date.now();
        window.location.replace(`/login?t=${timestamp}`);

        // Fallback: Komplette Seite neu laden falls nötig
        setTimeout(() => {
          console.log("🔄 Fallback: Vollständiger Reload");
          window.location.reload(true); // Force reload from server
        }, 2000);
      } else {
        // Im Browser: Standard-Navigation
        console.log("🌐 Browser erkannt - verwende Standard-Navigation");
        window.location.href = "/login";
      }
    }, 1000);
  } catch (error) {
    console.error("❌ Schwerwiegender Logout-Fehler:", error);

    // Fehler-Dialog mit Custom Dialog
    await customAlert(
      `Logout-Fehler aufgetreten:

${error.message}

Sie werden trotzdem abgemeldet.`,
      "error",
      "Logout-Problem"
    );

    if (typeof showNotification === "function") {
      showNotification("Abgemeldet (mit Fehlern)", "warning");
    }

    // Notfall-Lösung: Kompletter Reload
    setTimeout(() => {
      console.log("🆘 Notfall-Reload wird ausgeführt");
      window.location.reload(true);
    }, 500);
  }
}

// Session-Überwachung
function startSessionMonitoring() {
  setInterval(async () => {
    try {
      const response = await fetch("/api/auth/status", {
        credentials: "same-origin",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.authenticated) {
        console.warn("⚠️ Session abgelaufen");

        if (typeof showNotification === "function") {
          showNotification(
            "Session abgelaufen. Bitte melden Sie sich erneut an.",
            "warning"
          );
        }

        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        if (data.user && data.user.username) {
          const usernameElement = document.getElementById("current-username");
          if (usernameElement && usernameElement.textContent === "Laden...") {
            usernameElement.textContent = data.user.username;
            console.log("✅ Benutzer-Info aktualisiert");
          }
        }
      }
    } catch (error) {
      console.warn("⚠️ Session-Check fehlgeschlagen:", error);
    }
  }, 3 * 60 * 1000); // 3 Minuten
}

// Beim Laden der Seite initialisieren
document.addEventListener("DOMContentLoaded", function () {
  console.log("🔄 Initialisiere Haupt-App...");

  // User-Info laden
  loadUserInfo();

  // Session-Überwachung starten
  startSessionMonitoring();

  console.log("✅ Auth-System initialisiert");
});

// Keyboard-Shortcut für Logout (Ctrl+L)
document.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    handleLogout();
  }
});

// Globale Variable für aktuellen Benutzer
let currentProfileUser = null;

// Profil-Informationen beim Laden aktualisieren
document.addEventListener("DOMContentLoaded", function () {
  // Warte bis authManager verfügbar ist
  setTimeout(updateProfileSettings, 1000);
});

// Benutzer-Daten sicher abrufen
function getCurrentUserSafe() {
  // Versuche verschiedene Wege den aktuellen Benutzer zu bekommen
  if (window.authManager && window.authManager.getCurrentUser) {
    return window.authManager.getCurrentUser();
  }

  if (window.getCurrentUser) {
    return window.getCurrentUser();
  }

  if (currentProfileUser) {
    return currentProfileUser;
  }

  return null;
}

// Profil-Einstellungen aktualisieren
async function updateProfileSettings() {
  let user = getCurrentUserSafe();

  // Falls kein Benutzer gefunden, von API laden
  if (!user) {
    try {
      const response = await fetch("/api/auth/status");
      const data = await response.json();
      if (data.authenticated && data.user) {
        user = data.user;
        currentProfileUser = user;
      }
    } catch (error) {
      console.error("Fehler beim Laden der Benutzerdaten:", error);
      return;
    }
  }

  if (user) {
    const usernameEl = document.getElementById("settings-profile-username");
    const roleEl = document.getElementById("settings-profile-role");

    if (usernameEl) {
      usernameEl.textContent = user.username;
      // Auch das Username-Input-Feld mit aktuellem Wert füllen
      const usernameInput = document.getElementById("settings-username-input");
      if (usernameInput) {
        usernameInput.placeholder = `Aktuell: ${user.username}`;
      }
    }

    if (roleEl) {
      if (user.role === "admin") {
        roleEl.innerHTML =
          'Administrator <span style="background: var(--accent-warning); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; margin-left: 0.5rem;">ADMIN</span>';
      } else {
        roleEl.textContent = "Benutzer";
      }
    }
  }
}

// Passwort-Sichtbarkeit in Einstellungen umschalten
function toggleSettingsPassword(inputId) {
  const input = document.getElementById(inputId);
  const button = input.nextElementSibling;
  const icon = button.querySelector("i");

  if (input.type === "password") {
    input.type = "text";
    icon.className = "fas fa-eye-slash";
  } else {
    input.type = "password";
    icon.className = "fas fa-eye";
  }
}

// Passwort-Stärke in Einstellungen prüfen
function checkSettingsPasswordStrength(password) {
  const strengthDiv = document.getElementById("settings-password-strength");
  const strengthFill = document.getElementById("settings-strength-fill");
  const strengthText = document.getElementById("settings-strength-text");

  if (!password) {
    strengthDiv.style.display = "none";
    return;
  }

  strengthDiv.style.display = "block";

  let score = 0;
  let feedback = [];

  // Länge
  if (password.length >= 8) score++;
  else feedback.push("mindestens 8 Zeichen");

  // Großbuchstaben
  if (/[A-Z]/.test(password)) score++;
  else feedback.push("Großbuchstaben");

  // Kleinbuchstaben
  if (/[a-z]/.test(password)) score++;
  else feedback.push("Kleinbuchstaben");

  // Zahlen
  if (/\d/.test(password)) score++;
  else feedback.push("Zahlen");

  // Sonderzeichen
  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push("Sonderzeichen");

  // Stärke anzeigen
  if (score <= 1) {
    strengthFill.style.background = "#ef4444";
    strengthFill.style.width = "25%";
    strengthText.textContent =
      "Schwach - Fehlt: " + feedback.slice(0, 3).join(", ");
  } else if (score <= 2) {
    strengthFill.style.background = "#f59e0b";
    strengthFill.style.width = "50%";
    strengthText.textContent =
      "Mittelmäßig - Fehlt: " + feedback.slice(0, 2).join(", ");
  } else if (score <= 3) {
    strengthFill.style.background = "#10b981";
    strengthFill.style.width = "75%";
    strengthText.textContent =
      "Gut - Empfohlen: " + (feedback[0] || "Sonderzeichen");
  } else {
    strengthFill.style.background = "#059669";
    strengthFill.style.width = "100%";
    strengthText.textContent = "Stark - Sicheres Passwort";
  }
}

// Benutzername-Formular zurücksetzen
function resetUsernameForm() {
  document.getElementById("settings-change-username-form").reset();
}

// Passwort-Formular in Einstellungen zurücksetzen
function resetSettingsPasswordForm() {
  document.getElementById("settings-change-password-form").reset();
  document.getElementById("settings-password-strength").style.display = "none";
}

// Sitzungsinformationen in Einstellungen anzeigen - BEREITS mit Custom Dialogs
async function showSettingsSessionInfo() {
  let user = getCurrentUserSafe();

  // Falls kein Benutzer gefunden, von API laden
  if (!user) {
    try {
      const response = await fetch("/api/auth/status");
      const data = await response.json();
      if (data.authenticated && data.user) {
        user = data.user;
        currentProfileUser = user;
      }
    } catch (error) {
      console.error("Fehler beim Laden der Benutzerdaten:", error);
      await customAlert(
        `Fehler beim Laden der Benutzerdaten:

${error.message || "Unbekannter Fehler"}

Versuchen Sie es erneut oder melden Sie sich neu an.`,
        "error"
      );
      return;
    }
  }

  if (user) {
    const loginTime = user.login_time
      ? new Date(user.login_time).toLocaleString("de-DE")
      : new Date().toLocaleString("de-DE");

    const info = `Aktuelle Sitzung:

👤 Benutzer: ${user.username}
🔑 Rolle: ${user.role}
⏰ Angemeldet seit: ${loginTime}
🌐 Browser: ${navigator.userAgent.split(" ").pop()}
📍 IP-Adresse: ${window.location.hostname}
🔒 Protokoll: ${window.location.protocol}
💾 Session-ID: ${user.session_id || "Nicht verfügbar"}`;

    await customAlert(info, "info", "Sitzungsinformationen");
  } else {
    await customAlert(
      "Keine Benutzerdaten verfügbar.\n\nSie sind möglicherweise nicht angemeldet.",
      "warning",
      "Session-Fehler"
    );
  }
}

// Logout von Einstellungen - AKTUALISIERT (funktioniert jetzt)
async function logoutFromSettings() {
  const confirmed = await customConfirm(
    `Möchten Sie sich wirklich von allen Geräten abmelden?

Dies beendet:
• Ihre aktuelle Sitzung
• Alle anderen aktiven Sitzungen
• Gespeicherte Login-Daten

Sie müssen sich anschließend neu anmelden.`,
    "Abmeldung bestätigen"
  );

  if (!confirmed) return;

  try {
    // Loading-Anzeige
    if (typeof showNotification === "function") {
      showNotification("Abmeldung wird durchgeführt...", "info");
    }

    console.log("🔄 Sende logout-all Request...");

    const response = await fetch("/api/auth/logout-all", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    });

    console.log("📡 Logout-All Response Status:", response.status);

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Logout-All erfolgreich:", data);

      await customAlert(
        "✅ Sie wurden erfolgreich von allen Geräten abgemeldet!",
        "success"
      );

      // Kurz warten, dann zur Login-Seite
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } else {
      const errorData = await response.text();
      console.error("❌ Logout-All Fehler:", response.status, errorData);
      throw new Error(`Logout fehlgeschlagen: ${response.status}`);
    }
  } catch (error) {
    console.error("❌ Logout-Fehler:", error);
    await customAlert(
      `Fehler bei der Abmeldung:

${error.message}

Versuchen Sie es erneut oder schließen Sie den Browser.`,
      "error"
    );
  }
}

// Event Listener für Formulare in Einstellungen
document.addEventListener("DOMContentLoaded", function () {
  // Event Listener für Benutzername-Formular
  const usernameForm = document.getElementById("settings-change-username-form");

  if (usernameForm) {
    usernameForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const formData = new FormData(e.target);
      const newUsername = formData.get("newUsername").trim();

      // Validierung
      if (!newUsername) {
        if (typeof showNotification === "function") {
          showNotification("Benutzername ist erforderlich", "error");
        } else {
          alert("Benutzername ist erforderlich");
        }
        return;
      }

      if (newUsername.length < 3) {
        if (typeof showNotification === "function") {
          showNotification(
            "Benutzername muss mindestens 3 Zeichen lang sein",
            "error"
          );
        } else {
          alert("Benutzername muss mindestens 3 Zeichen lang sein");
        }
        return;
      }

      // Nur Buchstaben, Zahlen und Unterstriche erlauben
      if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
        if (typeof showNotification === "function") {
          showNotification(
            "Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten",
            "error"
          );
        } else {
          alert(
            "Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten"
          );
        }
        return;
      }

      // Prüfen ob Username sich geändert hat
      const currentUser = getCurrentUserSafe();
      if (currentUser && currentUser.username === newUsername) {
        if (typeof showNotification === "function") {
          showNotification(
            "Neuer Benutzername muss sich vom aktuellen unterscheiden",
            "error"
          );
        } else {
          alert("Neuer Benutzername muss sich vom aktuellen unterscheiden");
        }
        return;
      }

      const submitBtn = document.getElementById("settings-username-submit");
      const originalText = submitBtn.innerHTML;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Wird geändert...';

        const response = await fetch("/api/auth/change-username", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newUsername: newUsername,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          if (typeof showNotification === "function") {
            showNotification("Benutzername erfolgreich geändert", "success");
          } else {
            alert("Benutzername erfolgreich geändert");
          }

          // Benutzerdaten aktualisieren
          if (currentProfileUser) {
            currentProfileUser.username = newUsername;
          }

          // UI aktualisieren
          updateProfileSettings();

          // Auch den Username in der Hauptnavigation aktualisieren
          const mainUsernameEl = document.getElementById("current-username");
          if (mainUsernameEl) {
            mainUsernameEl.textContent = newUsername;
          }

          resetUsernameForm();
        } else {
          if (typeof showNotification === "function") {
            showNotification(
              data.error || "Fehler beim Ändern des Benutzernamens",
              "error"
            );
          } else {
            alert(data.error || "Fehler beim Ändern des Benutzernamens");
          }
        }
      } catch (error) {
        console.error("Fehler beim Ändern des Benutzernamens:", error);
        if (typeof showNotification === "function") {
          showNotification(
            "Netzwerkfehler beim Ändern des Benutzernamens",
            "error"
          );
        } else {
          alert("Netzwerkfehler beim Ändern des Benutzernamens");
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Event Listener für Passwort-Formular
  const passwordForm = document.getElementById("settings-change-password-form");

  if (passwordForm) {
    passwordForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const formData = new FormData(e.target);
      const currentPassword = formData.get("currentPassword");
      const newPassword = formData.get("newPassword");
      const confirmPassword = formData.get("confirmPassword");

      // Validierung
      if (!currentPassword || !newPassword || !confirmPassword) {
        if (typeof showNotification === "function") {
          showNotification("Alle Felder sind erforderlich", "error");
        } else {
          alert("Alle Felder sind erforderlich");
        }
        return;
      }

      if (newPassword.length < 6) {
        if (typeof showNotification === "function") {
          showNotification(
            "Neues Passwort muss mindestens 6 Zeichen lang sein",
            "error"
          );
        } else {
          alert("Neues Passwort muss mindestens 6 Zeichen lang sein");
        }
        return;
      }

      if (newPassword !== confirmPassword) {
        if (typeof showNotification === "function") {
          showNotification("Neue Passwörter stimmen nicht überein", "error");
        } else {
          alert("Neue Passwörter stimmen nicht überein");
        }
        return;
      }

      if (currentPassword === newPassword) {
        if (typeof showNotification === "function") {
          showNotification(
            "Neues Passwort muss sich vom aktuellen unterscheiden",
            "error"
          );
        } else {
          alert("Neues Passwort muss sich vom aktuellen unterscheiden");
        }
        return;
      }

      const submitBtn = document.getElementById("settings-password-submit");
      const originalText = submitBtn.innerHTML;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Wird geändert...';

        const response = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword: currentPassword,
            newPassword: newPassword,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          if (typeof showNotification === "function") {
            showNotification("Passwort erfolgreich geändert", "success");
          } else {
            alert("Passwort erfolgreich geändert");
          }
          resetSettingsPasswordForm();
        } else {
          if (typeof showNotification === "function") {
            showNotification(
              data.error || "Fehler beim Ändern des Passworts",
              "error"
            );
          } else {
            alert(data.error || "Fehler beim Ändern des Passworts");
          }
        }
      } catch (error) {
        console.error("Fehler beim Ändern des Passworts:", error);
        if (typeof showNotification === "function") {
          showNotification("Netzwerkfehler beim Ändern des Passworts", "error");
        } else {
          alert("Netzwerkfehler beim Ändern des Passworts");
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Prüfen ob Custom Dialogs verfügbar sind
  if (typeof customAlert === "undefined") {
    console.error("❌ Custom Dialogs nicht geladen in index.html!");

    // Fallback für kritische Funktionen
    window.customAlert = (msg) => alert(msg);
    window.customConfirm = (msg) => confirm(msg);
    window.customPrompt = (msg, def) => prompt(msg, def);
  } else {
    console.log("✅ Custom Dialogs in index.html verfügbar");
  }

  // NEUE: Settings standardmäßig auf Firmendaten-Tab initialisieren
  setTimeout(() => {
    if (document.querySelector(".settings-tabs")) {
      console.log("🔧 Initialisiere Settings mit Firmendaten-Tab als Standard");
      showSettingsTab("firma");
    }
  }, 500);
});

// ERWEITERTE showSettingsTab Funktion
if (typeof window.showSettingsTab === "undefined") {
  window.showSettingsTab = function (tabName) {
    console.log(`🔄 Settings-Tab wechseln zu: ${tabName}`);

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
      console.log(`✅ Tab '${tabName}' aktiviert`);
    } else {
      console.warn(`⚠️ Tab-Button für '${tabName}' nicht gefunden`);
    }

    if (activeContent) {
      activeContent.classList.add("active");
      console.log(`✅ Content '${tabName}' angezeigt`);
    } else {
      console.warn(`⚠️ Content für '${tabName}' nicht gefunden`);
    }

    // Tab-spezifische Behandlung
    if (tabName === "profil") {
      setTimeout(updateProfileSettings, 100);
    }

    if (tabName === "layout" && window.layoutEditorModule) {
      setTimeout(() => {
        if (window.layoutEditorModule.fillLayoutForm) {
          window.layoutEditorModule.fillLayoutForm();
        }
      }, 100);
    }

    if (tabName === "users") {
      console.log("👥 User-Management Tab aktiviert");
    }
  };
} else {
  // Erweitere bestehende Funktion
  const originalShowSettingsTab = window.showSettingsTab;
  window.showSettingsTab = function (tabName) {
    console.log(`🔄 Settings-Tab wechseln zu: ${tabName} (erweiterte Version)`);

    originalShowSettingsTab(tabName);

    // Zusätzliche Behandlung
    if (tabName === "profil") {
      setTimeout(updateProfileSettings, 100);
    }

    if (tabName === "layout" && window.layoutEditorModule) {
      setTimeout(() => {
        if (window.layoutEditorModule.fillLayoutForm) {
          window.layoutEditorModule.fillLayoutForm();
        }
      }, 100);
    }

    if (tabName === "users") {
      console.log("👥 User-Management Tab aktiviert");
    }
  };
}

// EINFACHE LÖSUNG: Observer entfernen und nur einmalig prüfen
function ensureCorrectTabOrderOnce() {
  const tabsContainer = document.querySelector(".settings-tabs");
  if (!tabsContainer) return;

  const profilTab = document.querySelector('[data-tab="profil"]');
  const layoutTab = document.querySelector('[data-tab="layout"]');
  const usersTab = document.querySelector('[data-tab="users"]');

  let changed = false;

  // Layout-Tab vor Profil positionieren
  if (layoutTab && profilTab) {
    const layoutIndex = Array.from(tabsContainer.children).indexOf(layoutTab);
    const profilIndex = Array.from(tabsContainer.children).indexOf(profilTab);

    if (layoutIndex > profilIndex) {
      console.log("🔧 Repositioniere Layout-Tab vor Profil-Tab (einmalig)");
      tabsContainer.insertBefore(layoutTab, profilTab);
      changed = true;
    }
  }

  // Users-Tab vor Profil positionieren
  if (usersTab && profilTab) {
    const usersIndex = Array.from(tabsContainer.children).indexOf(usersTab);
    const profilIndex = Array.from(tabsContainer.children).indexOf(profilTab);

    if (usersIndex > profilIndex) {
      console.log("🔧 Repositioniere Users-Tab vor Profil-Tab (einmalig)");
      tabsContainer.insertBefore(usersTab, profilTab);
      changed = true;
    }
  }

  if (changed) {
    console.log("✅ Tab-Reihenfolge korrigiert");
  } else {
    console.log("✅ Tab-Reihenfolge bereits korrekt");
  }
}

// NUR EINMALIGE Prüfung beim Laden - KEIN Observer
document.addEventListener("DOMContentLoaded", function () {
  // Mehrfache Prüfungen mit Verzögerung für dynamische Tabs
  setTimeout(ensureCorrectTabOrderOnce, 500); // Nach 0.5s
  setTimeout(ensureCorrectTabOrderOnce, 1500); // Nach 1.5s
  setTimeout(ensureCorrectTabOrderOnce, 3000); // Nach 3s (für späte Module)

  console.log("🔧 Tab-Reihenfolge wird einmalig geprüft (kein Observer)");
});

// Globale getSetting-Funktion für alle Module
window.getSetting = function (key, defaultValue = "") {
  if (!window.einstellungen) {
    console.warn(
      `⚠️ Global getSetting: Einstellungen noch nicht geladen für ${key}`
    );
    return defaultValue;
  }

  if (window.einstellungen[key] === undefined) {
    console.warn(`⚠️ Global getSetting: Key '${key}' nicht gefunden`);
    return defaultValue;
  }

  return window.einstellungen[key];
};

// Debug-Funktion
window.debugSettings = function () {
  console.log("=== SETTINGS DEBUG ===");
  console.log("window.einstellungen:", !!window.einstellungen);
  console.log("Keys:", Object.keys(window.einstellungen || {}));
  console.log("Logo vorhanden:", !!window.einstellungen?.firmen_logo);
  console.log(
    "Logo Länge:",
    window.einstellungen?.firmen_logo?.length || "N/A"
  );
  console.log(
    "Erste 50 Zeichen des Logos:",
    window.einstellungen?.firmen_logo?.substring(0, 50) || "N/A"
  );
  console.log(
    "Logo ist Base64:",
    window.einstellungen?.firmen_logo?.startsWith("data:") || false
  );

  // Testen ob Logo noch da ist nach verschiedenen Aktionen
  setTimeout(() => {
    console.log("Logo nach 1 Sekunde:", !!window.einstellungen?.firmen_logo);
  }, 1000);
};
