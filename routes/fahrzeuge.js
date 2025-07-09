const express = require("express");
const router = express.Router();
const fahrzeugeController = require("../controllers/fahrzeugeController");

router.get("/", fahrzeugeController.list);
router.get("/:id", fahrzeugeController.get);
router.post("/", fahrzeugeController.create);
router.put("/:id", fahrzeugeController.update);
router.delete("/:id", fahrzeugeController.remove);

module.exports = router;
