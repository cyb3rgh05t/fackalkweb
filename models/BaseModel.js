// models/BaseModel.js
class BaseModel {
  constructor() {
    this.db = null;
    this.tableName = null;
    this.primaryKey = "id";
  }

  // Multi-Tenant: DB-Verbindung setzen
  static setDb(userDb) {
    this.db = userDb;
  }

  // Standard-DB falls keine User-DB gesetzt
  static getDb() {
    return this.db || require("../db");
  }

  // Tabellen-Name für das Model
  static getTableName() {
    return this.tableName;
  }

  // Primary Key Spalte
  static getPrimaryKey() {
    return this.primaryKey || "id";
  }

  // Generische Find-All Methode
  static findAll(options = {}) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      let sql = `SELECT * FROM ${tableName}`;
      const params = [];

      // WHERE-Bedingungen
      if (options.where) {
        const whereConditions = [];
        Object.keys(options.where).forEach((key) => {
          whereConditions.push(`${key} = ?`);
          params.push(options.where[key]);
        });
        sql += ` WHERE ${whereConditions.join(" AND ")}`;
      }

      // ORDER BY
      if (options.orderBy) {
        sql += ` ORDER BY ${options.orderBy}`;
        if (options.orderDirection) {
          sql += ` ${options.orderDirection.toUpperCase()}`;
        }
      }

      // LIMIT
      if (options.limit) {
        sql += ` LIMIT ?`;
        params.push(options.limit);
      }

      // OFFSET
      if (options.offset) {
        sql += ` OFFSET ?`;
        params.push(options.offset);
      }

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error(`Fehler beim Laden von ${tableName}:`, err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Generische Find-By-ID Methode
  static findById(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();
      const primaryKey = this.getPrimaryKey();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      const sql = `SELECT * FROM ${tableName} WHERE ${primaryKey} = ?`;

      db.get(sql, [id], (err, row) => {
        if (err) {
          console.error(`Fehler beim Laden von ${tableName} (ID: ${id}):`, err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Generische Find-Where Methode
  static findWhere(conditions, options = {}) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      const whereConditions = [];
      const params = [];

      Object.keys(conditions).forEach((key) => {
        whereConditions.push(`${key} = ?`);
        params.push(conditions[key]);
      });

      let sql = `SELECT * FROM ${tableName} WHERE ${whereConditions.join(
        " AND "
      )}`;

      // ORDER BY
      if (options.orderBy) {
        sql += ` ORDER BY ${options.orderBy}`;
        if (options.orderDirection) {
          sql += ` ${options.orderDirection.toUpperCase()}`;
        }
      }

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error(`Fehler beim Suchen in ${tableName}:`, err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Generische Create Methode
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      // Validation falls definiert
      if (this.validate && typeof this.validate === "function") {
        const validation = this.validate(data);
        if (!validation.valid) {
          return reject(new Error(validation.message));
        }
      }

      const columns = Object.keys(data);
      const placeholders = columns.map(() => "?").join(", ");
      const values = Object.values(data);

      const sql = `
        INSERT INTO ${tableName} (${columns.join(", ")})
        VALUES (${placeholders})
      `;

      db.run(sql, values, function (err) {
        if (err) {
          console.error(`Fehler beim Erstellen von ${tableName}:`, err);
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            ...data,
          });
        }
      });
    });
  }

  // Generische Update Methode
  static update(id, data) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();
      const primaryKey = this.getPrimaryKey();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      // Validation falls definiert
      if (this.validate && typeof this.validate === "function") {
        const validation = this.validate(data, { isUpdate: true });
        if (!validation.valid) {
          return reject(new Error(validation.message));
        }
      }

      const columns = Object.keys(data);
      const setClause = columns.map((col) => `${col} = ?`).join(", ");
      const values = [...Object.values(data), id];

      // aktualisiert_am automatisch setzen falls Spalte existiert
      let sql = `UPDATE ${tableName} SET ${setClause}`;
      if (this.hasTimestamps !== false) {
        sql += ", aktualisiert_am = CURRENT_TIMESTAMP";
      }
      sql += ` WHERE ${primaryKey} = ?`;

      db.run(sql, values, function (err) {
        if (err) {
          console.error(`Fehler beim Aktualisieren von ${tableName}:`, err);
          reject(err);
        } else {
          resolve({
            changes: this.changes,
            success: this.changes > 0,
          });
        }
      });
    });
  }

  // Generische Delete Methode
  static remove(id) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();
      const primaryKey = this.getPrimaryKey();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      const sql = `DELETE FROM ${tableName} WHERE ${primaryKey} = ?`;

      db.run(sql, [id], function (err) {
        if (err) {
          console.error(`Fehler beim Löschen von ${tableName}:`, err);
          reject(err);
        } else {
          resolve({
            changes: this.changes,
            success: this.changes > 0,
          });
        }
      });
    });
  }

  // Anzahl Datensätze zählen
  static count(conditions = {}) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
      const params = [];

      if (Object.keys(conditions).length > 0) {
        const whereConditions = [];
        Object.keys(conditions).forEach((key) => {
          whereConditions.push(`${key} = ?`);
          params.push(conditions[key]);
        });
        sql += ` WHERE ${whereConditions.join(" AND ")}`;
      }

      db.get(sql, params, (err, row) => {
        if (err) {
          console.error(`Fehler beim Zählen von ${tableName}:`, err);
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  // Existiert Datensatz?
  static exists(id) {
    return new Promise((resolve, reject) => {
      this.findById(id)
        .then((row) => resolve(!!row))
        .catch(reject);
    });
  }

  // Suche mit LIKE
  static search(searchTerm, searchColumns = []) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      if (searchColumns.length === 0) {
        return reject(new Error("Such-Spalten müssen definiert werden"));
      }

      const searchPattern = `%${searchTerm}%`;
      const whereConditions = searchColumns.map((col) => `${col} LIKE ?`);
      const params = searchColumns.map(() => searchPattern);

      const sql = `
        SELECT * FROM ${tableName} 
        WHERE ${whereConditions.join(" OR ")}
        ORDER BY ${this.getPrimaryKey()} DESC
      `;

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error(`Fehler bei der Suche in ${tableName}:`, err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Paginierung
  static paginate(page = 1, perPage = 20, options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const offset = (page - 1) * perPage;

        // Gesamtanzahl ermitteln
        const totalCount = await this.count(options.where || {});

        // Daten laden
        const data = await this.findAll({
          ...options,
          limit: perPage,
          offset: offset,
        });

        const totalPages = Math.ceil(totalCount / perPage);

        resolve({
          data,
          pagination: {
            current_page: page,
            per_page: perPage,
            total_count: totalCount,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1,
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Batch-Insert
  static createMany(dataArray) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        return reject(new Error("Daten-Array ist leer"));
      }

      // Alle Objekte müssen die gleichen Spalten haben
      const columns = Object.keys(dataArray[0]);
      const placeholders = columns.map(() => "?").join(", ");

      const sql = `
        INSERT INTO ${tableName} (${columns.join(", ")})
        VALUES (${placeholders})
      `;

      // Transaktion für Batch-Insert
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const stmt = db.prepare(sql);
        let completed = 0;
        let hasError = false;

        dataArray.forEach((data, index) => {
          if (hasError) return;

          const values = columns.map((col) => data[col]);

          stmt.run(values, (err) => {
            if (err && !hasError) {
              console.error(`Fehler beim Batch-Insert (Index ${index}):`, err);
              hasError = true;
              db.run("ROLLBACK");
              stmt.finalize();
              return reject(err);
            }

            completed++;

            if (completed === dataArray.length) {
              stmt.finalize();
              db.run("COMMIT", (err) => {
                if (err) {
                  console.error("Fehler beim Commit:", err);
                  return reject(err);
                }

                resolve({
                  inserted: completed,
                  success: true,
                });
              });
            }
          });
        });
      });
    });
  }

  // Raw SQL Query ausführen
  static query(sql, params = []) {
    return new Promise((resolve, reject) => {
      const db = this.getDb();

      // Bestimme ob SELECT oder UPDATE/INSERT/DELETE
      const isSelect = sql.trim().toLowerCase().startsWith("select");

      if (isSelect) {
        db.all(sql, params, (err, rows) => {
          if (err) {
            console.error("Fehler bei SQL-Query:", err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      } else {
        db.run(sql, params, function (err) {
          if (err) {
            console.error("Fehler bei SQL-Query:", err);
            reject(err);
          } else {
            resolve({
              changes: this.changes,
              lastID: this.lastID,
            });
          }
        });
      }
    });
  }

  // Tabellen-Schema abrufen
  static getTableSchema() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      const sql = `PRAGMA table_info(${tableName})`;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error(`Fehler beim Laden des Schemas für ${tableName}:`, err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // Tabelle leeren
  static truncate() {
    return new Promise((resolve, reject) => {
      const db = this.getDb();
      const tableName = this.getTableName();

      if (!tableName) {
        return reject(new Error("Tabellen-Name nicht definiert"));
      }

      const sql = `DELETE FROM ${tableName}`;

      db.run(sql, [], function (err) {
        if (err) {
          console.error(`Fehler beim Leeren von ${tableName}:`, err);
          reject(err);
        } else {
          resolve({
            deleted: this.changes,
            success: true,
          });
        }
      });
    });
  }
}

module.exports = BaseModel;
