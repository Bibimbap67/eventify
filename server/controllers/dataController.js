// Generic read/write endpoints for the app's record collections.
//
//   GET  /api/data/:resource         -> { items: [...] } (only what the caller may see)
//   POST /api/data/:resource/batch   -> body { save: [records], remove: [ids] }
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

const PUBLIC_EVENT_STATUS = {
  admin: ["REGISTRATION OPEN", "OPENS SOON", "COMPLETED"],
  manager: ["Registration Open", "Published", "Approved", "Completed"],
};
const OPEN_EVENT_STATUS = {
  admin: ["REGISTRATION OPEN"],
  manager: ["Registration Open", "Published"],
};
const COMPLETED_EVENT_STATUS = {
  admin: ["COMPLETED", "Completed"],
  manager: ["Completed"],
};
// Status changes a manager may make on their own event without an admin.
const MANAGER_STATUS_CHANGES = ["Completed", "Cancelled"];

const isAdmin = (user) => user?.role === "admin";
const isManager = (user) => user?.role === "manager";
const managerKey = (user) => user.managerId || user.id;

async function ownedEventIds(user) {
  if (!isManager(user)) return [];
  return Event.find({ scope: "manager", managerId: managerKey(user) }).distinct("_id");
}

async function ownsEvent(user, eventId) {
  if (!isManager(user) || !eventId) return false;
  return Boolean(await Event.exists({ _id: eventId, scope: "manager", managerId: managerKey(user) }));
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

// Free seating clears the seat number. Reserved seating checks the seat is on the map and
// free. An attendee's own pick must be exact (`strict`); rows saved by staff without a
// seat, or whose old seat was taken while they were cancelled, get the first open seat.
async function placeSeat(record, existing, scope, { strict = false } = {}) {
  const event = await Event.findOne({ _id: record.eventId || existing?.eventId, scope });
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

function events(scope) {
  return {
    model: Event,
    scope,
    async read(user) {
      if (isAdmin(user)) return {};
      const visible = { status: { $in: PUBLIC_EVENT_STATUS[scope] } };
      if (scope === "manager" && isManager(user)) return { $or: [visible, { managerId: managerKey(user) }] };
      return visible;
    },
    async save(user, record, existing) {
      await checkSeating(record, existing);
      if (isAdmin(user)) return;
      if (scope !== "manager" || !isManager(user)) deny();
      if (existing && existing.managerId !== managerKey(user)) deny();
      record.managerId = managerKey(user);
      if (!existing) {
        record.status = "Pending"; // new events wait for admin approval
      } else if (record.status !== existing.status && !MANAGER_STATUS_CHANGES.includes(record.status)) {
        deny("Only an administrator can approve or publish an event.");
      }
    },
    async remove(user, existing) {
      if (isAdmin(user)) return;
      if (scope !== "manager" || existing.managerId !== managerKey(user)) deny();
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
    // Attendees only see their own registrations, so the server supplies the counts.
    async decorate(items) {
      const counts = await Registration.aggregate([
        { $match: { scope, status: "Confirmed", eventId: { $in: items.map((item) => item.id) } } },
        { $group: { _id: "$eventId", count: { $sum: 1 } } },
      ]);
      const byId = new Map(counts.map((row) => [row._id, row.count]));
      return items.map((item) => ({ ...item, registeredCount: byId.get(item.id) || 0 }));
    },
  };
}

function registrations(scope) {
  return {
    model: Registration,
    scope,
    async read(user) {
      if (!user) return null;
      if (isAdmin(user)) return {};
      if (isManager(user)) return scope === "manager" ? { eventId: { $in: await ownedEventIds(user) } } : null;
      return { userId: user.id };
    },
    async save(user, record, existing) {
      // The QR secret only ever comes from the server, and a stale client copy must not erase it.
      delete record.ticketToken;
      if (existing?.ticketToken) record.ticketToken = existing.ticketToken;
      if (isAdmin(user)) return placeSeat(record, existing, scope);
      if (isManager(user)) {
        if (scope !== "manager") deny();
        if (!(await ownsEvent(user, record.eventId))) deny();
        if (existing && !(await ownsEvent(user, existing.eventId))) deny();
        return placeSeat(record, existing, scope);
      }
      // Attendee: only their own registration, and the event cannot be swapped.
      if (existing) {
        if (existing.userId !== user.id) deny();
        record.userId = user.id;
        record.eventId = existing.eventId;
        // Check-in happens only when staff scan the ticket. The one change an attendee may make
        // is marking a checked-in ticket "Attended" after the event is completed.
        const checkedIn = String(existing.attendanceStatus || "").toLowerCase() === "checked in";
        const finishing = checkedIn && record.attendanceStatus === "Attended" &&
          await Event.exists({ _id: existing.eventId, status: { $in: COMPLETED_EVENT_STATUS[scope] } });
        if (!finishing) record.attendanceStatus = existing.attendanceStatus;
        record.checkedInAt = existing.checkedInAt;
        record.checkedInBy = existing.checkedInBy;
        // An attendee can cancel, but not revive a cancelled ticket or move to another seat.
        if (!(existing.status === "Confirmed" && record.status === "Cancelled")) record.status = existing.status;
        record.seat = existing.seat;
        record.seating = existing.seating;
        return;
      }
      record.userId = user.id;
      record.attendanceStatus = "Not Checked In";
      record.checkedInAt = null;
      delete record.checkedInBy;
      const event = await Event.findOne({ _id: record.eventId, scope });
      if (!event) throw new HttpError(404, "Event not found.");
      if (!OPEN_EVENT_STATUS[scope].includes(event.status)) deny("Registration is not open for this event.");
      const query = { scope, eventId: event._id, status: "Confirmed" };
      if (await Registration.exists({ ...query, userId: user.id })) deny("You are already registered for this event.");
      if (event.capacity && (await Registration.countDocuments(query)) >= event.capacity) {
        deny("Sorry, this event has reached maximum capacity.");
      }
      record.status = "Confirmed";
      await placeSeat(record, null, scope, { strict: true });
    },
    async remove(user, existing) {
      if (isAdmin(user)) return;
      if (scope === "manager" && (await ownsEvent(user, existing.eventId))) return;
      deny();
    },
  };
}

const RESOURCES = {
  // Admin-created events and their registrations (EventContext).
  events: events("admin"),
  registrations: registrations("admin"),

  certificates: {
    model: Certificate,
    read: (user) => (isAdmin(user) ? {} : user ? { userId: user.id } : null),
    async save(user, record, existing) {
      if (isAdmin(user)) return;
      if (!user || isManager(user) || existing) deny();
      record.userId = user.id;
      // Attendees can only claim a certificate they earned.
      const attended = await Registration.findOne({
        userId: user.id, eventId: record.eventId, status: "Confirmed", attendanceStatus: "Attended",
      });
      const completed = attended && await Event.exists({
        _id: record.eventId, status: { $in: COMPLETED_EVENT_STATUS[attended.scope] },
      });
      if (!completed) deny("You are not eligible for this certificate yet.");
    },
    remove: adminOnly.remove,
  },

  notifications: {
    model: Notification,
    scope: "attendee",
    read: (user) => (isAdmin(user) ? {} : user ? { userId: user.id } : null),
    save(user, record, existing) {
      if (isAdmin(user)) return;
      if (!user || (existing && existing.userId !== user.id)) deny();
      record.userId = user.id;
    },
    remove(user, existing) {
      if (!isAdmin(user) && existing.userId !== user?.id) deny();
    },
  },

  // Event Manager workspace (ManagerContext).
  "manager-events": events("manager"),
  "manager-registrations": registrations("manager"),
  "manager-sessions": { model: Session, scope: "manager", ...managerEventChild({ publicRead: true }) },
  "manager-announcements": { model: Announcement, scope: "manager", ...managerEventChild() },
  "manager-feedback": {
    model: Feedback,
    scope: "manager",
    ...managerEventChild(),
    async save(user, record, existing) {
      if (isAdmin(user) || (await ownsEvent(user, record.eventId))) return;
      // Attendees may leave one new feedback entry for an event they registered for.
      if (!user || existing) deny();
      if (!(await Registration.exists({ scope: "manager", userId: user.id, eventId: record.eventId }))) deny();
    },
  },
  "manager-notifications": {
    model: Notification,
    scope: "manager",
    ...managerEventChild(),
    async save(user, record, existing) {
      if (isAdmin(user) || (await ownsEvent(user, record.eventId))) return;
      // Attendee actions (registering, leaving feedback) notify the event's manager.
      if (!user || existing) deny();
      if (!(await Event.exists({ _id: record.eventId, scope: "manager" }))) deny();
    },
  },

  // Admin-only lists (AdminContext). Venues are readable by everyone.
  // The audit log is not here on purpose: only the server writes it (utils/audit.js), and
  // admins read it through GET /api/admin/audit-logs, so nobody can edit or delete entries.
  venues: { model: Venue, ...publicReadAdminWrite },
  sessions: { model: Session, scope: "admin", ...adminOnly },
  announcements: { model: Announcement, scope: "admin", ...adminOnly },
  feedback: { model: Feedback, scope: "admin", ...adminOnly },
};

// ---- audit trail ---------------------------------------------------------------
// Every change an admin makes through /batch is recorded with its outcome. Other users are
// recorded only when they are refused on records that only an admin may change (`watch`),
// such as approving their own event; their everyday writes are not admin activity.
const AUDITED = {
  events: { type: "event", name: (r) => r.title, watch: true },
  "manager-events": { type: "event", name: (r) => r.title, watch: true },
  venues: { type: "venue", name: (r) => r.name, watch: true },
  sessions: { type: "session", name: (r) => r.title, watch: true },
  announcements: { type: "announcement", name: (r) => r.title, watch: true },
  feedback: { type: "feedback", name: (r) => r.participant, watch: true },
  "manager-sessions": { type: "session", name: (r) => r.title },
  "manager-announcements": { type: "announcement", name: (r) => r.title },
  "manager-feedback": { type: "feedback", name: (r) => r.participant },
  registrations: { type: "registration", name: (r) => r.name && `${r.name} · ${r.eventTitle || r.eventId}` },
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
const SERVER_FIELDS = ["_id", "id", "__v", "createdAt", "updatedAt", "registeredCount", "scope"];

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
        await model.create({ ...record, _id: id });
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
  await auditBatch(req, results);

  if (errors.length) return res.status(400).json({ message: errors[0].message, errors });
  res.json({ ok: true });
};

// Express 5 forwards rejected promises to the error handler; HttpErrors keep their status.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
  if (err.expose) return res.status(err.status).json({ message: err.message });
  next(err);
});

module.exports = { list: wrap(list), batch: wrap(batch) };
