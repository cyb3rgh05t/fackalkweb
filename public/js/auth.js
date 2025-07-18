// public/js/auth.js - Frontend Authentication Management

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.sessionCheckInterval = null;
    this.init();
  }

  // Initialisierung
  init() {
    this.loadUserInfo();
    this.startSessionMonitoring();
    this.setupKeyboardShortcuts();
  }

  // User-Informationen laden und anzeigen
  async loadUserInfo() {
    try {
      const response = await fetch("/api/auth/status");
      const data = await response.json();

      if (data.authenticated && data.user) {
        this.currentUser = data.user;
        this.updateUserDisplay();
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
        const existingBadge = userInfoElement.querySelector(".admin-badge");
        if (!existingBadge) {
          const adminBadge = document.createElement("span");
          adminBadge.className = "admin-badge";
          adminBadge.textContent = "Admin";
          userInfoElement.appendChild(adminBadge);
        }
      }
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
    window.location.href = "/login";
  }

  // Tastatur-Shortcuts einrichten
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      // Ctrl+L für Logout
      if (event.ctrlKey && event.key === "l") {
        event.preventDefault();
        this.handleLogout();
      }

      // Escape für Logout (falls in Modal/Dialog)
      if (event.key === "Escape" && event.ctrlKey && event.shiftKey) {
        event.preventDefault();
        this.handleLogout();
      }
    });
  }

  // Notification anzeigen
  showNotification(message, type = "info") {
    // Prüfen ob bereits eine Notification-Funktion existiert
    if (typeof window.showNotification === "function") {
      window.showNotification(message, type);
      return;
    }

    // Fallback: Eigene Notification erstellen
    window.showNotification(message, type);
  }

  // Notification erstellen (Fallback)
  createNotification(message, type) {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Styling
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "12px 20px",
      borderRadius: "8px",
      color: "white",
      fontWeight: "500",
      zIndex: "9999",
      transform: "translateX(100%)",
      transition: "transform 0.3s ease",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
      maxWidth: "400px",
    });

    // Type-spezifische Farben
    const colors = {
      success: "#1ecb4f",
      error: "#ef4444",
      warning: "#f59e0b",
      info: "#2cabe3",
    };
    notification.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(notification);

    // Animation einblenden
    setTimeout(() => {
      notification.style.transform = "translateX(0)";
    }, 100);

    // Nach 4 Sekunden entfernen
    setTimeout(() => {
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }

  // User-Rolle prüfen
  hasRole(role) {
    return this.currentUser && this.currentUser.role === role;
  }

  // Admin-Rechte prüfen
  isAdmin() {
    return this.hasRole("admin");
  }

  // Aktueller Benutzer abrufen
  getCurrentUser() {
    return this.currentUser;
  }

  // Session-Info anzeigen (Debug)
  showSessionInfo() {
    if (this.currentUser) {
      console.log("Current User:", this.currentUser);
      this.showNotification(
        `Angemeldet als: ${this.currentUser.username} (${this.currentUser.role})`,
        "info"
      );
    } else {
      console.log("No user logged in");
      this.showNotification("Nicht angemeldet", "warning");
    }
  }
}

// Globale Auth-Manager Instanz
let authManager;

// Globale Funktionen für Kompatibilität mit bestehenden Code
window.handleLogout = function () {
  if (authManager) {
    authManager.handleLogout();
  }
};

window.getCurrentUser = function () {
  return authManager ? authManager.getCurrentUser() : null;
};

window.isUserAdmin = function () {
  return authManager ? authManager.isAdmin() : false;
};

// Initialisierung beim Laden der Seite
document.addEventListener("DOMContentLoaded", function () {
  authManager = new AuthManager();

  // Globale Verfügbarkeit für andere Scripts
  window.authManager = authManager;
});

// Export für Module (falls verwendet)
if (typeof module !== "undefined" && module.exports) {
  module.exports = AuthManager;
}
