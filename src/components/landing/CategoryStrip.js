import React from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon.js";
import { categoryColor, categoryIcon } from "../../data/options.js";

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
                <Icon name={categoryIcon(category)} size={16} />
                {category}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
