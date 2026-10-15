// Every app record except users lives in one of these collections.
// MongoDB creates each collection automatically the first time a record is saved.
//
// The React app generates record ids (e.g. "reg-1739...") and stores them as _id.
// `scope` is always "manager" for events and their records, whoever made the event (admins once
// saved theirs differently as "admin"). Notifications use it to say who they are for.
// `strict: false` keeps any extra display fields the UI adds.
const mongoose = require("mongoose");

const { Mixed } = mongoose.Schema.Types;

const toJSON = {
  transform(doc, ret) {
    ret.id = ret._id; // the React app expects `id`, not `_id`
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

function model(name, fields, extra = {}, indexes = []) {
  const schema = new mongoose.Schema(
    { _id: { type: String, required: true }, ...fields },
    { strict: false, id: false, timestamps: true, minimize: false, toJSON, ...extra }
  );
  indexes.forEach(([keys, options]) => schema.index(keys, options));
  return mongoose.model(name, schema);
}

const scope = (values) => ({ type: String, enum: values, required: true, index: true });

const Event = model("Event", {
  scope: scope(["manager"]),
  managerId: { type: String, default: null, index: true }, // owner: the manager, or the admin who made it
  title: { type: String, required: true },
  description: String,
  category: String,
  organizer: String,
  status: String, // "Pending" | "Registration Open" | "Completed" | ... (utils/eventStatus.js)
  date: String, // "YYYY-MM-DD"
  startTime: String,
  endTime: String,
  venue: String, // a venue name from the admin's list
  venueId: String, // set when an admin picked the venue
  capacity: Number,
  seating: String, // "free" (first come, first served) | "reserved" (attendees pick a seat)
});

const Registration = model("Registration", {
  scope: scope(["manager"]),
  userId: { type: String, index: true },
  eventId: { type: String, required: true, index: true },
  eventTitle: String,
  name: String,
  email: String,
  studentId: String,
  status: String, // "Confirmed" | "Pending" | "Cancelled"
  attendanceStatus: String, // "Not Checked In" | "Checked in" | "Attended" (Attended = exit verified)
  checkedInAt: String,
  checkedInBy: String,
  // Set by the server only, when the attendee leaves (controllers/ticketController.js).
  exitedAt: String, // shown time, e.g. "4:52 PM"
  exitVerifiedAt: Date,
  exitMethod: String, // "scan" (the exit QR) | "manual" (marked by the event's manager)
  exitedBy: String, // the manager's name, for a manual exit
  registrationDate: String,
  ticketCode: String,
  // Secret behind the ticket's QR code. Issued by the server (GET /api/tickets/:id), never by a client.
  ticketToken: { type: String, unique: true, sparse: true },
  ticketType: String,
  seating: String, // "free" | "reserved", copied from the event when the ticket is issued
  seat: String, // reserved seating only, e.g. "C7"; free seating keeps no seat number
  feedback: Mixed,
}, {}, [
  // One confirmed ticket per reserved seat, so two people picking a seat at the same moment cannot both get it.
  [{ eventId: 1, seat: 1 }, { unique: true, partialFilterExpression: { status: "Confirmed", seating: "reserved" } }],
]);

const Certificate = model("Certificate", {
  userId: { type: String, index: true },
  eventId: { type: String, required: true, index: true },
  eventTitle: String,
  recipientName: String,
  credentialId: String,
  issueDate: String,
  status: String, // "Issued" | "Eligible"
}, {}, [
  // One certificate per attendee per event (admins can still add hand-made ones without a userId).
  [{ eventId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "string" } } }],
  // The public check page looks a certificate up by this ID, so two certificates may never share one.
  [{ credentialId: 1 }, { unique: true, partialFilterExpression: { credentialId: { $type: "string" } } }],
]);

const Notification = model("Notification", {
  scope: scope(["attendee", "manager"]), // attendee: shown to one user; manager: shown to the event's manager
  userId: { type: String, index: true },
  eventId: { type: String, index: true },
  type: String,
  title: String,
  message: String,
  read: { type: Boolean, default: false },
});

// The exit QR an event's staff screen shows while exit verification runs. One row per event
// (_id is the event's id), kept apart from the event so a manager saving the event can't erase
// the code mid-scan. Each code works once and only until expiresAt.
const ExitPass = model("ExitPass", {
  active: { type: Boolean, default: false },
  token: { type: String, default: null },
  expiresAt: { type: Date, default: null },
  startedBy: String,
});

const Session = model("Session", {
  scope: scope(["manager"]),
  eventId: { type: String, index: true },
  title: String,
  speaker: String,
  room: String,
  startTime: String,
  endTime: String,
  time: String,
});

const Announcement = model("Announcement", {
  scope: scope(["manager"]),
  eventId: { type: String, index: true },
  title: String,
  message: String,
  status: String, // "Draft" | "Published"
  publishedAt: String,
  date: String,
});

const Feedback = model("Feedback", {
  scope: scope(["manager"]),
  eventId: { type: String, index: true },
  userId: String, // the attendee who sent it (entries from before this was kept have none)
  participant: String,
  rating: Number,
  comment: String,
  date: String,
}, { collection: "feedback" }, [
  // One entry per attendee per event, even when two sends arrive at the same moment.
  [{ eventId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "string" } } }],
]);

const Venue = model("Venue", {
  name: { type: String, required: true },
  location: String,
  capacity: Number,
});

// Written only by the server (utils/audit.js). The actor comes from the signed-in user,
// and the time is createdAt. `time` is kept for entries the old admin screen wrote itself.
const AuditLog = model("AuditLog", {
  action: String, // "Changed user role", "Approved event", ...
  admin: String, // actor's name at the time
  actorId: { type: String, index: true },
  actorRole: String,
  actorEmail: String,
  targetType: String, // "user" | "event" | "venue" | "certificate" | "settings" | ...
  targetId: String,
  record: String, // readable name of the target
  outcome: String, // "success" | "failed" | "denied" (old entries have none: success)
  details: Mixed, // e.g. { from, to } or { changes } or { reason }
  time: String,
}, {}, [[{ createdAt: -1 }]]);

// A single document with _id "global" holds the admin Settings page values.
const Settings = model("Settings", {}, { collection: "settings" });

module.exports = { Event, Registration, Certificate, Notification, ExitPass, Session, Announcement, Feedback, Venue, AuditLog, Settings };
