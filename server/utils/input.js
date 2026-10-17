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

// A profile photo: "" (back to the default face) or the cropped image the Profile page sends,
// a JPEG/PNG/WebP data URL. The cap keeps a photo far below the 2mb body limit (a 256px JPEG is ~20 KB).
const AVATAR_MAX = 300 * 1024;
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const validAvatar = (value) => value === "" || (typeof value === "string" && value.length <= AVATAR_MAX && AVATAR_RE.test(value));

module.exports = { EMAIL_RE, PASSWORD_MIN, PASSWORD_RULE, text, searchRegex, paging, validAvatar };
