export const EVENT_CATEGORIES = [
  "All",
  "Technology",
  "Academic",
  "Career",
  "Workshop",
  "Seminar",
  "Competition",
  "Organization",
  "Community",
];

export const ORGANIZERS = ["School of IT", "Student Council", "Career Services"];

// One fill per category, shared by event badges and the landing category links.
// `ink` is the text color that reads on it: white on the dark red, ink on the light fills.
export const CATEGORY_COLORS = {
  Technology: { bg: "#5294ff", ink: "#0a0a0a" },
  Academic: { bg: "#c4b5fd", ink: "#0a0a0a" },
  Career: { bg: "#86efac", ink: "#0a0a0a" },
  Workshop: { bg: "#ffa94d", ink: "#0a0a0a" },
  Seminar: { bg: "#5eead4", ink: "#0a0a0a" },
  Competition: { bg: "#c81e1e", ink: "#ffffff" },
  Organization: { bg: "#f9a8d4", ink: "#0a0a0a" },
  Community: { bg: "#ffd93d", ink: "#0a0a0a" },
};

export const categoryColor = (category) => CATEGORY_COLORS[category] || { bg: "#ffffff", ink: "#0a0a0a" };

const BANNERS = ["#5294ff", "#ffd93d", "#c4b5fd", "#86efac", "#ffa94d", "#5eead4", "#f9a8d4"];

// An event's banner color: the same on its card and in the schedule, and never the
// same as its category badge, so the badge always stands out from the band behind it.
export function eventBanner(event) {
  const choices = BANNERS.filter((color) => color !== categoryColor(event?.category).bg);
  const key = String(event?.id || event?.title || "");
  const hash = [...key].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0);
  return choices[hash % choices.length];
}
