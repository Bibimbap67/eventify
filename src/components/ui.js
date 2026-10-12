import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.js";
import { CountUp, prefersReducedMotion, useEntering } from "./Motion.js";
import { avatarUri } from "./avatar.js";
import { isCheckedIn } from "../data/checkIn.js";

// Shared screen pieces (tables, badges, metrics, filters) used by the admin, manager and public pages.

// Current events or the archive, each with its count (admin Events and manager My events).
export function ArchiveSwitch({ value, onChange, current, archived }) {
  return (
    <div className="manager-tabs" role="group" aria-label="Current or archived events">
      {[["current", "Current", "calendar-days", current], ["archive", "Archive", "archive", archived]].map(([id, label, icon, count]) => (
        <button
          key={id}
          type="button"
          className={`manager-tab${value === id ? " manager-tab--active" : ""}`}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          <Icon name={icon} size={16} /> {label} <TabCount value={count} />
        </button>
      ))}
    </div>
  );
}

// Bumps when the number changes, so archiving or restoring shows which list the event moved to.
function TabCount({ value }) {
  const ref = useRef(null);
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    const frames = prefersReducedMotion()
      ? [{ opacity: 0.35 }, { opacity: 1 }]
      : [{ transform: "scale(1.35)" }, { transform: "none" }];
    ref.current?.animate?.(frames, { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }, [value]);
  return <span ref={ref} className="manager-tab__count">{value}</span>;
}

export function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

export function plural(count, word, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`;
}


export function eventRegistrations(eventId, registrations) {
  return registrations.filter((item) => item.eventId === eventId && item.status !== "Cancelled");
}

export function countRegistrations(eventId, registrations) {
  return eventRegistrations(eventId, registrations).length;
}

export function getAttendance(eventId, registrations) {
  const confirmed = registrations.filter((item) => item.eventId === eventId && item.status === "Confirmed");
  const checkedIn = confirmed.filter(isCheckedIn);
  return { confirmed, checkedIn, percentage: confirmed.length ? Math.round(checkedIn.length / confirmed.length * 100) : 0 };
}

// Sorts events by their "YYYY-MM-DD" date, soonest first.
export const byDate = (a, b) => a.date.localeCompare(b.date);

export function eventDate(date, options) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", options);
}

// Whole days from today to `date` (negative when it has passed).
export function daysUntil(date) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((new Date(`${date}T12:00:00`) - today) / 86400000);
}

export function countdownLabel(date) {
  const days = daysUntil(date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return `${plural(-days, "day")} ago`;
  return `In ${plural(days, "day")}`;
}

export function relativeDay(date) {
  const days = -daysUntil(date);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return eventDate(date, { month: "short", day: "numeric" });
}

export function StatusBadge({ value }) {
  return <span className={`manager-status manager-status--${slug(value)}`}>{value}</span>;
}

// Preparation status as a colored chip (ready = green, needs attention = red, ...).
export function PrepChip({ value }) {
  return <span className={`manager-prep manager-prep--${slug(value)}`}>{value || "Not set"}</span>;
}

export function SectionHeading({ eyebrow, title, detail, action }) {
  return (
    <div className="manager-section-heading">
      <div>
        <span className="manager-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function PanelHeader({ eyebrow, title, aside, id }) {
  return (
    <div className="manager-panel__header">
      <div>
        <span>{eyebrow}</span>
        <h3 id={id}>{title}</h3>
      </div>
      {aside}
    </div>
  );
}

// A number tile. With `to` it is a link, so the whole card is a shortcut to that page.
export function Metric({ icon, tone = "yellow", label, value, note, to }) {
  const body = (
    <>
      <span className="manager-metric__label">
        {icon && <span className={`manager-icon-chip manager-icon-chip--${tone}`}><Icon name={icon} size={16} /></span>}
        {label}
      </span>
      <strong><CountUp value={value} /></strong>
      <small>{note}</small>
      {to && <Icon name="arrow-right" size={16} className="manager-metric__go" />}
    </>
  );
  return to
    ? <Link className="manager-metric manager-metric--link" to={to}>{body}</Link>
    : <div className="manager-metric">{body}</div>;
}

// Capacity bar: green while there is room, yellow when filling fast, red when (almost) full.
export function CapacityBar({ value, max, label = "Registration progress" }) {
  const pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0;
  const level = pct >= 85 ? "high" : pct >= 60 ? "mid" : "low";
  return (
    <div
      className={`manager-meter manager-meter--${level}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${max} (${pct}%)`}
    >
      <span style={{ "--fill": `${pct}%` }} />
    </div>
  );
}

// Toggle chips for one filter. Each option shows how many rows it would leave.
export function FilterChips({ label, options, value, onChange }) {
  return (
    <div className="manager-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`manager-chip manager-chip--${slug(option.value)}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          <span className="manager-chip__count">{option.count}</span>
        </button>
      ))}
    </div>
  );
}

export function SearchField({ label, placeholder, value, onChange }) {
  return (
    <label className="manager-search">
      <Icon name="search" size={16} />
      <input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// The person's DiceBear face. Pass their account id as `seed` so it matches the face they see
// in their own navbar; without one (e.g. a feedback name) the name picks the face.
export function Avatar({ name, seed }) {
  return <img className="manager-avatar" src={avatarUri(seed || name)} alt="" />;
}

export function EmptyState({ icon = "inbox", title, children }) {
  return (
    <div className="manager-empty">
      <span className="manager-icon-chip manager-icon-chip--yellow"><Icon name={icon} size={20} /></span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function DateTile({ date }) {
  return (
    <div className="manager-date-tile" aria-hidden="true">
      <strong>{eventDate(date, { day: "2-digit" })}</strong>
      <span>{eventDate(date, { month: "short" }).toUpperCase()}</span>
    </div>
  );
}

export function Table({ columns, rows, empty = "No records to show.", emptyIcon, rowClass }) {
  const entering = useEntering();
  if (!rows.length) return <EmptyState icon={emptyIcon} title={empty} />;
  return (
    <div className={`manager-table-wrap${entering ? " stagger" : ""}`}>
      <table className="manager-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.label} scope="col">{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={rowClass?.(row) || undefined}>
              {columns.map((column) => <td key={column.label} data-label={column.label}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Name + email cell used by every participant table.
export function PersonCell({ name, detail, seed }) {
  return (
    <span className="manager-person">
      <Avatar name={name} seed={seed} />
      <span>
        <strong>{name}</strong>
        <small>{detail}</small>
      </span>
    </span>
  );
}
