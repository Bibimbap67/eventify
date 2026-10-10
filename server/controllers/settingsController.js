const { Settings } = require("../models/records");
const { audit, diff } = require("../utils/audit");

const SETTINGS_ID = "global";

// The settings the admin Settings page edits, each with its rule. Anything else is refused.
// Values saved by older versions of the page stay in the document untouched.
const RULES = {
  orgName(value) {
    const text = String(value ?? "").trim();
    return text && text.length <= 120 ? { value: text } : { error: "Enter the organization name (up to 120 characters)." };
  },
  academicTerm(value) {
    const text = String(value ?? "").trim();
    return text.length <= 80 ? { value: text } : { error: "Keep the academic term under 80 characters." };
  },
  defaultCapacity(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 100000
      ? { value: number }
      : { error: "Default capacity must be a whole number from 1 to 100000." };
  },
};

function readSettings(body) {
  const values = {};
  for (const [key, raw] of Object.entries(body || {})) {
    if (!Object.hasOwn(RULES, key)) return { error: `"${key}" is not a setting that can be changed.` };
    const { value, error } = RULES[key](raw);
    if (error) return { error };
    values[key] = value;
  }
  return { values };
}

function toSettings(doc) {
  if (!doc) return null;
  const { id, createdAt, updatedAt, ...settings } = doc.toJSON();
  return settings;
}

// Returns null until an admin saves settings once; the app then uses its defaults.
const getSettings = async (req, res) => {
  res.json({ settings: toSettings(await Settings.findById(SETTINGS_ID)) });
};

const updateSettings = async (req, res) => {
  const entry = { action: "Updated platform settings", targetType: "settings", targetId: SETTINGS_ID, target: "Platform settings" };
  const { values, error } = readSettings(req.body);
  if (error) {
    await audit(req, { ...entry, outcome: "failed", details: { reason: error } });
    return res.status(400).json({ message: error });
  }
  const doc = (await Settings.findById(SETTINGS_ID)) || new Settings({ _id: SETTINGS_ID });
  const before = toSettings(doc);
  doc.set(values);
  await doc.save();
  const settings = toSettings(doc);
  const changes = diff(before, settings);
  if (Object.keys(changes).length) await audit(req, { ...entry, details: { changes } });
  res.json({ settings });
};

module.exports = { getSettings, updateSettings };
