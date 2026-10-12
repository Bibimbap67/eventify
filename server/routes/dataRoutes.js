const express = require("express");
const { list, batch, publicFeedback, bookings } = require("../controllers/dataController");
const { getSettings, updateSettings } = require("../controllers/settingsController");
const { protect, optionalAuth, requireRole } = require("../middleware/auth");
const { requireAdmin } = require("../utils/audit");

const router = express.Router();

router.get("/settings", protect, requireAdmin, getSettings);
router.put("/settings", protect, requireAdmin, updateSettings);

// Public pages (event list, event detail) read without signing in.
router.get("/data/:resource", optionalAuth, list);
router.post("/data/:resource/batch", protect, batch);
router.get("/events/:id/feedback", publicFeedback);
router.get("/venues/bookings", protect, requireRole("admin", "manager"), bookings);

module.exports = router;
