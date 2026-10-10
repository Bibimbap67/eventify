import React from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon.js";
import { categoryColor } from "../../data/options.js";

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

// Every category in one still row under the "Coming up" list, so a visitor who didn't find
// their thing can jump straight to it. Each link wears its category color, as its badges do.
export default function CategoryStrip({ categories }) {
  return (
    <nav className="landing-categories" id="browse-categories" aria-labelledby="browse-categories-title">
      <h3 className="landing-categories__title" id="browse-categories-title">Browse by category</h3>
      <ul className="landing-categories__list">
        {categories.map((category) => {
          const color = categoryColor(category);
          return (
            <li key={category}>
              <Link
                to={`/events?category=${encodeURIComponent(category)}`}
                className="category-pill landing-pill"
                style={{ background: color.bg, color: color.ink }}
              >
                <Icon name={CATEGORY_ICONS[category] || "calendar"} size={16} />
                {category}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
