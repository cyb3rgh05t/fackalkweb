const bcrypt = require("bcrypt");
const User = require("../models/user");
const { LicenseManager } = require("../license/licenseManager");

const authController = {
  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      // Input-Validierung
      if (!username || !password) {
        return res.status(400).json({
          error: "Benutzername und Passwort sind erforderlich",
        });
      }

      // Benutzer in Datenbank suchen
      const user = await User.findByUsername(username);
      if (!user) {
        return res.status(401).json({
          error: "Ungültige Anmeldedaten",
        });
      }

      // Passwort prüfen
      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash
      );
      if (!isValidPassword) {
        return res.status(401).json({
          error: "Ungültige Anmeldedaten",
        });
      }

      console.log(
        "🔑 HARDWARE-DEAKTIVIERUNGS-AWARE Lizenz-Validierung beim Login..."
      );
      const licenseManager = new LicenseManager();

      try {
        const licenseStatus = await licenseManager.validateLicenseOnLogin();

        if (!licenseStatus.valid) {
          console.log("❌ LOGIN VERWEIGERT: Lizenz ungültig");

          let errorMessage = "Ungültige Lizenz";
          let redirectPath = "/license-activation";
          let errorType = "license_invalid";

          if (licenseStatus.needsActivation) {
            errorMessage = "Lizenz-Aktivierung erforderlich";
            redirectPath = "/license-activation";
            errorType = "license_activation_required";
          } else if (licenseStatus.needsReactivation) {
            if (licenseStatus.hardwareDeactivated) {
              // SPEZIELLE BEHANDLUNG FÜR HARDWARE-DEAKTIVIERUNG
              console.log("🚨 HARDWARE-DEAKTIVIERUNG beim Login erkannt!");
              errorMessage = "Hardware-ID wurde deaktiviert";
              errorType = "hardware_deactivated";
              redirectPath = "/license-activation";
            } else {
              errorMessage =
                "Lizenz-Reaktivierung erforderlich: " +
                (licenseStatus.error || "Lizenz ungültig");
              errorType = "license_reactivation_required";
              redirectPath = "/license-activation";
            }
          }

          return res.status(403).json({
            error: errorMessage,
            licenseError: true,
            errorType: errorType,
            hardwareDeactivated: licenseStatus.hardwareDeactivated || false,
            deactivatedAt: licenseStatus.deactivatedAt || null,
            needsActivation: licenseStatus.needsActivation,
            needsReactivation: licenseStatus.needsReactivation,
            redirect: redirectPath,
            details: licenseStatus.error,
          });
        }

        console.log(
          "✅ HARDWARE-DEAKTIVIERUNGS-AWARE Lizenz-Validierung erfolgreich:",
          licenseStatus.message
        );

        const licenseData = licenseStatus.licenseData || {};
        req.session.licenseInfo = {
          validated: true,
          validatedAt: Date.now(),
          offline: licenseStatus.offline || false,
          features: licenseData.features || [],
          expiresAt: licenseData.expires_at || null,
          customerName:
            licenseData.customer_name ||
            licenseData.user_info?.customer_name ||
            "Unbekannt",
          lastOnlineValidation:
            licenseData.last_online_validation || Date.now(),
        };
      } catch (licenseError) {
        console.error(
          "❌ HARDWARE-DEAKTIVIERUNGS-AWARE Lizenz-Validierung fehlgeschlagen:",
          licenseError
        );

        // Prüfen ob es sich um Hardware-Deaktivierung handelt
        if (licenseError.hardwareDeactivated) {
          console.log("🚨 HARDWARE-DEAKTIVIERUNG beim Login-Fehler erkannt!");
          return res.status(403).json({
            error: "Hardware-ID wurde auf dem Server deaktiviert",
            licenseError: true,
            errorType: "hardware_deactivated",
            hardwareDeactivated: true,
            deactivatedAt: licenseError.deactivatedAt || null,
            needsReactivation: true,
            redirect: "/license-activation",
            details: licenseError.message,
          });
        }

        return res.status(500).json({
          error: "Lizenz-Validierung fehlgeschlagen",
          licenseError: true,
          details: licenseError.message,
        });
      }

      // Session erstellen
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.userRole = user.role;
      req.session.save();

      // Login-Zeit aktualisieren
      await User.updateLastLogin(user.id);

      // Erfolgreiche Anmeldung mit Lizenz-Info
      const responseData = {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        license: {
          valid: true,
          message: req.session.licenseInfo?.offline
            ? "Offline-Modus aktiv"
            : "Lizenz online validiert",
          offline: req.session.licenseInfo?.offline || false,
        },
      };

      console.log(
        `✅ LOGIN ERFOLGREICH: ${username} (Lizenz: ${responseData.license.message})`
      );
      res.json(responseData);
    } catch (error) {
      console.error("Login-Fehler:", error);
      res.status(500).json({ error: "Interner Serverfehler" });
    }
  },

  // Logout
  logout: (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout-Fehler:", err);
        return res.status(500).json({ error: "Logout fehlgeschlagen" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true, message: "Erfolgreich abgemeldet" });
    });
  },

  getCurrentUser: async (req, res) => {
    if (req.session && req.session.userId) {
      console.log("🔄 HARDWARE-DEAKTIVIERUNGS-AWARE Session-Check...");

      const licenseManager = new LicenseManager();

      try {
        const licenseStatus = await licenseManager.validateLicenseForSession();

        if (!licenseStatus.valid) {
          console.log(
            "❌ SESSION INVALID: Lizenz nicht mehr gültig - User wird ausgeloggt"
          );

          // Session sofort zerstören
          req.session.destroy((err) => {
            if (err) console.error("Session-Destroy-Fehler:", err);
          });

          let errorType = "license_invalid";
          let errorMessage = licenseStatus.error || "Lizenz nicht mehr gültig";

          if (licenseStatus.hardwareDeactivated) {
            console.log("🚨 HARDWARE-DEAKTIVIERUNG bei Session-Check erkannt!");
            errorType = "hardware_deactivated";
            errorMessage = "Hardware-ID wurde deaktiviert";
          }

          return res.status(403).json({
            authenticated: false,
            licenseError: true,
            errorType: errorType,
            hardwareDeactivated: licenseStatus.hardwareDeactivated || false,
            deactivatedAt: licenseStatus.deactivatedAt || null,
            needsActivation: licenseStatus.needsActivation,
            needsReactivation: licenseStatus.needsReactivation,
            error: errorMessage,
            message: "Session beendet: " + errorMessage,
          });
        }

        console.log("✅ Session-Lizenz-Check erfolgreich");

        const licenseData = licenseStatus.licenseData || {};
        req.session.licenseInfo = {
          validated: true,
          validatedAt: Date.now(),
          offline: licenseStatus.offline || false,
          features: licenseData.features || [],
          expiresAt: licenseData.expires_at || null,
          customerName:
            licenseData.customer_name ||
            licenseData.user_info?.customer_name ||
            "Unbekannt",
          lastOnlineValidation:
            licenseData.last_online_validation || Date.now(),
        };

        // Session speichern
        req.session.save();

        res.json({
          authenticated: true,
          user: {
            id: req.session.userId,
            username: req.session.username,
            role: req.session.userRole,
          },
          license: req.session.licenseInfo || { validated: false },
        });
      } catch (licenseError) {
        console.error("❌ Session-Lizenz-Check fehlgeschlagen:", licenseError);

        // Session beenden
        req.session.destroy((err) => {
          if (err) console.error("Session-Destroy-Fehler:", err);
        });

        let errorType = "license_error";
        let errorMessage =
          "Lizenz-Validierung fehlgeschlagen: " + licenseError.message;

        if (licenseError.hardwareDeactivated) {
          console.log("🚨 HARDWARE-DEAKTIVIERUNG bei Session-Fehler erkannt!");
          errorType = "hardware_deactivated";
          errorMessage = "Hardware-ID wurde deaktiviert";
        }

        return res.status(403).json({
          authenticated: false,
          licenseError: true,
          errorType: errorType,
          hardwareDeactivated: licenseError.hardwareDeactivated || false,
          deactivatedAt: licenseError.deactivatedAt || null,
          error: errorMessage,
          message: "Session beendet: " + errorMessage,
        });
      }
    } else {
      res.json({ authenticated: false });
    }
  },

  // Benutzer erstellen (nur für Admin oder Setup)
  createUser: async (req, res) => {
    try {
      const { username, password, role = "user" } = req.body;

      // Validierung
      if (!username || !password) {
        return res.status(400).json({
          error: "Benutzername und Passwort sind erforderlich",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: "Passwort muss mindestens 6 Zeichen lang sein",
        });
      }

      // Prüfen ob Benutzer bereits existiert
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(409).json({
          error: "Benutzername bereits vergeben",
        });
      }

      // Passwort hashen
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Benutzer erstellen
      const userId = await User.create({
        username,
        password_hash: passwordHash,
        role,
      });

      res.json({
        success: true,
        message: "Benutzer erfolgreich erstellt",
        userId,
      });
    } catch (error) {
      console.error("Benutzer-Erstellung fehlgeschlagen:", error);
      res.status(500).json({ error: "Benutzer-Erstellung fehlgeschlagen" });
    }
  },

  // Benutzername ändern
  changeUsername: async (req, res) => {
    try {
      const { newUsername } = req.body;
      const userId = req.session.userId;

      if (!newUsername) {
        return res.status(400).json({
          error: "Neuer Benutzername ist erforderlich",
        });
      }

      // Prüfen ob Benutzername bereits existiert
      const existingUser = await User.findByUsername(newUsername);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({
          error: "Benutzername bereits vergeben",
        });
      }

      // Benutzername aktualisieren
      await User.updateUsername(userId, newUsername);

      // Session aktualisieren
      req.session.username = newUsername;
      req.session.save();

      res.json({
        success: true,
        message: "Benutzername erfolgreich geändert",
        newUsername,
      });
    } catch (error) {
      console.error("Benutzername-Änderung fehlgeschlagen:", error);
      res.status(500).json({ error: "Benutzername-Änderung fehlgeschlagen" });
    }
  },

  // Passwort ändern
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.session.userId;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: "Aktuelles und neues Passwort sind erforderlich",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          error: "Neues Passwort muss mindestens 6 Zeichen lang sein",
        });
      }

      // Aktuellen Benutzer laden MIT password_hash
      const user = await User.findById(userId, true); // <- HIER: true für password_hash
      if (!user) {
        return res.status(404).json({ error: "Benutzer nicht gefunden" });
      }

      // Aktuelles Passwort prüfen
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password_hash
      );
      if (!isValidPassword) {
        return res.status(401).json({
          error: "Aktuelles Passwort ist falsch",
        });
      }

      // Neues Passwort hashen
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Passwort aktualisieren
      await User.updatePassword(userId, newPasswordHash);

      res.json({
        success: true,
        message: "Passwort erfolgreich geändert",
      });
    } catch (error) {
      console.error("Passwort-Änderung fehlgeschlagen:", error);
      res.status(500).json({ error: "Passwort-Änderung fehlgeschlagen" });
    }
  },

  // Alle Benutzer abrufen (nur für Admins)
  getAllUsers: async (req, res) => {
    try {
      console.log("🔄 getAllUsers aufgerufen von Admin:", req.session.username);

      const users = await User.findAll();
      console.log(`📊 ${users.length} Benutzer gefunden`);

      res.json(users);
    } catch (error) {
      console.error("❌ Fehler beim Laden aller Benutzer:", error);
      res.status(500).json({ error: "Fehler beim Laden der Benutzer" });
    }
  },

  // Benutzer aktivieren
  activateUser: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`🔄 activateUser aufgerufen für ID: ${id}`);

      // Prüfen ob User existiert
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: "Benutzer nicht gefunden" });
      }

      // Benutzer aktivieren
      await User.setActiveStatus(id, true);
      console.log(`✅ Benutzer ${user.username} (ID: ${id}) aktiviert`);

      res.json({
        success: true,
        message: "Benutzer erfolgreich aktiviert",
      });
    } catch (error) {
      console.error("❌ Fehler beim Aktivieren des Benutzers:", error);
      res.status(500).json({ error: "Fehler beim Aktivieren des Benutzers" });
    }
  },

  // Benutzer deaktivieren (nur Admin)
  deactivateUser: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`🔄 deactivateUser aufgerufen für ID: ${id}`);

      // Prüfen ob User existiert
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: "Benutzer nicht gefunden" });
      }

      // Admin-Schutz: Admins können nicht deaktiviert werden
      if (user.role === "admin") {
        return res.status(403).json({
          error: "Administrator-Accounts können nicht deaktiviert werden",
        });
      }

      // Selbst-Deaktivierung verhindern
      if (parseInt(id) === req.session.userId) {
        return res.status(403).json({
          error: "Sie können sich nicht selbst deaktivieren",
        });
      }

      // Benutzer deaktivieren
      await User.setActiveStatus(id, false);
      console.log(`✅ Benutzer ${user.username} (ID: ${id}) deaktiviert`);

      res.json({
        success: true,
        message: "Benutzer erfolgreich deaktiviert",
      });
    } catch (error) {
      console.error("❌ Fehler beim Deaktivieren des Benutzers:", error);
      res.status(500).json({ error: "Fehler beim Deaktivieren des Benutzers" });
    }
  },

  // Benutzer löschen (soft delete)
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`🔄 deleteUser aufgerufen für ID: ${id}`);

      // Prüfen ob User existiert
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: "Benutzer nicht gefunden" });
      }

      // Admin-Schutz: Admins können nicht gelöscht werden
      if (user.role === "admin") {
        return res.status(403).json({
          error: "Administrator-Accounts können nicht gelöscht werden",
        });
      }

      // Selbst-Löschung verhindern
      if (parseInt(id) === req.session.userId) {
        return res.status(403).json({
          error: "Sie können sich nicht selbst löschen",
        });
      }

      // Benutzer löschen
      await User.delete(id);
      console.log(`✅ Benutzer ${user.username} (ID: ${id}) gelöscht`);

      res.json({
        success: true,
        message: "Benutzer erfolgreich gelöscht",
      });
    } catch (error) {
      console.error("❌ Fehler beim Löschen des Benutzers:", error);
      res.status(500).json({ error: "Fehler beim Löschen des Benutzers" });
    }
  },

  logoutAll: (req, res) => {
    try {
      console.log(
        `🔄 Logout-All für Benutzer: ${req.session.username} (ID: ${req.session.userId})`
      );

      // Aktuelle Session zerstören
      req.session.destroy((err) => {
        if (err) {
          console.error("❌ Logout-All Fehler:", err);
          return res.status(500).json({
            error: "Logout-All fehlgeschlagen",
            details: err.message,
          });
        }

        // Cookie löschen
        res.clearCookie("connect.sid");

        console.log("✅ Logout-All erfolgreich - Alle Sitzungen beendet");

        res.json({
          success: true,
          message: "Erfolgreich von allen Geräten abgemeldet",
        });
      });
    } catch (error) {
      console.error("❌ Logout-All kritischer Fehler:", error);
      res.status(500).json({
        error: "Interner Serverfehler beim Logout-All",
        details: error.message,
      });
    }
  },
};

module.exports = authController;
