// ===== test-login-flow.js - KOMPLETTER LOGIN-FLOW TEST =====
// Führe aus: node test-login-flow.js

const { LicenseManager } = require("./license/licenseManager");

async function testCompleteLoginFlow() {
  console.log("🔐 KOMPLETTER LOGIN-FLOW TEST");
  console.log("=============================\n");

  const licenseManager = new LicenseManager();

  try {
    // 1. Teste Lizenz-Manager Konfiguration
    console.log("1️⃣ License Manager Konfiguration:");
    licenseManager.debugInfo();

    // 2. Teste lokale Lizenz
    console.log("2️⃣ Lokale Lizenz testen:");
    const localLicense = await licenseManager.loadLocalLicense();

    if (localLicense) {
      console.log("✅ Lokale Lizenz gefunden:");
      console.log(`   🔑 License Key: ${localLicense.license_key || "FEHLT"}`);
      console.log(
        `   👤 Kunde: ${
          localLicense.customer_name ||
          localLicense.user_info?.customer_name ||
          "Unbekannt"
        }`
      );
      console.log(
        `   📧 Email: ${
          localLicense.customer_email ||
          localLicense.user_info?.customer_email ||
          "Unbekannt"
        }`
      );
      console.log(
        `   🏷️ Typ: ${
          localLicense.license_type ||
          localLicense.user_info?.license_type ||
          "Unbekannt"
        }`
      );
      console.log(
        `   🎛️ Features: ${JSON.stringify(localLicense.features || [])}`
      );
      console.log(
        `   ⏰ Läuft ab: ${
          localLicense.expires_at
            ? new Date(localLicense.expires_at).toLocaleString()
            : "Nie"
        }`
      );
    } else {
      console.log("❌ Keine lokale Lizenz gefunden");
    }
    console.log("");

    // 3. Teste Login-Validierung (HAUPTTEST)
    console.log("3️⃣ Login-Validierung testen:");
    const loginResult = await licenseManager.validateLicenseOnLogin();

    console.log(
      `   Status: ${loginResult.valid ? "✅ ERFOLGREICH" : "❌ FEHLGESCHLAGEN"}`
    );
    console.log(`   Message: ${loginResult.message || "Keine Nachricht"}`);
    console.log(`   Offline: ${loginResult.offline ? "Ja" : "Nein"}`);
    console.log(`   Error: ${loginResult.error || "Kein Fehler"}`);
    console.log(
      `   Needs Activation: ${loginResult.needsActivation ? "Ja" : "Nein"}`
    );
    console.log(
      `   Needs Reactivation: ${loginResult.needsReactivation ? "Ja" : "Nein"}`
    );

    // 4. Teste Session-Daten-Struktur
    if (loginResult.valid && loginResult.licenseData) {
      console.log("\n4️⃣ Session-Daten-Struktur:");
      const licenseData = loginResult.licenseData || {};
      const sessionInfo = {
        validated: true,
        validatedAt: Date.now(),
        offline: loginResult.offline || false,
        features: licenseData.features || [],
        expiresAt: licenseData.expires_at || null,
        customerName:
          licenseData.customer_name ||
          licenseData.user_info?.customer_name ||
          "Unbekannt",
      };

      console.log("✅ Session-Info erfolgreich erstellt:");
      console.log(JSON.stringify(sessionInfo, null, 2));
    }

    // 5. Gesamtergebnis
    console.log("\n🎯 GESAMTERGEBNIS:");
    console.log("==================");

    if (loginResult.valid) {
      console.log("✅ LOGIN-FLOW KOMPLETT FUNKTIONSFÄHIG!");
      console.log("   • Lizenz ist gültig");
      console.log("   • Online-Validierung erfolgreich");
      console.log("   • Session-Daten können erstellt werden");
      console.log("   • Login sollte funktionieren");

      console.log("\n🚀 NÄCHSTE SCHRITTE:");
      console.log("   1. Server neu starten: npm start");
      console.log("   2. Login versuchen mit deinen Benutzerdaten");
      console.log("   3. Falls Fehler: Logs prüfen");
    } else {
      console.log("❌ LOGIN-FLOW HAT PROBLEME:");
      console.log(`   • Grund: ${loginResult.error || "Unbekannt"}`);

      console.log("\n🔧 LÖSUNGSVORSCHLÄGE:");
      if (loginResult.needsActivation) {
        console.log("   • Lizenz aktivieren mit: KFZ2307-0797-0014-1035");
      } else if (loginResult.needsReactivation) {
        console.log(
          "   • Lizenz reaktivieren (alte Lizenz löschen und neu aktivieren)"
        );
      } else {
        console.log("   • Netzwerkverbindung prüfen");
        console.log("   • License-Server Status prüfen");
      }
    }
  } catch (error) {
    console.error("❌ KRITISCHER FEHLER:", error.message);
    console.error("   Stack:", error.stack);

    console.log("\n🆘 NOTFALL-MASSNAHMEN:");
    console.log("   1. node fix-license.js ausführen");
    console.log("   2. Lizenz neu aktivieren");
    console.log("   3. Bei weiteren Problemen: Test-Modus aktivieren");
  }
}

testCompleteLoginFlow();
