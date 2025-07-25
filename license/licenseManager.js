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

    // VERSCHIEDENE VALIDIERUNGS-INTERVALLE
    this.onlineValidationInterval = 5 * 60 * 1000; // 5 Minuten für normale API-Calls
    this.lastOnlineValidation = 0;

    console.log(`🔧 License Manager konfiguriert (SOFORTIGE SESSION-CHECKS):`);
    console.log(`   Server: ${this.serverUrl}`);
    console.log(`   Endpunkt: ${this.endpoint}`);
    console.log(`   Vollständige URL: ${this.serverUrl}/${this.endpoint}`);
    console.log(
      `   Normale Validierung alle: ${
        this.onlineValidationInterval / 1000 / 60
      } Minuten`
    );
    console.log(`   Session-Checks: SOFORT (immer online)`);
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

  // KLARTEXT-Speichern (deine Version beibehalten)
  async saveLicenseLocally(licenseData) {
    const dataDir = path.dirname(this.licenseFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Zeitstempel der letzten Online-Validierung setzen
    licenseData.last_online_validation = Date.now();

    fs.writeFileSync(this.licenseFile, JSON.stringify(licenseData, null, 2));
    console.log("💾 Lizenz lokal (unverschlüsselt) gespeichert");

    // Internen Zeitstempel aktualisieren
    this.lastOnlineValidation = Date.now();
  }

  // STRIKTE LIZENZ-VALIDIERUNG
  async loadLocalLicense() {
    try {
      if (!fs.existsSync(this.licenseFile)) {
        console.log("📝 Keine lokale Lizenz gefunden");
        return null;
      }
      const content = fs.readFileSync(this.licenseFile, "utf8");
      const licenseData = JSON.parse(content);

      // STRIKT: Hardware-ID prüfen
      const currentHardwareId = this.generateHardwareFingerprint();
      if (licenseData.hardware_id !== currentHardwareId) {
        console.log("❌ Hardware-Fingerprint stimmt nicht überein");
        console.log(`   In Lizenz: ${licenseData.hardware_id}`);
        console.log(`   Aktuell:   ${currentHardwareId}`);
        console.log(
          "🚫 KEINE automatische Anpassung - manuelle Reaktivierung erforderlich"
        );
        throw new Error(
          "Hardware-ID geändert - manuelle Lizenz-Reaktivierung erforderlich"
        );
      }

      // STRIKT: Ablauf prüfen
      if (licenseData.expires_at && Date.now() > licenseData.expires_at) {
        console.log("❌ Lizenz abgelaufen");
        console.log(
          `   Ablaufdatum: ${new Date(licenseData.expires_at).toLocaleString()}`
        );
        console.log("🚫 Lizenz-Erneuerung erforderlich");
        throw new Error("Lizenz abgelaufen - Lizenzerneuerung erforderlich");
      }

      console.log("✅ Lokale Lizenz gültig");
      return licenseData;
    } catch (error) {
      console.error("❌ Lokale Lizenz ungültig:", error.message);
      console.log(
        "🚫 Lizenz-Datei bleibt erhalten - manuelle Reaktivierung erforderlich"
      );
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
      `🔍 ONLINE-VALIDIERUNG: ${licenseKey} für Hardware: ${hwFingerprint.substring(
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
          "User-Agent": "KFZ-App/2.0-IMMEDIATE-SESSION",
          Accept: "application/json",
        },
        timeout: 10000,
      };

      console.log(
        `📡 ONLINE-CHECK: https://${options.hostname}${options.path}`
      );

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          console.log(
            `📥 Server-Status: ${res.statusCode} | Antwort: ${body.substring(
              0,
              100
            )}...`
          );

          try {
            if (res.headers["content-type"]?.includes("text/html")) {
              console.error("❌ Server gibt HTML zurück statt JSON");
              reject(
                new Error(`Server-Fehler: HTML-Response (${res.statusCode})`)
              );
              return;
            }

            const response = JSON.parse(body);

            if (res.statusCode === 200 && response.valid) {
              console.log("✅ ONLINE-VALIDIERUNG ERFOLGREICH");

              // Kundendaten extrahieren
              const user_info =
                response.user_info || response.licenseData?.user_info || {};
              const licenseData = {
                ...response.licenseData,
                ...user_info,
                license_key: licenseKey,
                validated_at: Date.now(),
                hardware_id: hwFingerprint,
              };

              this.saveLicenseLocally(licenseData);
              console.log(`   🔑 License Key: ${licenseKey}`);
              console.log(
                `   👤 Kunde: ${
                  licenseData.customer_name ||
                  licenseData.customer_email ||
                  "Unbekannt"
                }`
              );

              resolve({ valid: true, licenseData });
            } else {
              console.error(
                `❌ LIZENZ VOM SERVER ABGELEHNT (${res.statusCode}): ${
                  response.error || "Unbekannt"
                }`
              );

              // SPEZIELLE BEHANDLUNG FÜR HARDWARE-DEAKTIVIERUNG
              if (response.hardware_deactivated) {
                console.error("🚨 HARDWARE-ID WURDE DEAKTIVIERT!");
                console.error(
                  `   Deaktiviert am: ${response.deactivated_at || "Unbekannt"}`
                );
                console.error("   Manuelle Reaktivierung erforderlich");

                const error = new Error(
                  "Hardware-ID wurde auf dem Server deaktiviert - manuelle Reaktivierung erforderlich"
                );
                error.hardwareDeactivated = true;
                error.deactivatedAt = response.deactivated_at;
                error.manualReactivationRequired =
                  response.manual_reactivation_required;
                reject(error);
              } else {
                // Normale Lizenz-Fehler
                reject(
                  new Error(
                    response.error ||
                      `Server lehnt Lizenz ab (${res.statusCode})`
                  )
                );
              }
            }
          } catch (parseError) {
            console.error("❌ JSON-Parsing-Fehler:", parseError.message);
            reject(
              new Error("Ungültige Server-Antwort: " + parseError.message)
            );
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

      req.setTimeout(10000, () => {
        console.error("❌ Request Timeout (10s)");
        req.destroy();
        reject(
          new Error("Zeitüberschreitung - License-Server antwortet nicht")
        );
      });

      req.write(data);
      req.end();
    });
  }

  // NORMALE ONLINE-VALIDIERUNG (mit 5-Minuten-Intervall)
  async mustValidateOnline() {
    const localLicense = await this.loadLocalLicense();
    if (!localLicense) {
      console.log("❌ Keine lokale Lizenz für Online-Validierung");
      return { valid: false, needsActivation: true };
    }

    const lastValidation =
      localLicense.last_online_validation || this.lastOnlineValidation || 0;
    const timeSinceLastValidation = Date.now() - lastValidation;

    console.log(
      `🕐 Zeit seit letzter Online-Validierung: ${Math.round(
        timeSinceLastValidation / 1000 / 60
      )} Minuten`
    );

    // Normale API-Calls: 5-Minuten-Intervall respektieren
    if (timeSinceLastValidation > this.onlineValidationInterval) {
      console.log(
        "🔄 KRITISCHE ONLINE-VALIDIERUNG ERFORDERLICH (5-Min-Intervall)"
      );

      try {
        const response = await this.validateLicenseOnline(
          localLicense.license_key
        );
        if (response.valid) {
          console.log("✅ KRITISCHE ONLINE-VALIDIERUNG ERFOLGREICH");
          return {
            valid: true,
            licenseData: response.licenseData,
            message: "Online-Validierung erfolgreich",
          };
        } else {
          console.log("❌ KRITISCHE ONLINE-VALIDIERUNG FEHLGESCHLAGEN");
          return {
            valid: false,
            needsReactivation: true,
            error: "Online-Validierung fehlgeschlagen",
          };
        }
      } catch (onlineError) {
        console.error(
          "❌ KRITISCHE ONLINE-VALIDIERUNG FEHLER:",
          onlineError.message
        );

        // SPEZIELLE BEHANDLUNG FÜR HARDWARE-DEAKTIVIERUNG
        if (onlineError.hardwareDeactivated) {
          console.error("🚨 HARDWARE-DEAKTIVIERUNG ERKANNT!");
          return {
            valid: false,
            needsReactivation: true,
            hardwareDeactivated: true,
            error: onlineError.message,
            deactivatedAt: onlineError.deactivatedAt,
          };
        }

        // NUR bei echten Netzwerkfehlern Offline-Modus erlauben
        const isNetworkError =
          onlineError.message.includes("Verbindungsfehler") ||
          onlineError.message.includes("Zeitüberschreitung") ||
          onlineError.message.includes("nicht erreichbar") ||
          onlineError.message.includes("ENOTFOUND") ||
          onlineError.message.includes("ECONNREFUSED");

        if (isNetworkError) {
          console.log("🔄 NETZWERKFEHLER - Offline-Modus temporär erlaubt");
          return {
            valid: true,
            licenseData: localLicense,
            message: "Offline-Modus: Netzwerkfehler",
            offline: true,
          };
        } else {
          console.log("❌ LIZENZ VOM SERVER ABGELEHNT - Session beenden");
          return {
            valid: false,
            needsReactivation: true,
            error: "Lizenz vom Server abgelehnt: " + onlineError.message,
          };
        }
      }
    } else {
      console.log(
        "✅ Online-Validierung noch gültig (5-Min-Intervall nicht erreicht)"
      );
      return {
        valid: true,
        licenseData: localLicense,
        message: "Letzte Online-Validierung noch gültig",
      };
    }
  }

  // NEU: SOFORTIGE ONLINE-VALIDIERUNG (IGNORIERT 5-Minuten-Intervall)
  async forceValidateOnline() {
    const localLicense = await this.loadLocalLicense();
    if (!localLicense) {
      console.log("❌ Keine lokale Lizenz für sofortige Online-Validierung");
      return { valid: false, needsActivation: true };
    }

    console.log("⚡ SOFORTIGE ONLINE-VALIDIERUNG (Session-kritisch)");

    try {
      const response = await this.validateLicenseOnline(
        localLicense.license_key
      );
      if (response.valid) {
        console.log("✅ SOFORTIGE ONLINE-VALIDIERUNG ERFOLGREICH");
        return {
          valid: true,
          licenseData: response.licenseData,
          message: "Sofortige Online-Validierung erfolgreich",
        };
      } else {
        console.log("❌ SOFORTIGE ONLINE-VALIDIERUNG FEHLGESCHLAGEN");
        return {
          valid: false,
          needsReactivation: true,
          error: "Sofortige Online-Validierung fehlgeschlagen",
        };
      }
    } catch (onlineError) {
      console.error(
        "❌ SOFORTIGE ONLINE-VALIDIERUNG FEHLER:",
        onlineError.message
      );

      // SPEZIELLE BEHANDLUNG FÜR HARDWARE-DEAKTIVIERUNG
      if (onlineError.hardwareDeactivated) {
        console.error(
          "🚨 HARDWARE-DEAKTIVIERUNG bei sofortiger Validierung erkannt!"
        );
        return {
          valid: false,
          needsReactivation: true,
          hardwareDeactivated: true,
          error: onlineError.message,
          deactivatedAt: onlineError.deactivatedAt,
        };
      }

      // NUR bei echten Netzwerkfehlern Offline-Modus erlauben
      const isNetworkError =
        onlineError.message.includes("Verbindungsfehler") ||
        onlineError.message.includes("Zeitüberschreitung") ||
        onlineError.message.includes("nicht erreichbar") ||
        onlineError.message.includes("ENOTFOUND") ||
        onlineError.message.includes("ECONNREFUSED");

      if (isNetworkError) {
        console.log(
          "🔄 NETZWERKFEHLER bei sofortiger Validierung - Offline-Modus temporär erlaubt"
        );
        return {
          valid: true,
          licenseData: localLicense,
          message: "Offline-Modus: Netzwerkfehler bei sofortiger Validierung",
          offline: true,
        };
      } else {
        console.log(
          "❌ LIZENZ VOM SERVER ABGELEHNT bei sofortiger Validierung"
        );
        return {
          valid: false,
          needsReactivation: true,
          error:
            "Lizenz vom Server abgelehnt bei sofortiger Validierung: " +
            onlineError.message,
        };
      }
    }
  }

  // LOGIN-VALIDIERUNG (immer sofort online)
  async validateLicenseOnLogin() {
    console.log(
      "🔑 HARDWARE-DEAKTIVIERUNGS-AWARE Lizenz-Validierung beim Login..."
    );

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
          needsReactivation: true,
          error: "Lizenzschlüssel fehlt - manuelle Reaktivierung erforderlich",
        };
      }

      console.log(`🔍 Lokale Lizenz gefunden:`);
      console.log(`   🔑 License Key: ${localLicense.license_key}`);
      console.log(
        `   👤 Kunde: ${
          localLicense.customer_name ||
          localLicense.customer_email ||
          "Unbekannt"
        }`
      );

      // Bei JEDEM Login SOFORT online validieren
      console.log("🌐 ERZWINGE SOFORTIGE Online-Validierung beim Login...");

      try {
        const response = await this.validateLicenseOnline(
          localLicense.license_key
        );

        if (response.valid) {
          console.log("✅ LOGIN-ONLINE-VALIDIERUNG ERFOLGREICH");
          return {
            valid: true,
            licenseData: response.licenseData,
            message: "Lizenz online validiert beim Login",
          };
        } else {
          console.log("❌ LOGIN-ONLINE-VALIDIERUNG FEHLGESCHLAGEN");
          return {
            valid: false,
            needsReactivation: true,
            error: "Lizenz vom Server als ungültig markiert",
          };
        }
      } catch (onlineError) {
        console.warn(
          "⚠️ Login-Online-Validierung fehlgeschlagen:",
          onlineError.message
        );

        // SPEZIELLE BEHANDLUNG FÜR HARDWARE-DEAKTIVIERUNG
        if (onlineError.hardwareDeactivated) {
          console.error("🚨 HARDWARE-DEAKTIVIERUNG beim Login erkannt!");
          return {
            valid: false,
            needsReactivation: true,
            hardwareDeactivated: true,
            error: "Hardware-ID wurde deaktiviert: " + onlineError.message,
            deactivatedAt: onlineError.deactivatedAt,
          };
        }

        // Sehr restriktiv: NUR bei echten Netzwerkfehlern Offline-Modus
        const isNetworkError =
          onlineError.message.includes("Verbindungsfehler") ||
          onlineError.message.includes("Zeitüberschreitung") ||
          onlineError.message.includes("nicht erreichbar") ||
          onlineError.message.includes("ENOTFOUND") ||
          onlineError.message.includes("ECONNREFUSED");

        if (isNetworkError) {
          console.log(
            "🔄 NETZWERKFEHLER beim Login - Offline-Modus temporär erlaubt"
          );
          return {
            valid: true,
            licenseData: localLicense,
            message: "Offline-Modus: Server nicht erreichbar beim Login",
            offline: true,
          };
        } else {
          console.log("❌ LIZENZ-FEHLER beim Login - Login verweigert");
          return {
            valid: false,
            needsReactivation: true,
            error: "Lizenz-Problem beim Login: " + onlineError.message,
          };
        }
      }
    } catch (error) {
      console.error("❌ Login-Lizenzvalidierung fehlgeschlagen:", error);
      return {
        valid: false,
        needsReactivation: true,
        error: "Login-Lizenzvalidierung fehlgeschlagen: " + error.message,
      };
    }
  }

  // SESSION-VALIDIERUNG (IMMER SOFORT ONLINE - DAS WAR DAS PROBLEM!)
  async validateLicenseForSession() {
    console.log(
      "🔄 SOFORTIGE Session-Lizenz-Validierung (ignoriert 5-Min-Intervall)..."
    );

    // KRITISCH: Session-Checks IMMER sofort online validieren
    return await this.forceValidateOnline();
  }

  // Periodische Validierung (respektiert 5-Minuten-Intervall)
  async periodicValidation() {
    console.log("🔄 Periodische Validierung (5 Minuten Interval)...");
    return await this.mustValidateOnline();
  }

  async checkLicenseStatus() {
    console.log("🔍 Lizenz-Status-Prüfung (normale API-Calls)...");

    // Für allgemeine Status-Checks normale Validierung (5-Min-Intervall)
    const validationResult = await this.mustValidateOnline();

    if (!validationResult.valid) {
      return validationResult;
    }

    const features = this.extractLicenseFeatures(validationResult.licenseData);
    console.log("✅ Lizenz-Status: Gültig");

    return {
      valid: true,
      licenseData: validationResult.licenseData,
      features: features,
      expires_at: validationResult.licenseData.expires_at,
      validated_at: validationResult.licenseData.validated_at,
      offline: validationResult.offline || false,
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
    console.log(
      "\n🔧 SOFORTIGE SESSION-VALIDIERUNG LICENSE MANAGER DEBUG INFO:"
    );
    console.log("============================================================");
    console.log(`Server URL: ${this.serverUrl}`);
    console.log(`Server Host: ${this.serverHost}`);
    console.log(`Server Path: ${this.serverPath}`);
    console.log(`Endpoint: ${this.endpoint}`);
    console.log(`Full URL: ${this.serverUrl}/${this.endpoint}`);
    console.log(`Hardware ID: ${this.generateHardwareFingerprint()}`);
    console.log(`License File: ${this.licenseFile}`);
    console.log(`File exists: ${fs.existsSync(this.licenseFile)}`);
    console.log(
      `Normal Validation Interval: ${
        this.onlineValidationInterval / 1000 / 60
      } Minuten`
    );
    console.log(`Session Validation: SOFORT (immer online)`);
    console.log(
      `Last Online Validation: ${
        this.lastOnlineValidation
          ? new Date(this.lastOnlineValidation).toLocaleString()
          : "Nie"
      }`
    );
    console.log(
      "FEATURES: Session-Checks validieren SOFORT online (ignorieren 5-Min-Intervall)"
    );
    console.log(
      "============================================================\n"
    );
  }
}

module.exports = { LicenseManager };
