// Generic read/write endpoints for the app's record collections.
//
//   GET  /api/data/:resource         -> { items: [...] } (only what the caller may see)
//   POST /api/data/:resource/batch   -> body { save: [records], remove: [ids] }
//   GET  /api/venues/bookings        -> { capacity, bookings } (a venue's events on one day)
//
// The React contexts keep their data in memory and call /batch with whatever
// changed. Each resource below decides who may read and write which records, so a
// signed-in attendee can only touch their own registrations, a manager only the
// events they own, and so on.
const {
  Event, Registration, Certificate, Notification, Session, Announcement, Feedback, Venue,
} = require("../models/records");
const { seatId, seatIndex, onMap, firstFreeSeat } = require("../utils/seating");
const { audit, diff } = require("../utils/audit");
const { checkInOpensAt, opensLabel, toMinutes, formatTime } = require("../utils/checkIn");
const { PUBLIC_EVENT_STATUS, OPEN_EVENT_STATUS, managerMayChangeStatus, isRunning } = require("../utils/eventStatus");
const { issueCertificates } = require("../utils/certificates");
const { completeEndedEvents } = require("../utils/autoComplete");
const { sendMail } = require("../utils/mail");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}
const deny = (message = "You do not have permission to change this record.") => {
  throw new HttpError(403, message);
};

// Eventify serves NU MOA students only, so every attendee ticket is a student ticket.
const ATTENDEE_TYPE = "Student Attendee";

const isAdmin = (user) => user?.role === "admin";
const isManager = (user) => user?.role === "manager";
const managerKey = (user) => user.managerId || user.id;

async function ownedEventIds(user) {
  if (!isManager(user)) return [];
  return Event.find({ managerId: managerKey(user) }).distinct("_id");
}

async function ownsEvent(user, eventId) {
  if (!isManager(user) || !eventId) return false;
  return Boolean(await Event.exists({ _id: eventId, managerId: managerKey(user) }));
}

// ---- seating -----------------------------------------------------------------
// "free": first come, first served, and tickets carry no seat number.
// "reserved": every confirmed ticket holds one seat on the event's map (utils/seating.js).

// Seating may not change once people hold tickets, and a reserved event may not shrink
// below a seat that is already taken.
async function checkSeating(record, existing) {
  record.seating = record.seating === "reserved" ? "reserved" : "free";
  if (!existing) return;
  const holders = { eventId: existing.id, status: "Confirmed" };
  if (record.seating !== (existing.seating || "free") && (await Registration.exists(holders))) {
    deny("Seating can't change after people have registered.");
  }
  if (record.seating === "reserved") {
    const seats = await Registration.distinct("seat", { ...holders, seating: "reserved" });
    const last = Math.max(-1, ...seats.map(seatIndex));
    if (last >= Number(record.capacity || 0)) {
      deny(`Capacity can't go below ${last + 1}: seat ${seatId(last)} is already taken.`);
    }
  }
}

// ---- venue booking -------------------------------------------------------------
// One venue holds one event at a time, and no event may hold more people than its venue.
// Events that were called off free their time slot.
const FREED_EVENT_STATUS = ["Rejected", "Cancelled", "Archived"];

async function venueBookings(venue, date, excludeId) {
  return Event.find({ venue, date, _id: { $ne: excludeId }, status: { $nin: FREED_EVENT_STATUS } }).sort({ startTime: 1 });
}

// Only checked when the booking changes, so an older event can still be edited or closed.
async function checkVenue(record, existing) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (record.date && record.date !== existing?.date && record.date < today) {
    throw new HttpError(400, "Pick today or a later date.");
  }
  if (!record.venue) return;
  const venue = await Venue.findOne({ name: record.venue });
  const resized = !existing || record.venue !== existing.venue || Number(record.capacity) !== Number(existing.capacity);
  if (resized && venue?.capacity && Number(record.capacity) > venue.capacity) {
    throw new HttpError(400, `${venue.name} holds ${venue.capacity} people. Set the capacity to ${venue.capacity} or less.`);
  }
  if (!record.date || FREED_EVENT_STATUS.includes(record.status)) return;
  const reopened = existing && FREED_EVENT_STATUS.includes(existing.status);
  const moved = !existing || reopened || ["venue", "date", "startTime", "endTime"].some((key) => record[key] !== existing[key]);
  if (!moved) return;
  const start = toMinutes(record.startTime);
  const end = toMinutes(record.endTime);
  if (start === null || end === null) return;
  const clash = (await venueBookings(record.venue, record.date, existing?.id))
    .find((other) => toMinutes(other.startTime) < end && start < toMinutes(other.endTime));
  if (clash) {
    throw new HttpError(409, `${record.venue} is already booked for ${clash.title} from ${formatTime(clash.startTime)} to ${formatTime(clash.endTime)} that day. Pick another time or venue.`);
  }
}

// ---- attendee schedule ----------------------------------------------------------
// An attendee can't hold tickets to two events whose times overlap on the same day, at any
// venue. They cancel the other ticket first (src/data/time.js eventsClash checks the same).
const FINISHED_EVENT_STATUS = ["Completed", ...FREED_EVENT_STATUS];

async function checkAttendeeSchedule(userId, event) {
  const start = toMinutes(event.startTime);
  const end = toMinutes(event.endTime);
  if (!event.date || start === null || end === null) return;
  const held = await Registration.distinct("eventId", { userId, status: "Confirmed", eventId: { $ne: event._id } });
  if (!held.length) return;
  const sameDay = await Event.find({ _id: { $in: held }, date: event.date, status: { $nin: FINISHED_EVENT_STATUS } });
  const clash = sameDay.find((other) => {
    const [otherStart, otherEnd] = [toMinutes(other.startTime), toMinutes(other.endTime)];
    return otherStart !== null && otherEnd !== null && otherStart < end && start < otherEnd;
  });
  if (clash) {
    throw new HttpError(409, `This clashes with ${clash.title} (${formatTime(clash.startTime)} to ${formatTime(clash.endTime)}). Cancel that registration to register here.`);
  }
}

// Free seating clears the seat number. Reserved seating checks the seat is on the map and
// free. An attendee's own pick must be exact (`strict`); rows saved by staff without a
// seat, or whose old seat was taken while they were cancelled, get the first open seat.
async function placeSeat(record, existing, { strict = false } = {}) {
  const event = await Event.findById(record.eventId || existing?.eventId);
  if (!event) return;
  if (event.seating !== "reserved") {
    record.seating = "free";
    record.seat = null;
    return;
  }
  record.seating = "reserved";
  record.seat = record.seat || existing?.seat || null;
  if (record.status !== "Confirmed") return; // only confirmed tickets hold a seat
  const others = { eventId: event._id, status: "Confirmed", seating: "reserved" };
  if (existing) others._id = { $ne: existing.id };
  const taken = new Set(await Registration.distinct("seat", others));
  const usable = record.seat && onMap(record.seat, event.capacity) && !taken.has(record.seat);
  if (usable) return;
  if (strict) {
    if (!record.seat) throw new HttpError(400, "Pick a seat on the seat map.");
    if (!onMap(record.seat, event.capacity)) throw new HttpError(400, `Seat ${record.seat} is not on this event's seat map.`);
    throw new HttpError(409, `Seat ${record.seat} was just taken. Pick another seat.`);
  }
  record.seat = firstFreeSeat(event.capacity, taken);
  if (!record.seat) throw new HttpError(409, "Every seat for this event is taken.");
}

// ---- reusable policies -------------------------------------------------------

const adminOnly = {
  read: (user) => (isAdmin(user) ? {} : null),
  save: (user) => isAdmin(user) || deny(),
  remove: (user) => isAdmin(user) || deny(),
};

const publicReadAdminWrite = { ...adminOnly, read: () => ({}) };

// Sessions / announcements that belong to a manager's event.
function managerEventChild({ publicRead = false } = {}) {
  return {
    async read(user) {
      if (isAdmin(user) || publicRead) return {};
      if (isManager(user)) return { eventId: { $in: await ownedEventIds(user) } };
      return null;
    },
    async save(user, record, existing) {
      if (isAdmin(user)) return;
      if (!(await ownsEvent(user, record.eventId))) deny();
      if (existing && !(await ownsEvent(user, existing.eventId))) deny();
    },
    async remove(user, existing) {
      if (isAdmin(user)) return;
      if (!(await ownsEvent(user, existing.eventId))) deny();
    },
  };
}

const RUNNING_LOCKED_FIELDS = ["title", "description", "category", "organizer", "date", "startTime", "venue", "venueId", "capacity", "seating", "requirements", "preparationStatus", "speakers"];

// Every event, whether a manager or an admin made it. An admin's event belongs to that admin
// (its managerId), so it never shows in a manager's workspace.
const events = {
  model: Event,
  scope: "manager",
  async read(user) {
    if (isAdmin(user)) return {};
    const visible = { status: { $in: PUBLIC_EVENT_STATUS } };
    if (isManager(user)) return { $or: [visible, { managerId: managerKey(user) }] };
    if (!user) return visible;
    // An attendee still sees a cancelled event they had a ticket for, so it doesn't just vanish.
    const theirs = await Registration.distinct("eventId", { userId: user.id });
    return { $or: [visible, { status: "Cancelled", _id: { $in: theirs } }] };
  },
  async save(user, record, existing) {
    await checkSeating(record, existing);
    await checkVenue(record, existing);
    if (isAdmin(user)) return;
    if (!isManager(user)) deny();
    if (existing && existing.managerId !== managerKey(user)) deny();
    record.managerId = managerKey(user);
    // Managers pick the venue from the admin's list; an older event may keep its typed-in one.
    if (record.venue !== existing?.venue && (typeof record.venue !== "string" || !(await Venue.exists({ name: record.venue })))) {
      throw new HttpError(400, "Choose a venue from the list the admin set up.");
    }
    if (!existing) {
      record.status = "Pending"; // new events wait for admin approval
    } else if (record.status !== existing.status && !managerMayChangeStatus(existing, record.status)) {
      deny("Only an administrator can approve or publish an event.");
    }
    // Attendees are already in the room, so a running event keeps its details. Overtime (a later
    // end time) and a status change (complete, cancel) are the only edits.
    if (existing && isRunning(existing)) {
      const changed = RUNNING_LOCKED_FIELDS.some((key) => JSON.stringify(record[key] ?? null) !== JSON.stringify(existing[key] ?? null));
      if (changed || !(toMinutes(record.endTime) >= toMinutes(existing.endTime))) {
        deny("This event is running, so its details can't be edited. You can still add overtime or mark it completed.");
      }
    }
  },
  async remove(user, existing) {
    if (isAdmin(user)) return;
    if (existing.managerId !== managerKey(user)) deny();
  },
  // Completing an event issues the certificates of everyone already marked Attended.
  async afterSave(saved) {
    await issueCertificates(saved.filter(({ before, after }) => after.status === "Completed" && before?.status !== "Completed").map(({ id }) => id));
    await notifyRejectionUndone(saved);
  },
  async afterRemove(ids) {
    const byEvent = { eventId: { $in: ids } };
    await Promise.all([
      Registration.deleteMany(byEvent),
      Certificate.deleteMany(byEvent),
      Notification.deleteMany(byEvent),
      Session.deleteMany(byEvent),
      Announcement.deleteMany(byEvent),
      Feedback.deleteMany(byEvent),
    ]);
  },
  // Attendees only see their own registrations, so the server supplies the counts, and the
  // average rating of each completed event (feedback is public once an event is done).
  async decorate(items) {
    const done = items.filter((item) => item.status === "Completed").map((item) => item.id);
    const [counts, ratings] = await Promise.all([
      Registration.aggregate([
        { $match: { status: "Confirmed", eventId: { $in: items.map((item) => item.id) } } },
        { $group: { _id: "$eventId", count: { $sum: 1 } } },
      ]),
      Feedback.aggregate([
        { $match: { eventId: { $in: done }, rating: { $type: "number" } } },
        { $group: { _id: "$eventId", count: { $sum: 1 }, average: { $avg: "$rating" } } },
      ]),
    ]);
    const byId = new Map(counts.map((row) => [row._id, row.count]));
    const rated = new Map(ratings.map((row) => [row._id, row]));
    return items.map((item) => {
      const rating = rated.get(item.id);
      return {
        ...item,
        registeredCount: byId.get(item.id) || 0,
        ...(rating && { feedbackCount: rating.count, feedbackAverage: Math.round(rating.average * 10) / 10 }),
      };
    });
  },
};

// Saved only by the server when an attendee leaves (see Registration in models/records.js).
const EXIT_FIELDS = ["exitedAt", "exitVerifiedAt", "exitMethod", "exitedBy"];
const attended = (registration) => String(registration?.attendanceStatus || "").toLowerCase() === "attended";

const registrations = {
  model: Registration,
  scope: "manager",
  async read(user) {
    if (!user) return null;
    // Admins read registrations a page at a time (GET /api/admin/registrations), so here they get only their own.
    if (isManager(user)) return { eventId: { $in: await ownedEventIds(user) } };
    return { userId: user.id };
  },
  async save(user, record, existing) {
    // The QR secret only ever comes from the server, and a stale client copy must not erase it.
    delete record.ticketToken;
    if (existing?.ticketToken) record.ticketToken = existing.ticketToken;
    // Exit details come only from the exit QR scan or a manager's Mark exited (ticketController.js).
    EXIT_FIELDS.forEach((key) => {
      delete record[key];
      if (existing?.[key] != null && attended(record)) record[key] = existing[key];
    });
    if (isAdmin(user)) return placeSeat(record, existing);
    if (isManager(user)) {
      if (!(await ownsEvent(user, record.eventId))) deny();
      if (existing && !(await ownsEvent(user, existing.eventId))) deny();
      // Attended means the exit was verified, which managers record with Mark exited, not here.
      if (attended(existing)) {
        record.attendanceStatus = existing.attendanceStatus;
        EXIT_FIELDS.forEach((key) => { if (existing[key] != null) record[key] = existing[key]; });
      } else if (attended(record)) {
        deny("Attendance completes when the attendee scans the exit QR. Use Mark exited for a checked-in participant.");
      }
      const checkingIn = String(record.attendanceStatus || "").toLowerCase() === "checked in" &&
        String(existing?.attendanceStatus || "").toLowerCase() !== "checked in";
      const opensAt = checkingIn && checkInOpensAt(await Event.findById(record.eventId));
      if (opensAt && Date.now() < opensAt) deny(`Check-in opens when the event starts, ${opensLabel(opensAt)}.`);
      return placeSeat(record, existing);
    }
    // Attendee: only their own registration, and the event cannot be swapped.
    if (existing) {
      if (existing.userId !== user.id) deny();
      record.userId = user.id;
      record.eventId = existing.eventId;
      // The name prints on the certificate (utils/certificates.js): set from the account when the ticket is made, then fixed.
      record.name = existing.name;
      record.email = existing.email;
      record.studentId = existing.studentId;
      // Check-in and exit happen only by scanning (the ticket at the door, the exit QR on the way out).
      record.attendanceStatus = existing.attendanceStatus;
      EXIT_FIELDS.forEach((key) => { if (existing[key] != null) record[key] = existing[key]; });
      record.checkedInAt = existing.checkedInAt;
      record.checkedInBy = existing.checkedInBy;
      // An attendee can cancel, but not once checked in, not revive a cancelled ticket, and not move seats.
      const cancelling = existing.status === "Confirmed" && record.status === "Cancelled";
      if (!cancelling) record.status = existing.status;
      else if (/^(checked in|attended)$/i.test(existing.attendanceStatus || "")) deny("You're already checked in, so this ticket can't be cancelled.");
      record.seat = existing.seat;
      record.seating = existing.seating;
      record.ticketType = existing.ticketType;
      return;
    }
    record.userId = user.id;
    record.name = user.name;
    record.email = user.email;
    // A student ID on the profile wins; without one, the ID typed on the form is kept.
    record.studentId = user.studentId || String(record.studentId || "").trim().slice(0, 20);
    record.ticketType = ATTENDEE_TYPE;
    record.attendanceStatus = "Not Checked In";
    record.checkedInAt = null;
    delete record.checkedInBy;
    const event = await Event.findById(record.eventId);
    if (!event) throw new HttpError(404, "Event not found.");
    if (!OPEN_EVENT_STATUS.includes(event.status)) deny("Registration is not open for this event.");
    const query = { eventId: event._id, status: "Confirmed" };
    if (await Registration.exists({ ...query, userId: user.id })) deny("You are already registered for this event.");
    await checkAttendeeSchedule(user.id, event);
    if (event.capacity && (await Registration.countDocuments(query)) >= event.capacity) {
      deny("Sorry, this event has reached maximum capacity.");
    }
    record.status = "Confirmed";
    await placeSeat(record, null, { strict: true });
  },
  // Two sign-ups for the last seat can both pass the count in save(). The earliest tickets keep
  // their places; a ticket created past the event's capacity is taken back here.
  async afterCreate(user, created) {
    if (isAdmin(user) || isManager(user) || created.status !== "Confirmed") return;
    const event = await Event.findById(created.eventId);
    if (!event?.capacity) return;
    const earlier = await Registration.countDocuments({
      eventId: created.eventId,
      status: "Confirmed",
      $or: [{ createdAt: { $lt: created.createdAt } }, { createdAt: created.createdAt, _id: { $lt: created._id } }],
    });
    if (earlier < event.capacity) return;
    await created.deleteOne();
    deny("Sorry, this event has reached maximum capacity.");
  },
  async remove(user, existing) {
    if (isAdmin(user)) return;
    if (await ownsEvent(user, existing.eventId)) return;
    deny();
  },
  // A ticket marked Attended on a completed event gets its certificate.
  async afterSave(saved) {
    await issueCertificates(saved.filter(({ before, after }) => after.attendanceStatus === "Attended" && before?.attendanceStatus !== "Attended").map(({ after }) => after.eventId));
  },
};

const RESOURCES = {
  // Only the server issues certificates (utils/certificates.js). Attendees read their own;
  // an admin may still correct or revoke one.
  certificates: {
    model: Certificate,
    read: (user) => (isAdmin(user) ? {} : user ? { userId: user.id } : null),
    save: adminOnly.save,
    remove: adminOnly.remove,
  },

  notifications: {
    model: Notification,
    scope: "attendee",
    read: (user) => (user ? { userId: user.id } : null), // admins too: nobody reads another person's inbox
    save(user, record, existing) {
      if (isAdmin(user)) return;
      if (!user || (existing && existing.userId !== user.id)) deny();
      record.userId = user.id;
    },
    remove(user, existing) {
      if (!isAdmin(user) && existing.userId !== user?.id) deny();
    },
  },

  // Every event and its records (ManagerContext). The "manager-" names are from before admins
  // saved their events the same way as managers.
  "manager-events": events,
  "manager-registrations": registrations,
  "manager-sessions": { model: Session, scope: "manager", ...managerEventChild({ publicRead: true }) },
  "manager-announcements": {
    model: Announcement,
    scope: "manager",
    ...managerEventChild(),
    afterSave: notifyAnnouncements,
    // Published updates show on the public event page; drafts stay with the event's manager.
    async read(user) {
      if (isAdmin(user)) return {};
      const visible = await Event.distinct("_id", { status: { $in: PUBLIC_EVENT_STATUS } });
      const published = { status: "Published", eventId: { $in: visible } };
      if (isManager(user)) return { $or: [{ eventId: { $in: await ownedEventIds(user) } }, published] };
      return published;
    },
  },
  "manager-feedback": {
    model: Feedback,
    scope: "manager",
    ...managerEventChild(),
    async save(user, record, existing) {
      // Ratings feed the public average on event cards, so only whole stars 1 to 5 count.
      if (["rating", "organizationRating", "speakerRating", "venueRating"].some((key) => record[key] != null && ![1, 2, 3, 4, 5].includes(record[key]))) {
        throw new HttpError(400, "Ratings go from 1 to 5 stars.");
      }
      if (isAdmin(user) || (await ownsEvent(user, record.eventId))) return;
      // Attendees may leave one feedback entry for an event they attended (exit verified).
      if (!user || existing) deny();
      const ticket = await Registration.findOne({ userId: user.id, eventId: record.eventId, status: "Confirmed", attendanceStatus: "Attended" });
      if (!ticket) deny("Only attendees whose exit was verified can leave feedback.");
      if (await Feedback.exists({ userId: user.id, eventId: record.eventId })) deny("You already left feedback for this event.");
      record.userId = user.id;
      record.participant = ticket.name;
    },
  },
  "manager-notifications": {
    model: Notification,
    scope: "manager",
    ...managerEventChild(),
    // Only the event's manager reads them (their workspace's Event updates).
    async read(user) {
      return isManager(user) ? { eventId: { $in: await ownedEventIds(user) } } : null;
    },
    async save(user, record, existing) {
      if (isAdmin(user) || (await ownsEvent(user, record.eventId))) return;
      // Attendee actions (registering, leaving feedback) notify the event's manager.
      if (!user || existing) deny();
      if (!(await Event.exists({ _id: record.eventId }))) deny();
    },
  },

  // Venues: the admin keeps the list (AdminContext), everyone can read it.
  // The audit log is not here on purpose: only the server writes it (utils/audit.js), and
  // admins read it through GET /api/admin/audit-logs, so nobody can edit or delete entries.
  venues: {
    model: Venue,
    ...publicReadAdminWrite,
    // Events keep their venue by name, so a renamed venue renames it on its events too, and the
    // booking check (checkVenue) keeps finding them.
    async afterSave(saved) {
      for (const { before, after } of saved) {
        if (before && after.name && before.name !== after.name) await Event.updateMany({ venue: before.name }, { $set: { venue: after.name } });
      }
    },
  },
};

// An admin undid a rejection made by mistake (Rejected -> Pending): the event's manager sees it
// in their workspace's Event updates. Events an admin made have no manager to tell.
async function notifyRejectionUndone(saved) {
  const undone = saved.filter(({ before, after }) => before?.status === "Rejected" && after.status === "Pending" && !after.createdByAdmin);
  if (!undone.length) return;
  const now = new Date();
  await Notification.insertMany(undone.map(({ id, after }) => ({
    _id: `mn-undo-${id}-${now.getTime()}`,
    scope: "manager",
    eventId: id,
    type: "rejection-undone",
    message: `${after.title} was rejected by mistake. The admin undid it, and it's back to pending review.`,
    date: now.toISOString().slice(0, 10),
    read: false,
  })));
}

// A newly published announcement goes to everyone holding a ticket to its event: an inbox
// notification, and an email. Emails are not awaited, so a slow mail server never holds up saving.
async function notifyAnnouncements(saved) {
  const published = saved.filter(({ before, after }) => after.status === "Published" && before?.status !== "Published");
  for (const { id, after } of published) {
    const event = await Event.findById(after.eventId);
    if (!event) continue;
    const tickets = await Registration.find({ eventId: event._id, status: "Confirmed" });
    const now = new Date();
    await Notification.insertMany(tickets.filter((ticket) => ticket.userId).map((ticket) => ({
      _id: `notif-${id}-${ticket._id}`,
      scope: "attendee",
      userId: ticket.userId,
      eventId: event._id,
      type: "announcement",
      title: `${event.title}: ${after.title}`,
      message: after.message,
      time: "Just now",
      timestamp: now.toISOString(),
      read: false,
      link: `/events/${event._id}`,
    })), { ordered: false }).catch((err) => {
      if (err.code !== 11000) throw err; // already notified (the announcement was published before)
    });
    const emails = [...new Set(tickets.map((ticket) => ticket.email).filter(Boolean))];
    // Blind copies, so attendees never see each other's addresses. 50 at a time stays under Gmail's per-message limit.
    for (let i = 0; i < emails.length; i += 50) {
      sendMail({
        to: process.env.MAIL_FROM || process.env.SMTP_USER || "",
        bcc: emails.slice(i, i + 50),
        subject: `${event.title}: ${after.title}`,
        text: `${after.message}\n\nYou're getting this because you have a ticket to ${event.title}.\nEvent page: ${process.env.CLIENT_URL || "https://eventifys.vercel.app"}/events/${event._id}\n\nEventify · National University - Mall of Asia`,
      }).catch((err) => console.error("Could not send the announcement email:", err.message));
    }
  }
}

// ---- audit trail ---------------------------------------------------------------
// Every change an admin makes through /batch is recorded with its outcome. Other users are
// recorded only when they are refused on records that only an admin may change (`watch`),
// such as approving their own event; their everyday writes are not admin activity.
const AUDITED = {
  "manager-events": { type: "event", name: (r) => r.title, watch: true },
  venues: { type: "venue", name: (r) => r.name, watch: true },
  "manager-sessions": { type: "session", name: (r) => r.title },
  "manager-announcements": { type: "announcement", name: (r) => r.title },
  "manager-feedback": { type: "feedback", name: (r) => r.participant },
  "manager-registrations": { type: "registration", name: (r) => r.name && `${r.name} · ${r.eventTitle || r.eventId}` },
  certificates: { type: "certificate", name: (r) => r.recipientName && `${r.recipientName} · ${r.eventTitle}`, created: "Issued", removed: "Revoked" },
};

// An event's new status, as the admin action that set it.
function eventVerb(from, to) {
  const before = String(from || "").toLowerCase();
  const after = String(to || "").toLowerCase();
  if (["opens soon", "approved"].includes(after)) return "Approved";
  // Approving a manager's event opens registration straight away.
  if (["registration open", "published"].includes(after)) return before === "pending" ? "Approved" : "Published";
  return { rejected: "Rejected", cancelled: "Cancelled", completed: "Completed", archived: "Archived", pending: "Returned to pending" }[after] || "Changed status of";
}

function describeWrite(config, { op, before, after }) {
  if (op === "remove") return { action: `${config.removed || "Deleted"} ${config.type}` };
  if (!before) return { action: `${config.created || "Created"} ${config.type}` };
  if (config.type === "event" && before.status !== after.status) {
    return { action: `${eventVerb(before.status, after.status)} event`, details: { from: before.status, to: after.status } };
  }
  return { action: `Updated ${config.type}`, details: { changes: diff(before, after) } };
}

// One entry per action and outcome: deleting an event also deletes its registrations in the
// same request, and that reads better as "23 registrations" than as 23 separate lines.
async function auditBatch(req, results) {
  const config = AUDITED[req.params.resource];
  if (!config) return;
  const groups = new Map();
  for (const item of results) {
    const status = item.error ? item.error.status || 400 : 200;
    if (!isAdmin(req.user) && !(config.watch && status === 403)) continue;
    const { action, details } = describeWrite(config, item);
    if (!item.error && details?.changes && !Object.keys(details.changes).length) continue; // nothing changed
    const outcome = status === 403 ? "denied" : item.error ? "failed" : "success";
    const key = `${action}|${outcome}`;
    if (!groups.has(key)) groups.set(key, { action, outcome, items: [] });
    groups.get(key).items.push({ ...item, details });
  }
  for (const { action, outcome, items } of groups.values()) {
    const [first] = items;
    const reason = first.message && { reason: first.message };
    await audit(req, items.length === 1
      ? {
        action, outcome, targetType: config.type, targetId: first.id,
        target: config.name(first.after || first.before || {}) || first.id,
        details: { ...first.details, ...reason },
      }
      : {
        action, outcome, targetType: config.type, target: `${items.length} ${config.type}s`,
        details: { count: items.length, ids: items.slice(0, 20).map((item) => item.id), ...reason },
      });
  }
}

// Fields the client may not set directly.
const SERVER_FIELDS = ["_id", "id", "__v", "createdAt", "updatedAt", "registeredCount", "feedbackCount", "feedbackAverage", "scope"];

function clean(raw) {
  const record = { ...raw };
  SERVER_FIELDS.forEach((key) => delete record[key]);
  return record;
}

function getResource(req) {
  const resource = Object.hasOwn(RESOURCES, req.params.resource) ? RESOURCES[req.params.resource] : null;
  if (!resource) throw new HttpError(404, "Unknown data collection.");
  return resource;
}

const list = async (req, res) => {
  const resource = getResource(req);
  if (resource === events) await completeEndedEvents();
  const filter = await resource.read(req.user);
  if (!filter) return res.json({ items: [] });
  if (resource.scope) filter.scope = resource.scope;
  const docs = await resource.model.find(filter).sort({ createdAt: -1 });
  let items = docs.map((doc) => doc.toJSON());
  if (resource.decorate) items = await resource.decorate(items);
  res.json({ items });
};

function describe(err) {
  if (err.expose) return err.message;
  if (err.name === "ValidationError" || err.name === "CastError") return err.message;
  if (err.code === 11000) return err.keyPattern?.seat ? "That seat was just taken. Pick another seat." : "This record already exists.";
  console.error(err);
  return "Could not save this record.";
}

const batch = async (req, res) => {
  const resource = getResource(req);
  const { model, scope } = resource;
  const save = Array.isArray(req.body?.save) ? req.body.save : [];
  const remove = Array.isArray(req.body?.remove) ? req.body.remove : [];
  const errors = [];
  const removedIds = [];
  const results = []; // what happened to each record, for the audit trail

  for (const raw of save) {
    const id = String(raw?.id || "");
    let before = null;
    let record = raw;
    try {
      if (!id) throw new HttpError(400, "Record is missing an id.");
      const existing = await model.findById(id);
      before = existing ? existing.toJSON() : null;
      if (existing && scope && existing.scope !== scope) deny();
      record = clean(raw);
      await resource.save(req.user, record, before);
      if (scope) record.scope = scope;
      if (existing) {
        existing.overwrite({ ...record, _id: id, createdAt: existing.createdAt });
        await existing.save();
      } else {
        const created = await model.create({ ...record, _id: id });
        if (resource.afterCreate) await resource.afterCreate(req.user, created);
      }
      results.push({ op: "save", id, before, after: record });
    } catch (err) {
      const message = describe(err);
      errors.push({ id, message });
      results.push({ op: "save", id, before, after: record, error: err, message });
    }
  }

  for (const rawId of remove) {
    const id = String(rawId);
    let before = null;
    try {
      const existing = await model.findById(id);
      if (!existing) continue; // already gone
      before = existing.toJSON();
      if (scope && existing.scope !== scope) deny();
      await resource.remove(req.user, before);
      await existing.deleteOne();
      removedIds.push(id);
      results.push({ op: "remove", id, before });
    } catch (err) {
      const message = describe(err);
      errors.push({ id, message });
      results.push({ op: "remove", id, before, error: err, message });
    }
  }

  if (removedIds.length && resource.afterRemove) await resource.afterRemove(removedIds);
  if (resource.afterSave) {
    // The records are already saved, so a failure here is logged instead of reported as a failed save.
    await resource.afterSave(results.filter((item) => item.op === "save" && !item.error))
      .catch((err) => console.error(`After saving ${req.params.resource}:`, err));
  }
  await auditBatch(req, results);

  if (errors.length) return res.status(400).json({ message: errors[0].message, errors });
  res.json({ ok: true });
};

// GET /api/events/:id/feedback: the feedback of a completed event, for anyone to read, so
// attendees can judge an organizer by its past events. Names never leave the server.
const publicFeedback = async (req, res) => {
  const event = await Event.findById(String(req.params.id)).lean();
  if (event?.status !== "Completed") return res.json({ items: [] });
  const items = (await Feedback.find({ eventId: event._id }).sort({ createdAt: -1 }).lean()).map((row) => ({
    rating: row.rating, organizationRating: row.organizationRating, speakerRating: row.speakerRating,
    venueRating: row.venueRating, comment: row.comment || "", date: row.date || "",
  }));
  res.json({ items });
};

// GET /api/venues/bookings?venue=&date=&exclude=: what a venue already holds that day, so the
// event forms can show the taken times and the venue's size before saving (checkVenue enforces both).
const bookings = async (req, res) => {
  const name = String(req.query.venue || "");
  const date = String(req.query.date || "");
  const venue = await Venue.findOne({ name });
  const booked = date ? await venueBookings(name, date, String(req.query.exclude || "")) : [];
  res.json({
    capacity: venue?.capacity || null,
    bookings: booked.map((event) => ({ id: event._id, title: event.title, startTime: event.startTime, endTime: event.endTime })),
  });
};

module.exports = { list, batch, publicFeedback, bookings };
