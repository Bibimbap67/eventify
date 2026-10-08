import React from "react";
import { useNavigate } from "react-router-dom";
import { useEventContext } from "../context/EventContext.js";
import Icon from "./Icon.js";

// Top-band colors. Cards cycle through them by position so neighbours never match.
const CARD_ACCENTS = [
  "var(--color-pink)",
  "var(--color-sky)",
  "var(--color-yellow)",
  "var(--color-violet)",
  "var(--color-mint)",
];

export default function EventCard({ event, accentIndex }) {
  const navigate = useNavigate();
  const accent = accentIndex === undefined ? event.accent : CARD_ACCENTS[accentIndex % CARD_ACCENTS.length];
  const { isEventRegistered } = useEventContext();
  const eventPath = "/events/" + event.id;

  const capacity = event.capacity || 500;
  const registered = event.registered || 0;
  const pct = Math.min(100, Math.round((registered / capacity) * 100));
  const isRegistered = Boolean(isEventRegistered(event.id));

  let capacityColor = "var(--color-blue)";
  let capacityBadge = "Spots Available";
  if (pct >= 85) {
    capacityColor = "var(--color-pink)";
    capacityBadge = "Almost Full";
  } else if (pct >= 60) {
    capacityColor = "var(--color-yellow)";
    capacityBadge = "Filling Fast";
  }

  const handleCardClick = () => {
    navigate(eventPath);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(eventPath);
    }
  };

  return (
    <article
      className="event-card"
      style={{ "--accent": accent }}
      onClick={handleCardClick}
      aria-label={`View event details for ${event.title}`}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="event-card__accent" />
      <div className="event-card__body">
        <div className="event-card__top">
          <div className="event-card__badges-group">
            <span className="event-card__badge">{event.category || event.status}</span>
            {isRegistered && <span className="event-card__reg-tag">✓ REGISTERED</span>}
          </div>
          <span className="event-card__arrow" aria-hidden="true"><Icon name="arrow" size={18} /></span>
        </div>

        <h3 className="event-card__title">{event.title}</h3>
        <p className="event-card__desc">{event.description}</p>
        {event.speakers?.length > 0 && (
          <p className="event-card__speakers">
            <strong>Speakers</strong>
            {event.speakers.slice(0, 2).map((speaker) => speaker.name).filter(Boolean).join(" · ")}
            {event.speakers.length > 2 && ` +${event.speakers.length - 2}`}
          </p>
        )}

        {/* Mini Capacity Bar on the Card */}
        <div className="event-card__capacity">
          <div className="event-card__cap-head">
            <span className="event-card__cap-label">Capacity ({capacityBadge})</span>
            <span className="event-card__cap-count">
              <b>{registered}</b> / {capacity}
            </span>
          </div>
          <div className="event-card__cap-track">
            <div
              className="event-card__cap-bar"
              style={{ width: `${pct}%`, backgroundColor: capacityColor }}
            />
          </div>
        </div>

        <div className="event-card__meta">
          <span>
            <Icon name="calendar" size={14} /> {event.date}
          </span>
          <span>
            <Icon name="pin" size={14} /> {event.location.split("·")[0]}
          </span>
        </div>
        <span className="event-card__action">View event details <Icon name="arrow" size={14} /></span>
      </div>
    </article>
  );
}