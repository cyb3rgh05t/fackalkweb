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
    if (this.authDb) {
      return this.authDb;
    }
    // ✅ KORRIGIERT: authDb() direkt aufrufen
    const { authDb } = require("../middleware/auth");
    return authDb();
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
                function (err) {
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
                    });
                  });
                }
              );
            }
          );
        });
      } catch (error) {
        console.error("Fehler beim User-Erstellen:", error);
        reject(error);
      }
    });
  }

  // User aktualisieren
  static async update(id, data) {
    return new Promise(async (resolve, reject) => {
      const db = this.getAuthDb();

      const { username, email, password, role, is_active } = data;
      const updateFields = [];
      const updateValues = [];

      if (username) {
        updateFields.push("username = ?");
        updateValues.push(username);
      }

      if (email) {
        updateFields.push("email = ?");
        updateValues.push(email);
      }

      if (password) {
        try {
          const passwordHash = await bcrypt.hash(password, 10);
          updateFields.push("password_hash = ?");
          updateValues.push(passwordHash);
        } catch (error) {
          return reject(new Error("Fehler beim Hashen des Passworts"));
        }
      }

      if (role !== undefined) {
        updateFields.push("role = ?");
        updateValues.push(role);
      }

      if (is_active !== undefined) {
        updateFields.push("is_active = ?");
        updateValues.push(is_active ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return reject(new Error("Keine Felder zum Aktualisieren"));
      }

      updateFields.push("updated_at = CURRENT_TIMESTAMP");
      updateValues.push(id);

      const sql = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;

      db.run(sql, updateValues, function (err) {
        if (err) {
          console.error("Fehler beim Aktualisieren des Users:", err);
          reject(err);
        } else {
          resolve({ id, changes: this.changes });
        }
      });
    });
  }

  // User löschen
  static delete(id) {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
        if (err) {
          console.error("Fehler beim Löschen des Users:", err);
          reject(err);
        } else {
          resolve({ id, changes: this.changes });
        }
      });
    });
  }

  // User-Statistiken
  static getStats() {
    return new Promise((resolve, reject) => {
      const db = this.getAuthDb();

      const sql = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
          COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_users
        FROM users
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
      },
      premium: {
        max_customers: 200,
        max_vehicles: 1000,
      },
      enterprise: {
        max_customers: 1000,
        max_vehicles: 5000,
      },
    };

    return configs[type] || configs.basic;
  }
}

module.exports = User;
