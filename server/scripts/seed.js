// Demo data for the presentation. Run from /server: npm run seed
//
// Wipes every event and everything attached to it (registrations, certificates, feedback,
// sessions, announcements, notifications), the venues and the audit log, and removes every
// account that is not in the list below. Admin accounts are never removed. Then it adds:
//   15 accounts: the premade admin (SEED_ADMIN_EMAIL), 3 event managers, 1 check-in staff,
//                10 students. The admin keeps SEED_ADMIN_PASSWORD; every other account signs in
//                with its first name + SEED_PASSWORD_SUFFIX from server/.env (e.g. "Juan" + "@12345").
//   20 completed event workflows: manager proposal -> admin approval (audit log) ->
//                registrations -> check-in -> completed -> feedback -> certificates.
//                The 4 oldest are already archived, ready to restore in the demo.
//    4 active events: a pending proposal, two open for registration, one happening today.
// Dates are relative to the day it runs, and the same "random" values come out every time,
// so it is safe to run again, e.g. on the morning of the presentation.
require("dotenv").config({ quiet: true });
const assert = require("assert/strict");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const {
  Event, Registration, Certificate, Notification, Session, Announcement, Feedback, Venue, AuditLog,
} = require("../models/records");
const { seatId } = require("../utils/seating");
const { formatTime } = require("../utils/checkIn");

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to replace data with demo data in production.");
  process.exit(1);
}
const missing = ["SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD", "SEED_PASSWORD_SUFFIX"].filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Set ${missing.join(", ")} in server/.env first (see the README).`);
  process.exit(1);
}

// ---- accounts -------------------------------------------------------------------

const CCIT = "College of Computing and Information Technologies";
const ADMIN = { name: "Maria Teresa Villanueva", email: process.env.SEED_ADMIN_EMAIL.toLowerCase(), role: "admin", phone: "0917 803 2214" };
const MANAGERS = {
  it: { name: "Mark Anthony Dizon", email: "mark.dizon@nu-moa.edu.ph", organizer: "School of IT", phone: "0918 274 5530" },
  council: { name: "Kristine Joy Mendoza", email: "kristine.mendoza@nu-moa.edu.ph", organizer: "Student Council", phone: "0927 615 0938" },
  career: { name: "Paolo Miguel Bautista", email: "paolo.bautista@nu-moa.edu.ph", organizer: "Career Services", phone: "0939 402 7716" },
};
const STAFF = { name: "Rodel Castillo", email: "rodel.castillo@nu-moa.edu.ph", phone: "0945 330 1287" };
const IT_MWA = "BS Information Technology - Mobile and Web Applications";
const IT_NS = "BS Information Technology - Network and Security";
const CS_SE = "BS Computer Science - Software Engineering";
const CS_ML = "BS Computer Science - Machine Learning";
// [name, email user, student ID, program, year level, phone]
const STUDENTS = [
  ["Juan Carlos Reyes", "juancarlos.reyes", "2023-1045821", IT_MWA, "3rd Year", "0917 552 0143"],
  ["Andrea Nicole Santos", "andrea.santos", "2022-1038764", CS_SE, "4th Year", "0920 318 6672"],
  ["Joshua Miguel Garcia", "joshua.garcia", "2024-1052197", IT_NS, "2nd Year", "0915 274 9035"],
  ["Princess Mae Aquino", "princess.aquino", "2023-1047350", CS_ML, "3rd Year", "0961 845 2210"],
  ["Christian Paul Ramos", "christian.ramos", "2025-1060318", IT_MWA, "1st Year", "0908 637 4419"],
  ["Bea Patricia Navarro", "bea.navarro", "2022-1036642", IT_NS, "4th Year", "0926 190 3384"],
  ["Kenneth Lloyd Fernandez", "kenneth.fernandez", "2024-1053986", CS_SE, "2nd Year", "0955 712 6047"],
  ["Angelica Rose Torres", "angelica.torres", "2023-1046075", IT_MWA, "3rd Year", "0917 409 8852"],
  ["Gabriel Luis Mercado", "gabriel.mercado", "2025-1061742", CS_ML, "1st Year", "0999 263 5170"],
  ["Samantha Claire Lopez", "samantha.lopez", "2024-1050839", IT_NS, "2nd Year", "0936 584 1923"],
].map(([name, user, studentId, program, yearLevel, phone]) => ({
  name, email: `${user}@students.nu-moa.edu.ph`, studentId, program, department: CCIT, yearLevel, phone,
}));

// ---- venues and events -----------------------------------------------------------

const VENUES = {
  auditorium: ["NU MOA Auditorium", "Main Building, 4th Floor", 250],
  mph: ["Multipurpose Hall", "Main Building, Ground Floor", 150],
  lab501: ["Computer Laboratory 501", "Main Building, 5th Floor", 40],
  lab502: ["Computer Laboratory 502", "Main Building, 5th Floor", 40],
  hub: ["Innovation Hub", "Main Building, 6th Floor", 60],
  function: ["Function Room A", "Main Building, 3rd Floor", 80],
};
const CARLO = ["Engr. Carlo Santiago", "Instructor, School of IT", "Speaker"];
const ANDREA = ["Dr. Andrea Lim", "Associate Professor, School of IT", "Speaker"];
const JEROME = ["Jerome Tan", "Security Analyst, Bantay Cyber Labs", "Guest speaker"];
const GRACE = ["Grace Villareal", "Talent Acquisition Lead, Northpoint Solutions", "Guest speaker"];
const DENNIS = ["Engr. Dennis Uy", "Cloud Engineer, Sinag Cloud", "Guest speaker"];
const CAMILLE = ["Camille Ocampo", "Co-founder, Hiraya Labs", "Guest speaker"];

// [title, category, manager, venue, day (negative = days ago), start, end, description, speakers]
const COMPLETED = [
  ["Git and GitHub Crash Course", "Workshop", "it", "lab501", -238, "13:00", "16:00", "Hands-on version control: commits, branches, pull requests and fixing merge conflicts as a team.", [CARLO]],
  ["Cybersecurity Awareness Seminar", "Seminar", "it", "auditorium", -224, "09:00", "12:00", "How phishing, weak passwords and public Wi-Fi put students at risk, and the habits that keep accounts safe.", [JEROME, ["Atty. Liza Moreno", "Data Privacy Officer, NU MOA", "Guest speaker"]]],
  ["Valorant Campus Cup: Grand Finals", "Competition", "council", "mph", -210, "13:00", "18:00", "The top four student teams play for the campus title, with live casting on the big screen.", [["Nico Alcantara", "Shoutcaster", "Guest speaker"]]],
  ["Resume and LinkedIn Clinic", "Career", "career", "function", -196, "10:00", "12:00", "One-on-one reviews of student resumes and LinkedIn profiles with HR recruiters.", [GRACE]],
  ["UI/UX Design Workshop with Figma", "Workshop", "it", "lab502", -182, "13:00", "17:00", "From wireframes to a clickable prototype: auto layout, components and quick usability tests.", [["Bianca Robles", "Product Designer, Lakbay Apps", "Guest speaker"]]],
  ["Intro to Cloud Computing", "Technology", "it", "hub", -168, "09:00", "12:00", "What the cloud is, the main service models, and deploying a first web app on a free tier.", [DENNIS]],
  ["Women in Tech Forum", "Seminar", "council", "auditorium", -154, "14:00", "17:00", "Filipina engineers and founders share how they got into tech and answer students' questions.", [ANDREA, CAMILLE]],
  ["Data Analytics with Python Bootcamp", "Workshop", "it", "lab501", -140, "08:00", "17:00", "A full-day bootcamp on pandas, cleaning messy data and charts that answer real questions.", [CARLO]],
  ["IT Career Fair 2026", "Career", "career", "mph", -126, "09:00", "16:00", "Partner companies hiring interns and junior developers, with initial interviews on the spot.", []],
  ["Capstone Project Orientation", "Academic", "it", "auditorium", -112, "10:00", "12:00", "Timeline, panel guidelines and topic approval for this year's capstone projects.", [["Dr. Ronald Reyes", "Dean, School of Information Technology", "Speaker"]]],
  ["Capture the Flag: Ethical Hacking Challenge", "Competition", "it", "lab502", -98, "09:00", "17:00", "Teams solve web, cryptography and forensics puzzles on a safe, sandboxed network.", [JEROME]],
  ["Mobile App Development with Flutter", "Workshop", "it", "lab501", -84, "13:00", "17:00", "Build and run a cross-platform app, from layout widgets to calling a REST API.", [["Paul Navarro", "Mobile Developer, Lakbay Apps", "Guest speaker"]]],
  ["Tech Talk: AI in Philippine Industries", "Technology", "career", "auditorium", -70, "14:00", "16:30", "How local banks, BPOs and startups use AI today, and the skills they look for in graduates.", [["Dr. Miguel Santos", "Head of Data Science, Kalye Analytics", "Guest speaker"]]],
  ["Networking Lab: Cisco Packet Tracer", "Academic", "it", "lab502", -63, "09:00", "12:00", "Design, configure and troubleshoot a small campus network with VLANs and routing.", [["Engr. Ramon Cruz", "Network Instructor, School of IT", "Speaker"]]],
  ["Code for Community Hackathon", "Competition", "council", "hub", -56, "08:00", "20:00", "A one-day hackathon building tools for barangay services, judged by faculty and partner mentors.", [CAMILLE]],
  ["Mock Technical Interviews", "Career", "career", "function", -42, "13:00", "17:00", "Practice coding and system-design interviews with engineers, with feedback on the spot.", [GRACE]],
  ["Agile and Scrum Essentials", "Seminar", "it", "function", -35, "09:00", "12:00", "Sprints, stand-ups and user stories, practised in a short team simulation.", [["Ma. Lourdes Garcia", "Scrum Master, Northpoint Solutions", "Guest speaker"]]],
  ["Database Design with MongoDB", "Workshop", "it", "lab501", -28, "13:00", "16:00", "Modeling documents, indexes and queries for a real student-records app.", [CARLO]],
  ["Tech4Good: Digital Literacy Outreach", "Community", "council", "hub", -21, "08:00", "12:00", "Student volunteers teach senior citizens from nearby barangays to use e-wallets and spot online scams.", []],
  ["Research Colloquium: Student Theses in Computing", "Academic", "it", "auditorium", -12, "09:00", "15:00", "Graduating students present their thesis findings to faculty panels and fellow students.", [ANDREA]],
];
const ARCHIVED = 4; // the oldest completed events start in the archive

// [title, category, manager, venue, day, start, end, description, speakers, status, preparation, registrants]
const ACTIVE = [
  ["Game Development Jam 2026", "Competition", "council", "hub", 30, "09:00", "18:00", "A 9-hour game jam: form a team, get the theme at 9 AM, and ship a playable game by 6 PM.", [], "Pending", "Needs attention", 0],
  ["Intro to Docker and Containers", "Workshop", "it", "lab502", 18, "13:00", "16:00", "Package an app in a container, run it anywhere, and compose a multi-service setup.", [DENNIS], "Registration Open", "In progress", 3],
  ["Career Talk: Life as a Software Engineer", "Career", "career", "function", 6, "14:00", "16:00", "NU MOA alumni talk about their first years in the industry, then take questions.", [["Joshua Ramirez", "Software Engineer, Northpoint Solutions", "Guest speaker"], ["Patricia Gomez", "QA Engineer, Kalye Analytics", "Guest speaker"]], "Registration Open", "On track", 6],
  ["IT Week Opening: Student Tech Exhibit", "Organization", "council", "mph", 0, "08:00", "20:00", "Booths from every IT and CS section showing class projects, games and capstone prototypes.", [], "Registration Open", "Ready", 8],
];
const REQUIREMENTS = {
  Workshop: "Lab PCs are provided. Bring a USB drive for your files.",
  Competition: "Join as a team of 3 to 5 students.",
};
const RESERVED_VENUES = ["lab501", "lab502", "function"]; // numbered lab PCs and seats
const COMMENTS = [
  "Clear explanations and good pacing. I learned a lot.",
  "The hands-on part was the best. Please give more time for the exercises next time.",
  "The speakers were engaging and answered all our questions.",
  "The room was a bit cold, but the content was worth it.",
  "Well organized and it started on time. Thank you, SIT!",
  "I'd love a follow-up session on more advanced topics.",
  "Check-in at the door was fast with the QR ticket.",
  "Practical skills we can use for our capstone project.",
  "A little long, but very informative.",
  "The sound system had problems at the start. Otherwise great.",
];
const CAMPUS = "National University - Mall of Asia";

// ---- helpers ----------------------------------------------------------------------

// Seeded random numbers (mulberry32), so every run produces the same demo data.
let seed = 20261011;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (list) => list[Math.floor(rand() * list.length)];
const shuffled = (list) => list.map((item) => [rand(), item]).sort((a, b) => a[0] - b[0]).map(([, item]) => item);
const code = (length) => Array.from({ length }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand() * 32)]).join("");

const DAY = 864e5;
const noon = new Date();
noon.setHours(12, 0, 0, 0);
const day = (offset) => new Date(noon.getTime() + offset * DAY);
const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const at = (isoDay, time) => new Date(`${isoDay}T${time}:00`);
const label = (isoDay, options) => new Date(`${isoDay}T12:00:00`).toLocaleDateString("en-US", options);
const clock = (date) => date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const stamps = (date) => ({ createdAt: date, updatedAt: date });
// Demo sign-in, easy to type during the presentation: first name + the suffix in server/.env.
const passwordOf = (account) => `${account.name.split(" ")[0]}${process.env.SEED_PASSWORD_SUFFIX}`;

async function saveAccount(account, role, password, joined) {
  const user = (await User.findOne({ email: account.email })) || new User({ email: account.email });
  Object.assign(user, {
    name: account.name, role, status: "active", managerId: null, password, // hashed by the model
    studentId: account.studentId || "", department: account.department || "", program: account.program || "",
    yearLevel: account.yearLevel || "", phone: account.phone || "",
  });
  await user.save();
  if (joined) await User.collection.updateOne({ _id: user._id }, { $set: { createdAt: joined } });
  return user;
}

// ---- run -------------------------------------------------------------------------

async function run() {
  await connectDB();
  const keep = [ADMIN, ...Object.values(MANAGERS), STAFF, ...STUDENTS].map((account) => account.email);
  const models = [Event, Registration, Certificate, Notification, Session, Announcement, Feedback, Venue, AuditLog];
  const removedUsers = await User.deleteMany({ role: { $ne: "admin" }, email: { $nin: keep } });
  const removed = await Promise.all(models.map((model) => model.deleteMany({})));
  console.log(`Removed ${removedUsers.deletedCount} other accounts and ${removed.reduce((sum, r) => sum + r.deletedCount, 0)} old records.`);
  await Promise.all(models.map((model) => model.createIndexes())); // unique seats/certificates catch seed mistakes

  const admin = await saveAccount(ADMIN, "admin", process.env.SEED_ADMIN_PASSWORD);
  const managers = {};
  for (const [key, account] of Object.entries(MANAGERS)) {
    managers[key] = await saveAccount(account, "manager", passwordOf(account), day(-262));
  }
  const staff = await saveAccount(STAFF, "staff", passwordOf(STAFF), day(-262));
  const students = [];
  for (const account of STUDENTS) {
    students.push(await saveAccount(account, "user", passwordOf(account), day(-between(250, 420))));
  }

  const venues = Object.entries(VENUES).map(([key, [name, location, capacity]]) => ({ _id: `venue-${key}`, name, location, capacity, ...stamps(day(-300)) }));
  const rows = { events: [], registrations: [], certificates: [], feedback: [], notifications: [], sessions: [], announcements: [], logs: [] };
  const log = (action, when, entry) => rows.logs.push({
    _id: `log-seed-${rows.logs.length + 1}`, action, admin: admin.name, actorId: admin.id, actorRole: "admin",
    actorEmail: admin.email, outcome: "success", ...entry, ...stamps(when),
  });
  [...Object.values(managers), staff].forEach((user) => log("Created user", day(-262), {
    targetType: "user", targetId: user.id, record: `${user.name} (${user.email})`, details: { role: user.role },
  }));

  function addEvent([title, category, managerKey, venueKey, offset, startTime, endTime, description, speakers], index, status) {
    const date = iso(day(offset));
    const proposed = day(offset - between(21, 35));
    const event = {
      _id: `manager-demo-${String(index + 1).padStart(2, "0")}`,
      scope: "manager", managerId: managers[managerKey].id, title, description, category,
      organizer: MANAGERS[managerKey].organizer, date, startTime, endTime, venue: VENUES[venueKey][0],
      capacity: VENUES[venueKey][2], seating: RESERVED_VENUES.includes(venueKey) ? "reserved" : "free",
      requirements: REQUIREMENTS[category] || "", importantDate: "",
      speakers: speakers.map(([name, role, kind]) => ({ name, role, kind })),
      status, completedAt: null, ...stamps(proposed),
    };
    if (status !== "Pending") {
      log("Approved event", new Date(proposed.getTime() + between(1, 3) * DAY), {
        targetType: "event", targetId: event._id, record: title, details: { from: "Pending", to: "Registration Open" },
      });
    }
    rows.events.push(event);
    return event;
  }

  // One registration, in the shape the React app saves (manager events keep display copies of the event).
  function register(event, student, seatIndex, fields) {
    // 2 to 12 days before the event, and never later than today for upcoming events.
    const registered = new Date(Math.min(at(event.date, "10:00") - between(2, 12) * DAY, noon - between(0, 4) * DAY));
    const registration = {
      _id: `reg-${event._id.slice(-2)}-${student.email.split("@")[0]}`, scope: "manager", userId: student.id,
      eventId: event._id, eventTitle: event.title, name: student.name, email: student.email, studentId: student.studentId,
      date: label(event.date, { month: "short", day: "2-digit", year: "numeric" }).toUpperCase(),
      fullDate: label(event.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      time: `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`, location: event.venue.toUpperCase(),
      status: "Confirmed", attendanceStatus: "Not Checked In", checkedInAt: null,
      registrationDate: iso(registered), ticketCode: `TKT-${between(1000, 9999)}-${event.date.slice(0, 4)}`,
      ticketType: "Student Attendee", seating: event.seating,
      seat: event.seating === "reserved" ? seatId(seatIndex) : null, feedback: null,
      ...stamps(registered), ...fields,
    };
    rows.registrations.push(registration);
    rows.notifications.push({
      _id: `mn-${registration._id}`, scope: "manager", eventId: event._id, message: `New registration: ${student.name}`,
      date: registration.registrationDate, read: event.status !== "Registration Open", ...stamps(registered),
    });
    return registration;
  }

  const checkIn = (event) => {
    const time = new Date(at(event.date, event.startTime).getTime() + between(-15, 20) * 60000);
    return { attendanceStatus: "Checked in", checkedInAt: clock(time), checkedInBy: staff.name };
  };

  COMPLETED.forEach((row, index) => {
    const archived = index < ARCHIVED;
    const event = addEvent(row, index, archived ? "Archived" : "Completed");
    event.preparationStatus = "Closed out";
    event.completedAt = event.date;
    if (archived) {
      Object.assign(event, { archivedFrom: "Completed", archivedAt: iso(day(row[4] + 60)) });
      log("Archived event", at(event.archivedAt, "10:00"), {
        targetType: "event", targetId: event._id, record: event.title, details: { from: "Completed", to: "Archived" },
      });
    }
    const hours = Math.round((at(event.date, event.endTime) - at(event.date, event.startTime)) / 36e5);
    const firstSeat = between(0, 10);
    shuffled(students).slice(0, between(5, 9)).forEach((student, n) => {
      const roll = rand();
      if (roll < 0.08) return register(event, student, firstSeat + n, { status: "Cancelled", seat: null });
      if (roll < 0.2) return register(event, student, firstSeat + n, {}); // registered but never came
      const response = {
        overall: pick([5, 5, 5, 4, 4, 4, 3]), organization: pick([5, 4, 4, 3]), speaker: pick([5, 5, 4, 4]),
        venue: pick([5, 4, 4, 3]), comment: pick(COMMENTS),
      };
      const gaveFeedback = rand() < 0.65;
      const registration = register(event, student, firstSeat + n, {
        ...checkIn(event), attendanceStatus: "Attended", feedback: gaveFeedback ? response : null,
      });
      if (gaveFeedback) {
        const sent = day(row[4] + between(0, 3));
        rows.feedback.push({
          _id: `mf-${registration._id}`, scope: "manager", eventId: event._id, userId: student.id, participant: student.name,
          rating: response.overall, organizationRating: response.organization, speakerRating: response.speaker,
          venueRating: response.venue, comment: response.comment, date: iso(sent), ...stamps(sent),
        });
      }
      rows.certificates.push({
        _id: `cert-${registration._id}`, userId: student.id, eventId: event._id, eventTitle: event.title,
        credentialId: `CERT-NU-${event.date.slice(0, 4)}-${code(8)}`, recipientName: student.name,
        issueDate: label(event.date, { month: "long", day: "numeric", year: "numeric" }), organizer: `${event.organizer} · ${CAMPUS}`,
        hoursEarned: `${hours} Continuing Professional Development Hour${hours === 1 ? "" : "s"}`, status: "Issued",
        signatoryName: "Dr. Ronald Reyes", signatoryRole: "Dean, School of Information Technology",
        ...stamps(at(event.date, event.endTime)),
      });
      if (index >= COMPLETED.length - 2) {
        rows.notifications.push({
          _id: `notif-cert-${registration._id}`, scope: "attendee", userId: student.id, eventId: event._id,
          type: "certificate", title: `Certificate Issued: ${event.title}`,
          message: "Your certificate of participation is ready. View or print it under My Certificates.",
          time: label(event.date, { month: "short", day: "numeric" }), timestamp: at(event.date, event.endTime).toISOString(),
          read: index < COMPLETED.length - 1, link: "/certificates", ...stamps(at(event.date, event.endTime)),
        });
      }
    });
  });

  ACTIVE.forEach((row, index) => {
    const [, , , , , , , , , status, preparationStatus, registrants] = row;
    const event = addEvent(row, COMPLETED.length + index, status);
    event.preparationStatus = preparationStatus;
    const today = row[4] === 0;
    const firstSeat = between(20, 30);
    shuffled(students).slice(0, registrants).forEach((student, n) => {
      const registration = register(event, student, firstSeat + n * 2, today && n < 3 ? checkIn(event) : {});
      rows.notifications.push({
        _id: `notif-reg-${registration._id}`, scope: "attendee", userId: student.id, eventId: event._id,
        type: "registration", title: `Registration Confirmed: ${event.title}`,
        message: `Your ticket pass #${registration.ticketCode} is confirmed. View your schedule or ticket anytime under My Events.`,
        time: label(registration.registrationDate, { month: "short", day: "numeric" }), timestamp: registration.createdAt.toISOString(),
        read: false, link: "/my-events", ...stamps(registration.createdAt),
      });
    });
    if (today) {
      [["Opening program", "Kristine Joy Mendoza", "08:00", "09:00"], ["Capstone prototype showcase", "Dr. Andrea Lim", "09:00", "12:00"],
        ["Game corner and student booths", "SIT Student Council", "13:00", "19:00"], ["Awarding of best booths", "Dr. Ronald Reyes", "19:00", "20:00"]]
        .forEach(([title, speaker, startTime, endTime], n) => rows.sessions.push({
          _id: `ms-demo-${n + 1}`, scope: "manager", eventId: event._id, title, speaker, room: event.venue,
          startTime, endTime, time: `${startTime} - ${endTime}`, ...stamps(day(-5)),
        }));
      rows.announcements.push({
        _id: "ma-demo-1", scope: "manager", eventId: event._id, title: "Booths open at 8:00 AM",
        message: "Have your QR ticket ready at the Multipurpose Hall entrance. Check-in starts when the program opens.",
        status: "Published", publishedAt: day(-1).toISOString(), date: iso(day(-1)), ...stamps(day(-1)),
      });
    }
  });

  await Promise.all([
    Venue.collection.insertMany(venues),
    Event.collection.insertMany(rows.events),
    Registration.collection.insertMany(rows.registrations),
    Certificate.collection.insertMany(rows.certificates),
    Feedback.collection.insertMany(rows.feedback),
    Notification.collection.insertMany(rows.notifications),
    Session.collection.insertMany(rows.sessions),
    Announcement.collection.insertMany(rows.announcements),
    AuditLog.collection.insertMany(rows.logs),
  ]);

  // Self-check: every completed workflow is whole, from approval to certificates.
  const finished = await Event.find({ status: { $in: ["Completed", "Archived"] } }).lean();
  assert.equal(finished.length, 20);
  assert.equal(finished.filter((event) => event.status === "Archived").length, ARCHIVED);
  for (const event of finished) {
    const attended = await Registration.countDocuments({ eventId: event._id, attendanceStatus: "Attended" });
    assert.ok(attended > 0, `${event.title} has no attendees`);
    assert.equal(await Certificate.countDocuments({ eventId: event._id }), attended, event.title);
    assert.ok(await AuditLog.exists({ targetId: event._id, action: "Approved event" }), event.title);
  }
  assert.ok((await User.countDocuments({ status: "active" })) >= 10);

  console.log(`Seeded ${rows.events.length} events (20 completed, ${ARCHIVED} of them archived), ${rows.registrations.length} registrations, `
    + `${rows.certificates.length} certificates, ${rows.feedback.length} feedback responses, ${venues.length} venues.`);
  console.log("\nDemo accounts:");
  [[admin, "SEED_ADMIN_PASSWORD in server/.env"], ...[...Object.values(managers), staff, ...students].map((user) => [user, passwordOf(user)])]
    .forEach(([user, password]) => console.log(`  ${user.role.padEnd(8)} ${user.email.padEnd(44)} ${password}`));
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
