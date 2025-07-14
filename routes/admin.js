// routes/admin.js
const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { requireAdmin, authDb } = require("../middleware/auth");
const router = express.Router();

// Alle Routen mit Admin-Berechtigung schützen
router.use(requireAdmin);

// ===========================================
// USER MANAGEMENT
// ===========================================

// Benutzer-Statistiken
router.get("/users/stats", (req, res) => {
  const db = authDb();

  const statsQuery = `
    SELECT 
      COUNT(*) as total_users,
      COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
      COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users
    FROM users
  `;

  const licenseQuery = `
    SELECT 
      COUNT(CASE WHEN expires_at > datetime('now') AND is_active = 1 THEN 1 END) as valid_licenses,
      COUNT(CASE WHEN expires_at <= datetime('now') OR is_active = 0 THEN 1 END) as expired_licenses
    FROM licenses
  `;

  db.get(statsQuery, (err, userStats) => {
    if (err) {
      console.error("User-Stats Fehler:", err);
      return res
        .status(500)
        .json({ error: "Fehler beim Laden der Statistiken" });
    }

    db.get(licenseQuery, (err, licenseStats) => {
      if (err) {
        console.error("License-Stats Fehler:", err);
        return res
          .status(500)
          .json({ error: "Fehler beim Laden der Lizenz-Statistiken" });
      }

      res.json({
        total_users: userStats.total_users || 0,
        active_users: userStats.active_users || 0,
        admin_users: userStats.admin_users || 0,
        valid_licenses: licenseStats.valid_licenses || 0,
        expired_licenses: licenseStats.expired_licenses || 0,
      });
    });
  });
});

// Alle Benutzer auflisten
router.get("/users", (req, res) => {
  const db = authDb();

  const query = `
    SELECT 
      u.id, u.username, u.email, u.role, u.is_active, u.database_name,
      u.created_at, u.updated_at,
      l.expires_at as license_expires, l.is_active as license_active,
      l.license_key
    FROM users u
    LEFT JOIN licenses l ON u.id = l.user_id
    ORDER BY u.created_at DESC
  `;

  db.all(query, (err, users) => {
    if (err) {
      console.error("Users-Loading Fehler:", err);
      return res.status(500).json({ error: "Fehler beim Laden der Benutzer" });
    }

    res.json(users);
  });
});

// Neuen Benutzer erstellen
router.post("/users", async (req, res) => {
  try {
    const { username, email, password, role = "user" } = req.body;

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

    // E-Mail-Format prüfen
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Ungültiges E-Mail-Format",
      });
    }

    const db = authDb();
    const passwordHash = await bcrypt.hash(password, 10);
    const databaseName =
      role === "admin" ? "main_db" : `user_${Date.now()}_${username}`;

    // Benutzer erstellen
    db.run(
      "INSERT INTO users (username, email, password_hash, role, database_name) VALUES (?, ?, ?, ?, ?)",
      [username, email, passwordHash, role, databaseName],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({
              error: "Benutzername oder E-Mail bereits vorhanden",
            });
          }
          console.error("User-Creation Fehler:", err);
          return res
            .status(500)
            .json({ error: "Fehler beim Erstellen des Benutzers" });
        }

        const userId = this.lastID;

        // Lizenz für normale User erstellen (1 Jahr gültig)
        if (role !== "admin") {
          const licenseKey = `LICENSE-${Date.now()}-${crypto
            .randomBytes(8)
            .toString("hex")
            .toUpperCase()}`;
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);

          db.run(
            "INSERT INTO licenses (user_id, license_key, expires_at) VALUES (?, ?, ?)",
            [userId, licenseKey, expiresAt.toISOString()],
            (err) => {
              if (err) {
                console.error("License-Creation Fehler:", err);
              } else {
                console.log(
                  `✅ Lizenz für User ${username} erstellt (gültig bis ${expiresAt.toISOString()})`
                );
              }
            }
          );
        }

        res.status(201).json({
          success: true,
          message: "Benutzer erfolgreich erstellt",
          user: {
            id: userId,
            username,
            email,
            role,
            database_name: databaseName,
          },
        });
      }
    );
  } catch (error) {
    console.error("User-Creation Fehler:", error);
    res
      .status(500)
      .json({ error: "Server-Fehler beim Erstellen des Benutzers" });
  }
});

// Benutzer bearbeiten
router.put("/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, email, role, password } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        error: "Username und E-Mail sind erforderlich",
      });
    }

    const db = authDb();
    let updateFields = [
      "username = ?",
      "email = ?",
      "role = ?",
      "updated_at = datetime('now')",
    ];
    let updateValues = [username, email, role];

    // Passwort ändern falls angegeben
    if (password && password.length >= 6) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push("password_hash = ?");
      updateValues.push(passwordHash);
    }

    updateValues.push(userId);

    const updateQuery = `UPDATE users SET ${updateFields.join(
      ", "
    )} WHERE id = ?`;

    db.run(updateQuery, updateValues, function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({
            error: "Benutzername oder E-Mail bereits vorhanden",
          });
        }
        console.error("User-Update Fehler:", err);
        return res
          .status(500)
          .json({ error: "Fehler beim Aktualisieren des Benutzers" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Benutzer nicht gefunden" });
      }

      res.json({
        success: true,
        message: "Benutzer erfolgreich aktualisiert",
      });
    });
  } catch (error) {
    console.error("User-Update Fehler:", error);
    res
      .status(500)
      .json({ error: "Server-Fehler beim Aktualisieren des Benutzers" });
  }
});

// Benutzer löschen
router.delete("/users/:id", (req, res) => {
  const userId = parseInt(req.params.id);
  const db = authDb();

  // Prüfen ob es ein Admin ist
  db.get("SELECT role FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) {
      console.error("User-Check Fehler:", err);
      return res
        .status(500)
        .json({ error: "Fehler beim Prüfen des Benutzers" });
    }

    if (!user) {
      return res.status(404).json({ error: "Benutzer nicht gefunden" });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        error: "Admin-Benutzer können nicht gelöscht werden",
      });
    }

    // Benutzer löschen (Lizenz wird durch CASCADE gelöscht)
    db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
      if (err) {
        console.error("User-Delete Fehler:", err);
        return res
          .status(500)
          .json({ error: "Fehler beim Löschen des Benutzers" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Benutzer nicht gefunden" });
      }

      // User-Database löschen falls vorhanden
      const userDbPath = path.join(
        __dirname,
        "..",
        "data",
        "users",
        `user_${userId}.db`
      );
      if (fs.existsSync(userDbPath)) {
        try {
          fs.unlinkSync(userDbPath);
          console.log(`User-DB für User ${userId} gelöscht`);
        } catch (error) {
          console.error("User-DB Löschung fehlgeschlagen:", error);
        }
      }

      res.json({
        success: true,
        message: "Benutzer erfolgreich gelöscht",
      });
    });
  });
});

// ===========================================
// LICENSE MANAGEMENT
// ===========================================

// Lizenz verlängern
router.put("/users/:id/extend-license", (req, res) => {
  const userId = parseInt(req.params.id);
  const db = authDb();

  // Aktuelle Lizenz abrufen
  db.get(
    "SELECT * FROM licenses WHERE user_id = ?",
    [userId],
    (err, license) => {
      if (err) {
        console.error("License-Check Fehler:", err);
        return res.status(500).json({ error: "Fehler beim Prüfen der Lizenz" });
      }

      let newExpiresAt;

      if (!license) {
        // Neue Lizenz erstellen
        newExpiresAt = new Date();
        newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1);

        const licenseKey = `LICENSE-${Date.now()}-${crypto
          .randomBytes(8)
          .toString("hex")
          .toUpperCase()}`;

        db.run(
          "INSERT INTO licenses (user_id, license_key, expires_at) VALUES (?, ?, ?)",
          [userId, licenseKey, newExpiresAt.toISOString()],
          function (err) {
            if (err) {
              console.error("License-Creation Fehler:", err);
              return res
                .status(500)
                .json({ error: "Fehler beim Erstellen der Lizenz" });
            }

            res.json({
              success: true,
              message: "Neue Lizenz erstellt und um 1 Jahr verlängert",
              expires_at: newExpiresAt.toISOString(),
            });
          }
        );
      } else {
        // Bestehende Lizenz verlängern
        const currentExpires = new Date(license.expires_at);
        const now = new Date();

        // Wenn Lizenz bereits abgelaufen ist, ab jetzt rechnen, sonst ab Ablaufdatum
        newExpiresAt = currentExpires > now ? currentExpires : now;
        newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1);

        db.run(
          "UPDATE licenses SET expires_at = ?, is_active = 1 WHERE user_id = ?",
          [newExpiresAt.toISOString(), userId],
          function (err) {
            if (err) {
              console.error("License-Extend Fehler:", err);
              return res
                .status(500)
                .json({ error: "Fehler beim Verlängern der Lizenz" });
            }

            res.json({
              success: true,
              message: "Lizenz um 1 Jahr verlängert",
              expires_at: newExpiresAt.toISOString(),
            });
          }
        );
      }
    }
  );
});

// Lizenz deaktivieren
router.put("/users/:id/deactivate-license", (req, res) => {
  const userId = parseInt(req.params.id);
  const db = authDb();

  db.run(
    "UPDATE licenses SET is_active = 0 WHERE user_id = ?",
    [userId],
    function (err) {
      if (err) {
        console.error("License-Deactivate Fehler:", err);
        return res
          .status(500)
          .json({ error: "Fehler beim Deaktivieren der Lizenz" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Keine Lizenz gefunden" });
      }

      res.json({
        success: true,
        message: "Lizenz deaktiviert",
      });
    }
  );
});

// Lizenz reaktivieren
router.put("/users/:id/activate-license", (req, res) => {
  const userId = parseInt(req.params.id);
  const db = authDb();

  db.run(
    "UPDATE licenses SET is_active = 1 WHERE user_id = ?",
    [userId],
    function (err) {
      if (err) {
        console.error("License-Activate Fehler:", err);
        return res
          .status(500)
          .json({ error: "Fehler beim Aktivieren der Lizenz" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Keine Lizenz gefunden" });
      }

      res.json({
        success: true,
        message: "Lizenz aktiviert",
      });
    }
  );
});

// ===========================================
// SYSTEM MANAGEMENT
// ===========================================

// System-Backup erstellen
router.post("/system/backup", (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(
      __dirname,
      "..",
      "backups",
      `backup_${timestamp}`
    );

    // Backup-Verzeichnis erstellen
    if (!fs.existsSync(path.dirname(backupDir))) {
      fs.mkdirSync(path.dirname(backupDir), { recursive: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });

    // Auth-DB Backup
    const authDbPath = path.join(__dirname, "..", "data", "auth.db");
    const authBackupPath = path.join(backupDir, `auth_backup.db`);

    if (fs.existsSync(authDbPath)) {
      fs.copyFileSync(authDbPath, authBackupPath);
    }

    // Haupt-DB Backup
    const mainDbPath = path.join(__dirname, "..", "data", "kfz.db");
    const mainBackupPath = path.join(backupDir, `main_backup.db`);

    if (fs.existsSync(mainDbPath)) {
      fs.copyFileSync(mainDbPath, mainBackupPath);
    }

    // User-DBs Backup
    const userDbDir = path.join(__dirname, "..", "data", "users");
    const userBackupDir = path.join(backupDir, "users");

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
      message: "System-Backup erfolgreich erstellt",
      backup_timestamp: timestamp,
      backup_path: backupDir,
      files: {
        auth_backup: fs.existsSync(authBackupPath),
        main_backup: fs.existsSync(mainBackupPath),
        users_backup: fs.existsSync(userBackupDir),
      },
    });
  } catch (error) {
    console.error("Backup-Fehler:", error);
    res.status(500).json({ error: "Fehler beim Erstellen des System-Backups" });
  }
});

// System-Statistiken
router.get("/system/stats", (req, res) => {
  try {
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
      path.join(__dirname, "..", "data", "kfz.db")
    );

    // User-DBs Größe
    let totalUserDbSize = 0;
    let userDbCount = 0;
    const userDbDir = path.join(__dirname, "..", "data", "users");
    if (fs.existsSync(userDbDir)) {
      const userDbFiles = fs.readdirSync(userDbDir);
      userDbFiles.forEach((file) => {
        if (file.endsWith(".db")) {
          totalUserDbSize += getFileSize(path.join(userDbDir, file));
          userDbCount++;
        }
      });
    }

    res.json({
      server: {
        uptime: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        node_version: process.version,
        platform: process.platform,
        pid: process.pid,
      },
      database: {
        auth_db_size: authDbSize,
        main_db_size: mainDbSize,
        user_dbs_size: totalUserDbSize,
        user_db_count: userDbCount,
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("System-Stats Fehler:", error);
    res.status(500).json({ error: "Fehler beim Laden der System-Statistiken" });
  }
});

// Abgelaufene Sessions bereinigen
router.post("/system/cleanup-sessions", (req, res) => {
  const db = authDb();

  db.run(
    "DELETE FROM sessions WHERE expires_at <= datetime('now')",
    [],
    function (err) {
      if (err) {
        console.error("Session-Cleanup Fehler:", err);
        return res
          .status(500)
          .json({ error: "Session-Cleanup fehlgeschlagen" });
      }

      res.json({
        success: true,
        message: `${this.changes} abgelaufene Sessions gelöscht`,
        deleted_sessions: this.changes,
      });
    }
  );
});

// System-Logs abrufen (vereinfacht)
router.get("/system/logs", (req, res) => {
  try {
    const { limit = 100 } = req.query;

    // Beispiel-Logs (in echter Anwendung würde man echte Log-Dateien lesen)
    const sampleLogs = Array.from({ length: parseInt(limit) }, (_, i) => ({
      id: i + 1,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      level: ["INFO", "WARN", "ERROR"][Math.floor(Math.random() * 3)],
      message: [
        "User login successful",
        "Database backup completed",
        "Session cleanup performed",
        "License validation completed",
        "System health check passed",
      ][Math.floor(Math.random() * 5)],
      source: "System",
    }));

    res.json({
      success: true,
      logs: sampleLogs,
      total: sampleLogs.length,
    });
  } catch (error) {
    console.error("Logs-Fehler:", error);
    res.status(500).json({ error: "Fehler beim Laden der System-Logs" });
  }
});

// ===========================================
// LICENSE BULK OPERATIONS
// ===========================================

// Alle abgelaufenen Lizenzen verlängern
router.post("/licenses/extend-expired", (req, res) => {
  const db = authDb();

  db.run(
    `UPDATE licenses 
     SET expires_at = datetime(expires_at, '+1 year'), 
         is_active = 1 
     WHERE expires_at <= datetime('now')`,
    [],
    function (err) {
      if (err) {
        console.error("Bulk-License-Extend Fehler:", err);
        return res
          .status(500)
          .json({ error: "Fehler beim Verlängern der Lizenzen" });
      }

      res.json({
        success: true,
        message: `${this.changes} abgelaufene Lizenzen um 1 Jahr verlängert`,
        extended_licenses: this.changes,
      });
    }
  );
});

// Alle Lizenzen um bestimmte Zeit verlängern
router.post("/licenses/extend-all", (req, res) => {
  const { months = 12 } = req.body;
  const db = authDb();

  if (months < 1 || months > 60) {
    return res.status(400).json({
      error: "Monate müssen zwischen 1 und 60 liegen",
    });
  }

  db.run(
    `UPDATE licenses 
     SET expires_at = datetime(expires_at, '+${months} months')
     WHERE user_id IN (SELECT id FROM users WHERE role != 'admin')`,
    [],
    function (err) {
      if (err) {
        console.error("Bulk-License-Extend-All Fehler:", err);
        return res
          .status(500)
          .json({ error: "Fehler beim Verlängern aller Lizenzen" });
      }

      res.json({
        success: true,
        message: `${this.changes} Lizenzen um ${months} Monate verlängert`,
        extended_licenses: this.changes,
      });
    }
  );
});

module.exports = router;
