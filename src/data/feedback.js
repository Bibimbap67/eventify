// Many feedback responses -> one summary. Rows use the manager feedback shape:
// { rating, organizationRating, speakerRating, venueRating, comment, date }.
const ASPECTS = [
  ["organizationRating", "Organization"],
  ["speakerRating", "Speakers"],
  ["venueRating", "Venue"],
];

const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const ratings = (items, key) => items.map((item) => Number(item[key])).filter((value) => value >= 1 && value <= 5);

function mood({ positive, neutral, negative }, count) {
  if (positive / count >= 0.7) return "Mostly positive";
  if (negative / count >= 0.5) return "Mostly negative";
  if (neutral / count >= 0.5) return "Mostly average";
  return "Mixed";
}

export function summarizeFeedback(items) {
  const rated = items.filter((item) => Number(item.rating) >= 1 && Number(item.rating) <= 5);
  const count = rated.length;
  const overall = average(ratings(rated, "rating"));
  const aspects = ASPECTS
    .map(([key, label]) => ({ key, label, average: average(ratings(rated, key)) }))
    .filter((aspect) => aspect.average !== null);
  const ranked = [...aspects].sort((a, b) => b.average - a.average);
  const spread = ranked.length > 1 && ranked[0].average > ranked[ranked.length - 1].average;
  const best = spread ? ranked[0] : null;
  const worst = spread ? ranked[ranked.length - 1] : null;
  const split = {
    positive: rated.filter((item) => Number(item.rating) >= 4).length,
    neutral: rated.filter((item) => Number(item.rating) === 3).length,
    negative: rated.filter((item) => Number(item.rating) <= 2).length,
  };
  const concerns = rated.filter((item) => Number(item.rating) <= 2);

  let headline = "No feedback yet.";
  if (count) {
    headline = `${mood(split, count)}: ${overall.toFixed(1)}/5 from ${count} ${count === 1 ? "response" : "responses"}.`;
    if (best) headline += ` ${best.label} scored best (${best.average.toFixed(1)}), the ${worst.label.toLowerCase()} lowest (${worst.average.toFixed(1)}).`;
    if (concerns.length) headline += ` ${concerns.length} ${concerns.length === 1 ? "person" : "people"} rated it 2★ or lower.`;
  }

  return { count, average: overall, aspects, best, worst, split, concerns, headline };
}
