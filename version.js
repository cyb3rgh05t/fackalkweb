// version.js - Zentrale Versionsverwaltung für KFZ Fac Pro
const fs = require("fs");
const path = require("path");

let cachedVersion = null;
let cachedPackageInfo = null;

/**
 * Lädt die aktuelle App-Version aus package.json
 * @returns {string} Version (z.B. "2.0.0")
 */
function getAppVersion() {
  if (!cachedVersion) {
    try {
      const packagePath = path.join(__dirname, "package.json");
      const packageInfo = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      cachedVersion = packageInfo.version;
      cachedPackageInfo = packageInfo;
      console.log(`📋 Version geladen: ${cachedVersion}`);
    } catch (error) {
      console.error("❌ Fehler beim Laden der Version:", error.message);
      cachedVersion = "0.0.0";
    }
  }
  return cachedVersion;
}

/**
 * Gibt vollständige Package-Informationen zurück
 * @returns {object} Package.json Objekt
 */
function getPackageInfo() {
  if (!cachedPackageInfo) {
    getAppVersion(); // Lädt Package-Info
  }
  return cachedPackageInfo;
}

/**
 * Formatiert Version für verschiedene Zwecke
 * @param {string} format - 'full', 'short', 'major', 'minor', 'patch'
 * @returns {string} Formatierte Version
 */
function getFormattedVersion(format = "full") {
  const version = getAppVersion();
  const [major, minor, patch] = version.split(".");

  switch (format) {
    case "short":
      return `${major}.${minor}`; // "2.0"
    case "major":
      return major; // "2"
    case "minor":
      return minor; // "0"
    case "patch":
      return patch; // "0"
    case "full":
    default:
      return version; // "2.0.0"
  }
}

/**
 * Erstellt Version-String für Lizenzserver
 * @returns {string} Version im Format für Lizenzvalidierung
 */
function getLicenseVersion() {
  return getFormattedVersion("short"); // "2.0" für Lizenzserver
}

/**
 * Erstellt vollständigen Build-Info String
 * @returns {object} Detaillierte Versionsinformationen
 */
function getBuildInfo() {
  const pkg = getPackageInfo();
  return {
    version: pkg.version,
    name: pkg.name,
    description: pkg.description,
    author: pkg.author,
    buildDate: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

// Cache leeren (für Tests oder Updates)
function clearCache() {
  cachedVersion = null;
  cachedPackageInfo = null;
}

module.exports = {
  getAppVersion,
  getPackageInfo,
  getFormattedVersion,
  getLicenseVersion,
  getBuildInfo,
  clearCache,
};
