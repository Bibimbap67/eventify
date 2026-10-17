import { toMinutes } from "./time.js";
import { LIVE_STATUSES } from "./eventStatus.js";

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
// An approved event between its start and end. The server then refuses edits except overtime
// and completing it (server/utils/eventStatus.js).
export const isRunning = (event, now = Date.now()) =>
  LIVE_STATUSES.includes(event?.status) && Boolean(checkInOpensAt(event) && eventEndsAt(event)) && checkInOpensAt(event) <= now && now < eventEndsAt(event);
// The status to show: "Ongoing" while it runs. Never saved, since the server lists, registers and
// checks in by the saved status.
export const shownStatus = (event) => (isRunning(event) ? "Ongoing" : event.status);

// Exit verification (the staff screen's exit QR) runs from 15 minutes before the event ends until
// 2 hours after. Mirrors server/utils/checkIn.js. "before" | "open" | "closed", or null without an end time.
export function exitPhase(event, now = Date.now()) {
  const end = eventEndsAt(event);
  if (!end) return null;
  if (now < end.getTime() - 15 * 60 * 1000) return "before";
  return now < end.getTime() + 2 * 60 * 60 * 1000 ? "open" : "closed";
}
export const exitOpensAt = (event) => eventEndsAt(event) && new Date(eventEndsAt(event).getTime() - 15 * 60 * 1000);

// The exit QR on the staff screen holds a link to /exit/<eventId>?code=<code>, so a phone's own
// camera app opens it (ExitPage); the in-app scanner (ExitScan.js) reads the same link.
export const exitLink = (eventId, code) => `${window.location.origin}/exit/${encodeURIComponent(eventId)}?code=${code}`;

export function parseExitLink(text) {
  try {
    const url = new URL(text);
    const match = /^\/exit\/([^/]+)\/?$/.exec(url.pathname);
    const code = url.searchParams.get("code");
    return match && code ? { eventId: decodeURIComponent(match[1]), code } : null;
  } catch {
    return null;
  }
}

// Attendance is saved as "Not Checked In", "Checked in" or "Attended" (exit verified, which earns
// the certificate). Older records differ in capital letters, so always read it through here:
// "waiting" | "checked-in" | "attended".
export function attendanceKey(status) {
  const value = String(status || "").toLowerCase();
  if (value === "attended") return "attended";
  if (value === "checked in") return "checked-in";
  return "waiting";
}

// True once staff scanned the ticket (checked in, or attended after the event).
export const isCheckedIn = (registration) => attendanceKey(registration?.attendanceStatus) !== "waiting";

export const opensLabel = (opensAt) => opensAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
