import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import Icon from "../components/Icon.js";
import { plural } from "../components/manager/parts.js";
import { useAuth } from "../context/AuthContext.js";
import { useEventContext } from "../context/EventContext.js";
import { categoryColor } from "../data/options.js";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const STATUS_LABELS = { "REGISTRATION OPEN": "Registration open", "OPENS SOON": "Opens soon", COMPLETED: "Completed" };
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromKey = (key) => new Date(`${key}T12:00:00`);
const monthOf = (key) => {
  const date = fromKey(key);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

// "YYYY-MM-DD" for an event; older admin events only carry "OCT 14, 2026".
function eventDay(event) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.isoDate || "")) return event.isoDate;
  const parsed = new Date(event.date);
  return Number.isNaN(parsed.getTime()) ? "" : dayKey(parsed);
}

// Minutes after midnight for "13:00" or "1:00 PM"; null when there is no time.
function minutes(time) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(time || "").trim());
  if (!match) return null;
  let hours = Number(match[1]) % (match[3] ? 12 : 24);
  if (/pm/i.test(match[3] || "")) hours += 12;
  return hours * 60 + Number(match[2]);
}

const clock = (mins) => `${Math.floor(mins / 60) % 12 || 12}:${pad(mins % 60)} ${mins < 720 ? "AM" : "PM"}`;

function timeRange(event) {
  const start = minutes(event.startTime);
  const end = minutes(event.endTime);
  if (start === null) return "All day";
  return end === null ? clock(start) : `${clock(start)} – ${clock(end)}`;
}

// A prefilled Google Calendar "add event" link, in Manila time like the campus.
function googleCalendarUrl(event, day) {
  const date = day.replace(/-/g, "");
  const start = minutes(event.startTime);
  const end = minutes(event.endTime) ?? (start === null ? null : Math.min(start + 60, 1439));
  const stamp = (mins) => `${date}T${pad(Math.floor(mins / 60))}${pad(mins % 60)}00`;
  const dates = start === null
    ? `${date}/${dayKey(new Date(fromKey(day).getTime() + 864e5)).replace(/-/g, "")}`
    : `${stamp(start)}/${stamp(end)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    ctz: "Asia/Manila",
    location: event.fullLocation || event.location || "National University MOA",
    details: `${event.description || ""}\n\nEvent page: ${window.location.origin}/events/${event.id}`.trim(),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// Eventify's month calendar: every published event on its day, a day agenda beside it,
// and a one-click "Add to Google Calendar" for each event.
export default function CalendarPage() {
  const { user } = useAuth();
  const { events, isEventRegistered } = useEventContext();
  const [params, setParams] = useSearchParams();
  const isAttendee = user?.role === "user";
  const mineOnly = isAttendee && params.get("mine") === "1";
  const todayKey = dayKey(new Date());
  const [month, setMonth] = useState(() => monthOf(todayKey));
  const [selected, setSelected] = useState(todayKey);

  const byDay = useMemo(() => {
    const map = new Map();
    events
      .filter((event) => !mineOnly || isEventRegistered(event.id))
      .forEach((event) => {
        const day = eventDay(event);
        if (!day) return;
        if (!map.has(day)) map.set(day, []);
        map.get(day).push(event);
      });
    map.forEach((list) => list.sort((a, b) => (minutes(a.startTime) ?? -1) - (minutes(b.startTime) ?? -1)));
    return map;
  }, [events, isEventRegistered, mineOnly]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const index = month.getMonth();
    const blanks = new Date(year, index, 1).getDay();
    const days = new Date(year, index + 1, 0).getDate();
    return [...Array(blanks).fill(null), ...Array.from({ length: days }, (_, day) => dayKey(new Date(year, index, day + 1)))];
  }, [month]);

  const monthDays = cells.filter(Boolean);
  const monthEvents = monthDays.flatMap((day) => byDay.get(day) || []);
  const categories = [...new Set(monthEvents.map((event) => event.category).filter(Boolean))];
  const dayEvents = byDay.get(selected) || [];
  const nextDay = [...byDay.keys()].filter((day) => day > selected).sort()[0];

  // A new month opens on today, else its first day with events, else the 1st.
  const goMonth = (offset) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    const prefix = dayKey(next).slice(0, 7);
    const firstBusy = [...byDay.keys()].filter((day) => day.startsWith(prefix)).sort()[0];
    setMonth(next);
    setSelected(todayKey.startsWith(prefix) ? todayKey : firstBusy || dayKey(next));
  };
  const jumpTo = (day) => {
    setMonth(monthOf(day));
    setSelected(day);
  };

  return (
    <div className="calendar-page">
      <Navbar />

      <main className="calendar-container">
        <div className="calendar-header">
          <div>
            <span className="events-hero__eyebrow">CAMPUS CALENDAR</span>
            <h1 className="calendar-title">EVENT CALENDAR</h1>
            <p className="calendar-subtitle">
              Every published campus event, month by month. Pick a day to see what is on, then add any event to your Google Calendar.
            </p>
          </div>
          {isAttendee && (
            <div className="calendar-filter" role="group" aria-label="Events to show">
              <button type="button" className={`tab-btn${mineOnly ? "" : " tab-btn--active"}`} aria-pressed={!mineOnly} onClick={() => setParams({})}>
                All events
              </button>
              <button type="button" className={`tab-btn${mineOnly ? " tab-btn--active" : ""}`} aria-pressed={mineOnly} onClick={() => setParams({ mine: "1" })}>
                <Icon name="ticket" size={16} /> My events
              </button>
            </div>
          )}
        </div>

        <div className="calendar-layout">
          <section className="cal-board" aria-labelledby="cal-month">
            <div className="cal-head">
              <button type="button" className="cal-nav" onClick={() => goMonth(-1)} aria-label="Previous month">
                <Icon name="arrow-left" size={18} />
              </button>
              <h2 id="cal-month">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
              <button type="button" className="cal-nav" onClick={() => goMonth(1)} aria-label="Next month">
                <Icon name="arrow-right" size={18} />
              </button>
              <button type="button" className="btn-sm cal-today" onClick={() => jumpTo(todayKey)}>Today</button>
            </div>

            <div className="cal-weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </div>

            <div className="cal-grid">
              {cells.map((day, index) => {
                if (!day) return <span key={`blank-${index}`} className="cal-day cal-day--blank" />;
                const list = byDay.get(day) || [];
                return (
                  <button
                    key={day}
                    type="button"
                    className={`cal-day${day === todayKey ? " is-today" : ""}${day === selected ? " is-selected" : ""}${list.length ? " has-events" : ""}`}
                    aria-pressed={day === selected}
                    aria-current={day === todayKey ? "date" : undefined}
                    aria-label={`${fromKey(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${plural(list.length, "event")}`}
                    onClick={() => setSelected(day)}
                  >
                    <span className="cal-day__num">{Number(day.slice(8))}</span>
                    <span className="cal-day__chips">
                      {list.slice(0, 2).map((event) => (
                        <span
                          key={event.id}
                          className={`cal-chip${isEventRegistered(event.id) ? " is-mine" : ""}`}
                          style={{ background: categoryColor(event.category).bg, color: categoryColor(event.category).ink }}
                        >
                          {event.title}
                        </span>
                      ))}
                      {list.length > 2 && <span className="cal-more">+{list.length - 2} more</span>}
                    </span>
                    <span className="cal-day__dots">
                      {list.slice(0, 3).map((event) => <i key={event.id} style={{ background: categoryColor(event.category).bg }} />)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="cal-foot">
              <b>{plural(monthEvents.length, "event")} this month</b>
              {categories.map((category) => (
                <span key={category} className="cal-legend">
                  <i style={{ background: categoryColor(category).bg }} /> {category}
                </span>
              ))}
            </div>
          </section>

          <section className="cal-agenda" aria-labelledby="cal-day-title" aria-live="polite">
            <h2 id="cal-day-title">
              {fromKey(selected).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {plural(dayEvents.length, "event")}
            </h2>

            {dayEvents.length === 0 ? (
              <div className="cal-empty">
                <p>Nothing scheduled this day.</p>
                {nextDay && (
                  <button type="button" className="btn-sm" onClick={() => jumpTo(nextDay)}>
                    Next event: {fromKey(nextDay).toLocaleDateString("en-US", { month: "short", day: "numeric" })} <Icon name="arrow-right" size={16} />
                  </button>
                )}
              </div>
            ) : (
              dayEvents.map((event) => {
                const color = categoryColor(event.category);
                return (
                  <article key={event.id} className="cal-event" style={{ "--cat": color.bg }}>
                    <span className="cal-event__time"><Icon name="clock" size={14} /> {timeRange(event)}</span>
                    <h3 className="cal-event__title"><Link to={`/events/${event.id}`}>{event.title}</Link></h3>
                    <p className="cal-event__meta"><Icon name="pin" size={14} /> {event.fullLocation || event.location}</p>
                    <div className="cal-event__tags">
                      <span className="cal-tag" style={{ background: color.bg, color: color.ink }}>{event.category || "Event"}</span>
                      {STATUS_LABELS[event.status] && <span className="cal-tag cal-tag--plain">{STATUS_LABELS[event.status]}</span>}
                      {isEventRegistered(event.id) && <span className="cal-tag cal-tag--mine"><Icon name="ticket" size={14} /> Registered</span>}
                    </div>
                    <div className="cal-event__actions">
                      <Link to={`/events/${event.id}`} className="btn-sm">View event</Link>
                      <a className="btn-sm btn-sm--blue" href={googleCalendarUrl(event, selected)} target="_blank" rel="noopener noreferrer">
                        <Icon name="calendar" size={16} /> Add to Google Calendar
                      </a>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
