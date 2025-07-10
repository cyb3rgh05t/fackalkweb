const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Erweiterte Sicherheit für File-Uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // Nur Bilder erlauben
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Nur Bilddateien sind erlaubt"), false);
    }
  },
});

// Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

app.use(compression());
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Rate Limiting - unterschiedliche Limits für verschiedene Endpunkte
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100,
  message: { error: "Zu viele Anfragen, versuchen Sie es später erneut" },
});

const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 Minuten
  max: 10, // Maximal 10 Uploads pro 5 Minuten
  message: { error: "Upload-Limit erreicht, versuchen Sie es später erneut" },
});

const exportLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 Minute
  max: 5, // Maximal 5 Exports pro Minute
  message: { error: "Export-Limit erreicht, versuchen Sie es später erneut" },
});

app.use("/api/", generalLimiter);
app.use("/api/*/export", exportLimiter);

app.use(express.static(path.join(__dirname, "public")));

// Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// Logo-Upload-Endpunkt
app.post(
  "/api/upload/logo",
  uploadLimiter,
  upload.single("logo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Keine Datei hochgeladen" });
      }

      // Datei zu Base64 konvertieren
      const base64Data = `data:${
        req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

      // In Einstellungen speichern
      const Einstellung = require("./models/einstellung");
      await Einstellung.update("firmen_logo", base64Data);

      res.json({
        success: true,
        logo: base64Data,
        size: req.file.size,
        type: req.file.mimetype,
      });
    } catch (error) {
      console.error("Logo-Upload Fehler:", error);
      res.status(500).json({ error: "Fehler beim Speichern des Logos" });
    }
  }
);

// Backup-Endpunkt
app.post("/api/backup/create", async (req, res) => {
  try {
    const backupDir = path.join(__dirname, "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
    const backupPath = path.join(backupDir, `backup_${timestamp}.db`);
    const sourcePath = path.join(__dirname, "data", "lackiererei.db");

    // Datenbank kopieren
    fs.copyFileSync(sourcePath, backupPath);

    // Einstellungen als JSON exportieren
    const Einstellung = require("./models/einstellung");
    const einstellungen = await Einstellung.findAll();
    const settingsPath = path.join(backupDir, `settings_${timestamp}.json`);

    const settingsData = {
      created: new Date().toISOString(),
      version: "1.0",
      settings: einstellungen.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {}),
    };

    fs.writeFileSync(settingsPath, JSON.stringify(settingsData, null, 2));

    res.json({
      success: true,
      backup: {
        database: backupPath,
        settings: settingsPath,
        created: timestamp,
      },
    });
  } catch (error) {
    console.error("Backup-Fehler:", error);
    res.status(500).json({ error: "Fehler beim Erstellen des Backups" });
  }
});

// Backup-Wiederherstellung
app.post("/api/backup/restore", async (req, res) => {
  try {
    const { backupFile } = req.body;

    if (!backupFile || !fs.existsSync(backupFile)) {
      return res.status(400).json({ error: "Backup-Datei nicht gefunden" });
    }

    const sourcePath = path.join(__dirname, "data", "lackiererei.db");

    // Aktuelles Backup erstellen vor Wiederherstellung
    const emergencyBackup = `${sourcePath}.emergency_${Date.now()}`;
    fs.copyFileSync(sourcePath, emergencyBackup);

    // Backup wiederherstellen
    fs.copyFileSync(backupFile, sourcePath);

    res.json({
      success: true,
      message: "Backup erfolgreich wiederhergestellt",
      emergencyBackup: emergencyBackup,
    });
  } catch (error) {
    console.error("Restore-Fehler:", error);
    res.status(500).json({ error: "Fehler beim Wiederherstellen des Backups" });
  }
});

// Systemstatus-Endpunkt
app.get("/api/system/status", (req, res) => {
  const db = require("./db");

  db.get("SELECT COUNT(*) as count FROM einstellungen", (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Datenbankfehler" });
    }

    const diskUsage = fs.statSync(
      path.join(__dirname, "data", "lackiererei.db")
    ).size;

    res.json({
      status: "ok",
      database: {
        connected: true,
        settings_count: result.count,
        size_bytes: diskUsage,
        size_mb: Math.round((diskUsage / 1024 / 1024) * 100) / 100,
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        platform: process.platform,
      },
      timestamp: new Date().toISOString(),
    });
  });
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0",
  });
});

// API Routes
app.use("/api/kunden", require("./routes/kunden"));
app.use("/api/fahrzeuge", require("./routes/fahrzeuge"));
app.use("/api/auftraege", require("./routes/auftraege"));
app.use("/api/rechnungen", require("./routes/rechnungen"));
app.use("/api/einstellungen", require("./routes/einstellungen"));

// Statische Dateien mit erweiterten Headers
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "1d",
    etag: true,
    lastModified: true,
  })
);

// Haupt-Route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 404 Handler für API-Routen
app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: "API-Endpunkt nicht gefunden",
    requested: req.originalUrl,
    available_endpoints: [
      "/api/kunden",
      "/api/fahrzeuge",
      "/api/auftraege",
      "/api/rechnungen",
      "/api/einstellungen",
      "/api/system/status",
      "/api/health",
    ],
  });
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
      return res.status(400).json({ error: "Zu viele Dateien" });
    }
  }

  // Andere Fehler
  if (err.message === "Nur Bilddateien sind erlaubt") {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({
    error: "Interner Serverfehler",
    timestamp: new Date().toISOString(),
  });
});

// Server starten
const server = app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
  console.log(`📱 Öffnen Sie http://localhost:${PORT} in Ihrem Browser`);
  console.log(
    `💾 Datenbank: ${path.join(__dirname, "data", "lackiererei.db")}`
  );
  console.log(`📁 Statische Dateien: ${path.join(__dirname, "public")}`);
  console.log(`🛡️  Sicherheitsfeatures aktiviert`);
  console.log(`📊 System-Status: http://localhost:${PORT}/api/system/status`);
});

// Graceful Shutdown mit erweiterten Aufräumarbeiten
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} erhalten. Server wird heruntergefahren...`);

  server.close((err) => {
    if (err) {
      console.error("❌ Fehler beim Schließen des Servers:", err);
      process.exit(1);
    }

    console.log("✅ HTTP-Server geschlossen");

    // Datenbank schließen
    const db = require("./db");
    db.close((dbErr) => {
      if (dbErr) {
        console.error("❌ Fehler beim Schließen der Datenbank:", dbErr.message);
        process.exit(1);
      } else {
        console.log("✅ Datenbankverbindung geschlossen");
      }

      // Cleanup-Operationen
      cleanup()
        .then(() => {
          console.log("✅ Cleanup abgeschlossen");
          console.log("👋 Server erfolgreich heruntergefahren");
          process.exit(0);
        })
        .catch((cleanupErr) => {
          console.error("❌ Fehler beim Cleanup:", cleanupErr);
          process.exit(1);
        });
    });
  });

  // Fallback: Nach 10 Sekunden erzwungen beenden
  setTimeout(() => {
    console.error("⚠️  Erzwungenes Herunterfahren nach Timeout");
    process.exit(1);
  }, 10000);
};

async function cleanup() {
  // Temporäre Dateien aufräumen
  const tempDir = path.join(__dirname, "temp");
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log("🧹 Temporäre Dateien gelöscht");
  }

  // Alte Backups aufräumen (älter als 30 Tage)
  const backupDir = path.join(__dirname, "backups");
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir);
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime.getTime() < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Altes Backup gelöscht: ${file}`);
      }
    });
  }

  // Letzte System-Informationen loggen
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  console.log(
    `📊 Server-Laufzeit: ${Math.floor(uptime / 3600)}h ${Math.floor(
      (uptime % 3600) / 60
    )}m`
  );
  console.log(
    `💾 Speicherverbrauch: ${Math.round(memory.heapUsed / 1024 / 1024)}MB`
  );
}

// Signal-Handler
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Unbehandelte Promise-Rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unbehandelte Promise-Rejection:", reason);
  console.error("Promise:", promise);
  // Server nicht automatisch beenden, aber Fehler loggen
});

// Unbehandelte Exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Unbehandelte Exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

module.exports = app;
