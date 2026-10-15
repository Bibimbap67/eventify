// Event times: "14:00" (or older "2:00 PM") on a "YYYY-MM-DD" date, in Philippine time
// (server.js sets the zone). Mirrored in src/data/checkIn.js and src/data/time.js.

// Minutes after midnight, or null when the time can't be read.
function toMinutes(value) {
  const time = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(String(value || "").trim());
  if (!time) return null;
  let hour = Number(time[1]) % (time[3] ? 12 : 24);
  if (/pm/i.test(time[3] || "")) hour += 12;
  return hour * 60 + Number(time[2]);
}

// "14:00" -> "2:00 PM".
function formatTime(value) {
  const minutes = toMinutes(value);
  if (minutes === null) return String(value || "");
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function eventTime(event, field) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event?.date || "");
  const minutes = toMinutes(event?.[field]);
  if (!date || minutes === null) return null;
  return new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]), Math.floor(minutes / 60), minutes % 60);
}

// When check-in opens: the event's start. Null when the event has no readable start; check-in
// is then not time-gated.
const checkInOpensAt = (event) => eventTime(event, "startTime");
// When the event ends and is marked Completed on its own (utils/autoComplete.js).
const eventEndsAt = (event) => eventTime(event, "endTime");

// Exit verification (the rotating exit QR) runs from 15 minutes before the event ends until
// 2 hours after. Overtime moves the end, so it moves this too. Mirrored in src/data/checkIn.js.
const EXIT_OPENS_BEFORE_MS = 15 * 60 * 1000;
const EXIT_CLOSES_AFTER_MS = 2 * 60 * 60 * 1000;
function exitWindow(event) {
  const end = eventEndsAt(event);
  if (!end) return null;
  return { opensAt: new Date(end.getTime() - EXIT_OPENS_BEFORE_MS), closesAt: new Date(end.getTime() + EXIT_CLOSES_AFTER_MS) };
}
const exitIsOpen = (event, now = Date.now()) => {
  const window = exitWindow(event);
  return Boolean(window) && now >= window.opensAt.getTime() && now < window.closesAt.getTime();
};

const opensLabel = (opensAt) => opensAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

module.exports = { checkInOpensAt, eventEndsAt, exitWindow, exitIsOpen, opensLabel, toMinutes, formatTime };
