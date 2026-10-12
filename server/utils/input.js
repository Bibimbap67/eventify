// Rules for reading what a request sends, shared by the controllers.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Also enforced by models/User.js. Keep the message in step with the number.
const PASSWORD_MIN = 6;
const PASSWORD_RULE = "Use at least 6 characters for the password.";

// A query value as trimmed text, cut to `max` characters.
const text = (value, max = 100) => String(value ?? "").trim().slice(0, max);

// Case-insensitive "contains" match for typed search text (regex characters are escaped).
const searchRegex = (q) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

// ?page & ?limit as numbers MongoDB can use: page from 1, limit from 1 to 100.
function paging(query, fallback = 25) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || fallback));
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { EMAIL_RE, PASSWORD_MIN, PASSWORD_RULE, text, searchRegex, paging };
