import React, { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon.js";
import { useReducedMotion } from "./motion.js";

const CATEGORY_ICONS = {
  Technology: "cpu",
  Academic: "book",
  Career: "briefcase",
  Workshop: "wrench",
  Seminar: "speaker",
  Competition: "trophy",
  Organization: "users",
  Community: "heart",
};

// A slow loop of category links. It pauses on hover and with the Pause button, and turns into
// a plain scrollable row for keyboard users (on focus) and when reduced motion is on.
export default function CategoryMarquee({ categories }) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const moving = !reduced && !keyboardFocus;

  const pills = (copy) => categories.map((category) => (
    <Link
      key={`${copy}-${category}`}
      to={`/events?category=${encodeURIComponent(category)}`}
      className="category-pill landing-pill"
      tabIndex={copy === "copy" ? -1 : undefined}
      aria-hidden={copy === "copy" ? "true" : undefined}
    >
      <Icon name={CATEGORY_ICONS[category] || "calendar"} size={16} />
      {category}
    </Link>
  ));

  const handleBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setKeyboardFocus(false);
  };

  return (
    <section
      className={`landing-marquee${moving ? "" : " is-static"}${paused ? " is-paused" : ""}`}
      id="browse-categories"
      aria-label="Browse events by category"
    >
      <div className="landing-marquee__inner">
        <div className="landing-marquee__head">
          <span className="landing-label">Browse by category</span>
          {!reduced && (
            <button
              type="button"
              className="landing-marquee__toggle"
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
            >
              <Icon name={paused ? "play" : "pause"} size={16} />
              {paused ? "Play" : "Pause"}
            </button>
          )}
        </div>
        <div
          className="landing-marquee__viewport"
          onFocus={(e) => { if (e.target.matches(":focus-visible")) setKeyboardFocus(true); }}
          onBlur={handleBlur}
        >
          <div className="landing-marquee__track">
            {pills("main")}
            {moving && pills("copy")}
          </div>
        </div>
      </div>
    </section>
  );
}
