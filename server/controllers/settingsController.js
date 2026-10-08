const { Settings } = require("../models/records");

const SETTINGS_ID = "global";

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
  const { _id, id, __v, createdAt, updatedAt, ...values } = req.body || {};
  const doc = (await Settings.findById(SETTINGS_ID)) || new Settings({ _id: SETTINGS_ID });
  doc.overwrite({ ...values, _id: SETTINGS_ID, createdAt: doc.createdAt });
  await doc.save();
  res.json({ settings: toSettings(doc) });
};

module.exports = { getSettings, updateSettings };
