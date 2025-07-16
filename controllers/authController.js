// controllers/authController.js
const bcrypt = require("bcrypt");
const User = require("../models/user");

const authController = {
  // Login-Verarbeitung
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

      // Session erstellen
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.userRole = user.role;
      req.session.save();

      // Login-Zeit aktualisieren
      await User.updateLastLogin(user.id);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
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
      res.clearCookie("connect.sid"); // Session-Cookie löschen
      res.json({ success: true, message: "Erfolgreich abgemeldet" });
    });
  },

  // Aktuellen Benutzer abrufen
  getCurrentUser: (req, res) => {
    if (req.session && req.session.userId) {
      res.json({
        authenticated: true,
        user: {
          id: req.session.userId,
          username: req.session.username,
          role: req.session.userRole,
        },
      });
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

      // Aktueller Benutzer abrufen
      const user = await User.findById(userId);
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

      // Neues Passwort hashen und speichern
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

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
};

module.exports = authController;
