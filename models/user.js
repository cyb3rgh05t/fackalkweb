// models/user.js
const bcrypt = require("bcrypt");
const crypto = require("crypto");

class User {
  constructor() {
    this.authDb = null;
  }

  // Auth-DB-Verbindung setzen
  static setAuthDb(authDb) {
    this.authDb = authDb;
  }

  // Auth-DB holen
  static getAuthDb() {
    return this.authDb || require("../middleware/auth").authDb();
  }

  // Alle User laden (Admin-Funktion)
  static findAll() {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      const sql = `
        SELECT u.*, 
               l.license_key,
               l.expires_at,
               l.is_active as license_active,
               l.max_customers,
               l.max_vehicles,
               COUNT(s.id) as active_sessions
        FROM users u
        LEFT JOIN licenses l ON u.id = l.user_id
        LEFT JOIN sessions s ON u.id = s.user_id AND s.expires_at > datetime('now')
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden aller User:", err);
          reject(err);
        } else {
          // Passwort-Hash entfernen
          const users = (rows || []).map((user) => {
            const { password_hash, ...userWithoutPassword } = user;
            return userWithoutPassword;
          });
          resolve(users);
        }
      });
    });
  }

  // User per ID laden
  static findById(id) {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      const sql = `
        SELECT u.*, 
               l.license_key,
               l.expires_at,
               l.is_active as license_active,
               l.max_customers,
               l.max_vehicles
        FROM users u
        LEFT JOIN licenses l ON u.id = l.user_id
        WHERE u.id = ?
      `;

      db.get(sql, [id], (err, row) => {
        if (err) {
          console.error("Fehler beim Laden des Users:", err);
          reject(err);
        } else {
          if (row) {
            // Passwort-Hash entfernen
            const { password_hash, ...userWithoutPassword } = row;
            resolve(userWithoutPassword);
          } else {
            resolve(null);
          }
        }
      });
    });
  }

  // User per Username/Email laden
  static findByLogin(usernameOrEmail) {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      const sql = `
        SELECT u.*, 
               l.license_key,
               l.expires_at,
               l.is_active as license_active,
               l.max_customers,
               l.max_vehicles
        FROM users u
        LEFT JOIN licenses l ON u.id = l.user_id
        WHERE u.username = ? OR u.email = ?
      `;

      db.get(sql, [usernameOrEmail, usernameOrEmail], (err, row) => {
        if (err) {
          console.error("Fehler beim Laden des Users per Login:", err);
          reject(err);
        } else {
          resolve(row); // Mit password_hash für Login-Verification
        }
      });
    });
  }

  // Neuen User erstellen
  static async create(data) {
    return new Promise(async (resolve, reject) => {
      const db = this.getAuthDb();

      const {
        username,
        email,
        password,
        role = "user",
        license_type = "basic",
      } = data;

      // Validierung
      if (!username || !email || !password) {
        return reject(
          new Error("Username, E-Mail und Passwort sind erforderlich")
        );
      }

      if (password.length < 6) {
        return reject(
          new Error("Passwort muss mindestens 6 Zeichen lang sein")
        );
      }

      try {
        // Passwort hashen
        const passwordHash = await bcrypt.hash(password, 10);

        // Eindeutige DB-Name generieren
        const dbName = `user_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Transaktion starten
        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          // User erstellen
          const userSql = `
            INSERT INTO users (username, email, password_hash, role, database_name, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
          `;

          db.run(
            userSql,
            [username, email, passwordHash, role, dbName],
            function (err) {
              if (err) {
                console.error("Fehler beim Erstellen des Users:", err);
                db.run("ROLLBACK");

                if (err.message.includes("UNIQUE constraint failed")) {
                  if (err.message.includes("username")) {
                    return reject(new Error("Username bereits vergeben"));
                  } else if (err.message.includes("email")) {
                    return reject(new Error("E-Mail bereits vergeben"));
                  }
                }

                return reject(err);
              }

              const userId = this.lastID;

              // Lizenz erstellen
              const licenseConfig = User.getLicenseConfig(license_type);
              const licenseKey = `${license_type.toUpperCase()}-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 8)
                .toUpperCase()}`;
              const expiresAt = new Date(
                Date.now() + 365 * 24 * 60 * 60 * 1000
              ).toISOString(); // 1 Jahr

              const licenseSql = `
              INSERT INTO licenses (user_id, license_key, expires_at, is_active, max_customers, max_vehicles)
              VALUES (?, ?, ?, 1, ?, ?)
            `;

              db.run(
                licenseSql,
                [
                  userId,
                  licenseKey,
                  expiresAt,
                  licenseConfig.max_customers,
                  licenseConfig.max_vehicles,
                ],
                (err) => {
                  if (err) {
                    console.error("Fehler beim Erstellen der Lizenz:", err);
                    db.run("ROLLBACK");
                    return reject(err);
                  }

                  db.run("COMMIT", (err) => {
                    if (err) {
                      console.error("Fehler beim Commit:", err);
                      return reject(err);
                    }

                    resolve({
                      id: userId,
                      username,
                      email,
                      role,
                      database_name: dbName,
                      license_key: licenseKey,
                      expires_at: expiresAt,
                      max_customers: licenseConfig.max_customers,
                      max_vehicles: licenseConfig.max_vehicles,
                    });
                  });
                }
              );
            }
          );
        });
      } catch (error) {
        console.error("Fehler beim Hashen des Passworts:", error);
        reject(error);
      }
    });
  }

  // User aktualisieren
  static update(id, data) {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      const { username, email, role, is_active } = data;

      const sql = `
        UPDATE users 
        SET username = ?, email = ?, role = ?, is_active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      db.run(
        sql,
        [username, email, role, is_active ? 1 : 0, id],
        function (err) {
          if (err) {
            console.error("Fehler beim Aktualisieren des Users:", err);

            if (err.message.includes("UNIQUE constraint failed")) {
              if (err.message.includes("username")) {
                return reject(new Error("Username bereits vergeben"));
              } else if (err.message.includes("email")) {
                return reject(new Error("E-Mail bereits vergeben"));
              }
            }

            reject(err);
          } else {
            resolve({
              changes: this.changes,
              success: this.changes > 0,
            });
          }
        }
      );
    });
  }

  // Passwort ändern
  static async changePassword(id, oldPassword, newPassword) {
    return new Promise(async (resolve, reject) => {
      const db = this.getAuthDb();

      if (newPassword.length < 6) {
        return reject(
          new Error("Neues Passwort muss mindestens 6 Zeichen lang sein")
        );
      }

      try {
        // Aktuelles Passwort prüfen
        db.get(
          "SELECT password_hash FROM users WHERE id = ?",
          [id],
          async (err, user) => {
            if (err) {
              console.error("Fehler beim Laden des Users:", err);
              return reject(err);
            }

            if (!user) {
              return reject(new Error("User nicht gefunden"));
            }

            // Altes Passwort verifizieren
            const isValidOldPassword = await bcrypt.compare(
              oldPassword,
              user.password_hash
            );
            if (!isValidOldPassword) {
              return reject(new Error("Aktuelles Passwort ist falsch"));
            }

            // Neues Passwort hashen
            const newPasswordHash = await bcrypt.hash(newPassword, 10);

            // Passwort aktualisieren
            db.run(
              "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
              [newPasswordHash, id],
              function (err) {
                if (err) {
                  console.error("Fehler beim Ändern des Passworts:", err);
                  reject(err);
                } else {
                  resolve({ success: true });
                }
              }
            );
          }
        );
      } catch (error) {
        console.error("Fehler beim Passwort-Hash:", error);
        reject(error);
      }
    });
  }

  // User löschen
  static remove(id) {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      if (id === 1) {
        return reject(new Error("Haupt-Admin kann nicht gelöscht werden"));
      }

      // Transaktion für vollständiges Löschen
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Sessions löschen
        db.run("DELETE FROM sessions WHERE user_id = ?", [id], (err) => {
          if (err) {
            console.error("Fehler beim Löschen der Sessions:", err);
            db.run("ROLLBACK");
            return reject(err);
          }

          // Lizenz löschen
          db.run("DELETE FROM licenses WHERE user_id = ?", [id], (err) => {
            if (err) {
              console.error("Fehler beim Löschen der Lizenz:", err);
              db.run("ROLLBACK");
              return reject(err);
            }

            // User löschen
            db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
              if (err) {
                console.error("Fehler beim Löschen des Users:", err);
                db.run("ROLLBACK");
                return reject(err);
              }

              db.run("COMMIT", (err) => {
                if (err) {
                  console.error("Fehler beim Commit:", err);
                  return reject(err);
                }

                resolve({
                  changes: this.changes,
                  success: this.changes > 0,
                });
              });
            });
          });
        });
      });
    });
  }

  // Lizenz verlängern
  static extendLicense(userId, months = 12) {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      // Aktuelle Lizenz laden
      db.get(
        "SELECT expires_at FROM licenses WHERE user_id = ?",
        [userId],
        (err, license) => {
          if (err) {
            console.error("Fehler beim Laden der Lizenz:", err);
            return reject(err);
          }

          if (!license) {
            return reject(new Error("Keine Lizenz gefunden"));
          }

          // Neues Ablaufdatum berechnen
          const currentExpiry = new Date(license.expires_at);
          const now = new Date();
          const baseDate = currentExpiry > now ? currentExpiry : now;
          const newExpiry = new Date(
            baseDate.getTime() + months * 30 * 24 * 60 * 60 * 1000
          );

          // Lizenz aktualisieren
          db.run(
            "UPDATE licenses SET expires_at = ?, is_active = 1 WHERE user_id = ?",
            [newExpiry.toISOString(), userId],
            function (err) {
              if (err) {
                console.error("Fehler beim Verlängern der Lizenz:", err);
                reject(err);
              } else {
                resolve({
                  user_id: userId,
                  new_expiry: newExpiry,
                  extended_by_months: months,
                  success: this.changes > 0,
                });
              }
            }
          );
        }
      );
    });
  }

  // Lizenz-Typ upgraden
  static upgradeLicense(userId, newLicenseType) {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      const licenseConfig = User.getLicenseConfig(newLicenseType);

      const sql = `
        UPDATE licenses 
        SET max_customers = ?, max_vehicles = ?
        WHERE user_id = ?
      `;

      db.run(
        sql,
        [licenseConfig.max_customers, licenseConfig.max_vehicles, userId],
        function (err) {
          if (err) {
            console.error("Fehler beim Upgraden der Lizenz:", err);
            reject(err);
          } else {
            resolve({
              user_id: userId,
              license_type: newLicenseType,
              max_customers: licenseConfig.max_customers,
              max_vehicles: licenseConfig.max_vehicles,
              success: this.changes > 0,
            });
          }
        }
      );
    });
  }

  // User-Sessions laden
  static getSessions(userId) {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      const sql = `
        SELECT id, expires_at, created_at,
               CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END as is_active
        FROM sessions 
        WHERE user_id = ?
        ORDER BY created_at DESC
      `;

      db.all(sql, [userId], (err, rows) => {
        if (err) {
          console.error("Fehler beim Laden der User-Sessions:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Alle Sessions eines Users beenden
  static terminateAllSessions(userId) {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      db.run(
        "DELETE FROM sessions WHERE user_id = ?",
        [userId],
        function (err) {
          if (err) {
            console.error("Fehler beim Beenden der Sessions:", err);
            reject(err);
          } else {
            resolve({
              terminated: this.changes,
              success: this.changes > 0,
            });
          }
        }
      );
    });
  }

  // User-Statistiken
  static getStats() {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      const sql = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN u.role = 'admin' THEN 1 END) as admin_users,
          COUNT(CASE WHEN u.role = 'user' THEN 1 END) as regular_users,
          COUNT(CASE WHEN u.is_active = 1 THEN 1 END) as active_users,
          COUNT(CASE WHEN l.expires_at > datetime('now') THEN 1 END) as valid_licenses,
          COUNT(CASE WHEN l.expires_at <= datetime('now') THEN 1 END) as expired_licenses
        FROM users u
        LEFT JOIN licenses l ON u.id = l.user_id
      `;

      db.get(sql, [], (err, row) => {
        if (err) {
          console.error("Fehler beim Laden der User-Statistiken:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Lizenz-Konfigurationen
  static getLicenseConfig(type) {
    const configs = {
      basic: {
        max_customers: 50,
        max_vehicles: 200,
        price_yearly: 99,
      },
      professional: {
        max_customers: 200,
        max_vehicles: 1000,
        price_yearly: 199,
      },
      enterprise: {
        max_customers: 9999,
        max_vehicles: 9999,
        price_yearly: 399,
      },
      admin: {
        max_customers: 9999,
        max_vehicles: 9999,
        price_yearly: 0,
      },
    };

    return configs[type] || configs.basic;
  }

  // Abgelaufene Lizenzen finden
  static findExpiredLicenses(daysBefore = 0) {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      const checkDate = new Date(Date.now() - daysBefore * 24 * 60 * 60 * 1000);

      const sql = `
        SELECT u.username, u.email, l.license_key, l.expires_at
        FROM users u
        JOIN licenses l ON u.id = l.user_id
        WHERE l.expires_at <= ? AND l.is_active = 1
        ORDER BY l.expires_at ASC
      `;

      db.all(sql, [checkDate.toISOString()], (err, rows) => {
        if (err) {
          console.error("Fehler beim Suchen abgelaufener Lizenzen:", err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

module.exports = User;
