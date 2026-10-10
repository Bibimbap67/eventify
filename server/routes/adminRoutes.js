const express = require("express");
const {
  overview, registrations, eventReport, eventDetails, auditLogs, exportData,
} = require("../controllers/adminController");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../utils/audit");

const router = express.Router();

// Admin screens only. A signed-in non-admin who calls these is recorded in the audit trail.
router.use(protect, requireAdmin);
router.get("/overview", overview);
router.get("/registrations", registrations);
router.get("/reports/events", eventReport);
router.get("/events/:id", eventDetails);
router.get("/audit-logs", auditLogs);
router.get("/export", exportData);

module.exports = router;
