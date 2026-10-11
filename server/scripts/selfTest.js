// Self-test for ticket QR check-in, event seating and public feedback. Run from /server with the API running:
//   npm run selftest
// Creates throwaway users, events and registrations, checks every rule, then deletes them.
require("dotenv").config({ quiet: true });
const assert = require("assert/strict");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const { Event, Registration, Notification, AuditLog, Feedback, Announcement, Venue } = require("../models/records");

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;
const tag = `selftest-${Date.now().toString(36)}`;

async function call(path, user, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = `Bearer ${jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "5m" })}`;
  const res = await fetch(BASE + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const makeUser = (name, role) => User.create({ name, email: `${tag}-${name.toLowerCase().replace(/\W+/g, "-")}@example.com`, password: "selftest123", role });
const save = (resource, user, records) => call(`/data/${resource}/batch`, user, { method: "POST", body: { save: records } });

async function checkIn(student, staff) {
  const eventId = `${tag}-event`;
  const otherEventId = `${tag}-other`;
  const regId = `${tag}-reg`;
  await Event.create({ _id: eventId, scope: "admin", title: "Self Test Event", status: "REGISTRATION OPEN", capacity: 10 });
  await Event.create({ _id: otherEventId, scope: "admin", title: "Other Event", status: "REGISTRATION OPEN", capacity: 10 });
  const register = (fields) => save("registrations", student, [
    { id: regId, eventId, status: "Confirmed", name: "Self Test Student", ticketCode: "TKT-0000-2026", ...fields },
  ]);

  // Registering cannot smuggle in a check-in or a chosen QR token.
  let res = await register({ attendanceStatus: "Checked in", ticketToken: "f".repeat(32) });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  let reg = await Registration.findById(regId);
  assert.equal(reg.attendanceStatus, "Not Checked In");
  assert.equal(reg.ticketToken, undefined);

  // The pass gets one stable, server-issued QR that only its owner can read.
  res = await call(`/tickets/${regId}`, student);
  assert.match(res.data.qr, /^EVENTIFY-TICKET:[a-f0-9]{32}$/);
  const qr = res.data.qr;
  assert.equal((await call(`/tickets/${regId}`, student)).data.qr, qr);
  assert.equal((await call(`/tickets/${regId}`, staff)).status, 404);

  // A later attendee save cannot check in or erase the token.
  await register({ attendanceStatus: "Attended" });
  reg = await Registration.findById(regId);
  assert.equal(reg.attendanceStatus, "Not Checked In");
  assert.equal(`EVENTIFY-TICKET:${reg.ticketToken}`, qr);

  // Only staff may use the desk.
  assert.equal((await call("/staff/checkin", student, { method: "POST", body: { code: qr } })).status, 403);

  const scan = async (code, extra = {}) => (await call("/staff/checkin", staff, { method: "POST", body: { code, ...extra } })).data;
  assert.equal((await scan("TKT-0000-2026")).result, "invalid");
  assert.equal((await scan(`EVENTIFY-TICKET:${"0".repeat(32)}`)).result, "invalid");
  assert.equal((await scan(qr, { eventId: otherEventId })).result, "wrong-event");

  const admitted = await scan(qr, { eventId });
  assert.equal(admitted.result, "checked-in", admitted.message);
  assert.equal(admitted.attendee.name, "Self Test Student");
  assert.equal(admitted.attendee.seat, null, "free seating shows no seat at the desk");
  assert.equal((await scan(qr)).result, "duplicate");

  reg = await Registration.findById(regId);
  assert.equal(reg.attendanceStatus, "Checked in");
  assert.equal(reg.checkedInBy, "Self Test Staff");
  assert.ok(await Notification.exists({ userId: student.id, eventId, type: "attendance" }));
  const desk = (await call("/staff/events", staff)).data.events.find((event) => event.id === eventId);
  assert.equal(desk.checkedIn, 1);

  // A cancelled ticket is refused even with a valid QR.
  await Registration.updateOne({ _id: regId }, { status: "Cancelled", attendanceStatus: "Not Checked In" });
  assert.equal((await scan(qr)).result, "invalid");
  console.log("  check-in: ok");
}

async function seating(student, other, admin) {
  const reservedId = `${tag}-reserved`;
  const freeId = `${tag}-free`;
  // Capacity 12: row A holds A1–A10, row B only B1 and B2.
  await Event.create({ _id: reservedId, scope: "admin", title: "Reserved Test", status: "REGISTRATION OPEN", capacity: 12, seating: "reserved" });
  await Event.create({ _id: freeId, scope: "admin", title: "Free Test", status: "REGISTRATION OPEN", capacity: 12, seating: "free" });
  const ticket = (user, id, eventId, fields = {}) => save("registrations", user, [
    { id: `${tag}-${id}`, eventId, status: "Confirmed", name: user.name, ticketCode: "TKT-1111-2026", ...fields },
  ]);
  const seatsOf = async () => (await call(`/events/${reservedId}/seats`)).data;

  // A reserved ticket needs a real seat on the map.
  let res = await ticket(student, "a", reservedId);
  assert.equal(res.status, 400);
  assert.match(res.data.message, /pick a seat/i);
  res = await ticket(student, "a", reservedId, { seat: "C1" });
  assert.equal(res.status, 400);
  assert.match(res.data.message, /not on this event's seat map/);
  res = await ticket(student, "a", reservedId, { seat: "B2" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  let reg = await Registration.findById(`${tag}-a`);
  assert.deepEqual([reg.seating, reg.seat], ["reserved", "B2"]);

  // Nobody else can take it, and the map shows it taken.
  res = await ticket(other, "b", reservedId, { seat: "B2" });
  assert.equal(res.status, 400);
  assert.match(res.data.message, /Seat B2 was just taken/);
  assert.deepEqual(await seatsOf(), { seating: "reserved", capacity: 12, taken: ["B2"] });

  // The holder cannot move seats; cancelling frees the seat and cannot be undone by the attendee.
  await ticket(student, "a", reservedId, { seat: "A1" });
  assert.equal((await Registration.findById(`${tag}-a`)).seat, "B2");
  await ticket(student, "a", reservedId, { seat: "B2", status: "Cancelled" });
  assert.deepEqual((await seatsOf()).taken, []);
  res = await ticket(other, "b", reservedId, { seat: "B2" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  await ticket(student, "a", reservedId, { seat: "B2", status: "Confirmed" });
  assert.equal((await Registration.findById(`${tag}-a`)).status, "Cancelled");

  // The database itself refuses a second confirmed ticket for one seat.
  await assert.rejects(Registration.create({ _id: `${tag}-race`, scope: "admin", eventId: reservedId, status: "Confirmed", seating: "reserved", seat: "B2" }), { code: 11000 });

  // Staff-added tickets without a seat get the first open one.
  res = await save("registrations", admin, [{ id: `${tag}-c`, eventId: reservedId, status: "Confirmed", name: "Walk In" }]);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal((await Registration.findById(`${tag}-c`)).seat, "A1");

  // Seating is locked once people hold tickets, and capacity cannot drop below a taken seat.
  const event = (await Event.findById(reservedId)).toJSON();
  const update = (fields) => save("events", admin, [{ ...event, ...fields }]);
  res = await update({ seating: "free" });
  assert.equal(res.status, 400);
  assert.match(res.data.message, /Seating can't change/);
  res = await update({ capacity: 11 });
  assert.equal(res.status, 400);
  assert.match(res.data.message, /seat B2 is already taken/);
  assert.equal((await update({ capacity: 20 })).status, 200);

  // Free seating keeps no seat number, whatever the client sends.
  res = await ticket(student, "d", freeId, { seat: "A1" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  reg = await Registration.findById(`${tag}-d`);
  assert.deepEqual([reg.seating, reg.seat], ["free", null]);
  assert.deepEqual((await call(`/events/${freeId}/seats`)).data.taken, []);
  console.log("  seating: ok");
}

async function transparency(student) {
  const done = `${tag}-done`;
  const open = `${tag}-open`;
  const adminDone = `${tag}-admin-done`;
  await Event.create({ _id: done, scope: "manager", managerId: `${tag}-mgr`, title: "Done Test", status: "Completed", capacity: 10 });
  await Event.create({ _id: open, scope: "manager", managerId: `${tag}-mgr`, title: "Open Test", status: "Registration Open", capacity: 10 });
  await Event.create({ _id: adminDone, scope: "admin", title: "Admin Done Test", status: "COMPLETED", capacity: 10 });
  await Feedback.create([
    { _id: `${tag}-fb1`, scope: "manager", eventId: done, participant: "Secret Person", rating: 5, organizationRating: 4, speakerRating: 5, venueRating: 3, comment: "Great", date: "2026-10-01" },
    { _id: `${tag}-fb2`, scope: "manager", eventId: done, participant: "Hidden Person", rating: 2, comment: "Too hot", date: "2026-10-02" },
    { _id: `${tag}-fb3`, scope: "manager", eventId: open, participant: "Early Person", rating: 1, comment: "Not yet", date: "2026-10-03" },
  ]);
  await Registration.create({
    _id: `${tag}-fbreg`, scope: "admin", eventId: adminDone, userId: student.id, status: "Confirmed", attendanceStatus: "Attended",
    feedback: { overall: 4, organization: 4, speaker: 3, venue: 5, comment: "Nice", submittedAt: "2026-10-04 10:00" },
  });

  // Anyone can read a completed event's feedback, without names; an event still running shows none.
  let res = await call(`/events/${done}/feedback`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.data.items.map((item) => item.comment).sort(), ["Great", "Too hot"]);
  assert.ok(!JSON.stringify(res.data).includes("Person"), "participant names stay on the server");
  assert.deepEqual((await call(`/events/${open}/feedback`)).data.items, []);
  assert.deepEqual((await call(`/events/${adminDone}/feedback`)).data.items, [
    { rating: 4, organizationRating: 4, speakerRating: 3, venueRating: 5, comment: "Nice", date: "2026-10-04" },
  ]);

  // Event lists carry the average rating of completed events only.
  const listed = (await call("/data/manager-events")).data.items;
  assert.deepEqual([listed.find((e) => e.id === done).feedbackAverage, listed.find((e) => e.id === done).feedbackCount], [3.5, 2]);
  assert.equal(listed.find((e) => e.id === open).feedbackCount, undefined);
  assert.equal((await call("/data/events")).data.items.find((e) => e.id === adminDone).feedbackAverage, 4);

  // Published announcements are public; drafts stay with the event's manager.
  await Announcement.create([
    { _id: `${tag}-ann1`, scope: "manager", eventId: open, title: "Doors open at 9", status: "Published" },
    { _id: `${tag}-ann2`, scope: "manager", eventId: open, title: "Draft plan", status: "Draft" },
  ]);
  const notes = (await call("/data/manager-announcements", student)).data.items.filter((item) => item.eventId === open);
  assert.deepEqual(notes.map((item) => item.title), ["Doors open at 9"]);

  // Every attendee ticket is a student ticket, whatever the client sends.
  res = await save("manager-registrations", student, [{ id: `${tag}-tt`, eventId: open, status: "Confirmed", name: student.name, ticketType: "Guest / Alumni" }]);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal((await Registration.findById(`${tag}-tt`)).ticketType, "Student Attendee");

  // Student IDs are the entry year, a dash, and 7 digits.
  const profile = (body) => call("/auth/me", student, { method: "PATCH", body });
  assert.equal((await profile({ studentId: "2024-105142" })).status, 400);
  assert.equal((await profile({ studentId: "2024-1051423" })).status, 200);
  assert.equal((await User.findById(student.id)).studentId, "2024-1051423");
  console.log("  public feedback: ok");
}

async function managerVenues(manager) {
  const venue = `${tag} Hall`;
  await Venue.create({ _id: `${tag}-venue`, name: venue, capacity: 50 });
  const create = (fields) => save("manager-events", manager, [
    { id: `${tag}-mev`, title: "Venue Test", date: "2026-12-01", startTime: "09:00", endTime: "10:00", capacity: 10, ...fields },
  ]);

  // A manager picks a venue from the admin's list; a typed-in one (or a query object) is refused.
  let res = await create({ venue: "Somewhere Else" });
  assert.equal(res.status, 400);
  assert.match(res.data.message, /venue/i);
  assert.equal((await create({ venue: { $ne: null } })).status, 400);
  res = await create({ venue });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal((await Event.findById(`${tag}-mev`)).status, "Pending");

  // An older event keeps its typed-in venue when its other details change.
  await Event.updateOne({ _id: `${tag}-mev` }, { venue: "Old Typed Hall" });
  const saved = (await Event.findById(`${tag}-mev`)).toJSON();
  res = await save("manager-events", manager, [{ ...saved, description: "Edited" }]);
  assert.equal(res.status, 200, JSON.stringify(res.data));
  console.log("  manager venues: ok");
}

async function run() {
  await connectDB();
  try {
    const student = await makeUser("Self Test Student", "user");
    const other = await makeUser("Other Student", "user");
    const staff = await makeUser("Self Test Staff", "staff");
    const admin = await makeUser("Self Test Admin", "admin");
    const manager = await makeUser("Self Test Manager", "manager");
    await checkIn(student, staff);
    await seating(student, other, admin);
    await transparency(student);
    await managerVenues(manager);
    console.log("Self-test passed.");
  } finally {
    const mine = { $regex: `^${tag}` };
    await Promise.all([
      AuditLog.deleteMany({ actorEmail: mine }), // the throwaway admin's changes are audited too
      User.deleteMany({ email: mine }),
      Event.deleteMany({ _id: mine }),
      Registration.deleteMany({ eventId: mine }),
      Notification.deleteMany({ eventId: mine }),
      Feedback.deleteMany({ eventId: mine }),
      Announcement.deleteMany({ eventId: mine }),
      Venue.deleteMany({ _id: mine }),
    ]);
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
