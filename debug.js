// Debug-Script: Erstelle eine neue Datei debug-server.js im Hauptverzeichnis
const http = require("http");

async function debugServerConnection() {
  const PORT = 3000;

  console.log("🔍 Debug: Teste Server-Verbindung...");

  try {
    // 1. Test: Einfacher HTTP-Request
    const result = await new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
        console.log(`📡 HTTP Status: ${res.statusCode}`);
        console.log(`📋 Headers:`, res.headers);

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          console.log(`📄 Response:`, data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
          });
        });
      });

      req.on("error", (error) => {
        console.error(`❌ Request Error:`, error.message);
        reject(error);
      });

      req.setTimeout(5000, () => {
        console.error(`⏰ Timeout nach 5 Sekunden`);
        req.destroy();
        reject(new Error("Timeout"));
      });
    });

    console.log("✅ Server-Verbindung erfolgreich!");
    return true;
  } catch (error) {
    console.error("❌ Server-Verbindung fehlgeschlagen:", error.message);

    // 2. Test: Prüfe ob Server überhaupt läuft
    console.log("\n🔍 Prüfe ob Server-Prozess läuft...");
    try {
      const net = require("net");
      const portCheck = await new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);

        socket.on("connect", () => {
          console.log(`✅ Port ${PORT} ist offen`);
          socket.destroy();
          resolve(true);
        });

        socket.on("timeout", () => {
          console.log(`❌ Port ${PORT} Timeout`);
          socket.destroy();
          resolve(false);
        });

        socket.on("error", (err) => {
          console.log(`❌ Port ${PORT} nicht erreichbar:`, err.message);
          resolve(false);
        });

        socket.connect(PORT, "localhost");
      });

      if (!portCheck) {
        console.log("💡 Tipp: Server ist wahrscheinlich nicht gestartet");
      }
    } catch (portError) {
      console.error("❌ Port-Check fehlgeschlagen:", portError.message);
    }

    return false;
  }
}

// Script direkt ausführen falls aufgerufen
if (require.main === module) {
  debugServerConnection().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = debugServerConnection;
