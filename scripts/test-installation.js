// scripts/test-installation.js
// Dieses Script testet die Installation auf verschiedenen Windows-Versionen

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

class InstallationTester {
  constructor() {
    this.results = {
      system: {},
      paths: {},
      dependencies: {},
      database: {},
      network: {},
      permissions: {},
    };
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const prefix =
      {
        info: "📋",
        success: "✅",
        warning: "⚠️",
        error: "❌",
      }[type] || "📋";

    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async testSystemInfo() {
    this.log("System-Informationen sammeln...");

    try {
      this.results.system = {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        version: os.version(),
        nodeVersion: process.version,
        electronVersion: this.getElectronVersion(),
        homeDir: os.homedir(),
        tmpDir: os.tmpdir(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        memory: {
          total: Math.round(os.totalmem() / 1024 / 1024 / 1024) + " GB",
          free: Math.round(os.freemem() / 1024 / 1024 / 1024) + " GB",
        },
      };

      this.log(
        `Platform: ${this.results.system.platform} ${this.results.system.arch}`,
        "success"
      );
      this.log(`OS Version: ${this.results.system.release}`, "success");
      this.log(`Node.js: ${this.results.system.nodeVersion}`, "success");

      return true;
    } catch (error) {
      this.log(`System-Info-Fehler: ${error.message}`, "error");
      return false;
    }
  }

  getElectronVersion() {
    try {
      const packagePath = path.join(
        __dirname,
        "..",
        "node_modules",
        "electron",
        "package.json"
      );
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
        return pkg.version;
      }
    } catch (error) {
      return "nicht gefunden";
    }
    return "unbekannt";
  }

  async testPaths() {
    this.log("Pfad-Zugriffe testen...");

    const pathsToTest = [
      { name: "Projekt-Root", path: path.join(__dirname, "..") },
      { name: "Data-Verzeichnis", path: path.join(__dirname, "..", "data") },
      {
        name: "Public-Verzeichnis",
        path: path.join(__dirname, "..", "public"),
      },
      {
        name: "Node-Modules",
        path: path.join(__dirname, "..", "node_modules"),
      },
      {
        name: "Backup-Verzeichnis",
        path: path.join(__dirname, "..", "backups"),
      },
      { name: "Benutzer-Daten", path: path.join(os.homedir(), ".kfzfacpro") },
    ];

    for (const pathTest of pathsToTest) {
      try {
        const exists = fs.existsSync(pathTest.path);
        let permissions = null;

        if (exists) {
          // Test Schreibberechtigung
          try {
            const testFile = path.join(pathTest.path, `test_${Date.now()}.tmp`);
            fs.writeFileSync(testFile, "test");
            fs.unlinkSync(testFile);
            permissions = "read/write";
          } catch (writeError) {
            permissions = "read-only";
          }
        } else {
          // Versuche Verzeichnis zu erstellen
          try {
            fs.mkdirSync(pathTest.path, { recursive: true });
            permissions = "created";
          } catch (createError) {
            permissions = "no access";
          }
        }

        this.results.paths[pathTest.name] = {
          path: pathTest.path,
          exists,
          permissions,
        };

        this.log(
          `${pathTest.name}: ${
            exists ? "existiert" : "fehlt"
          } (${permissions})`,
          permissions === "no access" ? "error" : "success"
        );
      } catch (error) {
        this.results.paths[pathTest.name] = {
          path: pathTest.path,
          exists: false,
          permissions: "error",
          error: error.message,
        };
        this.log(`${pathTest.name}: Fehler - ${error.message}`, "error");
      }
    }
  }

  async testDependencies() {
    this.log("Abhängigkeiten prüfen...");

    const dependencies = [
      "express",
      "sqlite3",
      "electron",
      "bcrypt",
      "cors",
      "helmet",
    ];

    for (const dep of dependencies) {
      try {
        const modulePath = path.join(__dirname, "..", "node_modules", dep);
        const exists = fs.existsSync(modulePath);

        if (exists) {
          // Versuche Modul zu laden
          try {
            require(dep);
            this.results.dependencies[dep] = { status: "OK", loadable: true };
            this.log(`${dep}: Verfügbar und ladbar`, "success");
          } catch (loadError) {
            this.results.dependencies[dep] = {
              status: "ERROR",
              loadable: false,
              error: loadError.message,
            };
            this.log(
              `${dep}: Vorhanden aber nicht ladbar - ${loadError.message}`,
              "error"
            );
          }
        } else {
          this.results.dependencies[dep] = {
            status: "MISSING",
            loadable: false,
          };
          this.log(`${dep}: Nicht installiert`, "error");
        }
      } catch (error) {
        this.results.dependencies[dep] = {
          status: "ERROR",
          error: error.message,
        };
        this.log(`${dep}: Fehler - ${error.message}`, "error");
      }
    }
  }

  async testDatabase() {
    this.log("Datenbank-Zugriff testen...");

    try {
      const sqlite3 = require("sqlite3");
      const dbPath = path.join(__dirname, "..", "data", "test.db");

      // Erstelle Test-Datenbank
      const db = new sqlite3.Database(dbPath);

      await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run(
            "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)",
            (err) => {
              if (err) reject(err);
            }
          );

          db.run("INSERT INTO test (name) VALUES (?)", ["test"], (err) => {
            if (err) reject(err);
          });

          db.get("SELECT * FROM test WHERE name = ?", ["test"], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      });

      db.close();

      // Test-DB löschen
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }

      this.results.database.status = "OK";
      this.log("Datenbank-Test erfolgreich", "success");
    } catch (error) {
      this.results.database.status = "ERROR";
      this.results.database.error = error.message;
      this.log(`Datenbank-Test fehlgeschlagen: ${error.message}`, "error");
    }
  }

  async testNetwork() {
    this.log("Netzwerk-Zugriff testen...");

    const portsToTest = [3000, 3001, 8080];

    for (const port of portsToTest) {
      try {
        const net = require("net");
        const server = net.createServer();

        await new Promise((resolve, reject) => {
          server.listen(port, () => {
            server.close();
            this.results.network[`port_${port}`] = "available";
            this.log(`Port ${port}: Verfügbar`, "success");
            resolve();
          });

          server.on("error", (err) => {
            this.results.network[`port_${port}`] = "occupied";
            this.log(`Port ${port}: Belegt`, "warning");
            resolve();
          });
        });
      } catch (error) {
        this.results.network[`port_${port}`] = "error";
        this.log(`Port ${port}: Fehler - ${error.message}`, "error");
      }
    }
  }

  async testPermissions() {
    this.log("Berechtigungen testen...");

    const testPaths = [
      path.join(__dirname, ".."),
      path.join(__dirname, "..", "data"),
      path.join(os.homedir()),
      path.join(os.tmpdir()),
    ];

    for (const testPath of testPaths) {
      try {
        // Test verschiedene Operationen
        const testFile = path.join(
          testPath,
          `permission_test_${Date.now()}.tmp`
        );

        // Schreiben
        fs.writeFileSync(testFile, "permission test");

        // Lesen
        const content = fs.readFileSync(testFile, "utf8");

        // Löschen
        fs.unlinkSync(testFile);

        this.results.permissions[testPath] = "full";
        this.log(`${testPath}: Vollzugriff`, "success");
      } catch (error) {
        this.results.permissions[testPath] = "limited";
        this.log(`${testPath}: Eingeschränkt - ${error.message}`, "warning");
      }
    }
  }

  generateReport() {
    this.log("Generiere Bericht...");

    const reportPath = path.join(
      __dirname,
      "..",
      `installation-test-${Date.now()}.json`
    );
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: this.generateSummary(),
    };

    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      this.log(`Bericht gespeichert: ${reportPath}`, "success");
    } catch (error) {
      this.log(`Fehler beim Speichern des Berichts: ${error.message}`, "error");
    }

    return report;
  }

  generateSummary() {
    const issues = [];
    const warnings = [];

    // System-Checks
    if (this.results.system.platform !== "win32") {
      issues.push("Nicht-Windows-System erkannt");
    }

    // Dependency-Checks
    for (const [dep, result] of Object.entries(this.results.dependencies)) {
      if (result.status !== "OK") {
        issues.push(`Abhängigkeit ${dep}: ${result.status}`);
      }
    }

    // Database-Checks
    if (this.results.database.status !== "OK") {
      issues.push(
        `Datenbank-Problem: ${this.results.database.error || "Unbekannt"}`
      );
    }

    // Path-Checks
    for (const [name, result] of Object.entries(this.results.paths)) {
      if (result.permissions === "no access") {
        issues.push(`Kein Zugriff auf ${name}`);
      } else if (result.permissions === "read-only") {
        warnings.push(`Nur Lesezugriff auf ${name}`);
      }
    }

    return {
      overallStatus:
        issues.length === 0
          ? warnings.length === 0
            ? "GOOD"
            : "WARNING"
          : "ERROR",
      issues,
      warnings,
      issueCount: issues.length,
      warningCount: warnings.length,
    };
  }

  async runAllTests() {
    this.log("🔍 Starte Installation-Tests...");

    await this.testSystemInfo();
    await this.testPaths();
    await this.testDependencies();
    await this.testDatabase();
    await this.testNetwork();
    await this.testPermissions();

    const report = this.generateReport();

    this.log("📊 Test-Zusammenfassung:");
    this.log(`Status: ${report.summary.overallStatus}`);
    this.log(`Probleme: ${report.summary.issueCount}`);
    this.log(`Warnungen: ${report.summary.warningCount}`);

    if (report.summary.issues.length > 0) {
      this.log("🚨 Gefundene Probleme:", "error");
      report.summary.issues.forEach((issue) =>
        this.log(`  - ${issue}`, "error")
      );
    }

    if (report.summary.warnings.length > 0) {
      this.log("⚠️ Warnungen:", "warning");
      report.summary.warnings.forEach((warning) =>
        this.log(`  - ${warning}`, "warning")
      );
    }

    if (report.summary.overallStatus === "GOOD") {
      this.log(
        "🎉 Alle Tests bestanden! Installation sollte funktionieren.",
        "success"
      );
    } else if (report.summary.overallStatus === "WARNING") {
      this.log(
        "⚠️ Tests mit Warnungen abgeschlossen. Installation möglich aber mit Einschränkungen.",
        "warning"
      );
    } else {
      this.log(
        "❌ Tests fehlgeschlagen. Installation wird wahrscheinlich Probleme haben.",
        "error"
      );
    }

    return report;
  }
}

// Script ausführen
if (require.main === module) {
  const tester = new InstallationTester();
  tester
    .runAllTests()
    .then((report) => {
      process.exit(report.summary.overallStatus === "ERROR" ? 1 : 0);
    })
    .catch((error) => {
      console.error("❌ Test-Script-Fehler:", error);
      process.exit(1);
    });
}

module.exports = InstallationTester;
