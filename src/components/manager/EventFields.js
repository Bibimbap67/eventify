import React, { useEffect, useState } from "react";
import Icon from "../Icon.js";
import Spinner from "../Spinner.js";
import { useManager } from "../../context/ManagerContext.js";
import { EVENT_CATEGORIES } from "../../data/options.js";
import { api } from "../../api.js";
import { isRunning } from "../../data/checkIn.js";
import { addMinutes, formatTime, timeRange, toMinutes } from "../../data/time.js";

// Form pieces for creating and editing a manager event (My events, and an event's Details tab).

export const CATEGORIES = EVENT_CATEGORIES.filter((category) => category !== "All");
export const PREP_STATUSES = ["Needs attention", "In progress", "On track", "Venue confirmed", "Ready", "Closed out"];
export const EMPTY_EVENT = { title: "", category: "Academic", description: "", date: "", startTime: "", endTime: "", venue: "", capacity: "", seating: "free", organizer: "", requirements: "", importantDate: "", speakers: [] };
const SPEAKER_KINDS = ["Speaker", "Guest speaker"];

// A submit button that shows the spinner while its action is pending.
export function SaveButton({ pending, pendingText = "Saving…", children, onClick }) {
  return (
    <button className="manager-button manager-button--primary" type="submit" onClick={onClick} disabled={pending} aria-busy={pending || undefined}>
      {pending ? <><Spinner /> {pendingText}</> : children}
    </button>
  );
}

// Trimmed speaker rows. Rows left blank are dropped; a row with only a name or only a role is
// an error (null), so the event page never shows a speaker without a role.
export function cleanSpeakers(rows = []) {
  const speakers = rows
    .map((row) => ({ name: String(row.name || "").trim(), role: String(row.role || "").trim(), kind: SPEAKER_KINDS.includes(row.kind) ? row.kind : "Speaker" }))
    .filter((row) => row.name || row.role);
  return speakers.some((row) => !row.name || !row.role) ? null : speakers;
}

// Speakers and guest speakers: a name, the role shown under it, and which of the two they are.
export function SpeakersField({ value = [], onChange, error }) {
  const update = (index, field) => (e) => onChange(value.map((row, i) => (i === index ? { ...row, [field]: e.target.value } : row)));
  return (
    <fieldset className="manager-field manager-field--wide manager-speakers">
      <legend>Speakers & guest speakers</legend>
      {value.length === 0 && <p className="manager-muted">Add the people presenting: their name, and their role under it.</p>}
      {value.map((row, index) => (
        <div className="manager-speaker-row" key={index}>
          <input aria-label={`Speaker ${index + 1} name`} placeholder="Name, e.g. Mark Reyes" value={row.name || ""} onChange={update(index, "name")} />
          <input aria-label={`Speaker ${index + 1} role`} placeholder="Role, e.g. Google AI Automation Engineer" value={row.role || ""} onChange={update(index, "role")} />
          <select aria-label={`Speaker ${index + 1} type`} value={row.kind || "Speaker"} onChange={update(index, "kind")}>
            {SPEAKER_KINDS.map((kind) => <option key={kind}>{kind}</option>)}
          </select>
          <button type="button" className="manager-text-button manager-text-button--danger" onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label={`Remove speaker ${index + 1}`}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      ))}
      {error && <small>{error}</small>}
      <button type="button" className="manager-button manager-button--small" onClick={() => onChange([...value, { name: "", role: "", kind: "Speaker" }])}>
        <Icon name="plus" size={16} /> Add speaker
      </button>
    </fieldset>
  );
}

// A venue from the admin's list. An older event's typed-in venue stays listed until changed.
export function VenueField({ value, onChange, error }) {
  const { venues, loadVenues } = useManager();
  useEffect(() => {
    loadVenues();
  }, [loadVenues]);
  return (
    <label className="manager-field">Venue
      <select value={value} onChange={onChange}>
        <option value="">Choose venue</option>
        {value && !venues.includes(value) && <option value={value}>{value}</option>}
        {venues.map((item) => <option key={item}>{item}</option>)}
      </select>
      {error ? <small>{error}</small> : !venues.length && <small>No venues yet. Ask an admin to add one under Venues.</small>}
    </label>
  );
}

// What a venue already holds on a day, and how many people it fits, for the event forms.
// The server enforces both (checkVenue in dataController.js); this shows them before saving.
export function useVenueDay(venue, date, excludeId) {
  const [day, setDay] = useState(NO_VENUE_DAY);
  useEffect(() => {
    if (!venue) return setDay(NO_VENUE_DAY);
    let live = true;
    api(`/venues/bookings?${new URLSearchParams({ venue, date: date || "", exclude: excludeId || "" })}`)
      .then((res) => live && setDay(res))
      .catch(() => live && setDay(NO_VENUE_DAY)); // the server still checks on save
    return () => {
      live = false;
    };
  }, [venue, date, excludeId]);
  return day;
}
const NO_VENUE_DAY = { capacity: null, bookings: [] };

// The booking that overlaps start–end, if any. Back-to-back events (one ends at 5, the next starts at 5) are fine.
export const clashOf = (bookings, start, end) => bookings.find((booking) => toMinutes(booking.startTime) < toMinutes(end) && toMinutes(start) < toMinutes(booking.endTime));

// The venue's taken times that day, so the manager picks a free slot.
export function BookedTimes({ venue, date, bookings }) {
  if (!venue || !date) return null;
  return (
    <div className={`manager-field manager-field--wide manager-booked${bookings.length ? "" : " manager-booked--free"}`} aria-live="polite">
      {bookings.length ? (
        <>
          <strong><Icon name="calendar-clock" size={16} /> Already booked at {venue} that day</strong>
          <ul>
            {bookings.map((booking) => <li key={booking.id}><b>{timeRange(booking.startTime, booking.endTime)}</b> {booking.title}</li>)}
          </ul>
        </>
      ) : <span className="manager-muted"><Icon name="check-circle" size={16} /> {venue} is free all day.</span>}
    </div>
  );
}

const OVERTIME_MINUTES = [5, 10, 20, 30];

// An event ends, and is marked Completed, at its end time. While it runs, these push the end back.
export function OvertimeButtons({ event, endTime, onExtend }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  if (!isRunning({ ...event, endTime }, now)) return null;
  const latest = toMinutes(endTime) >= 23 * 60 + 59;
  return (
    <div className="manager-overtime" role="group" aria-label="Add overtime">
      <span><Icon name="hourglass" size={16} /> Running late? Ends {formatTime(endTime)}. Add overtime:</span>
      {OVERTIME_MINUTES.map((minutes) => (
        <button key={minutes} type="button" className="manager-button manager-button--small" disabled={latest} onClick={() => onExtend(addMinutes(endTime, minutes), minutes)}>
          +{minutes} min
        </button>
      ))}
    </div>
  );
}
