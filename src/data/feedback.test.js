import { summarizeFeedback } from "./feedback.js";

const row = (rating, organizationRating, speakerRating, venueRating, comment = "") => ({ rating, organizationRating, speakerRating, venueRating, comment });

test("says so when there is no feedback", () => {
  expect(summarizeFeedback([])).toMatchObject({ count: 0, average: null, best: null, concerns: [], headline: "No feedback yet." });
});

test("turns many responses into one summary", () => {
  const summary = summarizeFeedback([
    row(5, 5, 5, 3), row(5, 4, 5, 3), row(4, 4, 5, 2), row(4, 5, 4, 3), row(2, 3, 4, 1, "Too hot inside"),
  ]);
  expect(summary.count).toBe(5);
  expect(summary.average).toBeCloseTo(4);
  expect(summary.split).toEqual({ positive: 4, neutral: 0, negative: 1 });
  expect([summary.best.label, summary.worst.label]).toEqual(["Speakers", "Venue"]);
  expect(summary.concerns.map((item) => item.comment)).toEqual(["Too hot inside"]);
  expect(summary.headline).toBe("Mostly positive: 4.0/5 from 5 responses. Speakers scored best (4.6), the venue lowest (2.4). 1 person rated it 2★ or lower.");
});

test("skips aspects nobody rated and names no best part when all tie", () => {
  const summary = summarizeFeedback([{ rating: 3 }, { rating: "3" }]);
  expect(summary.aspects).toEqual([]);
  expect(summary.best).toBeNull();
  expect(summary.headline).toBe("Mostly average: 3.0/5 from 2 responses.");
});
