// Fills the local eventify DB with faker demo data. Usage: npm --prefix tools/redesign run seed
// Re-runnable: deletes only records whose _id starts with "demo-" and accounts on @demo.eventify.test,
// then recreates them. Run `npm --prefix server run seed` first so the three test accounts exist.
const path = require("path");
const SERVER = path.join(process.argv[2] || path.join(__dirname, "../.."), "server");
const req = (p) => require(path.join(SERVER, p));
req("node_modules/dotenv").config({ path: path.join(SERVER, ".env") });
const { faker } = req("node_modules/@faker-js/faker");
const mongoose = req("node_modules/mongoose");
const connectDB = req("config/db");
const User = req("models/User");
const R = req("models/records");

faker.seed(2026);
const pick = faker.helpers.arrayElement;
const num = (min, max) => faker.datatype.number({ min, max });
const DOMAIN = "demo.eventify.test";
const TODAY = new Date("2026-10-08T12:00:00");
let seq = 0;
const id = (prefix) => `demo-${prefix}-${(++seq).toString(36)}`;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => new Date(TODAY.getTime() + n * 864e5);
const short = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();
const long = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

const VENUES = [
  ["NU MOA Main Auditorium", "Ground Floor, Main Building", 400],
  ["Innovation Hub", "4th Floor, SIT Building", 120],
  ["Computer Lab 3", "3rd Floor, SIT Building", 45],
  ["Multipurpose Hall", "2nd Floor, Annex", 250],
  ["Library Learning Commons", "5th Floor, Main Building", 80],
];
const ORGANIZERS = ["School of IT", "Student Council", "Career Services"];
// [title, category, daysFromToday, status, owner (0 = seeded manager), capacity]
const EVENTS = [
  ["Build Your First AI Agent Workshop", "Workshop", 9, "Registration Open", 0, 45],
  ["NU MOA Hackathon 2026: Code for Community", "Competition", 23, "Registration Open", 0, 120],
  ["Cybersecurity Career Night", "Career", 14, "Registration Open", 1, 250],
  ["UX Research Bootcamp with Figma", "Workshop", 5, "Registration Open", 0, 30],
  ["Cloud Computing Seminar: Serverless in Practice", "Seminar", 30, "Published", 2, 400],
  ["Data Science Research Colloquium", "Academic", 41, "Approved", 0, 80],
  ["Esports Varsity Tryouts", "Organization", 18, "Pending", 1, 60],
  ["Open Source Contribution Sprint", "Technology", 35, "Pending", 0, 45],
  ["Freshie Tech Mixer", "Community", -21, "Completed", 0, 250],
  ["Web Accessibility Seminar", "Seminar", -12, "Completed", 2, 120],
  ["Blockchain Myths and Realities", "Seminar", 12, "Cancelled", 0, 400],
  ["Mobile Game Jam Weekend", "Competition", 50, "Rejected", 1, 80],
];
const COMMENTS = [
  "Very hands-on. I left with something that actually runs.",
  "Great speakers, but the room was too cold.",
  "Loved the Q&A part. Please make it longer next time.",
  "Well organized and started on time.",
  "The slides were hard to read from the back rows.",
  "Would join again. Learned a lot about the industry.",
  "Registration and check-in were quick and painless.",
];

async function run() {
  await connectDB();
  const student = await User.findOne({ email: "student@eventify.com" });
  const manager = await User.findOne({ email: "manager@eventify.com" });
  if (!student || !manager) throw new Error("Run `npm --prefix server run seed` first.");

  // Clear previous demo data.
  const demo = { _id: { $regex: "^demo-" } };
  await Promise.all(Object.values(R).map((Model) => Model.deleteMany(demo)));
  await User.deleteMany({ email: { $regex: `@${DOMAIN.replace(/\./g, "\\.")}$` } });

  // Accounts: 2 extra managers, 30 students. Password for all: Demo@12345
  const person = () => {
    const first = faker.name.firstName();
    const last = faker.name.lastName();
    return { first, last, name: `${first} ${last}`, email: faker.internet.email(first, last, DOMAIN).toLowerCase() };
  };
  const managers = [manager];
  for (let i = 2; i <= 3; i += 1) {
    const p = person();
    managers.push(await User.create({ name: p.name, email: p.email, password: "Demo@12345", role: "manager", managerId: `manager-${i}` }));
  }
  const students = [];
  for (let i = 0; i < 30; i += 1) {
    const p = person();
    students.push(await User.create({
      name: p.name, email: p.email, password: "Demo@12345", role: "user",
      status: i === 29 ? "inactive" : "active",
      studentId: `2024-${num(100000, 199999)}`,
      department: "School of Information Technology",
      program: pick(["BS Information Technology", "BS Computer Science", "BS Information Systems"]),
      yearLevel: pick(["1st Year", "2nd Year", "3rd Year", "4th Year"]),
      phone: faker.phone.number("09## ### ####"),
    }));
  }
  if (!student.studentId) {
    Object.assign(student, { studentId: "2024-104271", department: "School of Information Technology", program: "BS Information Technology", yearLevel: "3rd Year", phone: "0917 555 0142" });
    await student.save();
  }

  const venues = VENUES.map(([name, location, capacity]) => ({ _id: id("venue"), name, location, capacity }));
  await R.Venue.insertMany(venues);

  const events = EVENTS.map(([title, category, days, status, owner, capacity]) => {
    const date = iso(addDays(days));
    const startHour = pick([8, 9, 13, 14]);
    return {
      _id: id("event"), scope: "manager", managerId: managers[owner].managerId,
      title, category, status, capacity, date,
      startTime: `${String(startHour).padStart(2, "0")}:00`,
      endTime: `${String(startHour + pick([2, 3, 4])).padStart(2, "0")}:00`,
      venue: venues.find((v) => v.capacity >= capacity)?.name || venues[0].name,
      organizer: pick(ORGANIZERS),
      description: `${title} brings together students, faculty and industry partners. ${faker.company.catchPhrase()}. Bring your student ID for check-in.`,
      requirements: pick(["Bring a laptop with a charger.", "Student ID required at the door.", "Teams of 3 to 5 members.", ""]),
      importantDate: iso(addDays(days - 3)),
      preparationStatus: status === "Completed" ? "Closed out" : pick(["Needs attention", "On track", "Ready"]),
      completedAt: status === "Completed" ? date : null,
    };
  });
  await R.Event.insertMany(events);

  const sessions = events.filter((e) => !["Rejected", "Cancelled"].includes(e.status)).flatMap((e) => {
    const start = Number(e.startTime.slice(0, 2));
    return [0, 1].map((n) => ({
      _id: id("session"), scope: "manager", eventId: e._id,
      title: n ? `Hands-on: ${faker.hacker.ingverb()} the ${faker.hacker.noun()}` : `Keynote: The future of ${faker.hacker.noun()}s`,
      speaker: `${faker.name.fullName()}, ${faker.company.name()}`,
      room: e.venue, startTime: `${String(start + n).padStart(2, "0")}:00`, endTime: `${String(start + n + 1).padStart(2, "0")}:00`,
    }));
  });
  await R.Session.insertMany(sessions);

  // Registrations: fill open/completed events; the first open event is nearly full, the bootcamp is full.
  const registrations = [];
  const register = (event, user, extra = {}) => {
    const created = faker.date.between(addDays(-30), addDays(-1));
    const reg = {
      _id: id("reg"), scope: "manager", userId: user._id.toString(), eventId: event._id, eventTitle: event.title,
      date: short(event.date), fullDate: long(event.date), time: `${event.startTime} - ${event.endTime}`, location: event.venue.toUpperCase(),
      status: "Confirmed", attendanceStatus: "Not Checked In", checkedInAt: null,
      registrationDate: iso(created), ticketCode: `TKT-${num(1000, 9999)}-2026`,
      seat: `Section ${pick(["A", "B", "C"])} · Row ${num(1, 8)} · Seat ${num(1, 30)}`,
      ticketType: "Student Attendee", name: user.name, email: user.email, studentId: user.studentId, feedback: null,
      ...extra,
    };
    registrations.push(reg);
    return reg;
  };
  const fills = { "UX Research Bootcamp with Figma": 1, "Build Your First AI Agent Workshop": 0.9 };
  events.filter((e) => ["Registration Open", "Published", "Completed"].includes(e.status)).forEach((event) => {
    const share = fills[event.title] ?? faker.datatype.float({ min: 0.25, max: 0.7 });
    const count = Math.min(students.length - 1, Math.round(event.capacity * share));
    faker.helpers.arrayElements(students.slice(0, 29), count).forEach((user) => {
      const completed = event.status === "Completed";
      const roll = faker.datatype.float({ min: 0, max: 1 });
      register(event, user, completed
        ? { attendanceStatus: roll < 0.8 ? "Attended" : "Not Checked In", checkedInAt: roll < 0.8 ? `${event.startTime.slice(0, 2)}:${num(10, 59)} AM` : null }
        : { status: roll < 0.08 ? "Cancelled" : roll < 0.15 ? "Pending" : "Confirmed" });
    });
  });

  // The seeded student: 3 upcoming (one checked in), 2 attended completed events.
  const byTitle = (t) => events.find((e) => e.title === t);
  const mine = [
    register(byTitle("Build Your First AI Agent Workshop"), student),
    register(byTitle("NU MOA Hackathon 2026: Code for Community"), student),
    register(byTitle("Cybersecurity Career Night"), student, { attendanceStatus: "Checked in", checkedInAt: "05:42 PM" }),
    register(byTitle("Freshie Tech Mixer"), student, { attendanceStatus: "Attended", checkedInAt: "09:05 AM" }),
    register(byTitle("Web Accessibility Seminar"), student, { attendanceStatus: "Attended", checkedInAt: "01:12 PM", feedback: { overall: 5, organization: 4, speaker: 5, venue: 4, comment: COMMENTS[0] } }),
  ];
  await R.Registration.insertMany(registrations);

  const certificates = mine.filter((r) => r.attendanceStatus === "Attended").map((r) => {
    const credentialId = `CERT-NU-2026-${num(1000, 9999)}`;
    return {
      _id: id("cert"), userId: r.userId, eventId: r.eventId, eventTitle: r.eventTitle, credentialId,
      organizer: "School of Information Technology · National University MOA", recipientName: student.name,
      issueDate: new Date(`${byTitle(r.eventTitle).date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      hoursEarned: "5 Continuing Professional Development Hours", status: "Issued",
      signatoryName: "Dr. Ronald Reyes", signatoryRole: "Dean, School of Information Technology",
      verificationUrl: `https://nu-moa.edu.ph/verify/${credentialId}`,
    };
  });
  await R.Certificate.insertMany(certificates);

  const feedback = registrations.filter((r) => r.attendanceStatus === "Attended").map((r) => ({
    _id: id("fb"), scope: "manager", eventId: r.eventId, participant: r.name,
    rating: num(3, 5), organizationRating: num(3, 5), speakerRating: num(3, 5), venueRating: num(2, 5),
    comment: pick(COMMENTS), date: iso(faker.date.between(addDays(-20), addDays(-2))),
  }));
  await R.Feedback.insertMany(feedback);

  const announcements = events.filter((e) => ["Registration Open", "Published"].includes(e.status)).flatMap((e, i) => [{
    _id: id("ann"), scope: "manager", eventId: e._id, title: "Venue and check-in reminder",
    message: `Doors open 30 minutes before ${e.startTime} at ${e.venue}. Show your ticket QR at the entrance.`,
    status: "Published", publishedAt: addDays(-2).toISOString(), date: iso(addDays(-2)),
  }, ...(i % 2 ? [] : [{
    _id: id("ann"), scope: "manager", eventId: e._id, title: "Speaker line-up update",
    message: "We are confirming one more industry speaker. Details to follow.", status: "Draft", publishedAt: "", date: iso(TODAY),
  }])]);
  await R.Announcement.insertMany(announcements);

  const sid = student._id.toString();
  const note = (eventId, type, title, message, daysAgo, read) => ({
    _id: id("notif"), scope: "attendee", userId: sid, eventId, type, title, message,
    time: daysAgo ? `${daysAgo}d ago` : "Today", timestamp: addDays(-daysAgo).toISOString(), read, link: "/my-events",
  });
  await R.Notification.insertMany([
    note(mine[2].eventId, "attendance", `Checked In: ${mine[2].eventTitle}`, "Attendance confirmed. Welcome to the event!", 0, false),
    note(mine[0].eventId, "reminder", `Starts soon: ${mine[0].eventTitle}`, "Your event starts in 9 days. Bring your laptop.", 1, false),
    note(mine[4].eventId, "certificate", `Certificate issued: ${mine[4].eventTitle}`, "Your certificate is ready under Certificates.", 10, true),
    note(mine[1].eventId, "registration", `Registration Confirmed: ${mine[1].eventTitle}`, `Your ticket pass #${mine[1].ticketCode} is confirmed.`, 14, true),
    ...registrations.filter((r) => r.eventId === events[0]._id).slice(0, 6).map((r, i) => ({
      _id: id("mnotif"), scope: "manager", eventId: r.eventId, message: `New registration: ${r.name}`, date: iso(addDays(-i)), read: i > 2,
    })),
  ]);

  await R.AuditLog.insertMany(events.slice(0, 6).map((e, i) => ({
    _id: id("audit"), action: pick(["Approved event", "Published event", "Updated venue"]), admin: "Test Admin",
    record: e.title, time: addDays(-i - 1).toLocaleString("en-US"),
  })));

  console.log(`Demo data: ${managers.length - 1} managers, ${students.length} students (password Demo@12345), ${venues.length} venues,`);
  console.log(`  ${events.length} events, ${sessions.length} sessions, ${registrations.length} registrations, ${certificates.length} certificates,`);
  console.log(`  ${feedback.length} feedback, ${announcements.length} announcements. Student test account: ${mine.length} registrations.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
