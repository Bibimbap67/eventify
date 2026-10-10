import { eventFacts } from "./eventFacts.js";

const now = new Date(2026, 9, 10, 21, 30); // Sat Oct 10 2026, late evening

test("reads the ISO date and counts whole days from today", () => {
  const facts = eventFacts({ isoDate: "2026-10-17" }, now);
  expect([facts.month, facts.day, facts.weekday, facts.countdown]).toEqual(["OCT", 17, "SAT", "In 7 days"]);
  expect(eventFacts({ isoDate: "2026-10-10" }, now).countdown).toBe("Today");
  expect(eventFacts({ isoDate: "2026-10-11" }, now).countdown).toBe("Tomorrow");
  expect(eventFacts({ isoDate: "2026-10-01" }, now).countdown).toBe("");
});

test("leaves an unreadable date to the caller", () => {
  expect(eventFacts({ date: "TBA" }, now)).toMatchObject({ day: "", month: "", countdown: "" });
});

test("prints seats left, full, opens soon, or nothing without a capacity", () => {
  expect(eventFacts({ capacity: 45, registered: 27 }).seats).toBe("18 seats left");
  expect(eventFacts({ capacity: 45, registered: 44 }).seats).toBe("1 seat left");
  expect(eventFacts({ capacity: 45, registered: 50 }).seats).toBe("Full");
  expect(eventFacts({ capacity: 45, status: "OPENS SOON" }).seats).toBe("Opens soon");
  expect(eventFacts({}).seats).toBe("");
});

test("tidies the time range and keeps the first part of the venue", () => {
  expect(eventFacts({ time: "13:00 - 15:00" }).time).toBe("13:00–15:00");
  expect(eventFacts({ time: " - " }).time).toBe("");
  expect(eventFacts({ location: "ROOM 301 · BLDG A" }).venue).toBe("ROOM 301");
  expect(eventFacts({ location: "NU MOA MAIN AUDITORIUM", fullLocation: "NU MOA Main Auditorium" }).venue).toBe("NU MOA Main Auditorium");
});
