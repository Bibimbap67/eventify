const jwt = require("jsonwebtoken");
const User = require("../models/User");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

const signup = async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name) return res.status(400).json({ message: "Enter your full name." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
  if (password.length < 6) return res.status(400).json({ message: "Use at least 6 characters for the password." });

  if (await User.findOne({ email })) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  // role is NOT read from the request body: public signup can only create attendees.
  const user = await User.create({ name, email, password, role: "user" });
  res.status(201).json({ token: signToken(user), user });
};

const login = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: "Incorrect email or password." });
  }

  if (user.status === "inactive") {
    return res.status(403).json({ message: "This account is inactive. Contact an administrator." });
  }

  res.json({ token: signToken(user), user });
};

const me = (req, res) => {
  res.json({ user: req.user });
};

const PROFILE_FIELDS = ["studentId", "department", "program", "yearLevel", "phone", "avatar"];

// Profile page: the signed-in user edits their own details (not role or status).
const updateMe = async (req, res) => {
  const user = req.user;
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: "Enter your full name." });
    user.name = name;
  }
  if (req.body.email !== undefined) {
    const email = String(req.body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Enter a valid email address." });
    if (email !== user.email && (await User.exists({ email }))) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    user.email = email;
  }
  PROFILE_FIELDS.forEach((key) => {
    if (req.body[key] !== undefined) user[key] = String(req.body[key] ?? "");
  });
  await user.save();
  res.json({ user });
};

const changePassword = async (req, res) => {
  const current = String(req.body.currentPassword || "");
  const next = String(req.body.newPassword || "");
  const user = await User.findById(req.user.id).select("+password");
  if (!(await user.matchPassword(current))) {
    return res.status(400).json({ message: "Current password is incorrect." });
  }
  if (next.length < 6) return res.status(400).json({ message: "Use at least 6 characters for the password." });
  user.password = next; // hashed by the model before saving
  await user.save();
  res.json({ ok: true });
};

module.exports = { signup, login, me, updateMe, changePassword };
