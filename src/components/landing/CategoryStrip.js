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

// Every category in one still grid, so a visitor in a hurry can spot theirs at a glance.
// Each link wears its category color, the same one its event badges use.
export default function CategoryStrip({ categories }) {
  return (
    <section className="landing-categories" id="browse-categories" aria-labelledby="browse-categories-title">
      <div className="landing-categories__inner">
        <h2 className="landing-label" id="browse-categories-title">Browse by category</h2>
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
      </div>
    </section>
  );
}
