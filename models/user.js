const db = require("../db/index");

const User = {
  // Benutzer nach Username suchen
  findByUsername: function (username) {
    return new Promise(function (resolve, reject) {
      const query = `
        SELECT id, username, password_hash, role, created_at, last_login_at, is_active
        FROM users 
        WHERE username = ? AND is_active = 1
      `;

      db.get(query, [username], function (err, row) {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  // Benutzer nach ID suchen
  findById: async (id) => {
    return new Promise((resolve, reject) => {
      const sql = `
      SELECT id, username, role, is_active, created_at, last_login_at 
      FROM users 
      WHERE id = ?
    `;

      db.get(sql, [id], (err, row) => {
        if (err) {
          console.error("❌ Database error in User.findById:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  // Alle Benutzer abrufen (ohne Passwort-Hash)
  findAll: async () => {
    return new Promise((resolve, reject) => {
      const sql = `
      SELECT id, username, role, is_active, created_at, last_login_at 
      FROM users 
      ORDER BY created_at DESC
    `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error("❌ Database error in User.findAll:", err);
          reject(err);
        } else {
          console.log(`📊 User.findAll: ${rows.length} Benutzer gefunden`);
          resolve(rows);
        }
      });
    });
  },

  // Neuen Benutzer erstellen
  create: function (userData) {
    return new Promise(function (resolve, reject) {
      const username = userData.username;
      const password_hash = userData.password_hash;
      const role = userData.role || "user";

      const query = `
        INSERT INTO users (username, password_hash, role, created_at, is_active)
        VALUES (?, ?, ?, datetime('now'), 1)
      `;

      db.run(query, [username, password_hash, role], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  },

  delete: async (id) => {
    return new Promise((resolve, reject) => {
      const sql = "DELETE FROM users WHERE id = ?";

      db.run(sql, [id], function (err) {
        if (err) {
          console.error("❌ Database error in User.delete:", err);
          reject(err);
        } else {
          console.log(
            `✅ User.delete: Benutzer ID ${id} gelöscht (${this.changes} Zeilen betroffen)`
          );
          resolve(this.changes > 0);
        }
      });
    });
  },

  // Passwort aktualisieren
  updatePassword: function (userId, newPasswordHash) {
    return new Promise(function (resolve, reject) {
      const query = `
        UPDATE users 
        SET password_hash = ?, updated_at = datetime('now')
        WHERE id = ?
      `;

      db.run(query, [newPasswordHash, userId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  },

  // Login-Zeit aktualisieren
  updateLastLogin: function (userId) {
    return new Promise(function (resolve, reject) {
      const query = `
        UPDATE users 
        SET last_login_at = datetime('now')
        WHERE id = ?
      `;

      db.run(query, [userId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  },

  // Benutzer deaktivieren (soft delete)
  deactivate: function (userId) {
    return new Promise(function (resolve, reject) {
      const query = `
        UPDATE users 
        SET is_active = 0, updated_at = datetime('now')
        WHERE id = ?
      `;

      db.run(query, [userId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  },

  // Benutzer aktivieren
  activate: function (userId) {
    return new Promise(function (resolve, reject) {
      const query = `
        UPDATE users 
        SET is_active = 1, updated_at = datetime('now')
        WHERE id = ?
      `;

      db.run(query, [userId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  },

  setActiveStatus: async (id, isActive) => {
    return new Promise((resolve, reject) => {
      const sql = "UPDATE users SET is_active = ? WHERE id = ?";

      db.run(sql, [isActive ? 1 : 0, id], function (err) {
        if (err) {
          console.error("❌ Database error in User.setActiveStatus:", err);
          reject(err);
        } else {
          console.log(
            `✅ User.setActiveStatus: Benutzer ID ${id} auf ${
              isActive ? "aktiv" : "inaktiv"
            } gesetzt`
          );
          resolve(this.changes > 0);
        }
      });
    });
  },

  // Benutzerrolle ändern
  updateRole: function (userId, newRole) {
    return new Promise(function (resolve, reject) {
      const query = `
        UPDATE users 
        SET role = ?, updated_at = datetime('now')
        WHERE id = ?
      `;

      db.run(query, [newRole, userId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  },

  // Benutzername aktualisieren
  updateUsername: function (userId, newUsername) {
    return new Promise(function (resolve, reject) {
      const query = `
      UPDATE users 
      SET username = ?, updated_at = datetime('now')
      WHERE id = ?
    `;

      db.run(query, [newUsername, userId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  },

  // Prüfen ob bereits Benutzer existieren
  countUsers: function () {
    return new Promise(function (resolve, reject) {
      const query = "SELECT COUNT(*) as count FROM users WHERE is_active = 1";

      db.get(query, [], function (err, row) {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  },
};

module.exports = User;
