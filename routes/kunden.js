const express = require("express");
const router = express.Router();
const kundenController = require("../controllers/kundenController");

router.get("/", kundenController.list);
router.get("/:id", kundenController.get);
router.post("/", kundenController.create);
router.put("/:id", kundenController.update);
router.delete("/:id", kundenController.remove);

module.exports = router;
