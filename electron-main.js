const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const os = require("os");
const { execSync } = require("child_process");

// Produktionsmodus erkennen
const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 3000;

let mainWindow;
let serverProcess;
let printWindows = new Set();

// VERBESSERT: Server-Prozess mit besserer Fehlerbehandlung
function startServer() {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starte Express Server...");

    serverProcess = spawn("node", ["server.js"], {
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: isDev ? "development" : "production" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let serverReady = false;
    let timeout;

    serverProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`Server: ${output}`);

      if (output.includes("Server läuft") && !serverReady) {
        serverReady = true;
        clearTimeout(timeout);
        console.log("✅ Server erfolgreich gestartet");
        resolve();
      }
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on("error", (error) => {
      console.error("Server Prozess Fehler:", error);
      if (!serverReady) {
        clearTimeout(timeout);
        reject(error);
      }
    });

    serverProcess.on("close", (code) => {
      console.log(`Server beendet mit Code ${code}`);
    });

    // VERBESSERT: Timeout mit besserer Fehlerbehandlung
    timeout = setTimeout(() => {
      if (!serverReady) {
        console.warn("⚠️ Server-Start Timeout - versuche trotzdem zu starten");
        resolve(); // Auch bei Timeout weitermachen
      }
    }, 8000); // Längerer Timeout für Win10
  });
}

// Windows-Version erkennen
function getWindowsVersion() {
  try {
    const version = os.release();
    const major = parseInt(version.split(".")[0]);
    const minor = parseInt(version.split(".")[1]);

    if (major === 10) {
      if (minor >= 22000) {
        return "Windows 11";
      } else {
        return "Windows 10";
      }
    }
    return `Windows ${major}.${minor}`;
  } catch (error) {
    return "Windows Unknown";
  }
}

// Prozess-Priorität für bessere Performance auf älteren Systemen
function optimizeForSystem() {
  const windowsVersion = getWindowsVersion();
  console.log(`🖥️ Erkannte Version: ${windowsVersion}`);

  if (windowsVersion.includes("Windows 10")) {
    try {
      // Niedrigere Priorität für bessere Stabilität auf Win10
      process.priority = -5;
      console.log("⚡ Prozess-Priorität optimiert für Windows 10");
    } catch (error) {
      console.warn("⚠️ Priorität konnte nicht gesetzt werden:", error.message);
    }
  }
}

function ensureDataDirectory() {
  const dataPath = path.join(__dirname, "data");

  try {
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
      console.log("📁 Data-Verzeichnis erstellt");
    }

    // Teste Schreibberechtigung
    const testFile = path.join(dataPath, "test.tmp");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
    console.log("✅ Schreibberechtigung bestätigt");
  } catch (error) {
    console.error("❌ Problem mit Data-Verzeichnis:", error);

    // Fallback: Benutzer-Verzeichnis verwenden
    const userDataPath = path.join(os.homedir(), ".kfzfacpro");
    try {
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      console.log("📁 Fallback-Pfad verwendet:", userDataPath);
      return userDataPath;
    } catch (fallbackError) {
      console.error("❌ Auch Fallback-Pfad fehlgeschlagen:", fallbackError);
    }
  }

  return dataPath;
}

// VERBESSERT: Server-Verfügbarkeit prüfen
async function waitForServer(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`http://localhost:${PORT}/api/health`);
      if (response.ok) {
        console.log("✅ Server ist verfügbar");
        return true;
      }
    } catch (error) {
      console.log(`🔄 Warte auf Server... (Versuch ${i + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// VERBESSERT: Hauptfenster mit besserer Initialisierung
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      // WICHTIG: Partition für Session-Isolation
      partition: "persist:main",
    },
    icon: path.join(__dirname, "public", "favicon.ico"),
    show: false,
    titleBarStyle: "default",
  });

  // Menü erstellen
  createMenu();

  // VERBESSERT: Sequenzielle Server-Initialisierung
  initializeApp();
}

// NEUE FUNKTION: Bessere App-Initialisierung
async function initializeApp() {
  try {
    console.log("🔄 Starte Initialisierung...");

    optimizeForSystem(); // Diese Zeile hinzufügen
    ensureDataDirectory(); // Diese Zeile hinzufügen

    // 1. Server starten
    await startServer();

    // 2. Warten bis Server verfügbar ist
    const serverAvailable = await waitForServer();
    if (!serverAvailable) {
      throw new Error("Server ist nicht verfügbar");
    }

    // 3. WICHTIG: Immer zur Login-Seite weiterleiten
    console.log("🔄 Lade Login-Seite...");
    await mainWindow.loadURL(`http://localhost:${PORT}/login`);

    // 4. Fenster anzeigen
    mainWindow.show();

    // 5. DevTools nur im Development
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }

    console.log("✅ App erfolgreich initialisiert");
  } catch (error) {
    console.error("❌ Fehler bei der Initialisierung:", error);

    // Fallback: Versuche direkt zu laden
    try {
      await mainWindow.loadURL(`http://localhost:${PORT}/login`);
      mainWindow.show();
    } catch (fallbackError) {
      console.error("❌ Auch Fallback fehlgeschlagen:", fallbackError);

      // Letzter Versuch: Offline-Seite
      mainWindow.loadFile(path.join(__dirname, "public", "offline.html"));
      mainWindow.show();
    }
  }
}

// VERBESSERT: Window open handler
function setupWindowHandlers() {
  mainWindow.webContents.setWindowOpenHandler(
    ({ url, frameName, features }) => {
      console.log("Window open requested:", { url, frameName, features });

      if (!url || url === "about:blank" || url === "") {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            width: 1024,
            height: 768,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              webSecurity: false,
              allowRunningInsecureContent: true,
            },
            show: true,
            autoHideMenuBar: true,
            parent: mainWindow,
            modal: false,
          },
        };
      }

      shell.openExternal(url);
      return { action: "deny" };
    }
  );

  // VERBESSERT: Bessere Navigation-Handhabung
  mainWindow.webContents.on("did-navigate", (event, url) => {
    console.log("Navigiert zu:", url);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error("Ladefehler:", {
        errorCode,
        errorDescription,
        validatedURL,
      });

      // Bei Ladefehler zur Offline-Seite
      if (errorCode !== -3) {
        // -3 ist "abgebrochen"
        mainWindow.loadFile(path.join(__dirname, "public", "offline.html"));
      }
    }
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
    printWindows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.close();
      }
    });
    printWindows.clear();
  });
}

// Anwendungsmenü erstellen
function createMenu() {
  const template = [
    {
      label: "Datei",
      submenu: [
        {
          label: "Neuer Auftrag",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              if (typeof showSection === 'function') {
                showSection('auftrag-erstellen');
              }
            `);
          },
        },
        {
          label: "Neue Rechnung",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              if (typeof showSection === 'function') {
                showSection('rechnung-erstellen');
              }
            `);
          },
        },
        { type: "separator" },
        {
          label: "Backup erstellen",
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow, {
              title: "Backup speichern",
              defaultPath: `backup-${
                new Date().toISOString().split("T")[0]
              }.db`,
              filters: [{ name: "Datenbank", extensions: ["db"] }],
            });

            if (!result.canceled) {
              mainWindow.webContents.executeJavaScript(`
                fetch('/api/backup/create', { method: 'POST' })
                  .then(response => response.json())
                  .then(data => {
                    if (data.success) {
                      alert('Backup erfolgreich erstellt!');
                    } else {
                      alert('Fehler beim Backup: ' + data.error);
                    }
                  })
                  .catch(err => alert('Backup-Fehler: ' + err.message));
              `);
            }
          },
        },
        { type: "separator" },
        {
          label: "Beenden",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Bearbeiten",
      submenu: [
        { label: "Rückgängig", accelerator: "CmdOrCtrl+Z", role: "undo" },
        {
          label: "Wiederholen",
          accelerator: "Shift+CmdOrCtrl+Z",
          role: "redo",
        },
        { type: "separator" },
        { label: "Ausschneiden", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Kopieren", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Einfügen", accelerator: "CmdOrCtrl+V", role: "paste" },
      ],
    },
    {
      label: "Ansicht",
      submenu: [
        { label: "Neu laden", accelerator: "CmdOrCtrl+R", role: "reload" },
        {
          label: "Force Reload",
          accelerator: "CmdOrCtrl+Shift+R",
          role: "forceReload",
        },
        {
          label: "Entwicklertools",
          accelerator: "F12",
          role: "toggleDevTools",
        },
        { type: "separator" },
        { label: "Vollbild", accelerator: "F11", role: "togglefullscreen" },
      ],
    },
    {
      label: "Hilfe",
      submenu: [
        {
          label: "Über",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Über Meine Firma - Rechnungssystem",
              message: "Meine Firma - Rechnungssystem",
              detail:
                "Version 2.0\nEin modernes Rechnungs- und Auftragssystem\nEntwickelt mit Electron und Node.js",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App-Events
app.whenReady().then(() => {
  createWindow();
  setupWindowHandlers();
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Bessere Fehlerbehandlung
process.on("uncaughtException", (error) => {
  console.error("Unbehandelte Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unbehandelte Promise Rejection:", reason);
});
