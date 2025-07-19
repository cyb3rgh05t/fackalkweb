const builder = require("electron-builder");
const path = require("path");

async function buildApp() {
  console.log("🔨 Starte Build-Prozess...");

  try {
    // Rebuild native modules für Target-Platform
    const { execSync } = require("child_process");

    console.log("🔄 Rebuilding native modules...");
    execSync("npm run rebuild", { stdio: "inherit" });

    // Build für Windows
    const result = await builder.build({
      targets: builder.Platform.WINDOWS.createTarget(
        ["nsis"],
        builder.Arch.x64
      ),
      config: {
        directories: {
          output: "dist",
        },
        win: {
          target: [
            {
              target: "nsis",
              arch: ["x64"],
            },
          ],
        },
      },
    });

    console.log("✅ Build erfolgreich abgeschlossen");
    console.log(
      "📦 Installer erstellt in:",
      path.join(__dirname, "..", "dist")
    );
  } catch (error) {
    console.error("❌ Build-Fehler:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  buildApp();
}
