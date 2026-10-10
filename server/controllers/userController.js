const User = require("../models/User");
const { audit } = require("../utils/audit");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["user", "manager", "staff", "admin"];
const STATUSES = ["active", "inactive"];
const ROLE_NAMES = { user: "Attendee", manager: "Event Manager", staff: "Staff", admin: "Admin" };
// _id breaks ties so a page never repeats or skips a user.
const SORTS = {
  name: { name: 1, _id: 1 },
  "-name": { name: -1, _id: 1 },
  email: { email: 1, _id: 1 },
  "-email": { email: -1, _id: 1 },
  role: { role: 1, name: 1, _id: 1 },
  createdAt: { createdAt: 1, _id: 1 },
  "-createdAt": { createdAt: -1, _id: -1 },
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const label = (user) => `${user.name} (${user.email})`;
const countsOf = (rows) => Object.fromEntries(rows.map((row) => [row._id, row.count]));

// Without ?page: every account (AuthContext loads this for admins).
// With ?page: one page for the Users screen, plus how many accounts each role and status tab
// holds for the current search, so the tabs can show their counts.
const getUsers = async (req, res) => {
  if (req.query.page === undefined) {
    const users = await User.find().sort({ createdAt: -1 });
    return res.json({ users });
  }
  const q = String(req.query.q || "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const search = q ? { $or: [{ name: new RegExp(escapeRegex(q), "i") }, { email: new RegExp(escapeRegex(q), "i") }] } : {};
  const byRole = ROLES.includes(req.query.role) ? { role: req.query.role } : {};
  const byStatus = STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
  const filter = { ...search, ...byRole, ...byStatus };

  const [users, total, [facets]] = await Promise.all([
    User.find(filter).sort(SORTS[req.query.sort] || SORTS["-createdAt"]).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
    User.aggregate([
      { $match: search },
      {
        $facet: {
          roles: [{ $match: byStatus }, { $group: { _id: "$role", count: { $sum: 1 } } }],
          statuses: [{ $match: byRole }, { $group: { _id: "$status", count: { $sum: 1 } } }],
        },
      },
    ]),
  ]);
  res.json({ users, total, page, limit, counts: { roles: countsOf(facets.roles), statuses: countsOf(facets.statuses) } });
};

// Validates the admin form fields that were sent; returns an error message or null.
function readFields(body, { creating }) {
  const fields = {};
  if (creating || body.name !== undefined) {
    fields.name = String(body.name || "").trim();
    if (!fields.name) return { error: "Enter the user's full name." };
  }
  if (creating || body.email !== undefined) {
    fields.email = String(body.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(fields.email)) return { error: "Enter a valid email address." };
  }
  if (creating || body.password) {
    fields.password = String(body.password || "");
    if (fields.password.length < 6) return { error: "Use at least 6 characters for the password." };
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return { error: "Choose a valid role." };
    fields.role = body.role;
  }
  if (body.status !== undefined) {
    fields.status = String(body.status).toLowerCase();
    if (!STATUSES.includes(fields.status)) return { error: "Choose a valid status." };
  }
  return { fields };
}

// The audit name for what a PATCH tried to do, used when it is refused.
function attempted(body, user) {
  if (body.role !== undefined && body.role !== user?.role) return "Changed user role";
  const status = String(body.status ?? "").toLowerCase();
  if (status && status !== user?.status) return status === "active" ? "Activated user" : "Deactivated user";
  if (body.password) return "Reset user password";
  return "Updated user details";
}

async function refuse(req, res, status, message, entry, outcome = "failed") {
  await audit(req, { ...entry, targetType: "user", outcome, details: { ...entry.details, reason: message } });
  res.status(status).json({ message });
}

const createUser = async (req, res) => {
  const entry = { action: "Created user", target: String(req.body?.email || "").trim().toLowerCase() || "new account" };
  const { fields, error } = readFields(req.body || {}, { creating: true });
  if (error) return refuse(req, res, 400, error, entry);
  if (await User.exists({ email: fields.email })) {
    return refuse(req, res, 409, "An account with this email already exists.", entry);
  }
  const user = await User.create(fields);
  if (user.role === "manager" && !user.managerId) {
    user.managerId = user.id;
    await user.save();
  }
  await audit(req, {
    ...entry, targetType: "user", targetId: user.id, target: label(user),
    details: { role: ROLE_NAMES[user.role], status: user.status },
  });
  res.status(201).json({ user });
};

const updateUser = async (req, res) => {
  const body = req.body || {};
  const user = await User.findById(req.params.id).catch(() => null);
  const entry = { action: attempted(body, user), targetId: req.params.id, target: user ? label(user) : req.params.id };
  if (!user) return refuse(req, res, 404, "User not found.", entry);

  const { fields, error } = readFields(body, { creating: false });
  if (error) return refuse(req, res, 400, error, entry);

  // An admin can never demote, deactivate or delete their own account, and whoever does
  // these things is an active admin, so the last active admin can never be removed.
  const isSelf = user.id === req.user.id;
  if (isSelf && ((fields.role && fields.role !== "admin") || fields.status === "inactive")) {
    return refuse(req, res, 400, "You cannot remove your own admin access.", entry, "denied");
  }
  if (fields.email && fields.email !== user.email && (await User.exists({ email: fields.email }))) {
    return refuse(req, res, 409, "An account with this email already exists.", entry);
  }

  const before = { name: user.name, email: user.email, role: user.role, status: user.status };
  Object.assign(user, fields);
  if (user.role === "manager" && !user.managerId) user.managerId = user.id;
  await user.save();

  // One entry per kind of change, so role and status changes can be filtered on their own.
  const base = { targetType: "user", targetId: user.id, target: label(user) };
  if (before.role !== user.role) {
    await audit(req, { ...base, action: "Changed user role", details: { from: ROLE_NAMES[before.role], to: ROLE_NAMES[user.role] } });
  }
  if (before.status !== user.status) {
    await audit(req, { ...base, action: user.status === "active" ? "Activated user" : "Deactivated user", details: { from: before.status, to: user.status } });
  }
  if (fields.password) await audit(req, { ...base, action: "Reset user password" });
  const changes = {};
  ["name", "email"].forEach((key) => {
    if (before[key] !== user[key]) changes[key] = { from: before[key], to: user[key] };
  });
  if (Object.keys(changes).length) await audit(req, { ...base, action: "Updated user details", details: { changes } });

  res.json({ user });
};

const deleteUser = async (req, res) => {
  const entry = { action: "Deleted user", targetId: req.params.id, target: req.params.id };
  if (req.params.id === req.user.id) {
    return refuse(req, res, 400, "You cannot delete your own account.", { ...entry, target: label(req.user) }, "denied");
  }
  const user = await User.findByIdAndDelete(req.params.id).catch(() => null);
  if (!user) return refuse(req, res, 404, "User not found.", entry);
  await audit(req, { ...entry, targetType: "user", target: label(user), details: { role: ROLE_NAMES[user.role] } });
  res.json({ ok: true });
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
