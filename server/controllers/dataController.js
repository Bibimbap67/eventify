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
  Event, Registration, Certificate, Notification, Session, Announcement, Feedback, Venue, AuditLog,
} = require("../models/records");

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
      if (isAdmin(user)) return;
      if (isManager(user)) {
        if (scope !== "manager") deny();
        if (!(await ownsEvent(user, record.eventId))) deny();
        if (existing && !(await ownsEvent(user, existing.eventId))) deny();
        return;
      }
      // Attendee: only their own registration, and the event cannot be swapped.
      if (existing) {
        if (existing.userId !== user.id) deny();
        record.userId = user.id;
        record.eventId = existing.eventId;
        return;
      }
      record.userId = user.id;
      const event = await Event.findOne({ _id: record.eventId, scope });
      if (!event) throw new HttpError(404, "Event not found.");
      if (!OPEN_EVENT_STATUS[scope].includes(event.status)) deny("Registration is not open for this event.");
      const query = { scope, eventId: event._id, status: "Confirmed" };
      if (await Registration.exists({ ...query, userId: user.id })) deny("You are already registered for this event.");
      if (event.capacity && (await Registration.countDocuments(query)) >= event.capacity) {
        deny("Sorry, this event has reached maximum capacity.");
      }
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
  venues: { model: Venue, ...publicReadAdminWrite },
  sessions: { model: Session, scope: "admin", ...adminOnly },
  announcements: { model: Announcement, scope: "admin", ...adminOnly },
  feedback: { model: Feedback, scope: "admin", ...adminOnly },
  "audit-logs": { model: AuditLog, ...adminOnly },
};

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
  if (err.code === 11000) return "This record already exists.";
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

  for (const raw of save) {
    const id = String(raw?.id || "");
    try {
      if (!id) throw new HttpError(400, "Record is missing an id.");
      const existing = await model.findById(id);
      if (existing && scope && existing.scope !== scope) deny();
      const record = clean(raw);
      await resource.save(req.user, record, existing ? existing.toJSON() : null);
      if (scope) record.scope = scope;
      if (existing) {
        existing.overwrite({ ...record, _id: id, createdAt: existing.createdAt });
        await existing.save();
      } else {
        await model.create({ ...record, _id: id });
      }
    } catch (err) {
      errors.push({ id, message: describe(err) });
    }
  }

  for (const rawId of remove) {
    const id = String(rawId);
    try {
      const existing = await model.findById(id);
      if (!existing) continue; // already gone
      if (scope && existing.scope !== scope) deny();
      await resource.remove(req.user, existing.toJSON());
      await existing.deleteOne();
      removedIds.push(id);
    } catch (err) {
      errors.push({ id, message: describe(err) });
    }
  }

  if (removedIds.length && resource.afterRemove) await resource.afterRemove(removedIds);

  if (errors.length) return res.status(400).json({ message: errors[0].message, errors });
  res.json({ ok: true });
};

// Express 5 forwards rejected promises to the error handler; HttpErrors keep their status.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
  if (err.expose) return res.status(err.status).json({ message: err.message });
  next(err);
});

module.exports = { list: wrap(list), batch: wrap(batch) };
