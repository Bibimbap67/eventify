// Read-only data for the admin screens: dashboard numbers, oversight lists, reports, the
// audit log and the data export. Counting, filtering and paging happen in MongoDB, so the
// admin screens never download a whole collection just to show a total or one page.
//
//   GET /api/admin/overview          -> users, registrations and certificate totals, recent activity
//   GET /api/admin/registrations     -> one page of registrations (filters below) + totals
//   GET /api/admin/reports/events    -> per-event registrations, check-ins and feedback
//   GET /api/admin/events/:id        -> one event's sessions, announcements and totals
//   GET /api/admin/audit-logs        -> one page of the audit trail (filters below)
//   GET /api/admin/export            -> every collection as JSON (recorded in the audit trail)
const User = require("../models/User");
const {
  Event, Registration, Certificate, Session, Announcement, Feedback, Venue, AuditLog, Settings,
} = require("../models/records");
const { audit } = require("../utils/audit");

const DAY = 86400000;
const CHECKED_IN = /^(checked in|attended)$/i;
const IS_CHECKED_IN = {
  $regexMatch: { input: { $ifNull: ["$attendanceStatus", ""] }, regex: "^(checked in|attended)$", options: "i" },
};
const count = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
const REGISTRATION_TOTALS = {
  total: { $sum: 1 },
  confirmed: count({ $eq: ["$status", "Confirmed"] }),
  pending: count({ $eq: ["$status", "Pending"] }),
  cancelled: count({ $eq: ["$status", "Cancelled"] }),
  checkedIn: count({ $and: [{ $eq: ["$status", "Confirmed"] }, IS_CHECKED_IN] }),
};
const EMPTY_TOTALS = { total: 0, confirmed: 0, pending: 0, cancelled: 0, checkedIn: 0 };

const text = (value, max = 100) => String(value ?? "").trim().slice(0, max);
const search = (q) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const day = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null);
const instant = (value) => {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};
const toJSON = (doc) => doc.toJSON();
const sorted = (values) => values.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));

function paging(query, fallback = 25) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || fallback));
  return { page, limit, skip: (page - 1) * limit };
}

// [{ _id: null, ...totals }] -> totals
const totalsOf = (rows) => {
  const { _id, ...totals } = rows[0] || {};
  return { ...EMPTY_TOTALS, ...totals };
};

const overview = async (req, res) => {
  const monthAgo = new Date(Date.now() - 30 * DAY);
  const [userRows, newUsers, registrationRows, newRegistrations, certificates, venues, recent] = await Promise.all([
    User.aggregate([{ $group: { _id: { role: "$role", status: "$status" }, count: { $sum: 1 } } }]),
    User.countDocuments({ createdAt: { $gte: monthAgo } }),
    Registration.aggregate([{ $group: { _id: null, ...REGISTRATION_TOTALS } }]),
    Registration.countDocuments({ createdAt: { $gte: monthAgo } }),
    Certificate.countDocuments(),
    Venue.countDocuments(),
    AuditLog.find().sort({ createdAt: -1, _id: -1 }).limit(6),
  ]);
  const users = { total: 0, active: 0, inactive: 0, roles: { admin: 0, manager: 0, staff: 0, user: 0 }, new30d: newUsers };
  userRows.forEach(({ _id, count: n }) => {
    users.total += n;
    users[_id.status === "inactive" ? "inactive" : "active"] += n;
    users.roles[_id.role] = (users.roles[_id.role] || 0) + n;
  });
  res.json({
    users,
    registrations: { ...totalsOf(registrationRows), new30d: newRegistrations },
    certificates,
    venues,
    recentActivity: recent.map(toJSON),
  });
};

const REGISTRATION_FIELDS = "scope userId eventId eventTitle name email studentId status attendanceStatus checkedInAt checkedInBy registrationDate ticketCode ticketType seating seat createdAt";
const REGISTRATION_SORTS = {
  "-registrationDate": { registrationDate: -1, _id: -1 },
  registrationDate: { registrationDate: 1, _id: 1 },
  name: { name: 1, _id: 1 },
  "-name": { name: -1, _id: 1 },
};

// ?eventId &status=Confirmed|Pending|Cancelled &attendance=checked-in|not-checked-in
// &q (name, email, ticket code, student ID) &from &to (registration date, YYYY-MM-DD) &sort &page &limit
const registrations = async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = {};
  if (req.query.eventId) filter.eventId = text(req.query.eventId, 120);
  if (["Confirmed", "Pending", "Cancelled"].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.attendance === "checked-in") filter.attendanceStatus = CHECKED_IN;
  else if (req.query.attendance === "not-checked-in") filter.attendanceStatus = { $not: CHECKED_IN };
  const q = text(req.query.q);
  if (q) filter.$or = ["name", "email", "ticketCode", "studentId"].map((key) => ({ [key]: search(q) }));
  const from = day(req.query.from);
  const to = day(req.query.to);
  if (from || to) filter.registrationDate = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const [items, summaryRows] = await Promise.all([
    // The QR secret (ticketToken) is never selected.
    Registration.find(filter).select(REGISTRATION_FIELDS)
      .sort(REGISTRATION_SORTS[req.query.sort] || REGISTRATION_SORTS["-registrationDate"]).skip(skip).limit(limit),
    Registration.aggregate([{ $match: filter }, { $group: { _id: null, ...REGISTRATION_TOTALS } }]),
  ]);
  const events = await Event.find({ _id: { $in: [...new Set(items.map((item) => item.eventId))] } }).select("title");
  const titles = new Map(events.map((event) => [event._id, event.title]));
  const summary = totalsOf(summaryRows);
  res.json({
    items: items.map((doc) => ({ ...doc.toJSON(), eventTitle: titles.get(doc.eventId) || doc.eventTitle || "Deleted event" })),
    total: summary.total,
    page,
    limit,
    summary,
  });
};

const eventReport = async (req, res) => {
  const [events, registrationRows, feedbackRows, venues] = await Promise.all([
    Event.find().sort({ createdAt: -1 }),
    Registration.aggregate([{ $group: { _id: "$eventId", ...REGISTRATION_TOTALS } }]),
    Feedback.aggregate([{ $group: { _id: "$eventId", responses: { $sum: 1 }, rating: { $avg: "$rating" } } }]),
    Venue.find().select("name"),
  ]);
  // Manager events point at their owner by managerId (seeded accounts) or by user id.
  const keys = [...new Set(events.map((event) => event.managerId).filter(Boolean))];
  const managers = await User.find({
    $or: [{ managerId: { $in: keys } }, { _id: { $in: keys.filter((key) => /^[a-f0-9]{24}$/i.test(key)) } }],
  }).select("name managerId");
  const managerNames = new Map(managers.map((user) => [user.managerId || user.id, user.name]));
  const venueNames = new Map(venues.map((venue) => [venue._id, venue.name]));
  const byEvent = new Map(registrationRows.map((row) => [row._id, row]));
  const feedbackByEvent = new Map(feedbackRows.map((row) => [row._id, row]));

  res.json({
    events: events.map((doc) => {
      const event = doc.toJSON();
      const totals = byEvent.get(event.id) || EMPTY_TOTALS;
      const feedback = feedbackByEvent.get(event.id);
      return {
        id: event.id,
        scope: event.scope,
        title: event.title,
        status: event.status,
        organizer: event.organizer || "",
        date: (event.scope === "admin" ? event.adminDate : event.date) || "",
        venue: event.venue || venueNames.get(event.venueId) || "",
        capacity: event.capacity || 0,
        manager: managerNames.get(event.managerId) || null,
        confirmed: totals.confirmed,
        cancelled: totals.cancelled,
        checkedIn: totals.checkedIn,
        responses: feedback?.responses || 0,
        rating: feedback?.rating == null ? null : Math.round(feedback.rating * 10) / 10,
      };
    }),
  });
};

const eventDetails = async (req, res) => {
  const eventId = text(req.params.id, 120);
  if (!(await Event.exists({ _id: eventId }))) return res.status(404).json({ message: "Event not found." });
  const [sessions, announcements, feedbackRows, registrationRows] = await Promise.all([
    Session.find({ eventId }).sort({ startTime: 1, createdAt: 1 }),
    Announcement.find({ eventId }).sort({ createdAt: -1 }),
    Feedback.aggregate([{ $match: { eventId } }, { $group: { _id: null, responses: { $sum: 1 }, rating: { $avg: "$rating" } } }]),
    Registration.aggregate([{ $match: { eventId } }, { $group: { _id: null, ...REGISTRATION_TOTALS } }]),
  ]);
  const feedback = feedbackRows[0];
  res.json({
    sessions: sessions.map(toJSON),
    announcements: announcements.map(toJSON),
    feedback: { responses: feedback?.responses || 0, rating: feedback?.rating == null ? null : Math.round(feedback.rating * 10) / 10 },
    registrations: totalsOf(registrationRows),
  });
};

// ?q &action &actor &targetType &outcome=success|failed|denied &from &to (ISO times) &page &limit
const auditLogs = async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = {};
  const q = text(req.query.q);
  if (q) filter.$or = [{ action: search(q) }, { record: search(q) }, { admin: search(q) }, { targetId: q }];
  if (req.query.action) filter.action = text(req.query.action, 120);
  if (req.query.actor) filter.admin = text(req.query.actor, 120);
  if (req.query.targetType) filter.targetType = text(req.query.targetType, 40);
  // Entries written before outcomes existed only recorded actions that were carried out.
  if (req.query.outcome === "success") filter.outcome = { $in: ["success", null] };
  else if (["failed", "denied"].includes(req.query.outcome)) filter.outcome = req.query.outcome;
  const from = instant(req.query.from);
  const to = instant(req.query.to);
  if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const [items, total, actions, actors, targetTypes] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
    AuditLog.distinct("action"),
    AuditLog.distinct("admin"),
    AuditLog.distinct("targetType"),
  ]);
  res.json({
    items: items.map(toJSON),
    total,
    page,
    limit,
    options: { actions: sorted(actions), actors: sorted(actors), targetTypes: sorted(targetTypes) },
  });
};

const exportData = async (req, res) => {
  const [users, events, registrationList, certificates, sessions, announcements, feedback, venues, settings, auditLogList] = await Promise.all([
    User.find(),
    Event.find(),
    Registration.find().select("-ticketToken"), // QR secrets never leave the server
    Certificate.find(),
    Session.find(),
    Announcement.find(),
    Feedback.find(),
    Venue.find(),
    Settings.findById("global"),
    AuditLog.find().sort({ createdAt: -1 }),
  ]);
  const data = {
    users, events, registrations: registrationList, certificates, sessions, announcements, feedback, venues, auditLogs: auditLogList,
  };
  const counts = Object.fromEntries(Object.entries(data).map(([key, list]) => [key, list.length]));
  await audit(req, { action: "Exported platform data", targetType: "system", target: "All collections", details: { counts } });
  res.json({
    exportedAt: new Date().toISOString(),
    exportedBy: { id: req.user.id, name: req.user.name, email: req.user.email },
    counts,
    settings: settings ? settings.toJSON() : null,
    ...data,
  });
};

module.exports = { overview, registrations, eventReport, eventDetails, auditLogs, exportData };
