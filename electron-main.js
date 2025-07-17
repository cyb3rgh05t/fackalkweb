const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// Produktionsmodus erkennen
const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 3000;

let mainWindow;
let serverStarted = false;

// Server direkt in dieser Instanz starten (ohne spawn)
function startServer() {
  return new Promise((resolve, reject) => {
    if (serverStarted) {
      resolve();
      return;
    }

    console.log("🚀 Starte Express Server...");

    try {
      // Verschiedene Pfade für server.js testen
      const possiblePaths = [
        path.join(__dirname, "server.js"),
        path.join(process.resourcesPath, "app", "server.js"),
        path.join(process.resourcesPath, "server.js"),
        path.join(__dirname, "..", "server.js"),
      ];

      let serverPath = null;

      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          serverPath = testPath;
          console.log("✅ Server.js gefunden:", serverPath);
          break;
        }
      }

      if (!serverPath) {
        throw new Error(
          "Server.js nicht gefunden in den Pfaden: " + possiblePaths.join(", ")
        );
      }

      // Working Directory auf den Server-Ordner setzen
      process.chdir(path.dirname(serverPath));

      // Server laden
      require(serverPath);

      serverStarted = true;

      // Kurz warten, bis Server gestartet ist
      setTimeout(() => {
        resolve();
      }, 3000);
    } catch (error) {
      console.error("Fehler beim Starten des Servers:", error);
      reject(error);
    }
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
  startServer()
    .then(() => {
      console.log("✅ Server gestartet, lade Fenster...");
      mainWindow.loadURL(`http://localhost:${PORT}`);

      mainWindow.once("ready-to-show", () => {
        mainWindow.show();
        if (isDev) {
          mainWindow.webContents.openDevTools();
        }
      });
    })
    .catch((error) => {
      console.error("❌ Server-Start fehlgeschlagen:", error);
      // Fehlerdialog anzeigen
      dialog.showErrorBox(
        "Server-Fehler",
        "Der Express-Server konnte nicht gestartet werden.\n\nFehler: " +
          error.message
      );
      app.quit();
    });

  // Externe Links im Browser öffnen
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Fehler beim Laden abfangen
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        "Fehler beim Laden:",
        errorCode,
        errorDescription,
        validatedURL
      );

      // Retry nach 1 Sekunde
      setTimeout(() => {
        mainWindow.loadURL(`http://localhost:${PORT}`);
      }, 1000);
    }
  );

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
              title: "Über KFZ Fac Pro - Rechnungssystem",
              message: "KFZ Fac Pro - Rechnungssystem",
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
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Unbehandelte Exceptions abfangen
process.on("uncaughtException", (error) => {
  console.error("Unbehandelte Exception:", error);
  if (mainWindow) {
    dialog.showErrorBox(
      "Anwendungsfehler",
      "Ein unerwarteter Fehler ist aufgetreten:\n\n" + error.message
    );
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unbehandelte Promise Rejection:", reason);
});
