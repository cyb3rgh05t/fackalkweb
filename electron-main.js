const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

// Produktionsmodus erkennen
const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 3000;

let mainWindow;
let serverProcess;

// Server-Prozess starten
function startServer() {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starte Express Server...");

    serverProcess = spawn("node", ["server.js"], {
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: isDev ? "development" : "production" },
    });

    serverProcess.stdout.on("data", (data) => {
      console.log(`Server: ${data}`);
      if (data.toString().includes("Server läuft")) {
        resolve();
      }
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on("close", (code) => {
      console.log(`Server beendet mit Code ${code}`);
    });

    // Timeout für Server-Start
    setTimeout(() => {
      resolve(); // Auch bei Timeout weitermachen
    }, 5000);
  });
}

// Hauptfenster erstellen
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
    },
    icon: path.join(__dirname, "public", "favicon.ico"),
    show: false, // Erst nach dem Laden anzeigen
    titleBarStyle: "default",
  });

  // Menü erstellen
  createMenu();

  // Warten bis Server läuft, dann Fenster laden
  startServer().then(() => {
    mainWindow.loadURL(`http://localhost:${PORT}`);

    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      if (isDev) {
        mainWindow.webContents.openDevTools();
      }
    });
  });

  // Externe Links im Browser öffnen
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
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
                "Version 2.0\\nEin modernes Rechnungs- und Auftragssystem\\nEntwickelt mit Electron und Node.js",
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
app.whenReady().then(createWindow);

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

// Unbehandelte Exceptions abfangen
process.on("uncaughtException", (error) => {
  console.error("Unbehandelte Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unbehandelte Promise Rejection:", reason);
});
