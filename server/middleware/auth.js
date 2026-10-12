const jwt = require("jsonwebtoken");
const User = require("../models/User");

const SIGNED_IN_ELSEWHERE = "This admin account signed in on another device, so you were signed out here.";

async function userFromToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.id);
  if (!user || user.status === "inactive") return null;
  // An admin's token works only until the account signs in again somewhere (authController login).
  if (user.role === "admin" && !(await User.exists({ _id: user._id, sessionId: payload.sid ?? null }))) {
    throw new Error(SIGNED_IN_ELSEWHERE);
  }
  return user;
}

async function protect(req, res, next) {
  try {
    const user = await userFromToken(req);
    if (!user) return res.status(401).json({ message: "Not signed in." });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: err.message === SIGNED_IN_ELSEWHERE ? err.message : "Session expired. Please sign in again." });
  }
}

// For pages anyone can view: attaches req.user when a valid token is sent.
async function optionalAuth(req, res, next) {
  try {
    req.user = await userFromToken(req);
  } catch {
    req.user = null;
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to do that." });
    }
    next();
  };
}

module.exports = { protect, optionalAuth, requireRole };
