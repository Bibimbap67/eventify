// Event status words in one place.
//
// Every event is saved with Title Case words ("Registration Open"), whoever made it. Attendee
// pages show the public CAPITALS words (EventContext translates them), and the admin screens
// show the admin words (AdminContext translates them). The server's lists are in
// server/utils/eventStatus.js.

// Saved word -> public word. Any other status stays hidden from attendees.
export const SAVED_TO_PUBLIC = {
  "Registration Open": "REGISTRATION OPEN",
  Published: "REGISTRATION OPEN",
  Approved: "OPENS SOON",
  Completed: "COMPLETED",
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

// An event's status as the admin screens show it.
export const adminStatus = (event) => SAVED_TO_ADMIN[event.status] || event.status;
