// middleware/auth.js - Authentication Middleware
const requireAuth = (req, res, next) => {
  // Prüfen ob Benutzer eingeloggt ist
  if (req.session && req.session.userId) {
    return next();
  } else {
    // Bei API-Anfragen JSON-Fehler zurückgeben
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({
        error: "Authentifizierung erforderlich",
        redirect: "/login",
      });
    }
    // Bei normalen Anfragen zur Login-Seite weiterleiten
    return res.redirect("/login");
  }
};

// Optional: Admin-Rechte prüfen
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.userRole === "admin") {
    return next();
  } else {
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({
        error: "Admin-Rechte erforderlich",
      });
    }
    return res.status(403).send("Zugriff verweigert");
  }
};

// User-Informationen an Request anhängen
const attachUser = (req, res, next) => {
  if (req.session && req.session.userId) {
    req.user = {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.userRole || "user",
    };
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  attachUser,
};
