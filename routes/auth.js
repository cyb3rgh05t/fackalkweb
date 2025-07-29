const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.post("/login", authController.login);
router.get("/status", authController.getCurrentUser);

router.post("/logout", requireAuth, authController.logout);
router.post("/logout-all", requireAuth, authController.logoutAll);
router.post("/change-password", requireAuth, authController.changePassword);
router.post("/change-username", requireAuth, authController.changeUsername);

router.post("/create-user", requireAdmin, authController.createUser);
router.get("/users", requireAdmin, authController.getAllUsers); // NEU
router.delete("/user/:id", requireAdmin, authController.deleteUser); // NEU
router.post("/user/:id/activate", requireAdmin, authController.activateUser); // NEU
router.post(
  "/user/:id/deactivate",
  requireAdmin,
  authController.deactivateUser
);

module.exports = router;
