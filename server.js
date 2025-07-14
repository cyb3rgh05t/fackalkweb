// server.js - FAF Lackiererei Multi-Tenant System
const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const fs = require("fs");

// Auth-System initialisieren
const { requireAuth, initAuthDb } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;

console.log("🚀 Starting FAF Lackiererei Multi-Tenant System...");

// ===========================================
// MIDDLEWARE SETUP
// ===========================================

// CORS konfigurieren
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://yourdomain.com"]
        : ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie Parser für Sessions
app.use(cookieParser());

// Sicherheits-Headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  next();
});

// Request Logging (vereinfacht)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// ===========================================
// MULTER SETUP (File Uploads)
// ===========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Nur Bilder und Dokumente sind erlaubt"));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 5,
  },
  fileFilter: fileFilter,
});

// ===========================================
// DATABASE DIRECTORIES
// ===========================================

// Datenbank-Verzeichnisse erstellen
const dataDir = path.join(__dirname, "data");
const userDbDir = path.join(dataDir, "users");
const backupDir = path.join(__dirname, "backups");

[dataDir, userDbDir, backupDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Verzeichnis erstellt: ${dir}`);
  }
});

// ===========================================
// ROUTES SETUP
// ===========================================

// Auth-Routen (öffentlich zugänglich)
app.use("/api/auth", require("./routes/auth"));

// Admin-Routen (Admin-Berechtigung erforderlich)
app.use("/api/admin", require("./routes/admin"));

// Geschützte API-Routen (User-Authentifizierung erforderlich)
app.use("/api/kunden", requireAuth, require("./routes/kunden"));
app.use("/api/fahrzeuge", requireAuth, require("./routes/fahrzeuge"));
app.use("/api/auftraege", requireAuth, require("./routes/auftraege"));
app.use("/api/rechnungen", requireAuth, require("./routes/rechnungen"));
app.use("/api/einstellungen", requireAuth, require("./routes/einstellungen"));

// System-Status Route (ungeschützt für Health Checks)
app.get("/api/system/status", (req, res) => {
  res.json({
    status: "online",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    auth_system: "active",
    multi_tenant: "enabled",
  });
});

// Health Check Route
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: "connected",
      auth: "active",
      file_system: "accessible",
    },
  });
});

// File Upload Route (geschützt)
app.post("/api/upload", requireAuth, upload.array("files", 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Keine Dateien hochgeladen" });
    }

    const uploadedFiles = req.files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      path: `/uploads/${file.filename}`,
    }));

    res.json({
      success: true,
      message: `${uploadedFiles.length} Datei(en) erfolgreich hochgeladen`,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error("Upload-Fehler:", error);
    res.status(500).json({ error: "Upload fehlgeschlagen" });
  }
});

// Uploads statisch bereitstellen (geschützt)
app.use(
  "/uploads",
  requireAuth,
  express.static(path.join(__dirname, "uploads"))
);

// ===========================================
// STATIC FILES
// ===========================================

// Statische Dateien mit erweiterten Headers
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : "0",
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Cache-Control für verschiedene Dateitypen
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else if (filePath.match(/\.(css|js)$/)) {
        res.setHeader("Cache-Control", "public, max-age=86400"); // 1 Tag
      } else if (filePath.match(/\.(png|jpg|jpeg|gif|ico|svg)$/)) {
        res.setHeader("Cache-Control", "public, max-age=604800"); // 1 Woche
      }
    },
  })
);

// ===========================================
// PAGE ROUTES
// ===========================================

// Root-Route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Login-Route
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Admin-Route
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ===========================================
// ERROR HANDLERS
// ===========================================

// 404 Handler für API-Routen
app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: "API-Endpunkt nicht gefunden",
    requested: req.originalUrl,
    method: req.method,
    available_endpoints: [
      "/api/auth/login",
      "/api/auth/logout",
      "/api/auth/session-check",
      "/api/kunden",
      "/api/fahrzeuge",
      "/api/auftraege",
      "/api/rechnungen",
      "/api/einstellungen",
      "/api/admin/users",
      "/api/system/status",
      "/api/health",
    ],
    documentation: "Siehe API-Dokumentation für verfügbare Endpunkte",
  });
});

// 404 Handler für normale Routen (SPA Fallback)
app.get("*", (req, res) => {
  // Prüfen ob die Route zu einer gültigen HTML-Seite gehört
  const validRoutes = [
    "/",
    "/login",
    "/admin",
    "/index.html",
    "/login.html",
    "/admin.html",
  ];
  const requestedPath = req.path;

  if (
    validRoutes.includes(requestedPath) ||
    requestedPath.startsWith("/css/") ||
    requestedPath.startsWith("/js/")
  ) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  } else {
    res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>404 - Seite nicht gefunden</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #e74c3c; }
            .back-link { color: #3498db; text-decoration: none; margin-top: 1rem; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>404 - Seite nicht gefunden</h1>
            <p>Die angeforderte Seite <strong>${requestedPath}</strong> existiert nicht.</p>
            <a href="/" class="back-link">← Zurück zur Startseite</a>
          </div>
        </body>
      </html>
    `);
  }
});

// Globaler Error Handler
app.use((err, req, res, next) => {
  console.error("Unbehandelter Fehler:", err.stack);

  // Multer-Fehler spezifisch behandeln
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Datei zu groß (max. 2MB)" });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "Zu viele Dateien (max. 5)" });
    }
    return res.status(400).json({ error: "Upload-Fehler: " + err.message });
  }

  // Andere bekannte Fehler
  if (err.message === "Nur Bilder und Dokumente sind erlaubt") {
    return res.status(400).json({ error: err.message });
  }

  // Unbekannte Fehler
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Interner Serverfehler"
        : err.message,
    timestamp: new Date().toISOString(),
    requestId: req.id || Date.now(),
  });
});

// ===========================================
// SESSION CLEANUP JOB
// ===========================================

// Automatische Session-Bereinigung alle 6 Stunden
setInterval(() => {
  const { authDb } = require("./middleware/auth");
  authDb().run(
    "DELETE FROM sessions WHERE expires_at <= datetime('now')",
    (err) => {
      if (err) {
        console.error("Auto-Session-Cleanup Fehler:", err);
      } else {
        console.log("🧹 Automatische Session-Bereinigung durchgeführt");
      }
    }
  );
}, 6 * 60 * 60 * 1000); // 6 Stunden

// ===========================================
// SERVER START
// ===========================================

const server = app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
  console.log(`📱 Haupt-App: http://localhost:${PORT}`);
  console.log(`🔐 Login: http://localhost:${PORT}/login`);
  console.log(`⚙️  Admin: http://localhost:${PORT}/admin`);
  console.log(`💾 Datenbank: ${path.join(__dirname, "data")}`);
  console.log(`📁 Statische Dateien: ${path.join(__dirname, "public")}`);
  console.log(
    `🛡️  Sicherheitsfeatures: ${
      process.env.NODE_ENV === "production" ? "Aktiviert" : "Development-Modus"
    }`
  );
  console.log(`📊 System-Status: http://localhost:${PORT}/api/system/status`);
  console.log(`🔍 Health-Check: http://localhost:${PORT}/api/health`);
  console.log(`\n🎨 FAF Lackiererei Multi-Tenant System bereit!`);

  // Demo-User erstellen falls nicht vorhanden (nur in Development)
  if (process.env.NODE_ENV !== "production") {
    setTimeout(() => {
      fetch(`http://localhost:${PORT}/api/auth/create-demo-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {
        // Demo-User bereits vorhanden oder Fehler - ignorieren
      });
    }, 2000);
  }
});

// ===========================================
// GRACEFUL SHUTDOWN
// ===========================================

const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} erhalten. Graceful Shutdown...`);

  server.close((err) => {
    if (err) {
      console.error("❌ Fehler beim Schließen des Servers:", err);
      process.exit(1);
    }

    console.log("✅ Server erfolgreich heruntergefahren");
    console.log("🧹 Aufräumarbeiten...");

    // Datenbankverbindungen schließen
    try {
      const { authDb } = require("./middleware/auth");
      authDb().close((err) => {
        if (err) {
          console.error("❌ Fehler beim Schließen der Auth-DB:", err);
        } else {
          console.log("✅ Auth-Datenbank geschlossen");
        }

        console.log("👋 Auf Wiedersehen!");
        process.exit(0);
      });
    } catch (error) {
      console.log("✅ Cleanup abgeschlossen");
      process.exit(0);
    }
  });

  // Force-Exit nach 10 Sekunden
  setTimeout(() => {
    console.error("❌ Force-Exit nach Timeout");
    process.exit(1);
  }, 10000);
};

// Event Listeners für Graceful Shutdown
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Unhandled Promise Rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Uncaught Exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

module.exports = app;
