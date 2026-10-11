import { Avatar, Style } from "@dicebear/core";
import lorelei from "@dicebear/styles/lorelei.json";

const style = new Style(lorelei);
const drawn = new Map();

// A DiceBear Lorelei face on white, as an <img> src. One seed always draws the same face, so
// seeding with an account id gives every user their own avatar on every screen, with nothing stored.
export function avatarUri(seed) {
  const key = String(seed || "eventify");
  if (!drawn.has(key)) drawn.set(key, new Avatar(style, { seed: key, backgroundColor: "#ffffff" }).toDataUri());
  return drawn.get(key);
}
