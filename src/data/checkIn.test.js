import { exitPhase, parseExitLink } from "./checkIn.js";

test("exit opens 15 minutes before the end and closes 2 hours after", () => {
  const event = { date: "2026-10-15", endTime: "17:00" };
  const at = (time) => new Date(`2026-10-15T${time}:00`).getTime();
  expect(exitPhase(event, at("16:44"))).toBe("before");
  expect(exitPhase(event, at("16:45"))).toBe("open");
  expect(exitPhase(event, at("18:59"))).toBe("open");
  expect(exitPhase(event, at("19:00"))).toBe("closed");
  expect(exitPhase({ date: "2026-10-15" })).toBe(null);
});

test("reads the exit QR link, from any of the app's addresses", () => {
  expect(parseExitLink("https://eventifys.vercel.app/exit/manager-123?code=ab12")).toEqual({ eventId: "manager-123", code: "ab12" });
  expect(parseExitLink("http://localhost:3000/exit/ev%201?code=ff")).toEqual({ eventId: "ev 1", code: "ff" });
  expect(parseExitLink("EVENTIFY-TICKET:0123456789abcdef0123456789abcdef")).toBe(null);
  expect(parseExitLink("https://eventifys.vercel.app/events/manager-123")).toBe(null);
});
