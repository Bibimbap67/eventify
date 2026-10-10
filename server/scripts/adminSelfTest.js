// Self-test for the admin API and the audit trail. Run from /server with the API running:
//   npm run selftest:admin
// Creates throwaway accounts and an event, checks every rule, then deletes what it made
// (including its own audit entries) and puts the settings document back as it was.
require("dotenv").config({ quiet: true });
const assert = require("assert/strict");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const { Event, AuditLog, Settings } = require("../models/records");

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;
const tag = `admintest-${Date.now().toString(36)}`;

async function call(path, user, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = `Bearer ${jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "5m" })}`;
  const res = await fetch(BASE + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const email = (name) => `${tag}-${name}@example.com`;
const makeUser = (name, role) => User.create({ name: `${tag} ${name}`, email: email(name), password: "selftest123", role });
// The newest entry this actor wrote with this action.
const lastEntry = (actor, action) => AuditLog.findOne({ actorId: actor.id, action }).sort({ createdAt: -1, _id: -1 }).lean();

async function users(admin) {
  const created = await call("/users", admin, { method: "POST", body: { name: `${tag} New`, email: email("new"), password: "secret12", role: "staff" } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.user.id;
  let entry = await lastEntry(admin, "Created user");
  assert.equal(entry.outcome, "success");
  assert.equal(entry.admin, admin.name, "actor comes from the token");
  assert.equal(entry.actorRole, "admin");
  assert.equal(entry.targetId, id);
  assert.match(entry.record, new RegExp(email("new")));
  assert.ok(Date.now() - new Date(entry.createdAt).getTime() < 60000, "server time");
  assert.ok(!JSON.stringify(entry).includes("secret12"), "never stores passwords");

  // A client cannot pick the actor: extra fields in the body are ignored.
  const duplicate = await call("/users", admin, { method: "POST", body: { name: "Dup", email: email("new"), password: "secret12", admin: "Someone Else" } });
  assert.equal(duplicate.status, 409);
  entry = await lastEntry(admin, "Created user");
  assert.equal(entry.outcome, "failed");
  assert.equal(entry.admin, admin.name);
  assert.match(entry.details.reason, /already exists/);

  assert.equal((await call(`/users/${id}`, admin, { method: "PATCH", body: { role: "manager" } })).status, 200);
  entry = await lastEntry(admin, "Changed user role");
  assert.deepEqual([entry.details.from, entry.details.to, entry.targetId], ["Staff", "Event Manager", id]);

  assert.equal((await call(`/users/${id}`, admin, { method: "PATCH", body: { status: "inactive" } })).status, 200);
  entry = await lastEntry(admin, "Deactivated user");
  assert.equal(entry.outcome, "success");

  assert.equal((await call(`/users/${id}`, admin, { method: "PATCH", body: { password: "another12" } })).status, 200);
  entry = await lastEntry(admin, "Reset user password");
  assert.ok(!JSON.stringify(entry).includes("another12"));

  // Admins cannot lock themselves out, and the refusal is recorded as denied.
  let res = await call(`/users/${admin.id}`, admin, { method: "PATCH", body: { role: "user" } });
  assert.equal(res.status, 400);
  entry = await lastEntry(admin, "Changed user role");
  assert.deepEqual([entry.outcome, entry.targetId], ["denied", admin.id]);
  res = await call(`/users/${admin.id}`, admin, { method: "PATCH", body: { status: "inactive" } });
  assert.equal(res.status, 400);
  assert.equal((await lastEntry(admin, "Deactivated user")).outcome, "denied");
  res = await call(`/users/${admin.id}`, admin, { method: "DELETE" });
  assert.equal(res.status, 400);
  assert.equal((await lastEntry(admin, "Deleted user")).outcome, "denied");
  assert.equal((await User.findById(admin.id)).role, "admin");

  // Paging, role tabs and counts.
  res = await call(`/users?page=1&limit=1&q=${tag}&sort=name`, admin);
  assert.equal(res.status, 200);
  assert.equal(res.data.users.length, 1);
  assert.ok(res.data.total >= 4);
  assert.ok(res.data.counts.roles.admin >= 1 && res.data.counts.roles.manager >= 1);
  res = await call(`/users?page=1&limit=50&q=${tag}&role=manager&status=inactive`, admin);
  assert.deepEqual(res.data.users.map((user) => user.id), [id]);

  assert.equal((await call(`/users/${id}`, admin, { method: "DELETE" })).status, 200);
  entry = await lastEntry(admin, "Deleted user");
  assert.deepEqual([entry.outcome, entry.targetId], ["success", id]);
  console.log("  users: ok");
}

async function access(student, admin) {
  // Non-admins are refused on every admin API, and the attempt is recorded under their name.
  for (const path of ["/admin/audit-logs", "/admin/overview", "/users?page=1", "/settings"]) {
    assert.equal((await call(path, student)).status, 403, path);
  }
  const entry = await lastEntry(student, "Admin API request");
  assert.deepEqual([entry.outcome, entry.admin, entry.actorRole], ["denied", student.name, "user"]);
  assert.equal((await call("/admin/audit-logs")).status, 401);

  // Nobody can write or delete audit entries through the API, not even an admin.
  const forged = { id: `${tag}-forged`, action: "Forged", admin: "Nobody" };
  for (const user of [student, admin]) {
    const res = await call("/data/audit-logs/batch", user, { method: "POST", body: { save: [forged], remove: [entry._id] } });
    assert.equal(res.status, 404);
  }
  assert.equal(await AuditLog.exists({ _id: forged.id }), null);
  assert.ok(await AuditLog.exists({ _id: entry._id }));
  console.log("  access: ok");
}

async function events(admin, manager) {
  const id = `${tag}-event`;
  await Event.create({ _id: id, scope: "manager", managerId: manager.managerId || manager.id, title: "Admin Test Event", status: "Pending", date: "2026-12-01", capacity: 20 });
  const event = (await Event.findById(id)).toJSON();
  const save = (user, fields) => call("/data/manager-events/batch", user, { method: "POST", body: { save: [{ ...event, ...fields }] } });

  // A manager cannot approve their own event; the attempt is recorded as denied.
  let res = await save(manager, { status: "Registration Open" });
  assert.equal(res.status, 400);
  let entry = await lastEntry(manager, "Approved event");
  assert.deepEqual([entry.outcome, entry.targetId, entry.details.from], ["denied", id, "Pending"]);
  assert.match(entry.details.reason, /Only an administrator/);

  res = await save(admin, { status: "Registration Open" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  entry = await lastEntry(admin, "Approved event");
  assert.deepEqual([entry.outcome, entry.record, entry.details.to], ["success", "Admin Test Event", "Registration Open"]);

  // A manager's everyday edit is not admin activity.
  const before = await AuditLog.countDocuments({ actorId: manager.id });
  res = await save(manager, { status: "Registration Open", description: "Updated by the manager" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(await AuditLog.countDocuments({ actorId: manager.id }), before);

  res = await call("/data/manager-events/batch", admin, { method: "POST", body: { remove: [id] } });
  assert.equal(res.status, 200);
  assert.equal((await lastEntry(admin, "Deleted event")).targetId, id);
  console.log("  events: ok");
}

async function settings(admin) {
  let res = await call("/settings", admin, { method: "PUT", body: { defaultCapacity: 0 } });
  assert.equal(res.status, 400);
  assert.equal((await lastEntry(admin, "Updated platform settings")).outcome, "failed");
  res = await call("/settings", admin, { method: "PUT", body: { allowWaitlist: true } });
  assert.equal(res.status, 400, "settings with no effect are refused");

  res = await call("/settings", admin, { method: "PUT", body: { orgName: `${tag} School`, academicTerm: "Test Term", defaultCapacity: 75 } });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.settings.defaultCapacity, 75);
  const entry = await lastEntry(admin, "Updated platform settings");
  assert.equal(entry.outcome, "success");
  assert.equal(entry.details.changes.defaultCapacity.to, "75");
  console.log("  settings: ok");
}

async function lists(admin) {
  let res = await call("/admin/audit-logs?outcome=denied&limit=100", admin);
  assert.equal(res.status, 200);
  assert.ok(res.data.items.length > 0 && res.data.items.every((item) => item.outcome === "denied"));
  res = await call(`/admin/audit-logs?actor=${encodeURIComponent(admin.name)}&limit=2&page=2`, admin);
  assert.equal(res.data.page, 2);
  assert.ok(res.data.items.every((item) => item.admin === admin.name));
  assert.ok(res.data.total > 2);

  res = await call("/admin/registrations?limit=5", admin);
  assert.equal(res.status, 200);
  assert.ok(res.data.items.length <= 5);
  assert.ok(res.data.items.every((item) => !("ticketToken" in item)), "QR secrets are never listed");
  assert.equal(typeof res.data.summary.confirmed, "number");

  const failed = await call("/auth/password", admin, { method: "POST", body: { currentPassword: "wrong-password", newPassword: "whatever12" } });
  assert.equal(failed.status, 400);
  const entry = await lastEntry(admin, "Changed own password");
  assert.equal(entry.outcome, "failed");
  assert.ok(!JSON.stringify(entry).includes("wrong-password") && !JSON.stringify(entry).includes("whatever12"));
  console.log("  lists: ok");
}

async function run() {
  await connectDB();
  const savedSettings = await Settings.findById("global").lean();
  const made = [];
  try {
    const admin = await makeUser("Admin", "admin");
    const manager = await makeUser("Manager", "manager");
    const student = await makeUser("Student", "user");
    made.push(admin, manager, student);
    await users(admin);
    await access(student, admin);
    await events(admin, manager);
    await settings(admin);
    await lists(admin);
    console.log("Admin self-test passed.");
  } finally {
    await Promise.all([
      User.deleteMany({ email: { $regex: `^${tag}` } }),
      Event.deleteMany({ _id: { $regex: `^${tag}` } }),
      AuditLog.deleteMany({ actorId: { $in: made.map((user) => user.id) } }),
    ]);
    await Settings.deleteOne({ _id: "global" });
    if (savedSettings) await Settings.collection.insertOne(savedSettings);
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
