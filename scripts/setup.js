#!/usr/bin/env node

// ===== FAF LACKIEREREI SETUP SCRIPT V2.0 =====
// Automatische Installation und Migration

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Farben für Console-Output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Log-Funktionen
function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, "green");
}

function error(message) {
  log(`❌ ${message}`, "red");
}

function warning(message) {
  log(`⚠️  ${message}`, "yellow");
}

function info(message) {
  log(`ℹ️  ${message}`, "blue");
}

function header(message) {
  log(`\n🚀 ${message}`, "cyan");
  log("=".repeat(60), "cyan");
}

// Hilfsfunktionen
function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function execCommand(command, description) {
  try {
    info(`Führe aus: ${description}`);
    execSync(command, { stdio: "inherit" });
    success(`${description} erfolgreich`);
    return true;
  } catch (err) {
    error(`Fehler bei: ${description}`);
    error(err.message);
    return false;
  }
}

function createDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    success(`Verzeichnis erstellt: ${dirPath}`);
  } else {
    info(`Verzeichnis existiert bereits: ${dirPath}`);
  }
}

// System-Checks
function checkSystemRequirements() {
  header("System-Anforderungen prüfen");

  // Node.js Version prüfen
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

  if (majorVersion >= 16) {
    success(`Node.js Version: ${nodeVersion} ✓`);
  } else {
    error(
      `Node.js Version ${nodeVersion} ist zu alt. Mindestens v16 erforderlich.`
    );
    process.exit(1);
  }

  // NPM prüfen
  try {
    const npmVersion = execSync("npm --version", { encoding: "utf8" }).trim();
    success(`NPM Version: ${npmVersion} ✓`);
  } catch (err) {
    error("NPM ist nicht installiert oder nicht verfügbar");
    process.exit(1);
  }

  // Schreibrechte prüfen
  try {
    const testFile = path.join(process.cwd(), ".write-test");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
    success("Schreibrechte im aktuellen Verzeichnis ✓");
  } catch (err) {
    error("Keine Schreibrechte im aktuellen Verzeichnis");
    process.exit(1);
  }
}

// Abhängigkeiten installieren
function installDependencies() {
  header("Abhängigkeiten installieren");

  if (!checkFileExists("package.json")) {
    error("package.json nicht gefunden!");
    process.exit(1);
  }

  return execCommand("npm install", "NPM Dependencies Installation");
}

// Datenbank-Setup
function setupDatabase() {
  header("Datenbank einrichten");

  const dataDir = path.join(__dirname, "..", "data");
  const dbPath = path.join(dataDir, "lackiererei.db");

  createDirectory(dataDir);

  // Prüfen ob Datenbank bereits existiert
  if (checkFileExists(dbPath)) {
    warning("Datenbank existiert bereits");

    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(
        "Möchten Sie die Datenbank migrieren (m) oder neu erstellen (n)? [m/n]: ",
        (answer) => {
          rl.close();

          if (answer.toLowerCase() === "n") {
            warning("Erstelle neue Datenbank (alte wird überschrieben)...");
            if (execCommand("npm run init-db", "Datenbank-Initialisierung")) {
              success("Neue Datenbank erstellt");
            }
          } else {
            info("Führe Template-Migration durch...");
            if (
              execCommand("npm run migrate-templates", "Template-Migration")
            ) {
              success("Datenbank erfolgreich migriert");
            }
          }
          resolve();
        }
      );
    });
  } else {
    info("Erstelle neue Datenbank...");
    if (execCommand("npm run init-db", "Datenbank-Initialisierung")) {
      success("Datenbank erfolgreich erstellt");
    }
  }
}

// Backup-Verzeichnis erstellen
function createBackupDirectory() {
  header("Backup-System einrichten");

  const backupDir = path.join(__dirname, "..", "backups");
  createDirectory(backupDir);

  // .gitignore für Backups erstellen
  const gitignorePath = path.join(backupDir, ".gitignore");
  if (!checkFileExists(gitignorePath)) {
    fs.writeFileSync(gitignorePath, "# Backup files\n*.db\n*.json\n");
    success("Backup .gitignore erstellt");
  }
}

// System-Konfiguration prüfen
function checkConfiguration() {
  header("Konfiguration prüfen");

  const requiredFiles = [
    "server.js",
    "public/index.html",
    "public/js/app.js",
    "public/js/templates.js",
    "public/css/style.css",
    "public/css/templates.css",
    "models/template.js",
    "controllers/templatesController.js",
    "routes/templates.js",
  ];

  let allFilesExist = true;

  requiredFiles.forEach((file) => {
    const filePath = path.join(__dirname, "..", file);
    if (checkFileExists(filePath)) {
      success(`${file} ✓`);
    } else {
      error(`${file} ❌`);
      allFilesExist = false;
    }
  });

  if (!allFilesExist) {
    error("Nicht alle erforderlichen Dateien sind vorhanden!");
    warning(
      "Bitte stellen Sie sicher, dass alle Template-System Files korrekt kopiert wurden."
    );
    process.exit(1);
  }

  success("Alle erforderlichen Dateien vorhanden");
}

// Berechtigungen setzen (Unix/Linux)
function setPermissions() {
  if (process.platform !== "win32") {
    header("Berechtigungen setzen");

    try {
      execSync("chmod +x scripts/setup.js", { stdio: "pipe" });
      execSync("chmod +x scripts/migrate-templates.js", { stdio: "pipe" });
      success("Ausführungsrechte für Scripts gesetzt");
    } catch (err) {
      warning("Konnte Ausführungsrechte nicht setzen (möglicherweise Windows)");
    }
  }
}

// Entwicklung-Setup
function setupDevelopment() {
  header("Entwicklungsumgebung einrichten");

  // Nodemon für Development
  try {
    execSync("npm list nodemon", { stdio: "pipe" });
    success("Nodemon bereits installiert");
  } catch (err) {
    info("Installiere Nodemon für Development...");
    execCommand("npm install --save-dev nodemon", "Nodemon Installation");
  }

  // .env Template erstellen
  const envPath = path.join(__dirname, "..", ".env.example");
  if (!checkFileExists(envPath)) {
    const envContent = `# FAF Lackiererei System Environment Variables
NODE_ENV=development
PORT=3000
DB_PATH=./data/lackiererei.db

# Optional: Database Backup Settings
BACKUP_INTERVAL=24
MAX_BACKUPS=30

# Optional: Security Settings
SESSION_SECRET=your-secret-key-here
RATE_LIMIT_MAX=1000
`;
    fs.writeFileSync(envPath, envContent);
    success(".env.example erstellt");
  }
}

// Server-Test
async function testServer() {
  header("Server-Test");

  return new Promise((resolve) => {
    const { spawn } = require("child_process");

    info("Starte Server zum Testen...");
    const server = spawn("node", ["server.js"], {
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "test" },
    });

    let serverStarted = false;
    const timeout = setTimeout(() => {
      if (!serverStarted) {
        server.kill();
        error("Server-Start-Timeout");
        resolve(false);
      }
    }, 10000);

    server.stdout.on("data", (data) => {
      if (data.toString().includes("Server läuft auf Port")) {
        serverStarted = true;
        clearTimeout(timeout);
        success("Server erfolgreich gestartet");

        // Server wieder stoppen
        server.kill();

        setTimeout(() => {
          success("Server-Test erfolgreich abgeschlossen");
          resolve(true);
        }, 1000);
      }
    });

    server.stderr.on("data", (data) => {
      error(`Server-Fehler: ${data.toString()}`);
      server.kill();
      clearTimeout(timeout);
      resolve(false);
    });

    server.on("error", (err) => {
      error(`Fehler beim Starten des Servers: ${err.message}`);
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

// Installations-Summary
function showSummary() {
  header("Installation abgeschlossen");

  success("FAF Lackiererei System v2.0 erfolgreich eingerichtet!");

  log("\n📋 Nächste Schritte:", "cyan");
  log("1. Server starten: npm start", "white");
  log("2. Browser öffnen: http://localhost:3000", "white");
  log("3. Template-System testen", "white");

  log("\n🎯 Neue Features in v2.0:", "magenta");
  log("• Template-Verwaltung für Aufträge und Rechnungen", "white");
  log(
    "• Kategorisierte Positionen (Arbeitszeiten/Materialien/Sonstiges)",
    "white"
  );
  log("• Ein-Klick-Import von Standard-Positionen", "white");
  log("• Verbesserte Rechnungsdarstellung", "white");
  log("• Template Import/Export Funktionen", "white");

  log("\n🔧 Entwicklung:", "yellow");
  log("• Development Server: npm run dev", "white");
  log("• Datenbank zurücksetzen: npm run init-db", "white");
  log("• Template-Migration: npm run migrate-templates", "white");

  log("\n📞 Support:", "blue");
  log("• README.md für detaillierte Dokumentation", "white");
  log("• Browser-Konsole für Debugging", "white");
  log("• Server-Logs für Fehleranalyse", "white");

  log("\n🎉 Viel Erfolg mit Ihrem erweiterten System!", "green");
}

// Haupt-Setup-Funktion
async function runSetup() {
  log(
    `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║    🎨 FAF LACKIEREREI SYSTEM V2.0 SETUP                     ║
║    Rechnungs- und Auftragssystem mit Template-System         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`,
    "cyan"
  );

  try {
    // Setup-Schritte ausführen
    checkSystemRequirements();

    if (!installDependencies()) {
      error("Installation der Abhängigkeiten fehlgeschlagen");
      process.exit(1);
    }

    checkConfiguration();
    setPermissions();
    createBackupDirectory();
    setupDevelopment();

    await setupDatabase();

    const serverTestResult = await testServer();
    if (!serverTestResult) {
      warning(
        "Server-Test fehlgeschlagen, aber Installation wurde abgeschlossen"
      );
      warning("Versuchen Sie den Server manuell zu starten: npm start");
    }

    showSummary();
  } catch (err) {
    error("Setup fehlgeschlagen");
    error(err.message);
    process.exit(1);
  }
}

// Setup starten wenn direkt ausgeführt
if (require.main === module) {
  runSetup();
}

module.exports = { runSetup };
