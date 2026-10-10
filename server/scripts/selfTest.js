// Self-test for ticket QR check-in and event seating. Run from /server with the API running:
//   npm run selftest
// Creates throwaway users, events and registrations, checks every rule, then deletes them.
require("dotenv").config({ quiet: true });
const assert = require("assert/strict");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const { Event, Registration, Notification, AuditLog } = require("../models/records");

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

async function run() {
  await connectDB();
  try {
    const student = await makeUser("Self Test Student", "user");
    const other = await makeUser("Other Student", "user");
    const staff = await makeUser("Self Test Staff", "staff");
    const admin = await makeUser("Self Test Admin", "admin");
    await checkIn(student, staff);
    await seating(student, other, admin);
    console.log("Self-test passed.");
  } finally {
    const mine = { $regex: `^${tag}` };
    await Promise.all([
      AuditLog.deleteMany({ actorEmail: mine }), // the throwaway admin's changes are audited too
      User.deleteMany({ email: mine }),
      Event.deleteMany({ _id: mine }),
      Registration.deleteMany({ eventId: mine }),
      Notification.deleteMany({ eventId: mine }),
    ]);
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
