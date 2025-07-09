const express = require("express");
const router = express.Router();
const einstellungenController = require("../controllers/einstellungenController");

router.get("/", einstellungenController.list);
router.put("/:key", einstellungenController.update);

module.exports = router;
