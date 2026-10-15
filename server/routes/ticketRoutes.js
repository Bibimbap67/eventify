const express = require("express");
const {
  getTicket, checkIn, deskEvents, deskAttendees, verifyCertificate, eventSeats,
  startExit, exitStatus, stopExit, verifyExit, manualExit,
} = require("../controllers/ticketController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/tickets/:id", protect, getTicket);
router.get("/certificates/verify/:credentialId", verifyCertificate);
router.get("/events/:id/seats", eventSeats);
// Exit verification: the attendee scans the staff screen's code; managers may also mark it by hand.
router.post("/exit", protect, requireRole("user"), verifyExit);
router.post("/registrations/:id/exit", protect, requireRole("manager", "admin"), manualExit);

// Check-in desk: event staff accounts only.
router.use("/staff", protect, requireRole("staff"));
router.post("/staff/checkin", checkIn);
router.get("/staff/events", deskEvents);
router.get("/staff/events/:id/attendees", deskAttendees);
router.post("/staff/events/:id/exit", startExit);
router.get("/staff/events/:id/exit", exitStatus);
router.delete("/staff/events/:id/exit", stopExit);

module.exports = router;
