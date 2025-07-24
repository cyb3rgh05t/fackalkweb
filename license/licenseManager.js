const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");

class LicenseManager {
  constructor() {
    this.licenseFile = path.join(__dirname, "../data/license.json");
    this.serverUrl =
      process.env.LICENSE_SERVER_URL || "https://license.meinefirma.dev/api";
    this.serverHost = this.extractHostFromUrl(this.serverUrl);
    this.serverPath = this.extractPathFromUrl(this.serverUrl);
    this.endpoint = process.env.LICENSE_ENDPOINT || "validate.php";

    console.log(`🔧 License Manager konfiguriert:`);
    console.log(`   Server: ${this.serverUrl}`);
    console.log(`   Endpunkt: ${this.endpoint}`);
    console.log(`   Vollständige URL: ${this.serverUrl}/${this.endpoint}`);
  }

  extractHostFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      console.error("❌ Ungültige Server-URL:", url);
      return "license.meinefirma.dev";
    }
  }

  extractPathFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch (error) {
      console.error("❌ Ungültiger Server-Pfad:", url);
      return "/api";
    }
  }

  generateHardwareFingerprint() {
    const networkInterfaces = os.networkInterfaces();
    const cpus = os.cpus();
    let components = [
      os.platform(),
      os.arch(),
      os.hostname(),
      cpus[0]?.model || "unknown",
      JSON.stringify(Object.keys(networkInterfaces).sort()),
    ];
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      for (const iface of interfaces) {
        if (iface.mac && iface.mac !== "00:00:00:00:00:00") {
          components.push(iface.mac);
          break;
        }
      }
      break;
    }
    return require("crypto")
      .createHash("sha256")
      .update(components.join("|"))
      .digest("hex")
      .substring(0, 32);
  }

  // KLARTEXT-Speichern!
  async saveLicenseLocally(licenseData) {
    const dataDir = path.dirname(this.licenseFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(this.licenseFile, JSON.stringify(licenseData, null, 2));
    console.log("💾 Lizenz lokal (unverschlüsselt) gespeichert");
  }

  async loadLocalLicense() {
    try {
      if (!fs.existsSync(this.licenseFile)) {
        console.log("📝 Keine lokale Lizenz gefunden");
        return null;
      }
      const content = fs.readFileSync(this.licenseFile, "utf8");
      const licenseData = JSON.parse(content);

      if (licenseData.hardware_id !== this.generateHardwareFingerprint()) {
        console.log("❌ Hardware-Fingerprint stimmt nicht überein");
        throw new Error("Hardware-Fingerprint stimmt nicht überein");
      }
      if (licenseData.expires_at && Date.now() > licenseData.expires_at) {
        console.log("❌ Lizenz abgelaufen");
        throw new Error("Lizenz abgelaufen");
      }
      console.log("✅ Lokale Lizenz gültig");
      return licenseData;
    } catch (error) {
      console.error("❌ Lokale Lizenz ungültig:", error.message);
      if (fs.existsSync(this.licenseFile)) {
        try {
          fs.unlinkSync(this.licenseFile);
          console.log("🗑️ Beschädigte Lizenz-Datei gelöscht");
        } catch (deleteError) {
          console.error(
            "❌ Fehler beim Löschen der Lizenz-Datei:",
            deleteError
          );
        }
      }
      return null;
    }
  }

  async validateLicenseOnline(licenseKey) {
    const hwFingerprint = this.generateHardwareFingerprint();
    if (!licenseKey) {
      console.error(
        "❌ Kein Lizenzschlüssel für die Online-Validierung vorhanden!"
      );
      throw new Error("Lizenzschlüssel fehlt");
    }
    console.log(
      `🔍 Validiere Lizenz: ${licenseKey} für Hardware: ${hwFingerprint.substring(
        0,
        8
      )}...`
    );
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        license_key: licenseKey,
        hardware_id: hwFingerprint,
        timestamp: Date.now(),
        app_version: "2.0",
      });
      const options = {
        hostname: this.serverHost,
        port: 443,
        path: this.serverPath + "/" + this.endpoint,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          "User-Agent": "KFZ-App/2.0",
          Accept: "application/json",
        },
        timeout: 15000,
      };
      console.log(
        `📡 Verbinde mit: https://${options.hostname}${options.path}`
      );
      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          console.log(
            `📥 Server-Antwort (${res.statusCode}):`,
            body.substring(0, 200) + "..."
          );
          try {
            if (res.headers["content-type"]?.includes("text/html")) {
              console.error(
                "❌ Server gibt HTML zurück statt JSON - wahrscheinlich 404 oder Fehlerseite"
              );
              if (res.statusCode === 404) {
                reject(
                  new Error(
                    `Lizenz-Endpunkt nicht gefunden: https://${options.hostname}${options.path}`
                  )
                );
              } else {
                reject(
                  new Error(
                    `Server-Fehler (${res.statusCode}): HTML-Seite erhalten statt JSON`
                  )
                );
              }
              return;
            }
            const response = JSON.parse(body);
            if (res.statusCode === 200 && response.valid) {
              console.log("✅ Online-Validierung erfolgreich");
              // Richtige Kundendaten extrahieren:
              const user_info =
                response.user_info || response.licenseData?.user_info || {};
              const licenseData = {
                ...response.licenseData,
                ...user_info, // Holt customer_name, customer_email auf Hauptebene rein
                license_key: licenseKey,
                validated_at: Date.now(),
                hardware_id: hwFingerprint,
              };
              this.saveLicenseLocally(licenseData);
              console.log("   🔑 License Key: " + licenseKey);
              console.log(
                "   👤 Kunde: " +
                  (licenseData.customer_name ||
                    licenseData.customer_email ||
                    "Unbekannt")
              );
              resolve({ valid: true, licenseData });
            } else {
              console.error(
                `❌ Lizenz ungültig (${res.statusCode}): ${
                  response.error || "Unbekannter Fehler"
                }`
              );
              reject(
                new Error(response.error || `Server-Fehler (${res.statusCode})`)
              );
            }
          } catch (parseError) {
            console.error("❌ JSON-Parsing-Fehler:", parseError.message);
            console.error("❌ Erhaltene Daten:", body.substring(0, 500));
            if (body.includes("<!DOCTYPE") || body.includes("<html")) {
              reject(
                new Error(
                  `License-Server gibt HTML-Seite zurück (Status: ${res.statusCode}). ` +
                    `Prüfen Sie: 1) Server-URL korrekt? 2) Endpunkt existiert? 3) Server läuft?`
                )
              );
            } else {
              reject(
                new Error("Ungültige Server-Antwort: " + parseError.message)
              );
            }
          }
        });
      });
      req.on("error", (error) => {
        console.error("❌ Verbindungsfehler:", error.message);
        if (error.code === "ENOTFOUND") {
          reject(
            new Error(`License-Server nicht erreichbar: ${this.serverHost}`)
          );
        } else if (error.code === "ECONNREFUSED") {
          reject(
            new Error(
              `License-Server verweigert Verbindung: ${this.serverHost}`
            )
          );
        } else {
          reject(new Error("Verbindungsfehler: " + error.message));
        }
      });
      req.setTimeout(15000, () => {
        console.error("❌ Request Timeout");
        req.destroy();
        reject(
          new Error("Zeitüberschreitung - License-Server antwortet nicht")
        );
      });
      console.log(`📤 Sende Daten: ${data}`);
      req.write(data);
      req.end();
    });
  }

  async validateLicenseOnLogin() {
    console.log("🔑 Validiere Lizenz beim Login...");
    try {
      const localLicense = await this.loadLocalLicense();
      if (!localLicense) {
        console.log("❌ Keine lokale Lizenz gefunden");
        return { valid: false, needsActivation: true };
      }
      if (!localLicense.license_key) {
        console.error("❌ Lizenzschlüssel fehlt in der lokalen Lizenzdatei!");
        return {
          valid: false,
          needsActivation: true,
          error: "Lizenzschlüssel fehlt",
        };
      }
      try {
        const response = await this.validateLicenseOnline(
          localLicense.license_key
        );
        if (response.valid) {
          console.log("✅ Login-Lizenzvalidierung erfolgreich");
          return {
            valid: true,
            licenseData: response.licenseData,
            message: "Lizenz online validiert",
          };
        } else {
          console.log("❌ Lizenz vom Server als ungültig markiert");
          return {
            valid: false,
            needsReactivation: true,
            error: response.error || "Lizenz ungültig",
          };
        }
      } catch (onlineError) {
        console.warn(
          "⚠️ Online-Validierung fehlgeschlagen:",
          onlineError.message
        );
        const isNetworkError =
          onlineError.message.includes("Verbindungsfehler") ||
          onlineError.message.includes("Zeitüberschreitung") ||
          onlineError.message.includes("nicht erreichbar") ||
          onlineError.message.includes("ENOTFOUND") ||
          onlineError.message.includes("ECONNREFUSED");
        if (isNetworkError) {
          console.log("🔄 Fallback: Prüfe lokale Lizenz...");
          if (localLicense.expires_at && Date.now() > localLicense.expires_at) {
            console.log("❌ Lokale Lizenz abgelaufen");
            return {
              valid: false,
              needsReactivation: true,
              error: "Lizenz abgelaufen und Server nicht erreichbar",
            };
          }
          console.log("✅ Lokale Lizenz verwendet (Offline-Modus)");
          return {
            valid: true,
            licenseData: localLicense,
            message:
              "Offline-Modus: Lokale Lizenz verwendet (Server nicht erreichbar)",
            offline: true,
          };
        } else {
          console.log(
            "❌ Lizenz-Validierung fehlgeschlagen:",
            onlineError.message
          );
          return {
            valid: false,
            needsReactivation: true,
            error: onlineError.message,
          };
        }
      }
    } catch (error) {
      console.error("❌ Login-Lizenzvalidierung fehlgeschlagen:", error);
      return {
        valid: false,
        needsActivation: true,
        error: error.message,
      };
    }
  }

  // Der Rest (periodicValidation, checkLicenseStatus, extractLicenseFeatures, debugInfo) bleibt gleich
  async periodicValidation() {
    const localLicense = await this.loadLocalLicense();
    if (!localLicense) return false;
    const lastValidation = localLicense.validated_at || 0;
    const validationInterval = 7 * 24 * 60 * 60 * 1000; // 7 Tage
    if (Date.now() - lastValidation > validationInterval) {
      console.log("🔄 Periodische Online-Validierung erforderlich...");
      try {
        await this.validateLicenseOnline(localLicense.license_key);
        return true;
      } catch (error) {
        console.warn(
          "⚠️ Periodische Validierung fehlgeschlagen:",
          error.message
        );
        return !error.message.includes("ungültig");
      }
    }
    return true;
  }

  async checkLicenseStatus() {
    console.log("🔍 Prüfe Lizenz-Status...");
    const localLicense = await this.loadLocalLicense();
    if (!localLicense) {
      console.log("❌ Keine gültige lokale Lizenz");
      return { valid: false, needsActivation: true };
    }
    const periodicValid = await this.periodicValidation();
    if (!periodicValid) {
      console.log("❌ Periodische Validierung fehlgeschlagen");
      return { valid: false, needsReactivation: true };
    }
    const features = this.extractLicenseFeatures(localLicense);
    console.log("✅ Lizenz-Status: Gültig");
    return {
      valid: true,
      licenseData: localLicense,
      features: features,
      expires_at: localLicense.expires_at,
      validated_at: localLicense.validated_at,
    };
  }

  extractLicenseFeatures(licenseData) {
    return {
      maxUsers: licenseData.max_users || 1,
      maxCompanies: licenseData.max_companies || 1,
      features: licenseData.features || ["basic"],
      version: licenseData.version || "standard",
    };
  }

  debugInfo() {
    console.log("\n🔧 LICENSE MANAGER DEBUG INFO:");
    console.log("================================");
    console.log(`Server URL: ${this.serverUrl}`);
    console.log(`Server Host: ${this.serverHost}`);
    console.log(`Server Path: ${this.serverPath}`);
    console.log(`Endpoint: ${this.endpoint}`);
    console.log(`Full URL: ${this.serverUrl}/${this.endpoint}`);
    console.log(`Hardware ID: ${this.generateHardwareFingerprint()}`);
    console.log(`License File: ${this.licenseFile}`);
    console.log(`File exists: ${fs.existsSync(this.licenseFile)}`);
    console.log("================================\n");
  }
}

module.exports = { LicenseManager };
