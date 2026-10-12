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

const opensLabel = (opensAt) => opensAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

module.exports = { checkInOpensAt, eventEndsAt, opensLabel, toMinutes, formatTime };
