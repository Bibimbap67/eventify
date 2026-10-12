// Event status words in one place. Every event is saved with Title Case words, whoever made
// it. How the app shows them is in src/data/eventStatus.js.

// Statuses anyone may see. The staff check-in desk lists these events too.
const PUBLIC_EVENT_STATUS = ["Registration Open", "Published", "Approved", "Completed"];
// Statuses that accept new registrations.
const OPEN_EVENT_STATUS = ["Registration Open", "Published"];
// The check-in desk refuses scans for these.
const CLOSED_EVENT_STATUS = ["Completed", "Cancelled", "Rejected"];

module.exports = { PUBLIC_EVENT_STATUS, OPEN_EVENT_STATUS, CLOSED_EVENT_STATUS };
