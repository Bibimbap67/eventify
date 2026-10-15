// Event status words in one place.
//
// Every event is saved with Title Case words ("Registration Open"), whoever made it. Attendee
// pages show the public CAPITALS words (EventContext translates them), and the admin screens
// show the admin words (AdminContext translates them). The server's lists are in
// server/utils/eventStatus.js.

// Saved word -> public word. Any other status stays hidden from attendees. Cancelled events
// only reach attendees who had registered for them (EventContext checks).
export const SAVED_TO_PUBLIC = {
  "Registration Open": "REGISTRATION OPEN",
  Published: "REGISTRATION OPEN",
  Approved: "OPENS SOON",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
};

// Saved word -> admin screen word. Words not listed (Rejected, Archived) show as they are.
const SAVED_TO_ADMIN = {
  "Pending Approval": "Pending",
  Pending: "Pending",
  Approved: "Approved",
  Published: "Published",
  "Registration Open": "Published",
  "Registration Closed": "Published",
  Ongoing: "Published",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

// The admin screen words, in the order the admin filters list them.
export const ADMIN_STATUSES = ["Pending", "Approved", "Published", "Completed", "Rejected", "Cancelled", "Archived"];

// Finished events, which leave the "current" lists.
export const PAST_STATUSES = ["Completed", "Cancelled", "Archived"];

// Approved events still running or about to (saved words). Same list as server/utils/eventStatus.js.
export const LIVE_STATUSES = ["Registration Open", "Published", "Approved", "Registration Closed", "Ongoing"];

// An event as EventContext lists it (public words) that is still to come or running. Finished,
// cancelled and archived events (no longer listed) are not.
export const eventStillOn = (event) => Boolean(event) && !["COMPLETED", "CANCELLED"].includes(event.status);

// An event's status as the admin screens show it.
export const adminStatus = (event) => SAVED_TO_ADMIN[event.status] || event.status;
