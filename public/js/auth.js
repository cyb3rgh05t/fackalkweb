class AuthManager {
  constructor() {
    this.currentUser = null;
    this.licenseInfo = null;
    this.sessionCheckInterval = null;
    this.quickCheckInterval = null;
    this.init();
  }

  // Initialisierung
  init() {
    this.loadUserInfo();
    this.startImmediateSessionMonitoring();
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
        // Prüfen ob Hardware-Deaktivierungs-Fehler vorliegt
        if (data.licenseError && data.errorType === "hardware_deactivated") {
          console.log("🚨 HARDWARE-DEAKTIVIERUNG beim Laden erkannt!");
          this.handleHardwareDeactivationError(data);
        } else if (data.licenseError) {
          console.log("❌ Lizenz-Fehler beim Laden:", data.error);
          this.handleStrictLicenseError(data);
        } else {
          // Nicht eingeloggt - zur Login-Seite weiterleiten
          this.redirectToLogin();
        }
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

  // Lizenz-Status anzeigen
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

  // Lizenz-Benachrichtigungen prüfen
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

  // Login-Verarbeitung MIT HARDWARE-DEAKTIVIERUNGS-BEHANDLUNG
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
          if (data.errorType === "hardware_deactivated") {
            // SPEZIELLE HARDWARE-DEAKTIVIERUNGS-BEHANDLUNG
            console.log("🚨 HARDWARE-DEAKTIVIERUNG beim Login erkannt!");
            this.handleHardwareDeactivationError(data);
          } else {
            // Normale Lizenz-Fehler
            this.handleStrictLicenseError(data);
          }
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

  handleHardwareDeactivationError(errorData) {
    console.error("🚨 HARDWARE-DEAKTIVIERUNG ERKANNT:", errorData);

    // Session sofort beenden
    this.stopAllMonitoring();
    this.currentUser = null;
    this.licenseInfo = null;

    const deactivatedAt = errorData.deactivatedAt
      ? new Date(errorData.deactivatedAt).toLocaleString()
      : "Unbekannt";

    // SOFORTIGE SICHTBARE WARNUNG
    this.showCriticalAlert("🚨 HARDWARE-DEAKTIVIERUNG ERKANNT!", "critical");

    const criticalMessage = `🚨 KRITISCHER SICHERHEITSALARM!

HARDWARE-ID DEAKTIVIERT

Ihre Hardware-ID wurde auf dem License-Server deaktiviert.

📅 Deaktiviert am: ${deactivatedAt}

⚠️ GRUND DER DEAKTIVIERUNG:
Ihre Hardware-ID wurde vom Administrator manuell deaktiviert.

🔒 SOFORTIGE SICHERHEITSMASSNAHMEN:
• Alle Sessions wurden beendet
• Zugriff auf das System ist gesperrt
• Keine weitere Nutzung möglich

📞 ERFORDERLICHE SCHRITTE:
1. Kontaktieren Sie sofort Ihren Administrator
2. Klären Sie den Grund der Deaktivierung
3. Beantragen Sie eine manuelle Reaktivierung

Details: ${errorData.details || errorData.error}

Sie werden zur Lizenz-Verwaltung weitergeleitet.`;

    // Mehrere Alerts für maximale Sichtbarkeit
    alert(criticalMessage);

    // Zweite Bestätigung
    const actionMessage = `🔧 REAKTIVIERUNGS-ANWEISUNGEN:

WICHTIG: Die Hardware-ID wurde vom Administrator deaktiviert!

KONTAKT-OPTIONEN:
• Administrator: admin@meinefirma.dev
• Support-Hotline: verfügbar
• Lizenz-Problem-Ticket erstellen

MANUELLE REAKTIVIERUNG:
Falls Sie berechtigt sind, können Sie versuchen:
• Neue Lizenz-Aktivierung
• Hardware-ID-Reaktivierung beantragen

Zur Lizenz-Verwaltung gehen?`;

    if (confirm(actionMessage)) {
      window.location.href = "/license-activation";
    } else {
      // Nochmalige Warnung
      alert(
        "⚠️ ZUGRIFF GESPERRT!\n\nSie können sich erst nach der Hardware-Reaktivierung wieder anmelden.\n\nKontaktieren Sie Ihren Administrator!"
      );
      window.location.href = "/login";
    }
  }

  handleStrictLicenseError(errorData) {
    console.error("Lizenz-Fehler:", errorData);

    // Session beenden
    this.stopAllMonitoring();

    let title = "🔒 LIZENZ-PROBLEM";
    let message = errorData.error || "Unbekanntes Lizenz-Problem";
    let severity = "error";

    if (errorData.needsActivation) {
      title = "🔑 Lizenz-Aktivierung erforderlich";
      message =
        "Keine gültige Lizenz gefunden. Bitte aktivieren Sie Ihre Lizenz.";
      severity = "warning";
    } else if (errorData.needsReactivation) {
      title = "🔄 Lizenz-Reaktivierung erforderlich";
      message = `Ihre Lizenz muss reaktiviert werden.\n\nDetails: ${
        errorData.details || errorData.error
      }`;
      severity = "error";
    }

    // Standard-Lizenz-Fehler-Dialog
    this.showStandardLicenseError(title, message, severity);
  }

  showCriticalAlert(message, type = "critical") {
    console.error(`🚨 KRITISCHER ALERT: ${message}`);

    // Versuche Browser-Benachrichtigung
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("🚨 SICHERHEITSALARM - KFZ-App", {
          body: message,
          icon: "/favicon.ico",
          requireInteraction: true,
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification("🚨 SICHERHEITSALARM - KFZ-App", {
              body: message,
              icon: "/favicon.ico",
              requireInteraction: true,
            });
          }
        });
      }
    }

    // Zusätzlich: Titel des Browser-Tabs ändern
    if (document.title) {
      document.title = "🚨 HARDWARE DEAKTIVIERT - " + document.title;
    }
  }

  // Standard-Lizenz-Fehler-Dialog
  showStandardLicenseError(title, message, severity = "error") {
    const icon = severity === "error" ? "❌" : "⚠️";
    const fullMessage = `${icon} ${title}\n\n${message}\n\nSie werden zur Lizenz-Verwaltung weitergeleitet.`;

    alert(fullMessage);

    const actionMessage =
      `Möchten Sie zur Lizenz-Verwaltung?\n\n` +
      `Dort können Sie:\n` +
      `• Eine neue Lizenz aktivieren\n` +
      `• Bestehende Lizenz reaktivieren\n` +
      `• Support-Informationen finden`;

    if (confirm(actionMessage)) {
      window.location.href = "/license-activation";
    } else {
      window.location.href = "/login";
    }
  }

  // SOFORTIGE SESSION-ÜBERWACHUNG
  startImmediateSessionMonitoring() {
    console.log(
      "⚡ SOFORTIGE Session-Überwachung gestartet (Hardware-Deaktivierung wird SOFORT erkannt)"
    );

    this.sessionCheckInterval = setInterval(async () => {
      await this.performSessionCheck("30sec");
    }, 30 * 1000);

    this.quickCheckInterval = setInterval(async () => {
      await this.performSessionCheck("15sec");
    }, 15 * 1000);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        console.log("👁️ Tab wieder aktiv - SOFORTIGER Session-Check...");
        setTimeout(() => this.performSessionCheck("visibility"), 100); // 100ms statt 1000ms
      }
    });

    window.addEventListener("focus", () => {
      console.log("🎯 Fenster Focus - SOFORTIGER Session-Check...");
      setTimeout(() => this.performSessionCheck("focus"), 50); // 50ms statt 500ms
    });

    let lastActivity = Date.now();
    document.addEventListener("mousemove", () => {
      const now = Date.now();
      if (now - lastActivity > 60000) {
        // Alle 60 Sekunden bei Aktivität
        lastActivity = now;
        console.log("🖱️ Benutzer-Aktivität - Session-Check...");
        setTimeout(() => this.performSessionCheck("activity"), 100);
      }
    });

    document.addEventListener("keydown", () => {
      const now = Date.now();
      if (now - lastActivity > 60000) {
        // Alle 60 Sekunden bei Aktivität
        lastActivity = now;
        console.log("⌨️ Keyboard-Aktivität - Session-Check...");
        setTimeout(() => this.performSessionCheck("keyboard"), 100);
      }
    });
  }

  async performSessionCheck(type = "normal") {
    try {
      // Bei bestimmten Check-Typen zusätzliche Logs
      if (type !== "15sec") {
        console.log(`🔄 SOFORTIGER Session-Check (${type})...`);
      }

      const response = await fetch("/api/auth/status");
      const data = await response.json();

      if (!data.authenticated) {
        console.log(`❌ Session ungültig (${type}) - Analysiere Ursache...`);

        if (data.licenseError && data.errorType === "hardware_deactivated") {
          // HARDWARE-DEAKTIVIERUNG bei Session-Check
          console.log(
            `🚨 HARDWARE-DEAKTIVIERUNG bei Session-Check (${type}) erkannt!`
          );
          this.handleHardwareDeactivationError(data);
        } else if (data.licenseError) {
          // Andere Lizenz-Fehler
          console.log(
            `❌ Lizenz-Fehler bei Session-Check (${type}):`,
            data.error
          );
          this.handleStrictLicenseError(data);
        } else {
          // Normale Session-Expiration
          console.log(`⏰ Session-Ablauf bei (${type})`);
          this.handleSessionExpired();
        }
      } else {
        // Session gültig - Lizenz-Info aktualisieren
        this.licenseInfo = data.license || null;

        // Nur bei wichtigen Checks loggen
        if (type === "visibility" || type === "focus" || type === "30sec") {
          console.log(`✅ Session gültig (${type})`);
        }
      }
    } catch (error) {
      console.error(`Session-Check fehlgeschlagen (${type}):`, error);

      // Bei kritischen Check-Typen Session als ungültig behandeln
      if (type === "30sec" || type === "visibility" || type === "focus") {
        console.log(`❌ Kritischer Session-Check-Fehler (${type}) - Logout`);
        this.handleSessionExpired();
      }
    }
  }

  // Alle Überwachung stoppen
  stopAllMonitoring() {
    console.log("🛑 Stoppe alle Session-Überwachung");

    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }

    if (this.quickCheckInterval) {
      clearInterval(this.quickCheckInterval);
      this.quickCheckInterval = null;
    }
  }

  // Session-Überwachung stoppen (Legacy-Kompatibilität)
  stopSessionMonitoring() {
    this.stopAllMonitoring();
  }

  // Logout-Funktionalität (unverändert)
  async handleLogout() {
    if (!confirm("Möchten Sie sich wirklich abmelden?")) {
      return;
    }

    const logoutBtn = document.querySelector(".logout-btn");
    if (!logoutBtn) return;

    try {
      const originalHTML = logoutBtn.innerHTML;
      logoutBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> <span class="logout-text">Abmelden...</span>';
      logoutBtn.disabled = true;

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        this.showNotification("Erfolgreich abgemeldet", "success");
        this.stopAllMonitoring();

        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      } else {
        throw new Error("Logout fehlgeschlagen");
      }
    } catch (error) {
      console.error("Logout-Fehler:", error);

      this.showNotification("Abgemeldet", "info");
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }

  // Session abgelaufen
  handleSessionExpired() {
    this.stopAllMonitoring();
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

    if (type === "error") {
      console.error(message);
    } else if (type === "warning") {
      console.warn(message);
    } else {
      console.info(message);
    }

    // Browser-Benachrichtigung für wichtige Meldungen
    if (options.persistent && type === "warning") {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("KFZ-App", {
          body: message,
          icon: "/favicon.ico",
          requireInteraction: true,
        });
      }
    }
  }

  // Tastatur-Shortcuts einrichten
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
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
          if (data.errorType === "hardware_deactivated") {
            this.handleHardwareDeactivationError(data);
          } else {
            this.handleStrictLicenseError(data);
          }
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
