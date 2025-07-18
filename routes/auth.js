// routes/auth.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Öffentliche Routen (ohne Authentifizierung)
router.post("/login", authController.login);
router.get("/status", authController.getCurrentUser);

// Geschützte Routen (Authentifizierung erforderlich)
router.post("/logout", requireAuth, authController.logout);
router.post("/change-password", requireAuth, authController.changePassword);

// Admin-Routen (Admin-Rechte erforderlich)
router.post("/create-user", requireAdmin, authController.createUser);
router.post("/change-username", requireAuth, authController.changeUsername);
module.exports = router;
