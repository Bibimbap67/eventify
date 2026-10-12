// Certificates are made here, by the server, never by a browser. Every detail comes from the
// event and the registration, so nobody can write their own name, event or hours on one.
const crypto = require("crypto");
const { Event, Registration, Certificate } = require("../models/records");

const CAMPUS = "National University - Mall of Asia";
const SIGNATORY = { signatoryName: "Dr. Ronald Reyes", signatoryRole: "Dean, School of Information Technology" };
// No 0/O or 1/I, so a credential ID is easy to read out and type. 32 letters: no bias from % 32.
const ID_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const code = (length) => [...crypto.randomBytes(length)].map((byte) => ID_LETTERS[byte % 32]).join("");
const minutes = (time) => {
  const [hours, mins] = String(time || "").split(":").map(Number);
  return hours * 60 + mins;
};

// The event's length in whole hours ("14:00" to "17:00" is 3), at least 1.
function hoursEarned(event) {
  const hours = Math.max(1, Math.round((minutes(event.endTime) - minutes(event.startTime)) / 60) || 1);
  return `${hours} Continuing Professional Development Hour${hours === 1 ? "" : "s"}`;
}

// Issues the missing certificates for these events: one for each confirmed ticket marked
// Attended on a Completed event. Safe to call more than once.
async function issueCertificates(eventIds) {
  if (!eventIds.length) return;
  const events = await Event.find({ _id: { $in: [...new Set(eventIds)] }, status: "Completed" });
  for (const event of events) {
    const [attended, issued] = await Promise.all([
      Registration.find({ eventId: event._id, status: "Confirmed", attendanceStatus: "Attended", userId: { $type: "string" } }),
      Certificate.distinct("userId", { eventId: event._id }),
    ]);
    const now = new Date();
    for (const registration of attended.filter((item) => !issued.includes(item.userId))) {
      await Certificate.create({
        _id: `cert-${registration._id}`,
        userId: registration.userId,
        eventId: event._id,
        eventTitle: event.title,
        recipientName: registration.name || "Attendee",
        credentialId: `CERT-NU-${now.getFullYear()}-${code(8)}`,
        issueDate: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        // The office or group that ran the event, then the campus (the certificate prints one per line).
        organizer: [event.organizer, CAMPUS].filter(Boolean).join(" · "),
        hoursEarned: hoursEarned(event),
        status: "Issued",
        ...SIGNATORY,
      }).catch((err) => {
        // Two saves can finish at the same moment; the database keeps one certificate per person per event.
        if (err.code !== 11000) throw err;
      });
    }
  }
}

module.exports = { issueCertificates };
