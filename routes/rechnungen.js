const express = require("express");
const router = express.Router();
const rechnungenController = require("../controllers/rechnungenController");

router.get("/", rechnungenController.list);
router.get("/:id", rechnungenController.get);
router.post("/", rechnungenController.create);
router.put("/:id", rechnungenController.update);
router.delete("/:id", rechnungenController.remove);

// GET /api/rechnungen/stats/anzahlungen - Anzahlungsstatistiken
router.get("/stats/anzahlungen", rechnungenController.getAnzahlungsStats);

// PUT /api/rechnungen/:id/anzahlung - Nur Anzahlung aktualisieren
router.put("/:id/anzahlung", rechnungenController.updateAnzahlung);

module.exports = router;
