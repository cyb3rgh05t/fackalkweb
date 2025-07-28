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

const requireAdmin = (req, res, next) => {
  console.log("🔄 requireAdmin Middleware aufgerufen");
  console.log("Session User ID:", req.session?.userId);
  console.log("Session User Role:", req.session?.userRole);
  console.log("Request Path:", req.path);

  if (req.session && req.session.userId && req.session.userRole === "admin") {
    console.log("✅ Admin-Berechtigung bestätigt");

    // User-Info an Request anhängen
    req.user = {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.userRole,
    };

    return next();
  } else {
    console.log("❌ Admin-Berechtigung verweigert");

    if (req.path.startsWith("/api/")) {
      return res.status(403).json({
        error: "Admin-Rechte erforderlich",
        debug: {
          hasSession: !!req.session,
          hasUserId: !!req.session?.userId,
          userRole: req.session?.userRole,
        },
      });
    }
    return res
      .status(403)
      .send("Zugriff verweigert - Admin-Rechte erforderlich");
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
