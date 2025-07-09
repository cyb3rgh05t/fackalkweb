const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use("/api/", limiter);

app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api/kunden", require("./routes/kunden"));
app.use("/api/fahrzeuge", require("./routes/fahrzeuge"));
app.use("/api/auftraege", require("./routes/auftraege"));
app.use("/api/rechnungen", require("./routes/rechnungen"));
app.use("/api/einstellungen", require("./routes/einstellungen"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Interner Serverfehler" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`Öffnen Sie http://localhost:${PORT} in Ihrem Browser`);
});

// Graceful Shutdown
process.on("SIGINT", () => {
  const db = require("./db");
  console.log("Server wird heruntergefahren...");
  db.close((err) => {
    if (err) console.error(err.message);
    else console.log("Datenbankverbindung geschlossen.");
    process.exit(0);
  });
});
