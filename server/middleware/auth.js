const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function userFromToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.id);
  return user && user.status !== "inactive" ? user : null;
}

async function protect(req, res, next) {
  try {
    const user = await userFromToken(req);
    if (!user) return res.status(401).json({ message: "Not signed in." });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Session expired. Please sign in again." });
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
