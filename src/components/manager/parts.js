import React from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon.js";
import { CountUp, useEntering } from "../Motion.js";

// Shared pieces of the Event Manager workspace (pages live in pages/manager/ManagerScreen.js).

export const PAST_STATUSES = ["Completed", "Cancelled"];

export function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}

export function plural(count, word, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`;
}

// Stored attendance values differ in case ("Not Checked In" / "Not checked in"), so compare by key.
export function attendanceKey(status) {
  const value = String(status || "").toLowerCase();
  if (value === "attended") return "attended";
  if (value === "checked in") return "checked-in";
  return "waiting";
}

export function isCheckedIn(registration) {
  return attendanceKey(registration.attendanceStatus) !== "waiting";
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

const AVATAR_TONES = ["blue", "yellow", "coral", "mint", "violet"];

// Initials on a color picked from the name, so the same person keeps the same color.
export function Avatar({ name }) {
  const text = String(name || "?");
  const initials = text.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const tone = AVATAR_TONES[[...text].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES.length];
  return <span className={`manager-avatar manager-icon-chip--${tone}`} aria-hidden="true">{initials || "?"}</span>;
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
export function PersonCell({ name, detail }) {
  return (
    <span className="manager-person">
      <Avatar name={name} />
      <span>
        <strong>{name}</strong>
        <small>{detail}</small>
      </span>
    </span>
  );
}
