const express = require("express");
const { list, batch } = require("../controllers/dataController");
const { getSettings, updateSettings } = require("../controllers/settingsController");
const { protect, optionalAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/settings", protect, requireRole("admin"), getSettings);
router.put("/settings", protect, requireRole("admin"), updateSettings);

// Public pages (event list, event detail) read without signing in.
router.get("/data/:resource", optionalAuth, list);
router.post("/data/:resource/batch", protect, batch);

module.exports = router;
