// ===== ERWEITERTE public/js/auth.js =====
// Frontend Authentication Management mit Lizenz-Support

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.licenseInfo = null;
    this.sessionCheckInterval = null;
    this.init();
  }

  // Initialisierung
  init() {
    this.loadUserInfo();
    this.startSessionMonitoring();
    this.setupKeyboardShortcuts();
    this.checkForLicenseNotifications();
  }

  // User-Informationen laden und anzeigen
  async loadUserInfo() {
    try {
      const response = await fetch("/api/auth/status");
      const data = await response.json();

      if (data.authenticated && data.user) {
        this.currentUser = data.user;
        this.licenseInfo = data.license || null;
        this.updateUserDisplay();
        this.showLicenseStatus();
      } else {
        // Nicht eingeloggt - zur Login-Seite weiterleiten
        this.redirectToLogin();
      }
    } catch (error) {
      console.error("Fehler beim Laden der Benutzer-Informationen:", error);
      this.redirectToLogin();
    }
  }

  // User-Anzeige aktualisieren
  updateUserDisplay() {
    const usernameElement = document.getElementById("current-username");
    const userInfoElement = document.getElementById("user-info");

    if (usernameElement && this.currentUser) {
      usernameElement.textContent = this.currentUser.username;

      // Admin-Badge hinzufügen
      if (this.currentUser.role === "admin") {
        const existingBadge = userInfoElement?.querySelector(".admin-badge");
        if (!existingBadge && userInfoElement) {
          const adminBadge = document.createElement("span");
          adminBadge.className = "admin-badge";
          adminBadge.textContent = "Admin";
          userInfoElement.appendChild(adminBadge);
        }
      }
    }
  }

  // NEU: Lizenz-Status anzeigen
  showLicenseStatus() {
    if (!this.licenseInfo) return;

    // Lizenz-Status-Element finden oder erstellen
    let licenseStatusElement = document.getElementById("license-status");
    if (!licenseStatusElement) {
      licenseStatusElement = document.createElement("div");
      licenseStatusElement.id = "license-status";
      licenseStatusElement.className = "license-status";

      // Am besten in der Nähe der User-Info platzieren
      const userInfoElement = document.getElementById("user-info");
      if (userInfoElement) {
        userInfoElement.appendChild(licenseStatusElement);
      } else {
        document.body.appendChild(licenseStatusElement);
      }
    }

    // Lizenz-Status anzeigen
    if (this.licenseInfo.validated) {
      const statusClass = this.licenseInfo.offline
        ? "license-offline"
        : "license-online";
      const statusText = this.licenseInfo.offline
        ? "📱 Offline-Modus"
        : "✅ Lizenz aktiv";

      licenseStatusElement.className = `license-status ${statusClass}`;
      licenseStatusElement.innerHTML = `<span class="license-indicator">${statusText}</span>`;

      // Tooltip für mehr Informationen
      licenseStatusElement.title = this.licenseInfo.offline
        ? "Keine Internetverbindung - lokale Lizenz wird verwendet"
        : "Lizenz online validiert";
    }
  }

  // NEU: Lizenz-Benachrichtigungen prüfen
  checkForLicenseNotifications() {
    if (!this.licenseInfo || !this.licenseInfo.expiresAt) return;

    const expiresAt = this.licenseInfo.expiresAt;
    const daysUntilExpiry = Math.ceil(
      (expiresAt - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // Warnung bei baldiger Lizenz-Ablauf
    if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
      this.showNotification(
        `⚠️ Lizenz läuft in ${daysUntilExpiry} Tagen ab`,
        "warning",
        { persistent: true }
      );
    }
  }

  // Login-Verarbeitung MIT LIZENZ-FEHLER-HANDLING
  async handleLogin(username, password) {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Erfolgreiches Login
        this.currentUser = data.user;
        this.licenseInfo = data.license;

        // Lizenz-Status-Nachricht anzeigen
        if (data.license?.offline) {
          this.showNotification("✅ Angemeldet (Offline-Modus)", "info");
        } else {
          this.showNotification("✅ Erfolgreich angemeldet", "success");
        }

        // Zur Hauptseite weiterleiten
        window.location.href = "/";
      } else {
        // Login-Fehler behandeln
        if (data.licenseError) {
          // SPEZIELLE LIZENZ-FEHLER-BEHANDLUNG
          this.handleLicenseError(data);
        } else {
          // Normale Login-Fehler
          this.showNotification(
            data.error || "Anmeldung fehlgeschlagen",
            "error"
          );
        }
      }
    } catch (error) {
      console.error("Login-Fehler:", error);
      this.showNotification("Verbindungsfehler beim Anmelden", "error");
    }
  }

  // NEU: Lizenz-Fehler-Behandlung
  handleLicenseError(errorData) {
    console.error("Lizenz-Fehler:", errorData);

    let message = errorData.error || "Lizenz-Problem";
    let actionButton = null;

    if (errorData.needsActivation) {
      message = "🔑 Lizenz-Aktivierung erforderlich";
      actionButton = {
        text: "Lizenz aktivieren",
        action: () => (window.location.href = "/license-activation"),
      };
    } else if (errorData.needsReactivation) {
      message = `🔄 Lizenz-Reaktivierung erforderlich\n${
        errorData.details || ""
      }`;
      actionButton = {
        text: "Lizenz reaktivieren",
        action: () => (window.location.href = "/license-reactivation"),
      };
    }

    // Lizenz-Fehler-Dialog anzeigen
    this.showLicenseErrorDialog(message, actionButton);
  }

  // NEU: Lizenz-Fehler-Dialog
  showLicenseErrorDialog(message, actionButton) {
    // Einfacher Alert als Fallback
    if (!document.getElementById("license-error-modal")) {
      alert(message);
      if (actionButton) {
        if (confirm("Möchten Sie zur Lizenz-Aktivierung?")) {
          actionButton.action();
        }
      }
      return;
    }

    // Hier könnte ein schönerer Modal-Dialog implementiert werden
    // Für jetzt verwenden wir den einfachen Alert
    alert(message);
    if (actionButton && confirm("Zur Lizenz-Verwaltung wechseln?")) {
      actionButton.action();
    }
  }

  // Logout-Funktionalität
  async handleLogout() {
    // Bestätigung anzeigen
    if (!confirm("Möchten Sie sich wirklich abmelden?")) {
      return;
    }

    const logoutBtn = document.querySelector(".logout-btn");
    if (!logoutBtn) return;

    try {
      // Loading-Indikator
      const originalHTML = logoutBtn.innerHTML;
      logoutBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> <span class="logout-text">Abmelden...</span>';
      logoutBtn.disabled = true;

      // Logout-Request
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        // Erfolgreiche Abmeldung
        this.showNotification("Erfolgreich abgemeldet", "success");
        this.stopSessionMonitoring();

        // Kurz warten, dann weiterleiten
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      } else {
        throw new Error("Logout fehlgeschlagen");
      }
    } catch (error) {
      console.error("Logout-Fehler:", error);

      // Auch bei Fehlern zur Login-Seite weiterleiten
      this.showNotification("Abgemeldet", "info");
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }

  // Session-Überwachung starten
  startSessionMonitoring() {
    // Alle 5 Minuten prüfen ob Session noch gültig ist
    this.sessionCheckInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/auth/status");
        const data = await response.json();

        if (!data.authenticated) {
          this.handleSessionExpired();
        } else {
          // Lizenz-Info aktualisieren
          this.licenseInfo = data.license || null;
        }
      } catch (error) {
        console.error("Session-Check fehlgeschlagen:", error);
      }
    }, 5 * 60 * 1000); // 5 Minuten
  }

  // Session-Überwachung stoppen
  stopSessionMonitoring() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }

  // Session abgelaufen
  handleSessionExpired() {
    this.stopSessionMonitoring();
    this.showNotification(
      "Session abgelaufen. Bitte melden Sie sich erneut an.",
      "warning"
    );
    setTimeout(() => {
      window.location.href = "/login";
    }, 2000);
  }

  // Zur Login-Seite weiterleiten
  redirectToLogin() {
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  // Benachrichtigung anzeigen
  showNotification(message, type = "info", options = {}) {
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Einfache Implementierung mit Console-Log
    // Hier könnte ein Toast-System implementiert werden
    if (type === "error") {
      console.error(message);
    } else if (type === "warning") {
      console.warn(message);
    } else {
      console.info(message);
    }

    // Optional: Browser-Benachrichtigung für wichtige Meldungen
    if (options.persistent && type === "warning") {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("KFZ-App", {
          body: message,
          icon: "/favicon.ico",
        });
      }
    }
  }

  // Tastatur-Shortcuts einrichten
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Ctrl+Shift+L für Logout
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        e.preventDefault();
        this.handleLogout();
      }
    });
  }

  // API-Request mit automatischer Auth-Behandlung
  async apiRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      // Auth-Fehler abfangen
      if (response.status === 401) {
        this.handleSessionExpired();
        throw new Error("Authentifizierung erforderlich");
      }

      // Lizenz-Fehler abfangen
      if (response.status === 403) {
        const data = await response.json();
        if (data.licenseError) {
          this.handleLicenseError(data);
          throw new Error("Lizenz-Problem");
        }
      }

      return response;
    } catch (error) {
      console.error("API-Request Fehler:", error);
      throw error;
    }
  }
}

// Auth-Manager global verfügbar machen
window.authManager = new AuthManager();

// Login-Form-Handler (falls auf Login-Seite)
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username")?.value;
      const password = document.getElementById("password")?.value;

      if (username && password) {
        await window.authManager.handleLogin(username, password);
      }
    });
  }

  // Logout-Button-Handler
  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.authManager.handleLogout();
    });
  }
});
