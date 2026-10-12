import { toMinutes } from "./time.js";

// An event's start or end ("startTime" | "endTime") on its date ("YYYY-MM-DD"), in local time.
// Mirrors server/utils/checkIn.js, which enforces both. Null when the event has no readable time.
function eventTime(event, field) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event?.date || "");
  const minutes = toMinutes(event?.[field]);
  if (!date || minutes === null) return null;
  return new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]), Math.floor(minutes / 60), minutes % 60);
}

// When check-in opens: the event's start. Without one, check-in is not time-gated.
export const checkInOpensAt = (event) => eventTime(event, "startTime");
// When the server marks the event Completed, unless the manager adds overtime first.
export const eventEndsAt = (event) => eventTime(event, "endTime");

// Attendance is saved as "Not Checked In", "Checked in" or "Attended". Older records differ in
// capital letters, so always read it through here: "waiting" | "checked-in" | "attended".
export function attendanceKey(status) {
  const value = String(status || "").toLowerCase();
  if (value === "attended") return "attended";
  if (value === "checked in") return "checked-in";
  return "waiting";
}

// True once staff scanned the ticket (checked in, or attended after the event).
export const isCheckedIn = (registration) => attendanceKey(registration?.attendanceStatus) !== "waiting";

export const opensLabel = (opensAt) => opensAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
