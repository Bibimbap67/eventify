const User = require("../models/User");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["user", "manager", "admin"];
const STATUSES = ["active", "inactive"];

const getUsers = async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users });
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

const createUser = async (req, res) => {
  const { fields, error } = readFields(req.body, { creating: true });
  if (error) return res.status(400).json({ message: error });
  if (await User.exists({ email: fields.email })) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }
  const user = await User.create(fields);
  if (user.role === "manager" && !user.managerId) {
    user.managerId = user.id;
    await user.save();
  }
  res.status(201).json({ user });
};

const updateUser = async (req, res) => {
  const user = await User.findById(req.params.id).catch(() => null);
  if (!user) return res.status(404).json({ message: "User not found." });

  const { fields, error } = readFields(req.body, { creating: false });
  if (error) return res.status(400).json({ message: error });

  const isSelf = user.id === req.user.id;
  if (isSelf && ((fields.role && fields.role !== "admin") || fields.status === "inactive")) {
    return res.status(400).json({ message: "You cannot remove your own admin access." });
  }
  if (fields.email && fields.email !== user.email && (await User.exists({ email: fields.email }))) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  Object.assign(user, fields);
  if (user.role === "manager" && !user.managerId) user.managerId = user.id;
  await user.save();
  res.json({ user });
};

const deleteUser = async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: "You cannot delete your own account." });
  }
  const user = await User.findByIdAndDelete(req.params.id).catch(() => null);
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ ok: true });
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
