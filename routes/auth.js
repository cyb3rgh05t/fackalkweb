// routes/auth.js
const express = require("express");
const { login, authDb } = require("../middleware/auth");
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
    try {
      authDb().run("DELETE FROM sessions WHERE id = ?", [sessionId], (err) => {
        if (err) {
          console.error("Session-Löschung fehlgeschlagen:", err);
        }
      });
    } catch (error) {
      console.error("Fehler beim Zugriff auf authDb:", error);
    }
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
           WHERE l.user_id = ?`,
          [session.user_id],
          (err, license) => {
            if (err) {
              console.error("Lizenz-Status Fehler:", err);
              return res.status(500).json({ error: "Server-Fehler" });
            }

            res.json({
              success: true,
              license: license || null,
              message: "Lizenz-Status abgerufen",
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

// Demo-User erstellen (für Development)
router.post("/create-demo-user", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res
      .status(403)
      .json({ error: "Nur im Development-Modus verfügbar" });
  }

  try {
    const bcrypt = require("bcrypt");
    const crypto = require("crypto");

    const demoPassword = "demo123";
    const passwordHash = await bcrypt.hash(demoPassword, 10);
    const dbName = `demo_${Date.now()}`;

    // Demo-User erstellen
    authDb().run(
      "INSERT INTO users (username, email, password_hash, role, database_name) VALUES (?, ?, ?, ?, ?)",
      ["demo", `demo_${Date.now()}@localhost`, passwordHash, "user", dbName],
      function (err) {
        if (err) {
          console.error("Demo-User Fehler:", err);
          return res
            .status(500)
            .json({ error: "Fehler beim Erstellen des Demo-Users" });
        }

        const userId = this.lastID;

        // Demo-Lizenz erstellen
        const licenseKey = `DEMO-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 8)
          .toUpperCase()}`;
        const expiresAt = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(); // 30 Tage

        authDb().run(
          "INSERT INTO licenses (user_id, license_key, expires_at, is_active, max_customers, max_vehicles) VALUES (?, ?, ?, 1, 50, 200)",
          [userId, licenseKey, expiresAt],
          (err) => {
            if (err) {
              console.error("Demo-Lizenz Fehler:", err);
              return res
                .status(500)
                .json({ error: "Fehler beim Erstellen der Demo-Lizenz" });
            }

            res.json({
              success: true,
              demo_user: {
                username: "demo",
                password: demoPassword,
                license_key: licenseKey,
                expires_at: expiresAt,
              },
              message: "Demo-User erstellt",
            });
          }
        );
      }
    );
  } catch (error) {
    console.error("Demo-User Fehler:", error);
    res.status(500).json({
      error: "Server-Fehler beim Erstellen des Demo-Users",
    });
  }
});

module.exports = router;
