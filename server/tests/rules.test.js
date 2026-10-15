// Server rule tests. Run from /server: npm test
// The database tests use their own throwaway database (MONGODB_TEST_URI, by default a local
// "eventify_rules_test"), which they empty first and drop at the end. Without a reachable
// MongoDB they are skipped.
process.env.TZ = "Asia/Manila";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { managerMayChangeStatus } = require("../utils/eventStatus");
const { MAX_FAILS, LOCK_MS, isLocked, recordFailure, clearFailures } = require("../utils/loginLimit");
const { batch, list } = require("../controllers/dataController");
const { Event, Registration, Feedback, Venue, Notification } = require("../models/records");

test("a manager completes only an approved event, or restores an archived one", () => {
  assert.equal(managerMayChangeStatus({ status: "Registration Open" }, "Completed"), true);
  assert.equal(managerMayChangeStatus({ status: "Pending" }, "Completed"), false);
  assert.equal(managerMayChangeStatus({ status: "Rejected" }, "Completed"), false);
  assert.equal(managerMayChangeStatus({ status: "Archived", archivedFrom: "Completed" }, "Completed"), true);
  assert.equal(managerMayChangeStatus({ status: "Archived", archivedFrom: "Cancelled" }, "Completed"), false);
  assert.equal(managerMayChangeStatus({ status: "Pending" }, "Cancelled"), true);
  assert.equal(managerMayChangeStatus({ status: "Completed" }, "Archived"), true);
  assert.equal(managerMayChangeStatus({ status: "Pending" }, "Registration Open"), false);
});

test("ten wrong passwords lock that email for 15 minutes", () => {
  const email = "guess@test";
  for (let i = 1; i < MAX_FAILS; i += 1) recordFailure(email, 0);
  assert.equal(isLocked(email, 0), false);
  recordFailure(email, 0);
  assert.equal(isLocked(email, 1), true);
  assert.equal(isLocked(email, LOCK_MS + 1), false);
  clearFailures(email);
});

describe("data rules (MongoDB)", () => {
  let connected = false;
  const dbTest = (name, fn) => test(name, (t) => (connected ? fn() : t.skip("no MongoDB reachable")));

  before(async () => {
    try {
      await mongoose.connect(process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017/eventify_rules_test", { serverSelectionTimeoutMS: 2000 });
    } catch {
      return;
    }
    assert.match(mongoose.connection.name, /test/, "refusing to empty a database whose name doesn't say test");
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).createIndexes()));
    connected = true;
  });

  after(async () => {
    if (connected) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const response = () => ({ code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  async function send(user, resource, save = []) {
    const res = response();
    await batch({ params: { resource }, body: { save, remove: [] }, user, method: "POST", originalUrl: `/api/data/${resource}/batch` }, res);
    return res;
  }
  const admin = { id: "a1", role: "admin", name: "Admin", email: "a1@test" };
  const manager = { id: "m1", role: "manager", name: "Manager", email: "m1@test" };
  const student = (n) => ({ id: `s${n}`, role: "user", name: `Student ${n}`, email: `s${n}@test`, studentId: "" });
  let events = 0;
  const makeEvent = (fields = {}) => Event.create({
    _id: `ev-${(events += 1)}`, scope: "manager", managerId: manager.id, title: `Event ${events}`, status: "Registration Open",
    date: "2099-01-01", startTime: "09:00", endTime: "10:00", venue: "Room 1", capacity: 10, seating: "free", ...fields,
  });
  const ticket = (event, user, fields) => Registration.create({
    _id: `reg-${event._id}-${user.id}`, scope: "manager", eventId: event._id, userId: user.id, name: user.name, status: "Confirmed", ...fields,
  });

  dbTest("a manager can't complete an event the admin hasn't approved", async () => {
    const pending = await makeEvent({ status: "Pending" });
    assert.equal((await send(manager, "manager-events", [{ ...pending.toJSON(), status: "Completed" }])).code, 400);
    assert.equal((await Event.findById(pending._id)).status, "Pending");
    const open = await makeEvent();
    assert.equal((await send(manager, "manager-events", [{ ...open.toJSON(), status: "Completed" }])).code, 200);
  });

  dbTest("only an attendee whose exit was verified leaves feedback, and only once", async () => {
    const event = await makeEvent({ status: "Completed" });
    const [noShow, came] = [student(1), student(2)];
    await ticket(event, noShow, { attendanceStatus: "Not Checked In" });
    await ticket(event, came, { attendanceStatus: "Attended" });
    const entry = (id) => ({ id, eventId: event._id, rating: 5, comment: "Great" });
    assert.equal((await send(noShow, "manager-feedback", [entry("fb-1")])).code, 400);
    assert.equal((await send(came, "manager-feedback", [entry("fb-2")])).code, 200);
    assert.equal((await send(came, "manager-feedback", [entry("fb-3")])).code, 400);
    assert.equal(await Feedback.countDocuments({ eventId: event._id }), 1);
  });

  dbTest("an attendee can't cancel a ticket once checked in", async () => {
    const event = await makeEvent();
    const holder = student(3);
    const checkedIn = await ticket(event, holder, { attendanceStatus: "Checked in" });
    assert.equal((await send(holder, "manager-registrations", [{ ...checkedIn.toJSON(), status: "Cancelled" }])).code, 400);
    assert.equal((await Registration.findById(checkedIn._id)).status, "Confirmed");
  });

  dbTest("a rush of sign-ups never fills more seats than the event has", async () => {
    const event = await makeEvent({ capacity: 3 });
    const students = [4, 5, 6, 7, 8, 9, 10, 11].map(student);
    const results = await Promise.all(students.map((user) => send(user, "manager-registrations", [{ id: `reg-${event._id}-${user.id}`, eventId: event._id }])));
    assert.equal(await Registration.countDocuments({ eventId: event._id, status: "Confirmed" }), 3);
    assert.equal(results.filter((res) => res.code === 200).length, 3);
  });

  dbTest("renaming a venue renames it on the events booked there", async () => {
    const venue = await Venue.create({ _id: "venue-1", name: "Room A", location: "1F", capacity: 50 });
    const event = await makeEvent({ venue: "Room A" });
    assert.equal((await send(admin, "venues", [{ ...venue.toJSON(), name: "Room A (1F)" }])).code, 200);
    assert.equal((await Event.findById(event._id)).venue, "Room A (1F)");
  });

  dbTest("an admin's lists hold their own notifications only", async () => {
    await Notification.create({ _id: "n-1", scope: "attendee", userId: "s99", title: "Someone else's" });
    const res = response();
    await list({ params: { resource: "notifications" }, user: admin }, res);
    assert.equal(res.body.items.some((item) => item.id === "n-1"), false);
  });
});
