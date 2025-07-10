const express = require("express");
const router = express.Router();
const einstellungenController = require("../controllers/einstellungenController");

// GET /api/einstellungen - Alle Einstellungen laden
router.get("/", einstellungenController.list);

// PUT /api/einstellungen/batch - Batch-Update (NEUE LÖSUNG)
router.put("/batch", einstellungenController.updateBatch);

// PUT /api/einstellungen/:key - Einzelne Einstellung aktualisieren
router.put("/:key", einstellungenController.update);

// Legacy: PUT /api/einstellungen/ - Multiple Updates (für Kompatibilität)
router.put("/", einstellungenController.updateMultiple);

// GET /api/einstellungen/export - Einstellungen exportieren
router.get("/export", einstellungenController.export);

// POST /api/einstellungen/import - Einstellungen importieren
router.post("/import", einstellungenController.import);

// POST /api/einstellungen/reset - Einstellungen zurücksetzen
router.post("/reset", einstellungenController.reset);

module.exports = router;
