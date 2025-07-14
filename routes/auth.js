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
    const authDb = require("../middleware/auth").authDb();
    authDb.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
  }

  res.clearCookie("session_id");
  res.json({
    success: true,
    message: "Logout erfolgreich",
  });
});

// Session-Status prüfen
router.get("/session-check", (req, res) => {
  const sessionId = req.cookies?.session_id;

  if (!sessionId) {
    return res.status(401).json({
      error: "Keine Session gefunden",
    });
  }

  // Hier könntest du die Session validieren
  // Für jetzt einfach OK zurückgeben
  res.json({
    success: true,
    message: "Session gültig",
  });
});

// Lizenz-Status
router.get("/license-status", (req, res) => {
  // Placeholder für Lizenz-Check
  res.json({
    license: {
      expires_at: "2025-12-31",
      max_customers: 100,
      max_vehicles: 500,
      current_customers: 25,
      current_vehicles: 80,
    },
  });
});

module.exports = router;
