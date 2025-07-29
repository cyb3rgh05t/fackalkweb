const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { getAppVersion, getBuildInfo, getPackageInfo } = require("./version");

// Server-Referenz
let server;
let mainWindow;
let printWindows = new Set();

// Produktionsmodus erkennen
const isDev = process.env.NODE_ENV === "development";
const isPackaged = app.isPackaged;
const PORT = process.env.PORT || 3000;

// KORRIGIERT: Server richtig starten
function startServer() {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starte Express Server...");

    try {
      // Cache leeren für Neustart
      delete require.cache[require.resolve("./server.js")];

      // Server-Modul laden
      const serverModule = require("./server.js");

      // Die startServer Funktion aus dem Modul verwenden
      if (typeof serverModule.startServer === "function") {
        serverModule
          .startServer(PORT)
          .then((serverInstance) => {
            server = serverInstance; // Korrekte Server-Instanz speichern
            console.log("✅ Server erfolgreich gestartet");
            resolve();
          })
          .catch((error) => {
            console.error("❌ Server-Start-Fehler:", error);
            reject(error);
          });
      } else {
        throw new Error("startServer Funktion nicht gefunden in server.js");
      }
    } catch (error) {
      console.error("❌ Server-Modul-Fehler:", error);
      reject(error);
    }
  });
}

// Server auf Verfügbarkeit prüfen
async function waitForServer(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`http://localhost:${PORT}/login`);
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

// Ressourcen-Pfade für gepackte App korrigieren
function getResourcePath(relativePath) {
  if (isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, relativePath);
}

// Data-Verzeichnis sicherstellen
function ensureDataDirectory() {
  const dataDir = isPackaged
    ? path.join(path.dirname(process.execPath), "data")
    : path.join(__dirname, "data");

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`📁 Data-Verzeichnis erstellt: ${dataDir}`);
  }

  // Umgebungsvariable setzen für SQLite
  process.env.DB_PATH = path.join(dataDir, "kfz.db");
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
      partition: "persist:main",
    },
    icon: getResourcePath(path.join("public", "favicon.ico")),
    show: false,
    titleBarStyle: "default",
  });

  createMenu();
  setupWindowHandlers();
  initializeApp();
}

// App-Initialisierung
async function initializeApp() {
  try {
    console.log("🔄 Starte Initialisierung...");

    ensureDataDirectory();

    // Server starten
    await startServer();

    // Warten bis Server verfügbar ist
    const serverAvailable = await waitForServer();
    if (!serverAvailable) {
      throw new Error("Server ist nicht verfügbar");
    }

    // Login-Seite laden
    console.log("🔄 Lade Login-Seite...");
    await mainWindow.loadURL(`http://localhost:${PORT}/login`);

    // Fenster anzeigen
    mainWindow.show();

    // DevTools nur im Development
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }

    console.log("✅ App erfolgreich initialisiert");
  } catch (error) {
    console.error("❌ Fehler bei der Initialisierung:", error);

    // Fallback: Offline-Seite
    try {
      const offlinePage = getResourcePath(path.join("public", "offline.html"));
      if (fs.existsSync(offlinePage)) {
        await mainWindow.loadFile(offlinePage);
      } else {
        // Simple Error-HTML erstellen wenn offline.html nicht existiert
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head><title>KFZ Fac Pro - Fehler</title></head>
          <body>
            <h1>Fehler beim Starten der Anwendung</h1>
            <p>Die Anwendung konnte nicht gestartet werden.</p>
            <p>Fehler: ${error.message}</p>
          </body>
          </html>
        `;
        await mainWindow.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`
        );
      }
      mainWindow.show();
    } catch (fallbackError) {
      console.error("❌ Auch Fallback fehlgeschlagen:", fallbackError);
      dialog.showErrorBox(
        "Startfehler",
        `Die Anwendung konnte nicht gestartet werden: ${error.message}`
      );
      app.quit();
    }
  }
}

// Window-Handler einrichten
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

      if (errorCode !== -3) {
        // -3 ist "abgebrochen"
        const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Verbindungsfehler</title></head>
        <body>
          <h1>Verbindungsfehler</h1>
          <p>Die Seite konnte nicht geladen werden.</p>
          <p>Fehlercode: ${errorCode}</p>
          <p>Beschreibung: ${errorDescription}</p>
          <button onclick="location.reload()">Erneut versuchen</button>
        </body>
        </html>
      `;
        mainWindow.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`
        );
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
// Anwendungsmenü erstellen - Einfache funktionierende Version
function createMenu() {
  const template = [
    // DATEI-MENÜ
    {
      label: "Datei",
      submenu: [
        {
          label: "Neue Rechnung",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`http://localhost:${PORT}/rechnungen`);
            }
          },
        },
        {
          label: "Neuer Auftrag",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`http://localhost:${PORT}/auftraege`);
            }
          },
        },
        { type: "separator" },
        {
          label: "Drucken",
          accelerator: "CmdOrCtrl+P",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.print();
            }
          },
        },
        { type: "separator" },
        {
          label: "Beenden",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => app.quit(),
        },
      ],
    },

    // BEARBEITEN-MENÜ
    {
      label: "Bearbeiten",
      submenu: [
        { role: "undo", label: "Rückgängig" },
        { role: "redo", label: "Wiederholen" },
        { type: "separator" },
        { role: "cut", label: "Ausschneiden" },
        { role: "copy", label: "Kopieren" },
        { role: "paste", label: "Einfügen" },
        { type: "separator" },
        { role: "selectall", label: "Alles auswählen" },
        { type: "separator" },
        {
          label: "Suchen",
          accelerator: "CmdOrCtrl+F",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              // Öffnet die Browser-eigene Suchfunktion
              mainWindow.webContents.executeJavaScript(`
                if (document.querySelector('input[type="search"], input[placeholder*="such"], .search-input')) {
                  const searchInput = document.querySelector('input[type="search"], input[placeholder*="such"], .search-input');
                  searchInput.focus();
                  searchInput.select();
                } else {
                  // Browser-eigene Suche
                  document.execCommand('find');
                }
              `);
            }
          },
        },
      ],
    },

    // NAVIGATION-MENÜ
    {
      label: "Navigation",
      submenu: [
        {
          label: "Dashboard",
          accelerator: "CmdOrCtrl+1",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`http://localhost:${PORT}/dashboard`);
            }
          },
        },
        {
          label: "Rechnungen",
          accelerator: "CmdOrCtrl+2",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`http://localhost:${PORT}/rechnungen`);
            }
          },
        },
        {
          label: "Aufträge",
          accelerator: "CmdOrCtrl+3",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`http://localhost:${PORT}/auftraege`);
            }
          },
        },
        {
          label: "Kunden",
          accelerator: "CmdOrCtrl+4",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`http://localhost:${PORT}/kunden`);
            }
          },
        },
        {
          label: "Fahrzeuge",
          accelerator: "CmdOrCtrl+5",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`/fahrzeuge`);
            }
          },
        },
        { type: "separator" },
        {
          label: "Einstellungen",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`http://localhost:3000/api/einstellungen`);
            }
          },
        },
      ],
    },

    // ANSICHT-MENÜ
    {
      label: "Ansicht",
      submenu: [
        { role: "reload", label: "Neu laden" },
        { role: "forceReload", label: "Erzwungen neu laden" },
        { role: "toggleDevTools", label: "Entwicklertools" },
        { type: "separator" },
        { role: "resetzoom", label: "Zoom zurücksetzen" },
        { role: "zoomin", label: "Vergrößern" },
        { role: "zoomout", label: "Verkleinern" },
        { type: "separator" },
        {
          label: "Vollbild",
          accelerator: process.platform === "darwin" ? "Cmd+Ctrl+F" : "F11",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          },
        },
      ],
    },

    // FENSTER-MENÜ
    {
      label: "Fenster",
      submenu: [
        { role: "minimize", label: "Minimieren" },
        { role: "close", label: "Schließen" },
      ],
    },

    // HILFE-MENÜ
    {
      label: "Hilfe",
      submenu: [
        {
          label: "Bedienungsanleitung",
          click: () => {
            // Öffnet eine lokale Hilfe-Seite oder externe URL
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(`https://github.com/cyb3rgh05t`);
            }
          },
        },
        {
          label: "Tastenkürzel",
          click: () => {
            // Zeigt Tastenkürzel an
            if (mainWindow && !mainWindow.isDestroyed()) {
              dialog.showMessageBox(mainWindow, {
                type: "info",
                title: "Tastenkürzel",
                message: "Verfügbare Tastenkürzel:",
                detail: `
Strg+N - Neue Rechnung
Strg+Shift+N - Neuer Auftrag
Strg+P - Drucken
Strg+F - Suchen
Strg+1 - Dashboard
Strg+2 - Rechnungen  
Strg+3 - Aufträge
Strg+4 - Kunden
Strg+5 - Fahrzeuge
Strg+, - Einstellungen
F11 - Vollbild
F5 - Neu laden
F12 - Entwicklertools
                `.trim(),
                buttons: ["OK"],
              });
            }
          },
        },
        { type: "separator" },
        {
          label: "Systeminfo",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              const os = require("os");
              dialog.showMessageBox(mainWindow, {
                type: "info",
                title: "Systeminformationen",
                message: "KFZ-Verwaltungssystem",
                detail: `
Version: ${getAppVersion()}
Electron: ${process.versions.electron}
Chrome: ${process.versions.chrome}
Node.js: ${process.versions.node}
Betriebssystem: ${os.platform()} ${os.release()}
Architektur: ${os.arch()}
`.trim(),
                buttons: ["OK"],
              });
            }
          },
        },
        {
          label: "Über KFZ-Verwaltung",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              dialog.showMessageBox(mainWindow, {
                type: "info",
                title: "Über KFZ-Verwaltung",
                message: "KFZ-Verwaltungssystem",
                detail: `
Version ${getAppVersion()}

Ein professionelles System zur Verwaltung von:
• Rechnungen
• Aufträgen  
• Kunden
• Fahrzeugen

Entwickelt für KFZ-Betriebe
© ${new Date().getFullYear()} Ihre Firma
                `.trim(),
                buttons: ["OK"],
              });
            }
          },
        },
      ],
    },
  ];

  // macOS spezifische Anpassungen
  if (process.platform === "darwin") {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: "about", label: `Über ${app.getName()}` },
        { type: "separator" },
        { role: "services", label: "Dienste" },
        { type: "separator" },
        { role: "hide", label: `${app.getName()} ausblenden` },
        { role: "hideothers", label: "Andere ausblenden" },
        { role: "unhide", label: "Alle anzeigen" },
        { type: "separator" },
        { role: "quit", label: `${app.getName()} beenden` },
      ],
    });

    // Fenster-Menü für macOS erweitern
    template[5].submenu = [
      { role: "close", label: "Schließen" },
      { role: "minimize", label: "Minimieren" },
      { role: "zoom", label: "Zoom" },
      { type: "separator" },
      { role: "front", label: "Alle nach vorne" },
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// KORRIGIERT: Server ordnungsgemäß schließen
function closeServer() {
  return new Promise((resolve) => {
    if (server && typeof server.close === "function") {
      console.log("🛑 Schließe Server...");
      server.close((err) => {
        if (err) {
          console.error("❌ Server-Schließung-Fehler:", err);
        } else {
          console.log("✅ Server erfolgreich geschlossen");
        }
        resolve();
      });
    } else {
      console.log("⚠️ Kein Server zum Schließen gefunden");
      resolve();
    }
  });
}

// App-Events
app.whenReady().then(createWindow);

app.on("window-all-closed", async () => {
  await closeServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Cleanup beim Beenden
app.on("before-quit", async (event) => {
  event.preventDefault(); // Erstmal stoppen

  console.log("🛑 App wird beendet...");
  await closeServer();

  app.exit(0); // Dann wirklich beenden
});
