// routes/license.js
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

// Lizenz aktivieren
router.post("/activate", async (req, res) => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      return res.status(400).json({ error: "Lizenzschlüssel erforderlich" });
    }

    const licenseManager = new LicenseManager();
    const result = await licenseManager.validateLicenseOnline(licenseKey);

    res.json({
      success: true,
      message: "Lizenz erfolgreich aktiviert",
      licenseData: result.licenseData,
    });
  } catch (error) {
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

module.exports = router;
