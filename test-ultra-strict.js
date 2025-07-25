// ===== test-ultra-strict.js - TEST FÜR ULTRA-STRIKTE LIZENZ-VALIDIERUNG =====
// Führe aus: node test-ultra-strict.js

const { LicenseManager } = require("./license/licenseManager");

async function testUltraStrictBehavior() {
  console.log("🚨 ULTRA-STRICT LIZENZ-VALIDIERUNG TEST");
  console.log("======================================\n");

  const licenseManager = new LicenseManager();

  // Debug-Informationen anzeigen
  licenseManager.debugInfo();

  console.log("🧪 Teste verschiedene ultra-strikte Szenarien...\n");

  // 1. Session-Validierung testen
  console.log("1️⃣ SESSION-VALIDIERUNG (wie bei Browser-Reload):");
  console.log("   Simuliert: /api/auth/status Request");
  try {
    const sessionResult = await licenseManager.validateLicenseForSession();
    console.log(
      `   ✅ Session-Check: ${sessionResult.valid ? "GÜLTIG" : "UNGÜLTIG"}`
    );
    console.log(`   📄 Message: ${sessionResult.message || "Keine Nachricht"}`);
    console.log(`   ⏰ Offline: ${sessionResult.offline ? "Ja" : "Nein"}`);
    if (!sessionResult.valid) {
      console.log(`   ❌ Fehler: ${sessionResult.error}`);
    }
  } catch (error) {
    console.log(`   ❌ Session-Check fehlgeschlagen: ${error.message}`);
  }
  console.log("");

  // 2. Login-Validierung testen
  console.log("2️⃣ LOGIN-VALIDIERUNG (wie bei echtem Login):");
  console.log("   Simuliert: POST /api/auth/login");
  try {
    const loginResult = await licenseManager.validateLicenseOnLogin();
    console.log(
      `   ✅ Login-Check: ${
        loginResult.valid ? "ERFOLGREICH" : "FEHLGESCHLAGEN"
      }`
    );
    console.log(`   📄 Message: ${loginResult.message || "Keine Nachricht"}`);
    console.log(`   ⏰ Offline: ${loginResult.offline ? "Ja" : "Nein"}`);
    if (!loginResult.valid) {
      console.log(`   ❌ Fehler: ${loginResult.error}`);
      console.log(
        `   🔄 Needs Activation: ${loginResult.needsActivation ? "Ja" : "Nein"}`
      );
      console.log(
        `   🔄 Needs Reactivation: ${
          loginResult.needsReactivation ? "Ja" : "Nein"
        }`
      );
    }
  } catch (error) {
    console.log(`   ❌ Login-Check fehlgeschlagen: ${error.message}`);
  }
  console.log("");

  // 3. Kritische Online-Validierung testen
  console.log("3️⃣ KRITISCHE ONLINE-VALIDIERUNG (erzwungener Check):");
  console.log("   Simuliert: Häufige Online-Checks");
  try {
    const criticalResult = await licenseManager.mustValidateOnline();
    console.log(
      `   ✅ Kritischer Check: ${
        criticalResult.valid ? "BESTANDEN" : "FEHLGESCHLAGEN"
      }`
    );
    console.log(
      `   📄 Message: ${criticalResult.message || "Keine Nachricht"}`
    );
    console.log(`   ⏰ Offline: ${criticalResult.offline ? "Ja" : "Nein"}`);
    if (!criticalResult.valid) {
      console.log(`   ❌ Fehler: ${criticalResult.error}`);
    }
  } catch (error) {
    console.log(`   ❌ Kritischer Check fehlgeschlagen: ${error.message}`);
  }
  console.log("");

  // 4. Allgemeiner Status-Check
  console.log("4️⃣ ALLGEMEINER STATUS-CHECK:");
  console.log("   Simuliert: GET /api/license/status");
  try {
    const statusResult = await licenseManager.checkLicenseStatus();
    console.log(`   ✅ Status: ${statusResult.valid ? "GÜLTIG" : "UNGÜLTIG"}`);
    console.log(
      `   📄 Features: ${JSON.stringify(statusResult.features || {})}`
    );
    console.log(
      `   ⏰ Expires: ${
        statusResult.expires_at
          ? new Date(statusResult.expires_at).toLocaleDateString()
          : "Nie"
      }`
    );
    console.log(
      `   🔄 Validated: ${
        statusResult.validated_at
          ? new Date(statusResult.validated_at).toLocaleString()
          : "Nie"
      }`
    );
  } catch (error) {
    console.log(`   ❌ Status-Check fehlgeschlagen: ${error.message}`);
  }

  console.log("\n======================================");
  console.log("🎯 ULTRA-STRICT TEST ABGESCHLOSSEN");

  console.log("\n💡 ERWARTETES VERHALTEN:");
  console.log("=============================");
  console.log("✅ WENN LIZENZ-SERVER HARDWARE-ID AKTIVIERT:");
  console.log("   • Alle Checks: ERFOLGREICH");
  console.log("   • Online-Validierung: ✅ BESTANDEN");
  console.log("   • Session bleibt: ✅ AKTIV");
  console.log("");

  console.log("❌ WENN LIZENZ-SERVER HARDWARE-ID DEAKTIVIERT:");
  console.log("   • Session-Check: ❌ FEHLSCHLÄGT");
  console.log("   • Login-Check: ❌ FEHLSCHLÄGT");
  console.log("   • Online-Validierung: ❌ ABGELEHNT");
  console.log("   • User wird: 🚪 SOFORT AUSGELOGGT");
  console.log("");

  console.log("🔄 NETZWERKFEHLER (Server unerreichbar):");
  console.log("   • Fallback auf: 📱 OFFLINE-MODUS");
  console.log("   • Session bleibt: ✅ AKTIV (temporär)");
  console.log("");

  console.log("⚡ VALIDIERUNGS-HÄUFIGKEIT:");
  console.log("   • Session-Check: Alle 2 Minuten");
  console.log("   • Quick-Check: Alle 30 Sekunden");
  console.log("   • Focus-Check: Bei Tab-Wechsel");
  console.log("   • Online-Validierung: Alle 5 Minuten");

  console.log("\n🚨 KRITISCHER TEST:");
  console.log("===================");
  console.log("1. App starten und einloggen");
  console.log("2. Auf Lizenz-Server Hardware-ID deaktivieren");
  console.log("3. Browser-Tab neu laden (F5)");
  console.log("4. ERWARTUNG: Sofortiger Logout + Fehlermeldung");
  console.log("5. ERWARTUNG: Weiterleitung zur Lizenz-Aktivierung");
}

testUltraStrictBehavior().catch((error) => {
  console.error("❌ Test-Fehler:", error);
  process.exit(1);
});
