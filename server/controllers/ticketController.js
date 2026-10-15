// Ticket QR codes, the staff check-in desk, and public certificate checks.
//
//   GET  /api/tickets/:id                 -> { qr, attendanceStatus, checkedInAt }  (ticket owner or admin)
//   POST /api/staff/checkin               -> { result, message, attendee }          (staff)
//   GET  /api/staff/events                -> { events }                             (staff)
//   GET  /api/staff/events/:id/attendees  -> { attendees }                          (staff)
//   POST /api/staff/events/:id/exit       -> exit QR state, after starting it       (staff)
//   GET  /api/staff/events/:id/exit       -> { active, code, expiresIn, ... }       (staff, polled)
//   DELETE /api/staff/events/:id/exit     -> stops exit verification                (staff)
//   POST /api/exit                        -> { result, message, certificate }       (attendee)
//   POST /api/registrations/:id/exit      -> { message }                            (event's manager, admin)
//   GET  /api/certificates/verify/:id     -> { certificate }                        (anyone)
//   GET  /api/events/:id/seats            -> { seating, capacity, taken }           (anyone)
//
// The QR on a ticket holds "EVENTIFY-TICKET:<token>", where the token is 128 random bits
// stored on the registration. Ticket codes like TKT-1234-2026 are short and can repeat,
// so they are never accepted for check-in.
//
// Leaving works the other way round: the staff screen shows an exit QR and the attendee scans
// it with their signed-in account. Each code works for one successful scan and only for
// EXIT_CODE_MS, then the screen shows the next one. A verified exit marks the ticket Attended,
// which is what earns the certificate (utils/certificates.js).
const crypto = require("crypto");
const { Event, Registration, Certificate, Notification, ExitPass } = require("../models/records");
const { checkInOpensAt, exitWindow, exitIsOpen, opensLabel, formatTime } = require("../utils/checkIn");
const { issueCertificates } = require("../utils/certificates");
const { audit } = require("../utils/audit");
const { completeEndedEvents } = require("../utils/autoComplete");
const { CLOSED_EVENT_STATUS, PUBLIC_EVENT_STATUS } = require("../utils/eventStatus");

const QR_PREFIX = "EVENTIFY-TICKET:";
const QR_RE = /^EVENTIFY-TICKET:([a-f0-9]{32})$/;
const CHECKED_IN = ["checked in", "attended"];
const EXIT_CODE_MS = 30 * 1000;
// Events whose exit can't be verified: called off, or never approved.
const NO_EXIT_STATUS = ["Cancelled", "Rejected", "Archived", "Pending"];

const isCheckedIn = (registration) => CHECKED_IN.includes(String(registration.attendanceStatus || "").toLowerCase());
const hasExited = (registration) => String(registration.attendanceStatus || "").toLowerCase() === "attended";
const newToken = () => crypto.randomBytes(16).toString("hex");
const clockTime = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

async function notifyAttendee(registration, event, { type, title, message, link = "/my-events" }) {
  if (!registration.userId) return;
  await Notification.create({
    _id: `notif-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`,
    scope: "attendee",
    userId: registration.userId,
    eventId: registration.eventId,
    type,
    title: `${title}: ${event.title}`,
    message,
    time: "Just now",
    timestamp: new Date().toISOString(),
    read: false,
    link,
  });
}

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
    exitedAt: registration.exitedAt || null,
    eventId: registration.eventId,
    eventTitle: event?.title || registration.eventTitle,
  };
}

function eventView(event) {
  return {
    id: event._id,
    title: event.title,
    date: event.date,
    time: event.startTime && event.endTime ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)}` : "",
    venue: event.venue,
    status: event.status,
    closed: CLOSED_EVENT_STATUS.includes(event.status),
    exitOpen: !NO_EXIT_STATUS.includes(event.status) && exitIsOpen(event),
    exitOpensAt: exitWindow(event)?.opensAt || null,
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
  const opensAt = checkInOpensAt(event);
  if (opensAt && Date.now() < opensAt) return refuse(`Too early. Check-in opens when ${event.title} starts, ${opensLabel(opensAt)}.`, attendee);
  if (isCheckedIn(registration)) {
    return refuse(`Already checked in${registration.checkedInAt ? ` at ${registration.checkedInAt}` : ""}.`, attendee, "duplicate");
  }

  const checkedInAt = clockTime();
  // The status filter makes this atomic: two desks scanning the same ticket cannot both admit it.
  const updated = await Registration.findOneAndUpdate(
    { _id: registration._id, attendanceStatus: { $nin: ["Checked in", "Checked In", "Attended"] } },
    { $set: { attendanceStatus: "Checked in", checkedInAt, checkedInBy: req.user.name } },
    { new: true }
  );
  if (!updated) return refuse("Already checked in.", attendee, "duplicate");

  await notifyAttendee(updated, event, {
    type: "attendance",
    title: "Checked In",
    message: `Your ticket was scanned at ${checkedInAt}. Welcome! Scan the exit QR when you leave to get your certificate.`,
  });

  res.json({ result: "checked-in", message: "Ticket is valid. Checked in.", attendee: attendeeView(updated, event) });
};

const deskEvents = async (req, res) => {
  await completeEndedEvents();
  const events = await Event.find({ status: { $in: PUBLIC_EVENT_STATUS } }).sort({ createdAt: -1 });
  const counts = await Registration.aggregate([
    { $match: { status: "Confirmed", eventId: { $in: events.map((event) => event._id) } } },
    {
      $group: {
        _id: "$eventId",
        registered: { $sum: 1 },
        checkedIn: { $sum: { $cond: [{ $in: [{ $toLower: { $ifNull: ["$attendanceStatus", ""] } }, CHECKED_IN] }, 1, 0] } },
        exited: { $sum: { $cond: [{ $eq: [{ $toLower: { $ifNull: ["$attendanceStatus", ""] } }, "attended"] }, 1, 0] } },
      },
    },
  ]);
  const byId = new Map(counts.map((row) => [row._id, row]));
  res.json({
    events: events.map((event) => ({
      ...eventView(event),
      registered: byId.get(event._id)?.registered || 0,
      checkedIn: byId.get(event._id)?.checkedIn || 0,
      exited: byId.get(event._id)?.exited || 0,
    })),
  });
};

const deskAttendees = async (req, res) => {
  const event = await Event.findById(String(req.params.id));
  if (!event) return res.status(404).json({ message: "Event not found." });
  const registrations = await Registration.find({ eventId: event._id, status: "Confirmed" }).sort({ name: 1 });
  res.json({ attendees: registrations.map((registration) => attendeeView(registration, event)) });
};

// ---- exit verification ------------------------------------------------------------

// What the staff screen shows. A code past its time is replaced here, so the screen only has to
// ask every couple of seconds. Exit stops on its own once the window closes.
async function exitState(event) {
  const now = new Date();
  let pass = await ExitPass.findById(event._id);
  const open = !NO_EXIT_STATUS.includes(event.status) && exitIsOpen(event, now.getTime());
  if (pass?.active && !open) {
    pass = await ExitPass.findByIdAndUpdate(event._id, { $set: { active: false, token: null, expiresAt: null } }, { new: true });
  }
  if (pass?.active && !(pass.expiresAt > now)) {
    // Only replaces the code it read, so two staff screens asking at once agree on one code.
    pass = await ExitPass.findOneAndUpdate(
      { _id: event._id, token: pass.token },
      { $set: { token: newToken(), expiresAt: new Date(now.getTime() + EXIT_CODE_MS) } },
      { new: true }
    ) || await ExitPass.findById(event._id);
  }
  const tickets = { eventId: event._id, status: "Confirmed" };
  const [checkedIn, exited, recent] = await Promise.all([
    Registration.countDocuments({ ...tickets, attendanceStatus: { $in: ["Checked in", "Checked In", "Attended"] } }),
    Registration.countDocuments({ ...tickets, attendanceStatus: "Attended" }),
    Registration.find({ ...tickets, exitVerifiedAt: { $ne: null } }).sort({ exitVerifiedAt: -1 }).limit(5),
  ]);
  const active = Boolean(pass?.active);
  return {
    active,
    open,
    code: active ? pass.token : null,
    expiresIn: active ? Math.max(0, pass.expiresAt - now) : 0,
    codeMs: EXIT_CODE_MS,
    checkedIn,
    exited,
    recent: recent.map((item) => ({ id: item._id, name: item.name, exitedAt: item.exitedAt, method: item.exitMethod })),
  };
}

async function deskEvent(req, res) {
  const event = await Event.findById(String(req.params.id));
  if (!event) res.status(404).json({ message: "Event not found." });
  return event;
}

const startExit = async (req, res) => {
  const event = await deskEvent(req, res);
  if (!event) return;
  if (NO_EXIT_STATUS.includes(event.status)) {
    return res.status(400).json({ message: `${event.title} is ${event.status.toLowerCase()}, so there is no exit to verify.` });
  }
  const window = exitWindow(event);
  if (!exitIsOpen(event)) {
    return res.status(400).json({
      message: window && Date.now() < window.opensAt
        ? `Exit verification opens ${opensLabel(window.opensAt)}, 15 minutes before ${event.title} ends.`
        : "Exit verification for this event has closed. The event's manager can still mark someone as exited.",
    });
  }
  await ExitPass.findByIdAndUpdate(
    event._id,
    { $set: { active: true, token: newToken(), expiresAt: new Date(Date.now() + EXIT_CODE_MS), startedBy: req.user.name } },
    { upsert: true }
  );
  res.json(await exitState(event));
};

const exitStatus = async (req, res) => {
  const event = await deskEvent(req, res);
  if (event) res.json(await exitState(event));
};

const stopExit = async (req, res) => {
  const event = await deskEvent(req, res);
  if (!event) return;
  await ExitPass.findByIdAndUpdate(event._id, { $set: { active: false, token: null, expiresAt: null } });
  res.json(await exitState(event));
};

// Marks a checked-in ticket as exited (Attended), tells the attendee, and issues the
// certificate if the event is already Completed (otherwise it is issued when it completes).
async function recordExit(registration, event, method, by) {
  const exitedAt = clockTime();
  const updated = await Registration.findOneAndUpdate(
    { _id: registration._id, status: "Confirmed", attendanceStatus: { $in: ["Checked in", "Checked In"] } },
    { $set: { attendanceStatus: "Attended", exitedAt, exitVerifiedAt: new Date(), exitMethod: method, ...(by && { exitedBy: by }) } },
    { new: true }
  );
  if (!updated) return null;
  await issueCertificates([event._id]);
  const certificate = Boolean(await Certificate.exists({ eventId: event._id, userId: updated.userId }));
  await notifyAttendee(updated, event, {
    type: "attendance",
    title: "Exit Verified",
    message: certificate ? `You left at ${exitedAt}. Your certificate is ready.` : `You left at ${exitedAt}. Your certificate is issued when the event ends.`,
    link: certificate ? "/certificates" : "/my-events",
  });
  return { updated, certificate };
}

// The attendee's scan of the exit QR. Every answer is 200 with a result, like check-in, so the
// page can say why it was refused. A refused scan never uses up the code on screen.
const verifyExit = async (req, res) => {
  const eventId = String(req.body?.eventId || "");
  const code = String(req.body?.code || "").trim();
  const refuse = (result, message) => res.json({ result, message });

  const event = eventId && await Event.findById(eventId);
  if (!event || !/^[a-f0-9]{32}$/.test(code)) return refuse("invalid", "This is not an Eventify exit QR code.");
  const pass = await ExitPass.findById(event._id);
  if (!pass?.active || NO_EXIT_STATUS.includes(event.status) || !exitIsOpen(event)) {
    return refuse("closed", `Exit verification isn't running for ${event.title} right now. Ask the event staff.`);
  }
  const registration = await Registration.findOne({ eventId: event._id, userId: req.user.id, status: "Confirmed" });
  if (!registration) return refuse("not-registered", `You don't have a ticket to ${event.title}.`);
  if (hasExited(registration)) {
    return refuse("duplicate", `Your exit from ${event.title} is already verified${registration.exitedAt ? ` (${registration.exitedAt})` : ""}.`);
  }
  if (!isCheckedIn(registration)) {
    return refuse("not-checked-in", `Your ticket to ${event.title} was never checked in at the entrance, so your exit can't be verified. Talk to the event staff.`);
  }
  if (pass.token !== code || !(pass.expiresAt > new Date())) {
    return refuse("expired", "This code has expired or was already used. Scan the code on the staff screen now.");
  }

  // Uses the code up and puts the next one on screen in one step: of two scans of one code, one wins.
  const now = new Date();
  const consumed = await ExitPass.findOneAndUpdate(
    { _id: event._id, active: true, token: code, expiresAt: { $gt: now } },
    { $set: { token: newToken(), expiresAt: new Date(now.getTime() + EXIT_CODE_MS) } }
  );
  if (!consumed) return refuse("expired", "Someone just used this code. Scan the new code on the staff screen.");

  const done = await recordExit(registration, event, "scan");
  if (!done) return refuse("duplicate", `Your exit from ${event.title} is already verified.`);
  res.json({
    result: "exited",
    message: `Exit verified at ${done.updated.exitedAt}. ${done.certificate
      ? `Your certificate for ${event.title} is ready.`
      : `Your certificate for ${event.title} is issued when the event ends.`}`,
    certificate: done.certificate,
  });
};

// The event's manager (or an admin) marks someone as exited by hand, e.g. their phone died.
// Only a checked-in ticket qualifies, and only once exit verification has opened. Audited.
const manualExit = async (req, res) => {
  const registration = await Registration.findById(String(req.params.id));
  const event = registration && await Event.findById(registration.eventId);
  const owns = req.user.role === "admin" || (event && event.managerId === (req.user.managerId || req.user.id));
  if (!registration || !event || !owns) return res.status(404).json({ message: "Registration not found." });
  const entry = { action: "Marked exit manually", targetType: "registration", targetId: registration._id, target: `${registration.name} · ${event.title}` };
  const refuse = async (message) => {
    await audit(req, { ...entry, outcome: "denied", details: { reason: message } });
    res.status(400).json({ message });
  };
  const window = exitWindow(event);
  if (registration.status !== "Confirmed") return refuse(`${registration.name}'s registration is not confirmed.`);
  if (hasExited(registration)) return refuse(`${registration.name}'s exit is already recorded.`);
  if (!isCheckedIn(registration)) return refuse(`${registration.name} was never checked in, so they can't be marked as exited.`);
  if (NO_EXIT_STATUS.includes(event.status)) return refuse(`${event.title} is ${event.status.toLowerCase()}.`);
  if (window && Date.now() < window.opensAt) return refuse(`Exits can be recorded from ${opensLabel(window.opensAt)}.`);

  const done = await recordExit(registration, event, "manual", req.user.name);
  if (!done) return refuse(`${registration.name}'s exit is already recorded.`);
  await audit(req, { ...entry, details: { exitedAt: done.updated.exitedAt } });
  res.json({ message: `${registration.name} marked as exited. ${done.certificate ? "Their certificate is issued." : "Their certificate is issued when the event ends."}` });
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

module.exports = {
  getTicket, checkIn, deskEvents, deskAttendees, verifyCertificate, eventSeats,
  startExit, exitStatus, stopExit, verifyExit, manualExit,
};
