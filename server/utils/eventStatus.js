// Event status words in one place. Every event is saved with Title Case words, whoever made
// it. How the app shows them is in src/data/eventStatus.js.
const { checkInOpensAt, eventEndsAt } = require("./checkIn");

// Statuses anyone may see. The staff check-in desk lists these events too.
const PUBLIC_EVENT_STATUS = ["Registration Open", "Published", "Approved", "Completed"];
// Statuses that accept new registrations.
const OPEN_EVENT_STATUS = ["Registration Open", "Published"];
// The check-in desk refuses scans for these.
const CLOSED_EVENT_STATUS = ["Completed", "Cancelled", "Rejected"];
// Statuses of an event that is approved and still running or about to.
const LIVE_EVENT_STATUS = ["Registration Open", "Published", "Approved", "Registration Closed", "Ongoing"];

// Status changes a manager may make on their own event without an admin. Completed events are
// public, so only an approved event, or an archived one going back to Completed, may become
// Completed. Cancelling is always theirs, and so is archiving a finished event.
function managerMayChangeStatus(event, to) {
  if (to === "Cancelled") return true;
  if (to === "Completed") {
    return LIVE_EVENT_STATUS.includes(event.status) || (event.status === "Archived" && (event.archivedFrom || "Completed") === "Completed");
  }
  return to === "Archived" && ["Completed", "Cancelled"].includes(event.status);
}

// An approved event between its start and end time. Mirrored in src/data/checkIn.js.
function isRunning(event, now = Date.now()) {
  const start = checkInOpensAt(event);
  const end = eventEndsAt(event);
  return LIVE_EVENT_STATUS.includes(event?.status) && Boolean(start && end) && start <= now && now < end;
}

module.exports = { PUBLIC_EVENT_STATUS, OPEN_EVENT_STATUS, CLOSED_EVENT_STATUS, LIVE_EVENT_STATUS, managerMayChangeStatus, isRunning };
