const express = require("express");
const router = express.Router();
const einstellungenController = require("../controllers/einstellungenController");

// Bestehende Routen
router.get("/", einstellungenController.list);
router.put("/:key", einstellungenController.update);

// Neue erweiterte Routen
router.put("/", einstellungenController.updateMultiple);
router.get("/export", einstellungenController.export);
router.post("/import", einstellungenController.import);
router.post("/reset", einstellungenController.reset);

module.exports = router;
