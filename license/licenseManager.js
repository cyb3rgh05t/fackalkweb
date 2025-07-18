// ===== KORRIGIERTE license/licenseManager.js =====

const crypto = require("crypto");
const os = require("os");
const fs = require("fs");
const path = require("path");
const https = require("https");

// NATIVE HTTPS STATT node-fetch (100% kompatibel)

class LicenseManager {
  constructor() {
    this.licenseFile = path.join(__dirname, "../data/license.json");
    this.encryptionKey = this.getEncryptionKey();
    this.serverUrl = "https://license.meinefirma.dev/api"; // DEINE SERVER-URL
  }

  // Hardware-Fingerprint generieren (eindeutig pro PC)
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

    // MAC-Adressen hinzufügen (erste verfügbare)
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      for (const iface of interfaces) {
        if (iface.mac && iface.mac !== "00:00:00:00:00:00") {
          components.push(iface.mac);
          break;
        }
      }
      break;
    }

    return crypto
      .createHash("sha256")
      .update(components.join("|"))
      .digest("hex")
      .substring(0, 32);
  }

  // Verschlüsselungsschlüssel für lokale Lizenz (32 Bytes für AES-256)
  getEncryptionKey() {
    const hwFingerprint = this.generateHardwareFingerprint();
    const keySource = hwFingerprint + "kfz-app-key-2025";
    return crypto.createHash("sha256").update(keySource).digest(); // Returns 32-byte Buffer
  }

  // Lizenz verschlüsseln (MODERNE CRYPTO API)
  encryptLicense(licenseData) {
    try {
      const algorithm = "aes-256-cbc";
      const iv = crypto.randomBytes(16); // Initialization Vector
      const cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(JSON.stringify(licenseData), "utf8", "hex");
      encrypted += cipher.final("hex");

      // IV + verschlüsselte Daten kombinieren
      const result = iv.toString("hex") + ":" + encrypted;
      console.log("🔐 Lizenz verschlüsselt");
      return result;
    } catch (error) {
      console.error("❌ Verschlüsselung fehlgeschlagen:", error);
      throw error;
    }
  }

  // Lizenz entschlüsseln (MODERNE CRYPTO API)
  decryptLicense(encryptedData) {
    try {
      const algorithm = "aes-256-cbc";
      const parts = encryptedData.split(":");

      if (parts.length !== 2) {
        throw new Error("Ungültiges Verschlüsselungsformat");
      }

      const iv = Buffer.from(parts[0], "hex");
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(
        algorithm,
        this.encryptionKey,
        iv
      );
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      console.log("🔓 Lizenz entschlüsselt");
      return JSON.parse(decrypted);
    } catch (error) {
      console.error("❌ Entschlüsselung fehlgeschlagen:", error);
      throw new Error(
        "Lizenz-Entschlüsselung fehlgeschlagen: " + error.message
      );
    }
  }

  // Lizenz online validieren (NATIVE HTTPS)
  async validateLicenseOnline(licenseKey) {
    const hwFingerprint = this.generateHardwareFingerprint();

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
        app_version: "2.0",
        timestamp: Date.now(),
      });

      const options = {
        hostname: "license.meinefirma.dev",
        port: 443,
        path: "/api/validate.php",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
          "User-Agent": "KFZ-App/2.0",
        },
      };

      console.log(
        `📡 Sende Request an: https://${options.hostname}${options.path}`
      );

      const req = https.request(options, (res) => {
        let body = "";

        console.log(
          `📡 Server-Response: ${res.statusCode} ${res.statusMessage}`
        );

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          console.log(`📦 Response Body: ${body}`);

          try {
            const result = JSON.parse(body);
            console.log("✅ Parsed Response:", result);

            if (result.valid) {
              const licenseData = {
                license_key: licenseKey,
                hardware_id: hwFingerprint,
                validated_at: Date.now(),
                expires_at: result.expires_at,
                user_info: result.user_info,
                features: result.features || ["basic"],
              };

              this.saveLicenseLocally(licenseData);
              console.log("💾 Lizenz lokal gespeichert");
              resolve({ valid: true, licenseData });
            } else {
              reject(new Error(result.error || "Lizenz ungültig"));
            }
          } catch (error) {
            console.error("❌ JSON Parse Error:", error);
            console.error("Raw Body:", body);
            reject(
              new Error("Ungültige Server-Antwort: " + body.substring(0, 100))
            );
          }
        });
      });

      req.on("error", (error) => {
        console.error("❌ Request Error:", error);
        reject(new Error("Verbindungsfehler: " + error.message));
      });

      req.setTimeout(15000, () => {
        console.error("❌ Request Timeout");
        req.destroy();
        reject(new Error("Zeitüberschreitung - Server antwortet nicht"));
      });

      console.log(`📤 Sende Daten: ${data}`);
      req.write(data);
      req.end();
    });
  }

  // Lokale Lizenz speichern
  async saveLicenseLocally(licenseData) {
    const encrypted = this.encryptLicense(licenseData);
    const dataDir = path.dirname(this.licenseFile);

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(this.licenseFile, encrypted);
  }

  // Lokale Lizenz laden (MIT FALLBACK FÜR ALTE FORMATE)
  async loadLocalLicense() {
    try {
      if (!fs.existsSync(this.licenseFile)) {
        console.log("📝 Keine lokale Lizenz gefunden");
        return null;
      }

      const encrypted = fs.readFileSync(this.licenseFile, "utf8");
      let licenseData;

      try {
        // Versuche neues Format (mit IV)
        licenseData = this.decryptLicense(encrypted);
      } catch (error) {
        console.log(
          "⚠️ Neue Entschlüsselung fehlgeschlagen, versuche Fallback..."
        );
        // Falls alte Lizenz-Datei vorhanden, lösche sie
        fs.unlinkSync(this.licenseFile);
        console.log(
          "🗑️ Alte Lizenz-Datei gelöscht - neue Aktivierung erforderlich"
        );
        return null;
      }

      // Hardware-ID prüfen
      if (licenseData.hardware_id !== this.generateHardwareFingerprint()) {
        console.log("❌ Hardware-Fingerprint stimmt nicht überein");
        throw new Error("Hardware-Fingerprint stimmt nicht überein");
      }

      // Ablauf prüfen
      if (licenseData.expires_at && Date.now() > licenseData.expires_at) {
        console.log("❌ Lizenz abgelaufen");
        throw new Error("Lizenz abgelaufen");
      }

      console.log("✅ Lokale Lizenz gültig");
      return licenseData;
    } catch (error) {
      console.error("❌ Lokale Lizenz ungültig:", error.message);

      // Bei Problemen: Lizenz-Datei löschen für Neustart
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

  // Periodische Online-Validierung (alle 7 Tage)
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
        // Bei Netzwerkfehlern trotzdem erlauben (Graceful Degradation)
        return !error.message.includes("ungültig");
      }
    }

    return true;
  }

  // Lizenz-Status prüfen (Hauptfunktion)
  async checkLicenseStatus() {
    console.log("🔍 Prüfe Lizenz-Status...");

    // 1. Lokale Lizenz prüfen
    const localLicense = await this.loadLocalLicense();
    if (!localLicense) {
      console.log("❌ Keine gültige lokale Lizenz");
      return { valid: false, needsActivation: true };
    }

    // 2. Periodische Online-Validierung
    const periodicValid = await this.periodicValidation();
    if (!periodicValid) {
      console.log("❌ Periodische Validierung fehlgeschlagen");
      return { valid: false, needsReactivation: true };
    }

    console.log("✅ Lizenz gültig");
    return {
      valid: true,
      licenseData: localLicense,
      features: localLicense.features,
    };
  }

  // Lizenz deaktivieren (bei Deinstallation)
  async deactivateLicense() {
    const localLicense = await this.loadLocalLicense();
    if (!localLicense) return;

    return new Promise((resolve) => {
      const data = JSON.stringify({
        license_key: localLicense.license_key,
        hardware_id: localLicense.hardware_id,
      });

      const options = {
        hostname: "license.meinefirma.dev",
        port: 443,
        path: "/api/deactivate.php",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
        },
      };

      const req = https.request(options, (res) => {
        res.on("data", () => {}); // Daten verwerfen
        res.on("end", () => {
          console.log("🗑️ Lizenz server-seitig deaktiviert");
          resolve();
        });
      });

      req.on("error", (error) => {
        console.warn("⚠️ Deaktivierung fehlgeschlagen:", error.message);
        resolve(); // Trotzdem weitermachen
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve();
      });

      req.write(data);
      req.end();
    }).finally(() => {
      // Lokale Lizenz löschen
      if (fs.existsSync(this.licenseFile)) {
        fs.unlinkSync(this.licenseFile);
        console.log("🗑️ Lokale Lizenz gelöscht");
      }
    });
  }

  // Debug-Informationen
  getDebugInfo() {
    return {
      hardware_id: this.generateHardwareFingerprint(),
      server_url: this.serverUrl,
      license_file: this.licenseFile,
      license_file_exists: fs.existsSync(this.licenseFile),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    };
  }
}

module.exports = { LicenseManager };
