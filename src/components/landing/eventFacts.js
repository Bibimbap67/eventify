const DAY_MS = 24 * 60 * 60 * 1000;

// What a landing poster or list row prints about one event. The date comes from isoDate when
// the event has one; a date that can't be read is left to the caller, without a countdown.
export function eventFacts(event, now = new Date()) {
  const date = new Date(event.isoDate ? `${event.isoDate}T12:00:00` : event.date);
  const valid = !Number.isNaN(date.getTime());
  let countdown = "";
  if (valid) {
    // Both at noon, so a late-evening visit still counts whole days.
    const today = new Date(now);
    date.setHours(12, 0, 0, 0);
    today.setHours(12, 0, 0, 0);
    const days = Math.round((date - today) / DAY_MS);
    if (days === 0) countdown = "Today";
    else if (days === 1) countdown = "Tomorrow";
    else if (days > 1) countdown = `In ${days} days`;
  }

  const left = Math.max(0, (event.capacity || 0) - (event.registered || 0));
  let seats = "";
  if (event.status === "OPENS SOON") seats = "Opens soon";
  else if (event.capacity) seats = left === 0 ? "Full" : `${left.toLocaleString()} ${left === 1 ? "seat" : "seats"} left`;

  return {
    month: valid ? date.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "",
    day: valid ? date.getDate() : "",
    weekday: valid ? date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase() : "",
    countdown,
    seats,
    time: event.time && event.time.trim() !== "-" ? event.time.replace(" - ", "–") : "",
    venue: (event.fullLocation || event.location || "").split("·")[0].trim(),
  };
}
