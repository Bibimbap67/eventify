// When check-in opens: the event's start, read from its date ("YYYY-MM-DD") and start time
// ("14:00" or "2:00 PM"), in this machine's local time. Mirrored in src/data/checkIn.js.
// Returns null when the event has no readable start; check-in is then not time-gated.
function checkInOpensAt(event) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event?.adminDate || event?.date || "");
  const time = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(String(event?.adminStart || event?.startTime || "").trim());
  if (!date || !time) return null;
  let hour = Number(time[1]) % (time[3] ? 12 : 24);
  if (/pm/i.test(time[3] || "")) hour += 12;
  return new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]), hour, Number(time[2]));
}

const opensLabel = (opensAt) => opensAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

module.exports = { checkInOpensAt, opensLabel };
