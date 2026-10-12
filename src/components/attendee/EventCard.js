import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEventContext } from "../../context/EventContext.js";
import { CATEGORY_ICONS, categoryColor, categoryIcon, eventBanner } from "../../data/options.js";
import { isCheckedIn } from "../../data/checkIn.js";
import Icon from "../Icon.js";

// Paper bits that fly off the perforation when the stub rips.
const BITS = [
  { top: "18%", "--dx": "-14px", "--dy": "40px" },
  { top: "40%", "--dx": "10px", "--dy": "58px", width: 4, height: 4 },
  { top: "62%", "--dx": "-8px", "--dy": "72px" },
  { top: "82%", "--dx": "14px", "--dy": "46px", width: 5, height: 5 },
];

export default function EventCard({ event }) {
  const navigate = useNavigate();
  const categoryName = event.category || "Event";
  const category = categoryColor(event.category);
  const { isEventRegistered } = useEventContext();
  const eventPath = "/events/" + event.id;
  // Hover rips the stub off, leaving prints a fresh one. The CSS only plays it for mouse users.
  const [stub, setStub] = useState("");

  const capacity = event.capacity || 500;
  const registered = event.registered || 0;
  const spotsLeft = Math.max(0, capacity - registered);
  const registration = isEventRegistered(event.id);
  const isRegistered = Boolean(registration);
  const completed = event.status === "COMPLETED";
  const cancelled = event.status === "CANCELLED";
  const past = completed || cancelled;
  const attended = completed && isCheckedIn(registration);
  // Past events show how attendees rated them (the server adds this to completed events only).
  const rated = completed && event.feedbackCount > 0;
  const canRegister = event.status === "REGISTRATION OPEN" && spotsLeft > 0 && !isRegistered;
  const ctaLabel = isRegistered && !past ? "Your ticket" : canRegister ? "Get ticket" : "View event";

  // One stamp on the stub says where the event stands; without one, the stub shows spots left.
  let stamp = null;
  if (cancelled) stamp = { tone: "cancelled", label: "Cancelled" };
  else if (completed) stamp = isRegistered && !attended ? { tone: "missed", label: "Missed" } : { tone: "done", label: "Done" };
  else if (isRegistered) stamp = { tone: "going", label: "Going" };
  else if (event.status === "OPENS SOON") stamp = { tone: "soon", label: "Soon" };
  else if (spotsLeft === 0) stamp = { tone: "full", label: "Full" };
  const almostFull = spotsLeft / capacity <= 0.15;

  const handleCardClick = () => {
    navigate(eventPath);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(eventPath);
    }
  };

  const tear = () => setStub("is-torn");
  const restore = () => setStub((state) => (state === "is-torn" ? "is-restoring" : state));

  return (
    <article
      className={`event-card${past ? " event-card--past" : ""}${cancelled ? " event-card--cancelled" : ""}${stub ? ` ${stub}` : ""}`}
      style={{ "--accent": past ? "#e7e2d3" : eventBanner(event), "--cat-bg": category.bg, "--cat-ink": category.ink }}
      onClick={handleCardClick}
      onMouseEnter={tear}
      onMouseLeave={restore}
      onFocus={tear}
      onBlur={restore}
      onAnimationEnd={(e) => e.animationName === "event-card-reprint" && setStub("")}
      aria-label={`View event details for ${event.title}, ${stamp ? stamp.label : `${spotsLeft} spots left`}${rated ? `, rated ${event.feedbackAverage.toFixed(1)} out of 5 from ${event.feedbackCount} ${event.feedbackCount === 1 ? "review" : "reviews"}` : ""}`}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="event-card__body">
        <div className="event-card__kicker">
          <span className="event-card__cat" aria-hidden="true">
            <Icon name={categoryIcon(event.category)} size={18} />
          </span>
          <span className="event-card__cat-name">{categoryName}</span>
        </div>
        <h3 className="event-card__title">{event.title}</h3>
        <p className="event-card__place">
          <Icon name="pin" size={15} /> {event.location.split("·")[0]}
          {rated && <span className="event-card__rating"><Icon name="star" size={16} /> {event.feedbackAverage.toFixed(1)}</span>}
        </p>
      </div>

      <div className="event-card__stub" aria-hidden="true">
        <div className="event-card__stub-face event-card__stub-back">
          <span className="event-card__cta"><Icon name="ticket" size={24} /> {ctaLabel} <Icon name="arrow" size={16} /></span>
        </div>
        <div className="event-card__fall">
          <div className="event-card__stub-face event-card__stub-front">
            {/* The ticket punch: a check once registered, an empty hole if they never checked in. */}
            {isRegistered && !cancelled && (
              <span className={`event-card__punch${completed && !attended ? " event-card__punch--empty" : ""}`}>
                {(!completed || attended) && <Icon name="check" size={13} />}
              </span>
            )}
            <span>{event.date.split(",")[0]}</span>
            {event.time && <small>{event.time.split(/\s*[-–]\s*/)[0]}</small>}
            {stamp ? (
              <span className={`event-card__stamp event-card__stamp--${stamp.tone}`}>{stamp.label}</span>
            ) : (
              <span className={`event-card__spots${almostFull ? " event-card__spots--low" : ""}`}>
                <b>{spotsLeft}</b>{almostFull ? "left!" : "left"}
              </span>
            )}
          </div>
        </div>
        {BITS.map((style) => <span key={style.top} className="event-card__bit" style={style} />)}
      </div>
    </article>
  );
}

// What each category icon on the event cards means.
export function CategoryLegend() {
  return (
    <aside className="category-legend" aria-labelledby="category-legend-title">
      <h2 className="category-legend__title" id="category-legend-title">Category key</h2>
      <ul className="category-legend__list">
        {Object.keys(CATEGORY_ICONS).map((category) => {
          const color = categoryColor(category);
          return (
            <li key={category}>
              <span className="event-card__cat event-card__cat--small" style={{ "--cat-bg": color.bg, "--cat-ink": color.ink }} aria-hidden="true">
                <Icon name={categoryIcon(category)} size={15} />
              </span>
              {category}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
