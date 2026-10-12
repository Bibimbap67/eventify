// When check-in opens: the event's start, read from its date ("YYYY-MM-DD") and start time
// ("14:00" or "2:00 PM"), in local time. Mirrors server/utils/checkIn.js, which enforces it.
// Returns null when the event has no readable start; check-in is then not time-gated.
export function checkInOpensAt(event) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event?.date || "");
  const time = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(String(event?.startTime || "").trim());
  if (!date || !time) return null;
  let hour = Number(time[1]) % (time[3] ? 12 : 24);
  if (/pm/i.test(time[3] || "")) hour += 12;
  return new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]), hour, Number(time[2]));
}

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

export const opensLabel =(opensAt) => opensAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
