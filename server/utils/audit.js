// The admin audit trail. Entries are only ever written here, by the server, after it has
// decided what happened: the actor is the signed-in user from the token (never the request
// body), the time is the document's createdAt, and the outcome says whether the action went
// through ("success"), was refused by a rule ("denied") or failed ("failed").
const crypto = require("crypto");
const { AuditLog } = require("../models/records");

// Never copied into an entry: passwords, QR ticket secrets and server bookkeeping.
const HIDDEN = /password|token|secret/i;
const IGNORED = new Set(["id", "_id", "__v", "createdAt", "updatedAt", "scope", "registeredCount"]);

const short = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

// Field-by-field differences between two versions of a record: { field: { from, to } }.
function diff(before = {}, after = {}) {
  const changes = {};
  new Set([...Object.keys(before || {}), ...Object.keys(after || {})]).forEach((key) => {
    if (IGNORED.has(key)) return;
    const from = short(before?.[key]);
    const to = short(after?.[key]);
    if (from === to) return;
    changes[key] = HIDDEN.test(key) ? { from: "(hidden)", to: "(hidden)" } : { from, to };
  });
  return changes;
}

// Logging must never break the action it records, so a failed write is only reported.
async function audit(req, { action, targetType, targetId, target, outcome = "success", details }) {
  const actor = req.user;
  try {
    await AuditLog.create({
      _id: `log-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`,
      action,
      admin: actor?.name || "Unknown user",
      actorId: actor?.id,
      actorRole: actor?.role,
      actorEmail: actor?.email,
      targetType,
      targetId: targetId === undefined || targetId === null ? undefined : String(targetId),
      record: target === undefined || target === null ? undefined : String(target),
      outcome,
      details,
    });
  } catch (err) {
    console.error(`Could not write audit entry "${action}":`, err.message);
  }
}

// Like requireRole("admin"), but a signed-in non-admin who reaches an admin API is recorded.
function requireAdmin(req, res, next) {
  if (req.user?.role === "admin") return next();
  audit(req, {
    action: "Admin API request",
    targetType: "api",
    target: `${req.method} ${req.originalUrl.split("?")[0]}`,
    outcome: "denied",
    details: { reason: "Only administrators can use this." },
  }).then(() => res.status(403).json({ message: "You do not have permission to do that." }));
}

module.exports = { audit, diff, requireAdmin };
