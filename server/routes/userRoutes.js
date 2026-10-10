const express = require("express");
const { getUsers, createUser, updateUser, deleteUser } = require("../controllers/userController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../utils/audit");

const router = express.Router();

// Admin-only user management for the Admin > Users page.
router.use("/users", protect, requireAdmin);
router.get("/users", getUsers);
router.post("/users", createUser);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

module.exports = router;
