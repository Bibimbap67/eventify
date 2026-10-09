// Every app record except users lives in one of these collections.
// MongoDB creates each collection automatically the first time a record is saved.
//
// The React app generates record ids (e.g. "reg-1739...") and stores them as _id.
// `scope` separates records that the admin screens and the manager screens keep
// apart: "admin" = created from the Admin area, "manager" = created by an Event
// Manager. `strict: false` keeps any extra display fields the UI adds.
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
  scope: scope(["admin", "manager"]),
  managerId: { type: String, default: null, index: true }, // owner, for manager events
  title: { type: String, required: true },
  description: String,
  category: String,
  organizer: String,
  status: String, // admin: "PENDING" | "OPENS SOON" | "REGISTRATION OPEN" | ...; manager: "Pending" | "Registration Open" | ...
  date: String, // manager: "YYYY-MM-DD"; admin: display date, with the raw value in adminDate
  startTime: String,
  endTime: String,
  venue: String, // manager events
  venueId: String, // admin events
  capacity: Number,
  seating: String, // "free" (first come, first served) | "reserved" (attendees pick a seat)
});

const Registration = model("Registration", {
  scope: scope(["admin", "manager"]),
  userId: { type: String, index: true },
  eventId: { type: String, required: true, index: true },
  eventTitle: String,
  name: String,
  email: String,
  studentId: String,
  status: String, // "Confirmed" | "Pending" | "Cancelled"
  attendanceStatus: String, // "Not Checked In" | "Checked in" | "Attended"
  checkedInAt: String,
  checkedInBy: String,
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

const Session = model("Session", {
  scope: scope(["admin", "manager"]),
  eventId: { type: String, index: true },
  title: String,
  speaker: String,
  room: String,
  startTime: String,
  endTime: String,
  time: String,
});

const Announcement = model("Announcement", {
  scope: scope(["admin", "manager"]),
  eventId: { type: String, index: true },
  title: String,
  message: String,
  status: String, // "Draft" | "Published"
  publishedAt: String,
  date: String,
});

const Feedback = model("Feedback", {
  scope: scope(["admin", "manager"]),
  eventId: { type: String, index: true },
  participant: String,
  rating: Number,
  comment: String,
  date: String,
}, { collection: "feedback" });

const Venue = model("Venue", {
  name: { type: String, required: true },
  location: String,
  capacity: Number,
});

const AuditLog = model("AuditLog", {
  action: String,
  admin: String,
  record: String,
  time: String,
});

// A single document with _id "global" holds the admin Settings page values.
const Settings = model("Settings", {}, { collection: "settings" });

module.exports = { Event, Registration, Certificate, Notification, Session, Announcement, Feedback, Venue, AuditLog, Settings };
