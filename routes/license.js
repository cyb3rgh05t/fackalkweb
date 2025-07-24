// ===== KORRIGIERTE routes/license.js =====
const express = require("express");
const router = express.Router();
const { LicenseManager } = require("../license/licenseManager");

// Lizenz-Status abrufen
router.get("/status", async (req, res) => {
  try {
    const licenseManager = new LicenseManager();
    const status = await licenseManager.checkLicenseStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lizenz aktivieren - VERBESSERT
router.post("/activate", async (req, res) => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      return res.status(400).json({ error: "Lizenzschlüssel erforderlich" });
    }

    console.log(`🔑 Aktiviere Lizenz: ${licenseKey}`);

    const licenseManager = new LicenseManager();

    // Online-Validierung durchführen
    const result = await licenseManager.validateLicenseOnline(licenseKey);

    // WICHTIG: License Key in Antwort-Daten einbauen
    const licenseDataWithKey = {
      license_key: licenseKey, // Original License Key hinzufügen
      ...result.licenseData,
      validated_at: Date.now(),
      hardware_id: licenseManager.generateHardwareFingerprint(),
    };

    // Lokal speichern mit License Key
    await licenseManager.saveLicenseLocally(licenseDataWithKey);

    console.log("✅ Lizenz erfolgreich aktiviert und gespeichert");
    console.log(`   🔑 License Key: ${licenseKey}`);
    console.log(
      `   👤 Kunde: ${
        licenseDataWithKey.customer_name ||
        licenseDataWithKey.user_info?.customer_name ||
        "Unbekannt"
      }`
    );

    res.json({
      success: true,
      message: "Lizenz erfolgreich aktiviert",
      licenseData: licenseDataWithKey,
    });
  } catch (error) {
    console.error("❌ Lizenz-Aktivierung fehlgeschlagen:", error.message);
    res.status(400).json({ error: error.message });
  }
});

// Hardware-Info abrufen
router.get("/hardware-info", (req, res) => {
  try {
    const licenseManager = new LicenseManager();
    const fingerprint = licenseManager.generateHardwareFingerprint();
    res.json({
      hardware_id: fingerprint,
      platform: require("os").platform(),
      arch: require("os").arch(),
      hostname: require("os").hostname(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NEU: Debug-Endpunkt für Lizenz-Informationen
router.get("/debug", async (req, res) => {
  try {
    const licenseManager = new LicenseManager();

    // Lokale Lizenz laden
    const localLicense = await licenseManager.loadLocalLicense();

    const debugInfo = {
      hasLocalLicense: !!localLicense,
      localLicenseKeys: localLicense ? Object.keys(localLicense) : [],
      licenseKey: localLicense?.license_key || "NICHT GEFUNDEN",
      customerName:
        localLicense?.customer_name ||
        localLicense?.user_info?.customer_name ||
        "Unbekannt",
      expiresAt: localLicense?.expires_at
        ? new Date(localLicense.expires_at).toISOString()
        : null,
      hardwareId: licenseManager.generateHardwareFingerprint(),
      serverConfig: {
        url: licenseManager.serverUrl,
        endpoint: licenseManager.endpoint,
        testMode: licenseManager.testMode,
      },
    };

    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      debugInfo: {
        hasLocalLicense: false,
        errorDetails: error.stack,
      },
    });
  }
});

module.exports = router;
