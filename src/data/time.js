// Event times are saved as "14:00" (older events: "2:00 PM") and always shown on a 12-hour
// clock. server/utils/checkIn.js reads them the same way.

// Minutes after midnight, or null when the time can't be read.
export function toMinutes(value) {
  const time = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(String(value || "").trim());
  if (!time) return null;
  let hour = Number(time[1]) % (time[3] ? 12 : 24);
  if (/pm/i.test(time[3] || "")) hour += 12;
  return hour * 60 + Number(time[2]);
}

// "14:00" -> "2:00 PM". Anything unreadable is shown as it is.
export function formatTime(value) {
  const minutes = toMinutes(value);
  if (minutes === null) return String(value || "");
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

// "2:00 PM – 5:00 PM", or one time when the other is missing.
export const timeRange = (start, end, separator = " – ") => [start, end].filter(Boolean).map(formatTime).join(separator);

// Older tickets saved their time as text, e.g. "14:00 - 16:00": shows each 24-hour time in it on the 12-hour clock.
export const formatTimesIn = (text) => String(text || "").replace(/\b\d{1,2}:\d{2}\b(?!\s*[AP]M)/gi, (time) => formatTime(time));

// A saved time moved by some minutes, as "HH:MM", never past 11:59 PM.
export function addMinutes(value, add) {
  const minutes = Math.min(toMinutes(value) + add, 23 * 60 + 59);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
