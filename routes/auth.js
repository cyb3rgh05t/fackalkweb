// routes/auth.js
const express = require("express");
const { login } = require("../middleware/auth");
const router = express.Router();

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Username und Passwort erforderlich",
      });
    }

    const result = await login(username, password);

    // Session Cookie setzen
    res.cookie("session_id", result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24h
      sameSite: "strict",
    });

    res.json({
      success: true,
      user: result.user,
      sessionId: result.sessionId,
      message: "Login erfolgreich",
    });
  } catch (error) {
    console.error("Login-Fehler:", error);
    res.status(401).json({
      error: error.message || "Login fehlgeschlagen",
    });
  }
});

// Logout
router.post("/logout", (req, res) => {
  const sessionId = req.cookies?.session_id;

  if (sessionId) {
    const { authDb } = require("../middleware/auth");
    authDb().run("DELETE FROM sessions WHERE id = ?", [sessionId], (err) => {
      if (err) {
        console.error("Session-Löschung fehlgeschlagen:", err);
      }
    });
  }

  res.clearCookie("session_id");
  res.json({
    success: true,
    message: "Logout erfolgreich",
  });
});

// Session-Status prüfen
router.get("/session-check", async (req, res) => {
  try {
    const sessionId = req.cookies?.session_id;

    if (!sessionId) {
      return res.status(401).json({
        error: "Keine Session gefunden",
      });
    }

    const { authDb } = require("../middleware/auth");

    // Session validieren
    authDb().get(
      "SELECT s.*, u.id as user_id, u.username, u.email, u.role, u.is_active, u.database_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?",
      [sessionId],
      async (err, session) => {
        if (err) {
          console.error("Session-Check Fehler:", err);
          return res.status(500).json({ error: "Server-Fehler" });
        }

        if (!session || new Date() > new Date(session.expires_at)) {
          return res.status(401).json({
            error: "Session abgelaufen",
          });
        }

        if (!session.is_active) {
          return res.status(401).json({
            error: "Benutzer deaktiviert",
          });
        }

        // Lizenz-Check für normale User
        if (session.role !== "admin") {
          authDb().get(
            "SELECT * FROM licenses WHERE user_id = ? AND is_active = 1",
            [session.user_id],
            (err, license) => {
              if (err) {
                console.error("Lizenz-Check Fehler:", err);
                return res.status(500).json({ error: "Server-Fehler" });
              }

              if (!license || new Date() > new Date(license.expires_at)) {
                return res.status(403).json({
                  error: "Lizenz abgelaufen",
                  action: "renew_license",
                  expires_at: license?.expires_at,
                });
              }

              res.json({
                success: true,
                user: {
                  id: session.user_id,
                  username: session.username,
                  email: session.email,
                  role: session.role,
                  database_name: session.database_name,
                },
                license: {
                  expires_at: license.expires_at,
                  is_active: license.is_active,
                },
                message: "Session gültig",
              });
            }
          );
        } else {
          // Admin - keine Lizenz-Prüfung nötig
          res.json({
            success: true,
            user: {
              id: session.user_id,
              username: session.username,
              email: session.email,
              role: session.role,
              database_name: session.database_name,
            },
            message: "Session gültig",
          });
        }
      }
    );
  } catch (error) {
    console.error("Session-Check Fehler:", error);
    res.status(500).json({
      error: "Server-Fehler bei Session-Check",
    });
  }
});

// Lizenz-Status abrufen
router.get("/license-status", async (req, res) => {
  try {
    const sessionId = req.cookies?.session_id;

    if (!sessionId) {
      return res.status(401).json({
        error: "Nicht authentifiziert",
      });
    }

    const { authDb } = require("../middleware/auth");

    // User über Session ermitteln
    authDb().get(
      "SELECT user_id FROM sessions WHERE id = ? AND expires_at > datetime('now')",
      [sessionId],
      (err, session) => {
        if (err || !session) {
          return res.status(401).json({ error: "Ungültige Session" });
        }

        // Lizenz-Daten abrufen
        authDb().get(
          `SELECT l.*, u.role 
           FROM licenses l 
           JOIN users u ON l.user_id = u.id 
           WHERE l.user_id = ? AND l.is_active = 1`,
          [session.user_id],
          (err, license) => {
            if (err) {
              console.error("Lizenz-Status Fehler:", err);
              return res.status(500).json({ error: "Server-Fehler" });
            }

            if (!license) {
              return res.status(404).json({
                error: "Keine Lizenz gefunden",
              });
            }

            const expires = new Date(license.expires_at);
            const now = new Date();
            const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

            res.json({
              license: {
                expires_at: license.expires_at,
                is_active: license.is_active,
                days_remaining: Math.max(0, daysLeft),
                is_expired: expires <= now,
                license_key: license.license_key,
              },
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("Lizenz-Status Fehler:", error);
    res.status(500).json({
      error: "Server-Fehler bei Lizenz-Status",
    });
  }
});

// Demo-User erstellen (nur in Development)
router.post("/create-demo-user", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      error: "Demo-User Erstellung nur in Development möglich",
    });
  }

  try {
    const bcrypt = require("bcrypt");
    const crypto = require("crypto");
    const { authDb } = require("../middleware/auth");

    const demoPassword = "demo123";
    const passwordHash = await bcrypt.hash(demoPassword, 10);
    const demoDbName = `demo_user_${Date.now()}`;

    authDb().run(
      "INSERT OR IGNORE INTO users (username, email, password_hash, role, database_name) VALUES (?, ?, ?, ?, ?)",
      ["demo", "demo@faf-lackiererei.de", passwordHash, "user", demoDbName],
      function (err) {
        if (err) {
          console.error("Demo-User Erstellung fehlgeschlagen:", err);
          return res
            .status(500)
            .json({ error: "Demo-User Erstellung fehlgeschlagen" });
        }

        if (this.lastID) {
          // Demo-Lizenz erstellen (1 Jahr)
          const licenseKey = `DEMO-LICENSE-${Date.now()}`;
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);

          authDb().run(
            "INSERT INTO licenses (user_id, license_key, expires_at) VALUES (?, ?, ?)",
            [this.lastID, licenseKey, expiresAt.toISOString()],
            (err) => {
              if (err) {
                console.error("Demo-Lizenz Erstellung fehlgeschlagen:", err);
              } else {
                console.log("✅ Demo-User erstellt (demo/demo123)");
              }
            }
          );
        }

        res.json({
          success: true,
          message: "Demo-User erstellt",
          credentials: {
            username: "demo",
            password: "demo123",
          },
        });
      }
    );
  } catch (error) {
    console.error("Demo-User Fehler:", error);
    res.status(500).json({
      error: "Fehler bei Demo-User Erstellung",
    });
  }
});

// Session-Cleanup (abgelaufene Sessions löschen)
router.post("/cleanup-sessions", async (req, res) => {
  try {
    const { authDb } = require("../middleware/auth");

    authDb().run(
      "DELETE FROM sessions WHERE expires_at <= datetime('now')",
      [],
      function (err) {
        if (err) {
          console.error("Session-Cleanup Fehler:", err);
          return res.status(500).json({ error: "Cleanup fehlgeschlagen" });
        }

        res.json({
          success: true,
          message: `${this.changes} abgelaufene Sessions gelöscht`,
          deleted_sessions: this.changes,
        });
      }
    );
  } catch (error) {
    console.error("Session-Cleanup Fehler:", error);
    res.status(500).json({
      error: "Server-Fehler bei Session-Cleanup",
    });
  }
});

// Passwort ändern
router.put("/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const sessionId = req.cookies?.session_id;

    if (!sessionId) {
      return res.status(401).json({ error: "Nicht authentifiziert" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Aktuelles und neues Passwort erforderlich",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "Neues Passwort muss mindestens 6 Zeichen lang sein",
      });
    }

    const bcrypt = require("bcrypt");
    const { authDb } = require("../middleware/auth");

    // User über Session ermitteln
    authDb().get(
      "SELECT u.* FROM users u JOIN sessions s ON u.id = s.user_id WHERE s.id = ?",
      [sessionId],
      async (err, user) => {
        if (err || !user) {
          return res.status(401).json({ error: "Ungültige Session" });
        }

        // Aktuelles Passwort prüfen
        const passwordValid = await bcrypt.compare(
          currentPassword,
          user.password_hash
        );
        if (!passwordValid) {
          return res.status(400).json({
            error: "Aktuelles Passwort ist falsch",
          });
        }

        // Neues Passwort hashen und speichern
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        authDb().run(
          "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
          [newPasswordHash, user.id],
          function (err) {
            if (err) {
              console.error("Passwort-Update Fehler:", err);
              return res
                .status(500)
                .json({ error: "Passwort-Update fehlgeschlagen" });
            }

            res.json({
              success: true,
              message: "Passwort erfolgreich geändert",
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("Passwort-Änderung Fehler:", error);
    res.status(500).json({
      error: "Server-Fehler bei Passwort-Änderung",
    });
  }
});

module.exports = router;
