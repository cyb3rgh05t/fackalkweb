// routes/admin.js
const express = require("express");
const {
  requireAuth,
  requireAdmin,
  createUserDatabase,
} = require("../middleware/auth");
const User = require("../models/user");
const router = express.Router();

// Alle Admin-Routes benötigen Admin-Berechtigung
router.use(requireAuth);
router.use(requireAdmin);

// User-Statistiken
router.get("/users/stats", async (req, res) => {
  try {
    const stats = await User.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Fehler beim Laden der User-Statistiken:", error);
    res.status(500).json({ error: "Fehler beim Laden der Statistiken" });
  }
});

// Alle User laden
router.get("/users", async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error("Fehler beim Laden der User:", error);
    res.status(500).json({ error: "Fehler beim Laden der Benutzer" });
  }
});

// Einzelnen User laden
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "Benutzer nicht gefunden" });
    }

    res.json(user);
  } catch (error) {
    console.error("Fehler beim Laden des Users:", error);
    res.status(500).json({ error: "Fehler beim Laden des Benutzers" });
  }
});

// Neuen User erstellen
router.post("/users", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      role = "user",
      license_type = "basic",
    } = req.body;

    // Validierung
    if (!username || !email || !password) {
      return res.status(400).json({
        error: "Username, E-Mail und Passwort sind erforderlich",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Passwort muss mindestens 6 Zeichen lang sein",
      });
    }

    // User erstellen
    const newUser = await User.create({
      username,
      email,
      password,
      role,
      license_type,
    });

    // User-DB erstellen
    try {
      await createUserDatabase(newUser.database_name);
      console.log(`✅ User-DB erstellt: ${newUser.database_name}`);
    } catch (dbError) {
      console.error("Fehler beim Erstellen der User-DB:", dbError);
      // User wurde erstellt, aber DB-Erstellung fehlgeschlagen
      // In Produktion könnte man hier den User wieder löschen
    }

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
      license: {
        key: newUser.license_key,
        expires_at: newUser.expires_at,
        max_customers: newUser.max_customers,
        max_vehicles: newUser.max_vehicles,
      },
    });
  } catch (error) {
    console.error("Fehler beim Erstellen des Users:", error);

    if (error.message.includes("bereits vergeben")) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Fehler beim Erstellen des Benutzers" });
    }
  }
});

// User aktualisieren
router.put("/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, email, role, is_active } = req.body;

    // Validierung
    if (!username || !email) {
      return res.status(400).json({
        error: "Username und E-Mail sind erforderlich",
      });
    }

    // Haupt-Admin kann nicht deaktiviert werden
    if (userId === "1" && is_active === false) {
      return res.status(400).json({
        error: "Haupt-Administrator kann nicht deaktiviert werden",
      });
    }

    const result = await User.update(userId, {
      username,
      email,
      role,
      is_active: is_active !== undefined ? is_active : true,
    });

    if (!result.success) {
      return res.status(404).json({ error: "Benutzer nicht gefunden" });
    }

    res.json({
      success: true,
      message: "Benutzer erfolgreich aktualisiert",
    });
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Users:", error);

    if (error.message.includes("bereits vergeben")) {
      res.status(400).json({ error: error.message });
    } else {
      res
        .status(500)
        .json({ error: "Fehler beim Aktualisieren des Benutzers" });
    }
  }
});

// User löschen
router.delete("/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    // Haupt-Admin kann nicht gelöscht werden
    if (userId === "1") {
      return res.status(400).json({
        error: "Haupt-Administrator kann nicht gelöscht werden",
      });
    }

    // Sich selbst kann man nicht löschen
    if (userId === req.user.id.toString()) {
      return res.status(400).json({
        error: "Sie können sich nicht selbst löschen",
      });
    }

    const result = await User.remove(userId);

    if (!result.success) {
      return res.status(404).json({ error: "Benutzer nicht gefunden" });
    }

    res.json({
      success: true,
      message: "Benutzer erfolgreich gelöscht",
    });
  } catch (error) {
    console.error("Fehler beim Löschen des Users:", error);
    res.status(500).json({ error: "Fehler beim Löschen des Benutzers" });
  }
});

// Lizenz verlängern
router.put("/users/:id/extend-license", async (req, res) => {
  try {
    const userId = req.params.id;
    const { months = 12 } = req.body;

    if (months < 1 || months > 60) {
      return res.status(400).json({
        error: "Verlängerung muss zwischen 1 und 60 Monaten liegen",
      });
    }

    const result = await User.extendLicense(userId, months);

    if (!result.success) {
      return res
        .status(404)
        .json({ error: "Benutzer oder Lizenz nicht gefunden" });
    }

    res.json({
      success: true,
      message: `Lizenz um ${months} Monate verlängert`,
      new_expiry: result.new_expiry,
      extended_by_months: result.extended_by_months,
    });
  } catch (error) {
    console.error("Fehler beim Verlängern der Lizenz:", error);
    res.status(500).json({ error: "Fehler beim Verlängern der Lizenz" });
  }
});

// Lizenz upgraden
router.put("/users/:id/upgrade-license", async (req, res) => {
  try {
    const userId = req.params.id;
    const { license_type } = req.body;

    const validTypes = ["basic", "professional", "enterprise"];
    if (!validTypes.includes(license_type)) {
      return res.status(400).json({
        error: "Ungültiger Lizenz-Typ. Erlaubt: " + validTypes.join(", "),
      });
    }

    const result = await User.upgradeLicense(userId, license_type);

    if (!result.success) {
      return res
        .status(404)
        .json({ error: "Benutzer oder Lizenz nicht gefunden" });
    }

    res.json({
      success: true,
      message: `Lizenz auf ${license_type} geupgradet`,
      license_type: result.license_type,
      max_customers: result.max_customers,
      max_vehicles: result.max_vehicles,
    });
  } catch (error) {
    console.error("Fehler beim Upgraden der Lizenz:", error);
    res.status(500).json({ error: "Fehler beim Upgraden der Lizenz" });
  }
});

// User-Sessions anzeigen
router.get("/users/:id/sessions", async (req, res) => {
  try {
    const sessions = await User.getSessions(req.params.id);
    res.json(sessions);
  } catch (error) {
    console.error("Fehler beim Laden der Sessions:", error);
    res.status(500).json({ error: "Fehler beim Laden der Sessions" });
  }
});

// Alle Sessions eines Users beenden
router.delete("/users/:id/sessions", async (req, res) => {
  try {
    const result = await User.terminateAllSessions(req.params.id);

    res.json({
      success: true,
      message: `${result.terminated} Sessions beendet`,
    });
  } catch (error) {
    console.error("Fehler beim Beenden der Sessions:", error);
    res.status(500).json({ error: "Fehler beim Beenden der Sessions" });
  }
});

// Passwort eines Users zurücksetzen
router.put("/users/:id/reset-password", async (req, res) => {
  try {
    const userId = req.params.id;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        error: "Neues Passwort muss mindestens 6 Zeichen lang sein",
      });
    }

    // Temporäres Passwort setzen (User muss es beim nächsten Login ändern)
    const bcrypt = require("bcrypt");
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    const authDb = require("../middleware/auth").authDb();

    authDb.run(
      "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [newPasswordHash, userId],
      function (err) {
        if (err) {
          console.error("Fehler beim Zurücksetzen des Passworts:", err);
          return res
            .status(500)
            .json({ error: "Fehler beim Zurücksetzen des Passworts" });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: "Benutzer nicht gefunden" });
        }

        res.json({
          success: true,
          message: "Passwort erfolgreich zurückgesetzt",
        });
      }
    );
  } catch (error) {
    console.error("Fehler beim Zurücksetzen des Passworts:", error);
    res.status(500).json({ error: "Fehler beim Zurücksetzen des Passworts" });
  }
});

// Abgelaufene Lizenzen anzeigen
router.get("/licenses/expired", async (req, res) => {
  try {
    const expiredLicenses = await User.findExpiredLicenses();
    res.json(expiredLicenses);
  } catch (error) {
    console.error("Fehler beim Laden abgelaufener Lizenzen:", error);
    res.status(500).json({ error: "Fehler beim Laden abgelaufener Lizenzen" });
  }
});

// Bald ablaufende Lizenzen (30 Tage)
router.get("/licenses/expiring", async (req, res) => {
  try {
    const expiringLicenses = await User.findExpiredLicenses(-30); // 30 Tage in die Zukunft
    res.json(expiringLicenses);
  } catch (error) {
    console.error("Fehler beim Laden ablaufender Lizenzen:", error);
    res.status(500).json({ error: "Fehler beim Laden ablaufender Lizenzen" });
  }
});

// System-Backup erstellen
router.post("/system/backup", async (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");

    const backupDir = path.join(__dirname, "..", "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];

    // Auth-DB Backup
    const authDbPath = path.join(__dirname, "..", "data", "auth.db");
    const authBackupPath = path.join(backupDir, `auth_backup_${timestamp}.db`);

    if (fs.existsSync(authDbPath)) {
      fs.copyFileSync(authDbPath, authBackupPath);
    }

    // Haupt-DB Backup
    const mainDbPath = path.join(__dirname, "..", "data", "lackiererei.db");
    const mainBackupPath = path.join(backupDir, `main_backup_${timestamp}.db`);

    if (fs.existsSync(mainDbPath)) {
      fs.copyFileSync(mainDbPath, mainBackupPath);
    }

    // User-DBs Backup
    const userDbDir = path.join(__dirname, "..", "data", "users");
    const userBackupDir = path.join(backupDir, `users_${timestamp}`);

    if (fs.existsSync(userDbDir)) {
      fs.mkdirSync(userBackupDir, { recursive: true });

      const userDbFiles = fs.readdirSync(userDbDir);
      userDbFiles.forEach((file) => {
        if (file.endsWith(".db")) {
          fs.copyFileSync(
            path.join(userDbDir, file),
            path.join(userBackupDir, file)
          );
        }
      });
    }

    res.json({
      success: true,
      message: "System-Backup erstellt",
      backup_timestamp: timestamp,
      files: {
        auth_backup: authBackupPath,
        main_backup: mainBackupPath,
        users_backup: userBackupDir,
      },
    });
  } catch (error) {
    console.error("Fehler beim Erstellen des System-Backups:", error);
    res.status(500).json({ error: "Fehler beim Erstellen des System-Backups" });
  }
});

// System-Statistiken
router.get("/system/stats", async (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");

    // Dateigrößen ermitteln
    const getFileSize = (filePath) => {
      try {
        return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
      } catch {
        return 0;
      }
    };

    const authDbSize = getFileSize(
      path.join(__dirname, "..", "data", "auth.db")
    );
    const mainDbSize = getFileSize(
      path.join(__dirname, "..", "data", "lackiererei.db")
    );

    // User-DBs Größe
    let totalUserDbSize = 0;
    const userDbDir = path.join(__dirname, "..", "data", "users");
    if (fs.existsSync(userDbDir)) {
      const userDbFiles = fs.readdirSync(userDbDir);
      userDbFiles.forEach((file) => {
        if (file.endsWith(".db")) {
          totalUserDbSize += getFileSize(path.join(userDbDir, file));
        }
      });
    }

    res.json({
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        platform: process.platform,
      },
      database: {
        auth_db_size: authDbSize,
        main_db_size: mainDbSize,
        user_dbs_size: totalUserDbSize,
        total_size: authDbSize + mainDbSize + totalUserDbSize,
      },
      storage: {
        auth_db_mb: Math.round((authDbSize / 1024 / 1024) * 100) / 100,
        main_db_mb: Math.round((mainDbSize / 1024 / 1024) * 100) / 100,
        user_dbs_mb: Math.round((totalUserDbSize / 1024 / 1024) * 100) / 100,
        total_mb:
          Math.round(
            ((authDbSize + mainDbSize + totalUserDbSize) / 1024 / 1024) * 100
          ) / 100,
      },
    });
  } catch (error) {
    console.error("Fehler beim Laden der System-Statistiken:", error);
    res.status(500).json({ error: "Fehler beim Laden der System-Statistiken" });
  }
});

// Alle aktiven Sessions anzeigen
router.get("/sessions/active", async (req, res) => {
  try {
    const authDb = require("../middleware/auth").authDb();

    authDb.all(
      `
      SELECT s.id, s.expires_at, s.created_at, u.username, u.email, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > datetime('now')
      ORDER BY s.created_at DESC
    `,
      [],
      (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden aktiver Sessions:", err);
          return res
            .status(500)
            .json({ error: "Fehler beim Laden aktiver Sessions" });
        }

        res.json(rows || []);
      }
    );
  } catch (error) {
    console.error("Fehler beim Laden aktiver Sessions:", error);
    res.status(500).json({ error: "Fehler beim Laden aktiver Sessions" });
  }
});

// Abgelaufene Sessions bereinigen
router.delete("/sessions/cleanup", async (req, res) => {
  try {
    const authDb = require("../middleware/auth").authDb();

    authDb.run(
      'DELETE FROM sessions WHERE expires_at <= datetime("now")',
      function (err) {
        if (err) {
          console.error("Fehler beim Bereinigen der Sessions:", err);
          return res
            .status(500)
            .json({ error: "Fehler beim Bereinigen der Sessions" });
        }

        res.json({
          success: true,
          message: `${this.changes} abgelaufene Sessions entfernt`,
        });
      }
    );
  } catch (error) {
    console.error("Fehler beim Bereinigen der Sessions:", error);
    res.status(500).json({ error: "Fehler beim Bereinigen der Sessions" });
  }
});

module.exports = router;
