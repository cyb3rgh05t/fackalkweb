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
  findById: function (id) {
    return new Promise(function (resolve, reject) {
      const query = `
        SELECT id, username, password_hash, role, created_at, last_login_at, is_active
        FROM users 
        WHERE id = ? AND is_active = 1
      `;

      db.get(query, [id], function (err, row) {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  // Alle Benutzer abrufen (ohne Passwort-Hash)
  findAll: function () {
    return new Promise(function (resolve, reject) {
      const query = `
        SELECT id, username, role, created_at, last_login_at, is_active
        FROM users 
        ORDER BY created_at DESC
      `;

      db.all(query, [], function (err, rows) {
        if (err) {
          reject(err);
        } else {
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
