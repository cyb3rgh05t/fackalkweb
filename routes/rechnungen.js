const express = require("express");
const router = express.Router();
const rechnungenController = require("../controllers/rechnungenController");

router.get("/", rechnungenController.list);
router.get("/:id", rechnungenController.get);
router.post("/", rechnungenController.create);
router.put("/:id", rechnungenController.update);
router.delete("/:id", rechnungenController.remove);
router.get("/stats/anzahlungen", rechnungenController.getAnzahlungsStats);
router.put("/:id/anzahlung", rechnungenController.updateAnzahlung);

module.exports = router;
