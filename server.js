const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const fs = require("fs");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const { requireAuth, attachUser } = require("./middleware/auth");
const { requireValidLicense } = require("./middleware/licenseauth");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "kfz.db");

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

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: path.join(__dirname, "data"), // Absoluter Pfad
    }),
    secret:
      process.env.SESSION_SECRET ||
      "your-super-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // In Produktion auf true setzen (HTTPS erforderlich)
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 Stunden
    },
  })
);

// User-Informationen an alle Requests anhängen
app.use(attachUser);

// Allgemeines Rate Limit - erhöht für normale Nutzung
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 500, // Erhöht von 100 auf 500
  message: { error: "Zu viele Anfragen, versuchen Sie es später erneut" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login-spezifisches Rate Limit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5, // Maximal 5 Login-Versuche pro 15 Minuten
  message: {
    error: "Zu viele Login-Versuche. Versuchen Sie es später erneut.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Erfolgreiche Logins nicht mitzählen
});

// Spezielles Rate Limit für Einstellungen - sehr großzügig
const settingsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 Minuten
  max: 100, // 100 Einstellungs-Updates pro 5 Minuten
  message: {
    error: "Zu viele Einstellungsänderungen, versuchen Sie es später erneut",
  },
  keyGenerator: (req) => {
    // Separate Limits für Batch vs. Single Updates
    return req.path.includes("/batch") ? `batch_${req.ip}` : `single_${req.ip}`;
  },
});

// Sehr restriktives Limit nur für Upload-Endpunkte
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 Minuten
  max: 10, // Maximal 10 Uploads pro 5 Minuten
  message: { error: "Upload-Limit erreicht, versuchen Sie es später erneut" },
});

// Export/Import Limit
const exportLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 Minute
  max: 5, // Maximal 5 Exports pro Minute
  message: { error: "Export-Limit erreicht, versuchen Sie es später erneut" },
});

// Conditional Rate Limiting basierend auf Request-Typ
const smartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    // Verschiedene Limits je nach Endpunkt
    if (req.path.includes("/einstellungen/batch")) {
      return 50; // Großzügig für Batch-Updates
    }
    if (req.path.includes("/einstellungen/")) {
      return 200; // Mittel für einzelne Einstellungen
    }
    if (req.path.includes("/upload")) {
      return 10; // Restriktiv für Uploads
    }
    return 300; // Standard für alles andere
  },
  message: (req) => ({
    error: "Rate limit exceeded",
    endpoint: req.path,
    tip: req.path.includes("/einstellungen/")
      ? "Verwenden Sie den Batch-Update Endpunkt für mehrere Einstellungen"
      : "Versuchen Sie es später erneut",
  }),
});

// Rate Limits
app.use((err, req, res, next) => {
  if (err.status === 429) {
    console.error(`Rate Limit Fehler: ${req.method} ${req.url}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });
  }
  next(err);
});

// Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

app.use("/api/auth", loginLimiter, require("./routes/auth"));

app.get("/login", (req, res) => {
  // Wenn bereits eingeloggt, zur Hauptseite weiterleiten
  if (req.session && req.session.userId) {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Logout-Route (GET für einfache Verwendung)
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout-Fehler:", err);
    }
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

app.use("/api/license", require("./routes/license"));

app.use("/api/einstellungen", settingsLimiter);
app.use("/api/upload", uploadLimiter);
app.use("/api/*/export", exportLimiter);

app.use("/api/", generalLimiter);

app.use("/api/", (req, res, next) => {
  // Rate Limit Headers für Debugging
  res.on("finish", () => {
    if (res.statusCode === 429) {
      console.warn(
        `⚠️  Rate Limit erreicht: ${req.method} ${req.url} - IP: ${req.ip}`
      );
    }
  });
  next();
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0",
    authenticated: !!req.session?.userId,
  });
});

// Logo-Upload-Endpunkt
app.post(
  "/api/upload/logo",
  requireAuth,
  requireValidLicense,
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
app.post(
  "/api/backup/create",
  requireAuth,
  requireValidLicense,
  async (req, res) => {
    try {
      const backupDir = path.join(__dirname, "backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, "-")
        .split(".")[0];
      const backupPath = path.join(backupDir, `backup_${timestamp}.db`);
      const sourcePath = path.join(__dirname, "data", "kfz.db");

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
  }
);

// Backup-Wiederherstellung
app.post(
  "/api/backup/restore",
  requireAuth,
  requireValidLicense,
  async (req, res) => {
    try {
      const { backupFile } = req.body;

      if (!backupFile || !fs.existsSync(backupFile)) {
        return res.status(400).json({ error: "Backup-Datei nicht gefunden" });
      }

      const sourcePath = path.join(__dirname, "data", "kfz.db");

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
      res
        .status(500)
        .json({ error: "Fehler beim Wiederherstellen des Backups" });
    }
  }
);

// Systemstatus-Endpunkt
app.get("/api/system/status", requireAuth, requireValidLicense, (req, res) => {
  const db = require("./db");

  db.get("SELECT COUNT(*) as count FROM einstellungen", (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Datenbankfehler" });
    }

    const diskUsage = fs.statSync(path.join(__dirname, "data", "kfz.db")).size;

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
      user: req.user || null,
      timestamp: new Date().toISOString(),
    });
  });
});

app.use(
  "/api/kunden",
  requireAuth,
  requireValidLicense,
  require("./routes/kunden")
);
app.use(
  "/api/fahrzeuge",
  requireAuth,
  requireValidLicense,
  require("./routes/fahrzeuge")
);
app.use(
  "/api/auftraege",
  requireAuth,
  requireValidLicense,
  require("./routes/auftraege")
);
app.use(
  "/api/rechnungen",
  requireAuth,
  requireValidLicense,
  require("./routes/rechnungen")
);
app.use(
  "/api/einstellungen",
  requireAuth,
  requireValidLicense,
  require("./routes/einstellungen")
);

// Statische Dateien mit erweiterten Headers
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "1d",
    etag: true,
    lastModified: true,
  })
);

app.get("/", requireAuth, requireValidLicense, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/profile", requireAuth, requireValidLicense, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});

// 404 Handler für API-Routen
app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: "API-Endpunkt nicht gefunden",
    requested: req.originalUrl,
    available_endpoints: [
      "/api/auth/login (POST)",
      "/api/auth/logout (POST)",
      "/api/auth/status (GET)",
      "/api/kunden",
      "/api/fahrzeuge",
      "/api/auftraege",
      "/api/rechnungen",
      "/api/einstellungen",
      "/api/upload/logo",
      "/api/backup/create",
      "/api/backup/restore",
      "/api/system/status",
      "/api/health",
    ],
  });
});

// Backup-Liste abrufen
app.use(
  "/api/backup/list",
  requireAuth,
  requireValidLicense,
  async (req, res) => {
    try {
      const backupDir = path.join(__dirname, "backups");

      if (!fs.existsSync(backupDir)) {
        return res.json({ backups: [] });
      }

      const files = fs.readdirSync(backupDir);
      const backups = files
        .filter((file) => file.endsWith(".db") && file.startsWith("backup_"))
        .map((file) => {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);

          // Extrahiere Datum aus Dateiname (backup_2024-01-28T15-30-45.db)
          const dateMatch = file.match(
            /backup_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/
          );
          let created = new Date();

          if (dateMatch) {
            // Konvertiere Dateiname zurück zu ISO-String
            const dateStr = dateMatch[1]
              .replace(/-/g, ":")
              .replace(/T(\d{2}):(\d{2}):(\d{2})/, "T$1:$2:$3");
            created = new Date(dateStr + ".000Z");
          } else {
            // Fallback auf Datei-Erstellungsdatum
            created = stats.birthtime;
          }

          return {
            filename: file,
            path: filePath,
            size: stats.size,
            created: created.toISOString(),
            sizeFormatted:
              Math.round((stats.size / 1024 / 1024) * 100) / 100 + " MB",
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created)); // Neueste zuerst

      res.json({
        success: true,
        backups: backups,
        count: backups.length,
      });
    } catch (error) {
      console.error("Backup-Liste Fehler:", error);
      res.status(500).json({ error: "Fehler beim Laden der Backup-Liste" });
    }
  }
);

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

// Server-Start-Funktion
function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, (err) => {
      if (err) {
        reject(err);
        return;
      }

      console.log(`🚀 Server läuft auf Port ${port}`);
      console.log(`📱 Öffnen Sie http://localhost:${port} in Ihrem Browser`);
      console.log(`💾 Datenbank: ${path.join(__dirname, "data", "kfz.db")}`);
      console.log(`📁 Statische Dateien: ${path.join(__dirname, "public")}`);
      console.log(`🛡️  Sicherheitsfeatures aktiviert`);
      console.log(`🔐 Login-System aktiviert`);
      console.log(
        `📊 System-Status: http://localhost:${port}/api/system/status`
      );
      console.log(`🔑 Login-Seite: http://localhost:${port}/login`);

      if (process.send) {
        process.send("server-ready");
      }

      resolve(server);
    });

    server.on("error", (err) => {
      console.error("Server-Start-Fehler:", err);
      reject(err);
    });
  });
}

// Wenn direkt ausgeführt (nicht als Modul geladen)
if (require.main === module) {
  // Nur starten wenn direkt aufgerufen (npm start)
  startServer()
    .then((server) => {
      // Graceful Shutdown Setup
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
              console.error(
                "❌ Fehler beim Schließen der Datenbank:",
                dbErr.message
              );
              process.exit(1);
            } else {
              console.log("✅ Datenbankverbindung geschlossen");
            }

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

      // Signal-Handler
      process.on("SIGINT", () => gracefulShutdown("SIGINT"));
      process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

      // Unbehandelte Promise-Rejections
      process.on("unhandledRejection", (reason, promise) => {
        console.error("❌ Unbehandelte Promise-Rejection:", reason);
        console.error("Promise:", promise);
      });

      // Unbehandelte Exceptions
      process.on("uncaughtException", (error) => {
        console.error("❌ Unbehandelte Exception:", error);
        gracefulShutdown("UNCAUGHT_EXCEPTION");
      });
    })
    .catch((error) => {
      console.error("❌ Server-Start fehlgeschlagen:", error);
      process.exit(1);
    });
}

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

// Module Exports - FÜR ELECTRON BUILD
module.exports = {
  app, // Express App
  startServer, // Server-Start-Funktion
  generalLimiter,
  settingsLimiter,
  uploadLimiter,
  exportLimiter,
  smartLimiter,
};
