// ===== test-php-server.js - PHP LICENSE-SERVER TESTER =====
// Führe aus: node test-php-server.js

const https = require("https");
const { LicenseManager } = require("./license/licenseManager");

// Teste direkt den PHP-Endpunkt
async function testPHPEndpoint() {
  console.log("🐘 PHP LICENSE-SERVER TEST");
  console.log("==========================\n");

  const testUrl = "https://license.meinefirma.dev/api/validate.php";
  console.log(`🔍 Teste PHP-Endpunkt: ${testUrl}\n`);

  // Test-Daten für die Anfrage
  const testData = JSON.stringify({
    license_key: "KFZ2307-0797-0014-1035",
    hardware_id: "96b582de945c6fc41481f5523c1f4aa0",
    timestamp: Date.now(),
    app_version: "2.0",
  });

  console.log("📤 Sende Test-Daten:", testData);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "license.meinefirma.dev",
      port: 443,
      path: "/api/validate.php",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(testData),
        "User-Agent": "KFZ-App/2.0 Test",
        Accept: "application/json",
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        console.log(`\n📥 Server-Antwort:`);
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Content-Type: ${res.headers["content-type"]}`);
        console.log(`   Body (erste 500 Zeichen):`);
        console.log(
          `   ${body.substring(0, 500)}${body.length > 500 ? "..." : ""}\n`
        );

        if (res.statusCode === 200) {
          try {
            const jsonResponse = JSON.parse(body);
            console.log("✅ SUCCESS: PHP-Server antwortet mit JSON!");
            console.log(
              "📄 Parsed Response:",
              JSON.stringify(jsonResponse, null, 2)
            );
            resolve(jsonResponse);
          } catch (parseError) {
            console.log(
              "⚠️  WARNING: PHP-Server antwortet mit Status 200, aber kein gültiges JSON"
            );
            console.log("❌ Parse-Fehler:", parseError.message);
            reject(parseError);
          }
        } else {
          console.log(`❌ ERROR: HTTP ${res.statusCode}`);
          if (body.includes("<!DOCTYPE") || body.includes("<html")) {
            console.log(
              "💡 Server gibt HTML zurück - prüfe PHP-Script und URL"
            );
          }
          reject(
            new Error(`HTTP ${res.statusCode}: ${body.substring(0, 100)}`)
          );
        }
      });
    });

    req.on("error", (error) => {
      console.log("❌ CONNECTION ERROR:", error.message);

      if (error.code === "ENOTFOUND") {
        console.log("💡 Domain nicht gefunden - prüfe DNS/URL");
      } else if (error.code === "ECONNREFUSED") {
        console.log("💡 Verbindung verweigert - Server läuft nicht?");
      }

      reject(error);
    });

    req.setTimeout(10000, () => {
      console.log("❌ TIMEOUT: Server antwortet nicht innerhalb 10 Sekunden");
      req.destroy();
      reject(new Error("Timeout"));
    });

    req.write(testData);
    req.end();
  });
}

// Teste auch mit LicenseManager
async function testWithLicenseManager() {
  console.log("\n🔧 TEST MIT LICENSEMANAGER");
  console.log("==========================\n");

  // Setze Umgebungsvariablen für Test
  process.env.LICENSE_SERVER_URL = "https://license.meinefirma.dev/api";
  process.env.LICENSE_ENDPOINT = "validate.php";
  process.env.LICENSE_TEST_MODE = "false";

  const licenseManager = new LicenseManager();
  licenseManager.debugInfo();

  try {
    console.log("🔍 Teste mit LicenseManager...");
    const result = await licenseManager.validateLicenseOnline(
      "KFZ2307-0797-0014-1035"
    );
    console.log("✅ LicenseManager Test erfolgreich!");
    console.log("📄 Ergebnis:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.log("❌ LicenseManager Test fehlgeschlagen:", error.message);
  }
}

// Führe alle Tests aus
async function runAllTests() {
  try {
    console.log("🚀 STARTE PHP LICENSE-SERVER TESTS\n");

    // 1. Direkter HTTP-Test
    await testPHPEndpoint();

    // 2. Test mit LicenseManager
    await testWithLicenseManager();

    console.log("\n🎉 ALLE TESTS ABGESCHLOSSEN!");
    console.log("\n💡 NÄCHSTE SCHRITTE:");
    console.log(
      "   1. Falls Tests erfolgreich: .env Datei erstellen mit LICENSE_TEST_MODE=false"
    );
    console.log("   2. Falls Fehler: PHP-Script auf Server prüfen");
    console.log("   3. App neu starten: npm start");
  } catch (error) {
    console.error("\n❌ KRITISCHER FEHLER:", error.message);
    console.log("\n🔧 DEBUGGING-TIPPS:");
    console.log(
      "   1. PHP-Script existiert: https://license.meinefirma.dev/api/validate.php"
    );
    console.log("   2. PHP-Script verarbeitet POST-Requests");
    console.log("   3. PHP-Script gibt JSON zurück (nicht HTML)");
    console.log("   4. Server-Logs prüfen für detaillierte Fehler");
  }
}

runAllTests();
