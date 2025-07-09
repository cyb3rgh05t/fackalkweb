const express = require("express");
const router = express.Router();
const auftraegeController = require("../controllers/auftraegeController");

router.get("/", auftraegeController.list);
router.get("/:id", auftraegeController.get);
router.post("/", auftraegeController.create);
router.put("/:id", auftraegeController.update);
router.delete("/:id", auftraegeController.remove);

module.exports = router;
