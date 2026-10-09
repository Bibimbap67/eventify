// Ticket QR codes, the staff check-in desk, and public certificate checks.
//
//   GET  /api/tickets/:id                 -> { qr, attendanceStatus, checkedInAt }  (ticket owner or admin)
//   POST /api/staff/checkin               -> { result, message, attendee }          (staff)
//   GET  /api/staff/events                -> { events }                             (staff)
//   GET  /api/staff/events/:id/attendees  -> { attendees }                          (staff)
//   GET  /api/certificates/verify/:id     -> { certificate }                        (anyone)
//   GET  /api/events/:id/seats            -> { seating, capacity, taken }           (anyone)
//
// The QR on a ticket holds "EVENTIFY-TICKET:<token>", where the token is 128 random bits
// stored on the registration. Ticket codes like TKT-1234-2026 are short and can repeat,
// so they are never accepted for check-in.
const crypto = require("crypto");
const { Event, Registration, Certificate, Notification } = require("../models/records");

const QR_PREFIX = "EVENTIFY-TICKET:";
const QR_RE = /^EVENTIFY-TICKET:([a-f0-9]{32})$/;
const CHECKED_IN = ["checked in", "attended"];
const CLOSED_EVENT_STATUS = ["COMPLETED", "Completed", "Cancelled", "CANCELLED", "Rejected"];
const DESK_EVENT_STATUS = ["REGISTRATION OPEN", "OPENS SOON", "COMPLETED", "Registration Open", "Published", "Approved", "Completed"];

const isCheckedIn = (registration) => CHECKED_IN.includes(String(registration.attendanceStatus || "").toLowerCase());

function attendeeView(registration, event) {
  return {
    id: registration._id,
    name: registration.name,
    email: registration.email,
    studentId: registration.studentId,
    seating: registration.seating || "free",
    seat: registration.seating === "reserved" ? registration.seat : null,
    ticketCode: registration.ticketCode,
    ticketType: registration.ticketType,
    status: registration.status,
    attendanceStatus: registration.attendanceStatus || "Not Checked In",
    checkedInAt: registration.checkedInAt || null,
    eventId: registration.eventId,
    eventTitle: event?.title || registration.eventTitle,
  };
}

function eventView(event) {
  return {
    id: event._id,
    title: event.title,
    date: event.date,
    time: event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : event.time,
    venue: event.venue || event.location,
    status: event.status,
    closed: CLOSED_EVENT_STATUS.includes(event.status),
  };
}

const getTicket = async (req, res) => {
  const registration = await Registration.findById(String(req.params.id));
  if (!registration || (req.user.role !== "admin" && registration.userId !== req.user.id)) {
    return res.status(404).json({ message: "Ticket not found." });
  }
  if (!registration.ticketToken) {
    // Only fills an empty token, so two tabs opening the pass at once agree on one code.
    await Registration.updateOne(
      { _id: registration._id, ticketToken: null },
      { $set: { ticketToken: crypto.randomBytes(16).toString("hex") } }
    );
  }
  const fresh = await Registration.findById(registration._id);
  res.json({
    qr: QR_PREFIX + fresh.ticketToken,
    attendanceStatus: fresh.attendanceStatus || "Not Checked In",
    checkedInAt: fresh.checkedInAt || null,
  });
};

// Every scan answers 200 with a result, so the desk can show why a ticket was refused.
const checkIn = async (req, res) => {
  const code = String(req.body?.code || "").trim();
  const eventId = req.body?.eventId ? String(req.body.eventId) : "";
  const refuse = (message, attendee = null, result = "invalid") => res.json({ result, message, attendee });

  const match = QR_RE.exec(code);
  if (!match) return refuse("This QR code is not an Eventify ticket.");

  const registration = await Registration.findOne({ ticketToken: match[1] });
  if (!registration) return refuse("Ticket not found. It may be fake, or it was reissued.");

  const event = await Event.findById(registration.eventId);
  const attendee = attendeeView(registration, event);
  if (!event) return refuse("The event on this ticket no longer exists.", attendee);
  if (eventId && registration.eventId !== eventId) {
    return refuse(`Wrong event. This ticket is for ${event.title}.`, attendee, "wrong-event");
  }
  if (registration.status === "Cancelled") return refuse("This ticket was cancelled by the attendee.", attendee);
  if (registration.status !== "Confirmed") return refuse(`This registration is ${registration.status || "not confirmed"}.`, attendee);
  if (CLOSED_EVENT_STATUS.includes(event.status)) return refuse(`Check-in is closed: ${event.title} is ${event.status.toLowerCase()}.`, attendee);
  if (isCheckedIn(registration)) {
    return refuse(`Already checked in${registration.checkedInAt ? ` at ${registration.checkedInAt}` : ""}.`, attendee, "duplicate");
  }

  const checkedInAt = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  // The status filter makes this atomic: two desks scanning the same ticket cannot both admit it.
  const updated = await Registration.findOneAndUpdate(
    { _id: registration._id, attendanceStatus: { $nin: ["Checked in", "Checked In", "Attended"] } },
    { $set: { attendanceStatus: "Checked in", checkedInAt, checkedInBy: req.user.name } },
    { new: true }
  );
  if (!updated) return refuse("Already checked in.", attendee, "duplicate");

  if (updated.userId) {
    await Notification.create({
      _id: `notif-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
      scope: "attendee",
      userId: updated.userId,
      eventId: updated.eventId,
      type: "attendance",
      title: `Checked In: ${event.title}`,
      message: `Your ticket was scanned at ${checkedInAt}. Welcome to the event!`,
      time: "Just now",
      timestamp: new Date().toISOString(),
      read: false,
      link: "/my-events",
    });
  }

  res.json({ result: "checked-in", message: "Ticket is valid. Checked in.", attendee: attendeeView(updated, event) });
};

const deskEvents = async (req, res) => {
  const events = await Event.find({ status: { $in: DESK_EVENT_STATUS } }).sort({ createdAt: -1 });
  const counts = await Registration.aggregate([
    { $match: { status: "Confirmed", eventId: { $in: events.map((event) => event._id) } } },
    {
      $group: {
        _id: "$eventId",
        registered: { $sum: 1 },
        checkedIn: { $sum: { $cond: [{ $in: [{ $toLower: { $ifNull: ["$attendanceStatus", ""] } }, CHECKED_IN] }, 1, 0] } },
      },
    },
  ]);
  const byId = new Map(counts.map((row) => [row._id, row]));
  res.json({
    events: events.map((event) => ({
      ...eventView(event),
      registered: byId.get(event._id)?.registered || 0,
      checkedIn: byId.get(event._id)?.checkedIn || 0,
    })),
  });
};

const deskAttendees = async (req, res) => {
  const event = await Event.findById(String(req.params.id));
  if (!event) return res.status(404).json({ message: "Event not found." });
  const registrations = await Registration.find({ eventId: event._id, status: "Confirmed" }).sort({ name: 1 });
  res.json({ attendees: registrations.map((registration) => attendeeView(registration, event)) });
};

// The seat map's live state: which seats confirmed tickets already hold (never who holds them).
const eventSeats = async (req, res) => {
  const event = await Event.findById(String(req.params.id));
  if (!event) return res.status(404).json({ message: "Event not found." });
  const reserved = event.seating === "reserved";
  const taken = reserved
    ? await Registration.distinct("seat", { eventId: event._id, status: "Confirmed", seating: "reserved" })
    : [];
  res.json({ seating: reserved ? "reserved" : "free", capacity: event.capacity || 0, taken });
};

const verifyCertificate = async (req, res) => {
  const certificate = await Certificate.findOne({ credentialId: String(req.params.credentialId) });
  if (!certificate) return res.status(404).json({ message: "No certificate has this credential ID." });
  const { credentialId, recipientName, eventTitle, issueDate, organizer, hoursEarned } = certificate.toJSON();
  res.json({ certificate: { credentialId, recipientName, eventTitle, issueDate, organizer, hoursEarned } });
};

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = {
  getTicket: wrap(getTicket),
  checkIn: wrap(checkIn),
  deskEvents: wrap(deskEvents),
  deskAttendees: wrap(deskAttendees),
  verifyCertificate: wrap(verifyCertificate),
  eventSeats: wrap(eventSeats),
};
