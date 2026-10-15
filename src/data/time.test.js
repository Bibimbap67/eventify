import { addMinutes, eventsClash, formatTime, formatTimesIn, startSortKey, timeRange, toMinutes } from "./time.js";

test("formats saved times on a 12-hour clock", () => {
  expect(formatTime("00:05")).toBe("12:05 AM");
  expect(formatTime("12:00")).toBe("12:00 PM");
  expect(formatTime("14:30")).toBe("2:30 PM");
  expect(formatTime("2:00 PM")).toBe("2:00 PM");
  expect(formatTime("")).toBe("");
  expect(timeRange("09:00", "17:15")).toBe("9:00 AM – 5:15 PM");
});

test("overtime moves the end and stops at 11:59 PM", () => {
  expect(addMinutes("16:50", 20)).toBe("17:10");
  expect(addMinutes("23:45", 30)).toBe("23:59");
  expect(toMinutes("8:00 PM")).toBe(20 * 60);
});

test("reformats times inside older ticket text", () => {
  expect(formatTimesIn("14:00 - 16:00")).toBe("2:00 PM - 4:00 PM");
  expect(formatTimesIn("2:00 PM - 4:00 PM")).toBe("2:00 PM - 4:00 PM");
});

test("events on the same day clash only when their times overlap", () => {
  const morning = { date: "2026-10-14", startTime: "09:00", endTime: "11:00" };
  expect(eventsClash(morning, { date: "2026-10-14", startTime: "10:00", endTime: "12:00" })).toBe(true);
  expect(eventsClash(morning, { date: "2026-10-14", startTime: "11:00", endTime: "12:00" })).toBe(false);
  expect(eventsClash(morning, { date: "2026-10-15", startTime: "10:00", endTime: "12:00" })).toBe(false);
  expect(eventsClash(morning, { date: "2026-10-14", startTime: "8:00 AM", endTime: "9:30 AM" })).toBe(true);
});

test("sorts by day, then start time", () => {
  const keys = [startSortKey("2026-10-13", "13:00"), startSortKey("2026-10-14", "07:00"), startSortKey("2026-10-13", "7:00 AM")];
  expect(keys.sort()).toEqual([startSortKey("2026-10-13", "07:00"), startSortKey("2026-10-13", "13:00"), startSortKey("2026-10-14", "07:00")]);
});
