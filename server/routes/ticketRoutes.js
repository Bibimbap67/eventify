const express = require("express");
const { getTicket, checkIn, deskEvents, deskAttendees, verifyCertificate, eventSeats } = require("../controllers/ticketController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/tickets/:id", protect, getTicket);
router.get("/certificates/verify/:credentialId", verifyCertificate);
router.get("/events/:id/seats", eventSeats);

// Check-in desk: event staff accounts only.
router.use("/staff", protect, requireRole("staff"));
router.post("/staff/checkin", checkIn);
router.get("/staff/events", deskEvents);
router.get("/staff/events/:id/attendees", deskAttendees);

module.exports = router;
