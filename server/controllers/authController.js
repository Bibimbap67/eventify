const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { audit, diff } = require("../utils/audit");
const { sendMail } = require("../utils/mail");
const { EMAIL_RE, PASSWORD_MIN, PASSWORD_RULE } = require("../utils/input");

const RESET_TTL_MS = 30 * 60 * 1000;
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Admin accounts are the keys to the platform, so changes to them go in the audit trail.
const auditAdmin = (req, entry) => (req.user.role === "admin"
  ? audit(req, { targetType: "user", targetId: req.user.id, target: `${req.user.name} (${req.user.email})`, ...entry })
  : Promise.resolve());

// Student IDs read "2024-1051423": the year the student entered NU, then 7 digits.
// Keep in step with validStudentId in src/data/student.js.
const STUDENT_ID_RE = /^(\d{4})-\d{7}$/;
const validStudentId = (id) => {
  const match = STUDENT_ID_RE.exec(id);
  return Boolean(match) && Number(match[1]) >= 2000 && Number(match[1]) <= new Date().getFullYear();
};

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
  if (password.length < PASSWORD_MIN) return res.status(400).json({ message: PASSWORD_RULE });

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
  const before = { name: user.name, email: user.email };
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
  // Only a changed ID is checked, so an older one never blocks saving the rest of the profile.
  const studentId = String(req.body.studentId ?? "").trim();
  if (req.body.studentId !== undefined && studentId && studentId !== user.studentId && !validStudentId(studentId)) {
    return res.status(400).json({ message: "Enter your student ID like 2024-1051423." });
  }
  PROFILE_FIELDS.forEach((key) => {
    if (req.body[key] !== undefined) user[key] = String(req.body[key] ?? "");
  });
  await user.save();
  const changes = diff(before, { name: user.name, email: user.email });
  if (Object.keys(changes).length) await auditAdmin(req, { action: "Updated own profile", details: { changes } });
  res.json({ user });
};

const changePassword = async (req, res) => {
  const current = String(req.body.currentPassword || "");
  const next = String(req.body.newPassword || "");
  const user = await User.findById(req.user.id).select("+password");
  const refuse = async (message) => {
    await auditAdmin(req, { action: "Changed own password", outcome: "failed", details: { reason: message } });
    res.status(400).json({ message });
  };
  if (!(await user.matchPassword(current))) return refuse("Current password is incorrect.");
  if (next.length < PASSWORD_MIN) return refuse(PASSWORD_RULE);
  user.password = next; // hashed by the model before saving
  await user.save();
  await auditAdmin(req, { action: "Changed own password" });
  res.json({ ok: true });
};

// The same answer whether or not the account exists, so this form can't reveal who has one.
const RESET_SENT = "If an account uses that email, we sent it a link to reset the password. The link works for 30 minutes.";

const forgotPassword = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Enter a valid email address." });

  const user = await User.findOne({ email, status: "active" }).select("+resetTokenExpires");
  // At most one email a minute per account, so nobody can flood an inbox through this form.
  const recentlySent = user?.resetTokenExpires && user.resetTokenExpires - RESET_TTL_MS > Date.now() - 60 * 1000;
  if (user && !recentlySent) {
    const token = crypto.randomBytes(32).toString("hex");
    user.resetTokenHash = hashToken(token);
    user.resetTokenExpires = new Date(Date.now() + RESET_TTL_MS);
    await user.save();
    const link = `${process.env.CLIENT_URL || "http://localhost:3000"}/reset-password/${token}`;
    // Not awaited: a slow mail server must not make known emails answer slower than unknown ones.
    sendMail({
      to: user.email,
      subject: "Reset your Eventify password",
      text: `Hi ${user.name},\n\nSomeone asked to reset the password for your Eventify account. Open this link to choose a new one:\n\n${link}\n\nThe link works once and expires in 30 minutes. If you didn't ask for this, ignore this email and your password stays the same.\n\nEventify · National University - Mall of Asia`,
    }).catch((err) => console.error("Could not send the password reset email:", err.message));
  }
  res.json({ message: RESET_SENT });
};

const resetPassword = async (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  if (password.length < PASSWORD_MIN) return res.status(400).json({ message: PASSWORD_RULE });

  // The token fields are selected so that clearing them below is saved.
  const user = token && await User.findOne({ resetTokenHash: hashToken(token), resetTokenExpires: { $gt: new Date() } })
    .select("+resetTokenHash +resetTokenExpires");
  if (!user) return res.status(400).json({ message: "This reset link is invalid or has expired. Ask for a new one." });
  user.password = password; // hashed by the model before saving
  user.resetTokenHash = undefined; // a link works once
  user.resetTokenExpires = undefined;
  await user.save();
  res.json({ ok: true });
};

module.exports = { signup, login, me, updateMe, changePassword, forgotPassword, resetPassword };
