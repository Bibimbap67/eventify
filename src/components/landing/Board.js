import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon.js";
import Skeleton from "../Skeleton.js";
import { useEventContext } from "../../context/EventContext.js";
import { categoryColor, eventBanner } from "../../data/options.js";
import { eventFacts } from "./eventFacts.js";

// The landing page as a campus bulletin board: the next events pinned up as posters on the
// hero wall (PosterWall), and every upcoming event in one dated list below (ComingUp).

// A blue poster would vanish into the blue hero wall, so those are printed on white.
function posterColor(event) {
  const color = eventBanner(event);
  return color === "#5294ff" ? "#ffffff" : color;
}

// One sentence for screen readers, title first, instead of the poster's visual reading order.
const spokenLabel = (event, facts, registered) =>
  [event.title, event.fullDate || event.date, facts.time, facts.venue, registered ? "You're registered" : facts.seats]
    .filter(Boolean)
    .join(", ");

function DateBlock({ event, facts, className }) {
  return (
    <span className={className}>
      {facts.day ? (
        <>
          <span>{facts.month}</span>
          <b>{facts.day}</b>
          <span>{facts.weekday}</span>
        </>
      ) : (
        <span>{event.date}</span>
      )}
    </span>
  );
}

function Facts({ facts, className }) {
  if (!facts.time && !facts.venue) return null;
  return (
    <span className={className}>
      {facts.time && <span><Icon name="clock" size={16} /> {facts.time}</span>}
      {facts.venue && <span><Icon name="pin" size={16} /> {facts.venue}</span>}
    </span>
  );
}

function Poster({ event, index }) {
  const { isEventRegistered } = useEventContext();
  const registered = Boolean(isEventRegistered(event.id));
  const facts = eventFacts(event);
  const category = categoryColor(event.category);

  return (
    <Link
      to={`/events/${event.id}`}
      className="board-poster"
      style={{ "--poster": posterColor(event), "--i": index }}
      aria-label={spokenLabel(event, facts, registered)}
    >
      <span className="board-poster__tape" />
      <span className="board-poster__head">
        <DateBlock event={event} facts={facts} className="board-poster__date" />
        <span className="board-poster__marks">
          {event.category && (
            <span className="board-poster__cat" style={{ background: category.bg, color: category.ink }}>{event.category}</span>
          )}
          {registered && <span className="board-poster__stamp">Registered</span>}
        </span>
      </span>
      <span className="board-poster__title">{event.title}</span>
      <Facts facts={facts} className="board-poster__facts" />
      <span className="board-poster__foot">
        <b>{facts.seats}</b>
        <span>{facts.countdown}</span>
      </span>
    </Link>
  );
}

// The slap-on sequence plays once per page load; coming back to Home inside the app finds
// the posters already up (the home page is visited too often to replay it every time).
let wallShown = false;

export function PosterWall({ events, loading }) {
  const [entering] = useState(() => !wallShown);
  useEffect(() => {
    wallShown = true;
  }, []);

  // While events load the wall keeps its size, so the hero doesn't jump when the posters land.
  if (loading) return <div className="board-wall board-wall--loading" aria-hidden="true" />;

  if (events.length === 0) {
    return (
      <div className="board-wall">
        <p className="board-poster board-poster--note">
          <span className="board-poster__tape" aria-hidden="true" />
          <b>Nothing posted yet.</b>
          New events show up here as soon as they're published.
        </p>
      </div>
    );
  }

  return (
    <ul className={`board-wall${entering ? " is-entering" : ""}`} aria-label="Next up">
      {events.map((event, index) => (
        <li key={event.id}>
          <Poster event={event} index={index} />
        </li>
      ))}
    </ul>
  );
}

function AgendaRow({ event, match }) {
  const { isEventRegistered } = useEventContext();
  const registered = Boolean(isEventRegistered(event.id));
  const facts = eventFacts(event);
  const category = categoryColor(event.category);

  return (
    <li>
      <Link
        to={`/events/${event.id}`}
        className="agenda-row"
        style={{ "--poster": eventBanner(event) }}
        aria-label={spokenLabel(event, facts, registered) + (match ? ", matches your program" : "")}
      >
        <DateBlock event={event} facts={facts} className="agenda-row__date" />
        <span className="agenda-row__main">
          <span className="agenda-row__title">{event.title}</span>
          <Facts facts={facts} className="agenda-row__facts" />
        </span>
        <span className="agenda-row__tags">
          {event.category && (
            <span className="agenda-row__cat" style={{ background: category.bg, color: category.ink }}>{event.category}</span>
          )}
          {match && <span className="agenda-row__match">For your program</span>}
        </span>
        <span className="agenda-row__seats">
          {registered ? <b className="agenda-row__reg"><Icon name="check" size={16} /> Registered</b> : <b>{facts.seats}</b>}
          <span>{facts.countdown}</span>
        </span>
        <Icon name="arrow" size={20} className="agenda-row__arrow" />
      </Link>
    </li>
  );
}

// Every upcoming event, soonest first, as one sheet of rows. `children` goes under the list.
export function ComingUp({ events, loading, total, openCount, matchesProgram, children }) {
  return (
    <section className="board-agenda" aria-labelledby="coming-up-title">
      <div className="home-section__inner">
        <div className="board-agenda__head">
          <div>
            <h2 id="coming-up-title">Coming up</h2>
            {!loading && total > 0 && (
              <p>
                {total} upcoming {total === 1 ? "event" : "events"}, {openCount} open for registration.
              </p>
            )}
          </div>
          <div className="board-agenda__links">
            <Link to="/calendar"><Icon name="calendar-days" size={16} /> Calendar</Link>
            <Link to="/events"><Icon name="search" size={16} /> All events</Link>
          </div>
        </div>

        {loading ? (
          <ol className="board-agenda__list" aria-busy="true" aria-label="Loading events">
            {[0, 1, 2].map((row) => (
              <li key={row} className="agenda-row agenda-row--loading" aria-hidden="true">
                <span className="agenda-row__date" />
                <span className="agenda-row__main">
                  <Skeleton className="skeleton--title" style={{ width: "55%" }} />
                  <Skeleton style={{ width: "35%" }} />
                </span>
              </li>
            ))}
          </ol>
        ) : events.length > 0 ? (
          <ol className="board-agenda__list">
            {events.map((event) => <AgendaRow key={event.id} event={event} match={matchesProgram?.(event)} />)}
          </ol>
        ) : (
          <div className="home-empty-state">
            <h3>No events are published right now.</h3>
            <p>Check back soon, or browse a category below to see what usually runs.</p>
          </div>
        )}

        {children}
      </div>
    </section>
  );
}
