// Events end on their own. Once an event's end time passes, it is marked Completed exactly as
// the manager's "Mark completed" button does: checked-in tickets become Attended and their
// certificates are issued. Managers push the end back with the Overtime buttons first.
// Runs whenever events are listed, so a server that was asleep catches up on its next visit.
const { Event, Registration } = require("../models/records");
const { eventEndsAt } = require("./checkIn");
const { issueCertificates } = require("./certificates");

// Statuses of an event that is still running or about to.
const LIVE_EVENT_STATUS = ["Registration Open", "Published", "Approved", "Registration Closed", "Ongoing"];

const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

async function completeEndedEvents() {
  const now = new Date();
  const candidates = await Event.find({ status: { $in: LIVE_EVENT_STATUS }, date: { $lte: localDate(now) } });
  const ids = candidates.filter((event) => eventEndsAt(event) && eventEndsAt(event) <= now).map((event) => event._id);
  if (!ids.length) return;
  await Registration.updateMany(
    { eventId: { $in: ids }, status: "Confirmed", attendanceStatus: { $in: ["Checked in", "Checked In"] } },
    { $set: { attendanceStatus: "Attended" } }
  );
  await Event.updateMany(
    { _id: { $in: ids }, status: { $in: LIVE_EVENT_STATUS } },
    { $set: { status: "Completed", preparationStatus: "Closed out", completedAt: localDate(now) } }
  );
  await issueCertificates(ids);
}

module.exports = { completeEndedEvents, LIVE_EVENT_STATUS };
