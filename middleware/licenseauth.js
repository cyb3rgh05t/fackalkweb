const { LicenseManager } = require("../license/licenseManager");

const requireValidLicense = async (req, res, next) => {
  try {
    const licenseManager = new LicenseManager();
    const licenseStatus = await licenseManager.checkLicenseStatus();

    if (!licenseStatus.valid) {
      return res.status(403).json({
        error: "Keine gültige Lizenz",
        needsActivation: licenseStatus.needsActivation,
        needsReactivation: licenseStatus.needsReactivation,
      });
    }

    // Lizenz-Features an Request anhängen
    req.licenseFeatures = licenseStatus.features;
    next();
  } catch (error) {
    console.error("Lizenz-Prüfung fehlgeschlagen:", error);
    res.status(500).json({ error: "Lizenz-Prüfung fehlgeschlagen" });
  }
};

module.exports = { requireValidLicense };
