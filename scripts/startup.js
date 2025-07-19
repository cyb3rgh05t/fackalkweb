// scripts/startup.js - VERBESSERTE Windows-Version
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

class StartupManager {
  constructor() {
    this.maxRetries = 5;
    this.retryDelay = 2000;
    this.isWindows = os.platform() === "win32";
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

  async checkDependencies() {
    this.log("Überprüfe Abhängigkeiten...");

    // Node.js-Version prüfen
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

    if (majorVersion < 16) {
      throw new Error(
        `Node.js ${nodeVersion} ist zu alt. Mindestens v16 erforderlich.`
      );
    }

    this.log(`Node.js ${nodeVersion} OK`, "success");

    // SQLite3-Modul prüfen
    try {
      require("sqlite3");
      this.log("SQLite3-Modul verfügbar", "success");
    } catch (error) {
      this.log("SQLite3-Modul fehlt. Führe 'npm install' aus.", "error");
      throw error;
    }

    // WICHTIG: Electron prüfen mit verbesserter Erkennung
    await this.checkElectron();
  }

  async checkElectron() {
    this.log("Prüfe Electron-Installation...");

    // Verschiedene Pfade für Electron versuchen
    const possiblePaths = [
      path.join(__dirname, "..", "node_modules", ".bin", "electron.cmd"),
      path.join(__dirname, "..", "node_modules", ".bin", "electron"),
      path.join(
        __dirname,
        "..",
        "node_modules",
        "electron",
        "dist",
        "electron.exe"
      ),
      "npx electron", // Fallback über npx
    ];

    let electronFound = false;
    let workingPath = null;

    for (const electronPath of possiblePaths) {
      try {
        if (electronPath === "npx electron") {
          // Teste npx electron
          execSync("npx electron --version", { stdio: "pipe" });
          workingPath = "npx electron";
          electronFound = true;
          this.log("Electron über npx verfügbar", "success");
          break;
        } else {
          // Teste lokale Installation
          if (fs.existsSync(electronPath)) {
            try {
              execSync(`"${electronPath}" --version`, { stdio: "pipe" });
              workingPath = electronPath;
              electronFound = true;
              this.log(`Electron gefunden: ${electronPath}`, "success");
              break;
            } catch (testError) {
              this.log(`Electron-Binary defekt: ${electronPath}`, "warning");
            }
          }
        }
      } catch (error) {
        // Pfad nicht verfügbar, weiter versuchen
      }
    }

    if (!electronFound) {
      this.log("Electron nicht gefunden. Installiere Electron...", "warning");
      await this.installElectron();

      // Nochmal prüfen nach Installation
      try {
        execSync("npx electron --version", { stdio: "pipe" });
        workingPath = "npx electron";
        this.log("Electron erfolgreich installiert", "success");
      } catch (error) {
        throw new Error("Electron-Installation fehlgeschlagen");
      }
    }

    this.electronPath = workingPath;
    return workingPath;
  }

  async installElectron() {
    this.log("Installiere Electron...");

    try {
      // Versuche npm install
      execSync("npm install electron --save-dev", {
        stdio: "inherit",
        cwd: path.join(__dirname, ".."),
      });
      this.log("Electron über npm installiert", "success");
    } catch (error) {
      this.log(
        "npm install fehlgeschlagen, versuche cache clean...",
        "warning"
      );

      try {
        execSync("npm cache clean --force", { stdio: "inherit" });
        execSync("npm install electron --save-dev", {
          stdio: "inherit",
          cwd: path.join(__dirname, ".."),
        });
        this.log("Electron nach cache clean installiert", "success");
      } catch (retryError) {
        throw new Error(
          `Electron-Installation fehlgeschlagen: ${retryError.message}`
        );
      }
    }
  }

  async initializeDatabase() {
    this.log("Initialisiere Datenbank...");

    const setupScript = path.join(__dirname, "setup.js");

    if (!fs.existsSync(setupScript)) {
      this.log("Setup-Script nicht gefunden, überspringe DB-Init", "warning");
      return;
    }

    return new Promise((resolve, reject) => {
      const child = spawn("node", [setupScript], {
        stdio: "inherit",
        cwd: path.dirname(setupScript),
      });

      child.on("close", (code) => {
        if (code === 0) {
          this.log("Datenbank initialisiert", "success");
          resolve();
        } else {
          this.log(`Setup-Script fehlgeschlagen mit Code ${code}`, "warning");
          resolve(); // Nicht abbrechen, App kann trotzdem starten
        }
      });

      child.on("error", (error) => {
        this.log(`Setup-Script Fehler: ${error.message}`, "warning");
        resolve(); // Nicht abbrechen
      });
    });
  }

  async startApplication() {
    try {
      await this.checkDependencies();

      // Datenbank nur initialisieren wenn nicht vorhanden
      const dbPath = path.join(__dirname, "..", "data", "kfz.db");
      if (!fs.existsSync(dbPath)) {
        await this.initializeDatabase();
      }

      this.log("Starte Hauptanwendung...");

      // VERBESSERT: Robuste Electron-Start-Methoden
      await this.startElectron();
    } catch (error) {
      this.log(`Startup-Fehler: ${error.message}`, "error");
      this.log("Versuche alternativen Start...", "warning");

      // Fallback: Nur Server starten
      await this.startServerOnly();
    }
  }

  async startElectron() {
    const mainScript = path.join(__dirname, "..", "electron-main.js");

    return new Promise((resolve, reject) => {
      let child;

      if (this.electronPath === "npx electron") {
        // Über npx starten
        child = spawn("npx", ["electron", mainScript], {
          stdio: "inherit",
          shell: this.isWindows, // Wichtig für Windows
          env: {
            ...process.env,
            NODE_ENV: "production",
          },
          cwd: path.join(__dirname, ".."),
        });
      } else {
        // Über direkten Pfad starten
        const args = [mainScript];
        // FIXED: Nicht doppelt .cmd anhängen
        const electronExe = this.electronPath;

        child = spawn(electronExe, args, {
          stdio: "inherit",
          shell: this.isWindows,
          env: {
            ...process.env,
            NODE_ENV: "production",
          },
          cwd: path.join(__dirname, ".."),
        });
      }

      child.on("error", (error) => {
        this.log(`Electron-Start-Fehler: ${error.message}`, "error");
        reject(error);
      });

      child.on("close", (code) => {
        this.log(`Electron beendet mit Code ${code}`);
        resolve();
      });

      // Nach 5 Sekunden als erfolgreich betrachten (Electron läuft)
      setTimeout(() => {
        this.log("Electron erfolgreich gestartet", "success");
        resolve();
      }, 5000);
    });
  }

  async startServerOnly() {
    this.log("Starte nur den Server (Fallback-Modus)...", "warning");
    this.log("Du kannst die App dann im Browser öffnen: http://localhost:3000");

    const serverScript = path.join(__dirname, "..", "server.js");

    const child = spawn("node", [serverScript], {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "production",
      },
      cwd: path.join(__dirname, ".."),
    });

    child.on("error", (error) => {
      this.log(`Auch Server-Start fehlgeschlagen: ${error.message}`, "error");
      this.log("Versuche manuell: npm start", "info");
      process.exit(1);
    });

    this.log("Server gestartet im Fallback-Modus", "success");
  }
}

// Script ausführen
if (require.main === module) {
  const manager = new StartupManager();
  manager.startApplication().catch((error) => {
    console.error("❌ Kritischer Startup-Fehler:", error);
    console.log("\n🔧 Manuelle Alternativen:");
    console.log("1. npm start                    # Nur Server");
    console.log("2. npm run electron-dev-win     # Electron separat");
    console.log("3. npx electron .               # Direkt über npx");
    process.exit(1);
  });
}

module.exports = StartupManager;
