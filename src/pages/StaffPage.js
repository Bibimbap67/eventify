import React, { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar.js";
import Icon from "../components/Icon.js";
import QrScanner from "../components/QrScanner.js";
import { playSound } from "../components/sound.js";
import { api } from "../api.js";

// How each server answer looks at the desk.
const RESULTS = {
  "checked-in": { tone: "ok", icon: "check-circle", title: "Checked in" },
  duplicate: { tone: "warn", icon: "alert", title: "Already checked in" },
  "wrong-event": { tone: "warn", icon: "alert", title: "Wrong event" },
  invalid: { tone: "bad", icon: "close", title: "Not a valid ticket" },
};
const isIn = (attendee) => ["checked in", "attended"].includes(String(attendee.attendanceStatus).toLowerCase());

// The door: staff pick the event they are working, scan tickets, and see who has arrived.
// Every scan is checked by the server against the database; there is no manual check-in here.
export default function StaffPage() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadEvents = useCallback(() => {
    api("/staff/events")
      .then((data) => setEvents(data.events.filter((event) => !event.closed)))
      .catch((err) => setLoadError(err.message));
  }, []);

  const loadAttendees = useCallback(() => {
    if (!eventId) {
      setAttendees([]);
      return;
    }
    api(`/staff/events/${eventId}/attendees`)
      .then((data) => setAttendees(data.attendees))
      .catch((err) => setLoadError(err.message));
  }, [eventId]);

  useEffect(loadEvents, [loadEvents]);
  useEffect(loadAttendees, [loadAttendees]);

  const handleScan = useCallback(async (code) => {
    setBusy(true);
    let data;
    try {
      data = await api("/staff/checkin", { method: "POST", body: { code, eventId: eventId || undefined } });
    } catch (err) {
      data = { result: "invalid", message: err.message, attendee: null };
    }
    setResult(data);
    setLog((current) => [{ ...data, id: `${Date.now()}`, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...current].slice(0, 12));
    playSound(data.result === "checked-in" ? "success" : "error");
    if (data.result === "checked-in") {
      loadEvents();
      loadAttendees();
    }
    setBusy(false);
  }, [eventId, loadAttendees, loadEvents]);

  const selected = events.find((event) => event.id === eventId);
  const counts = selected
    ? { registered: selected.registered, checkedIn: selected.checkedIn }
    : events.reduce((sum, event) => ({ registered: sum.registered + event.registered, checkedIn: sum.checkedIn + event.checkedIn }), { registered: 0, checkedIn: 0 });

  const shownAttendees = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attendees.filter((attendee) => !q || [attendee.name, attendee.studentId, attendee.email, attendee.ticketCode]
      .some((value) => String(value || "").toLowerCase().includes(q)));
  }, [attendees, query]);

  const shown = result ? RESULTS[result.result] || RESULTS.invalid : null;

  return (
    <div className="staff-page">
      <Navbar />

      <main className="staff-container">
        <div className="staff-header">
          <div>
            <span className="events-hero__eyebrow">EVENT STAFF</span>
            <h1 className="staff-title">CHECK-IN DESK</h1>
            <p className="staff-subtitle">
              Scan the QR on an attendee's ticket pass. Valid tickets are checked in at once; fake, cancelled
              and already-used tickets are refused.
            </p>
          </div>
          <label className="staff-event-picker">
            <span>SCANNING FOR</span>
            <select value={eventId} onChange={(e) => { setEventId(e.target.value); setQuery(""); }}>
              <option value="">Any open event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title} · {event.date}</option>
              ))}
            </select>
          </label>
        </div>

        {loadError && <p className="form-error" role="alert">{loadError}</p>}

        <dl className="staff-stats">
          <div>
            <dt>Registered</dt>
            <dd>{counts.registered}</dd>
          </div>
          <div>
            <dt>Checked in</dt>
            <dd>{counts.checkedIn}</dd>
          </div>
          <div>
            <dt>Still to arrive</dt>
            <dd>{Math.max(0, counts.registered - counts.checkedIn)}</dd>
          </div>
        </dl>

        <div className="staff-grid">
          <section className="staff-panel" aria-labelledby="scanner-title">
            <h2 className="staff-panel__title" id="scanner-title"><Icon name="scan" size={20} /> Scan a ticket</h2>
            <QrScanner onScan={handleScan} paused={busy} />
          </section>

          <section className="staff-panel" aria-labelledby="result-title">
            <h2 className="staff-panel__title" id="result-title"><Icon name="user-check" size={20} /> Result</h2>
            <div className={`staff-result${shown ? ` staff-result--${shown.tone}` : ""}`} aria-live="polite">
              {busy ? (
                <p className="staff-result__hint">Checking ticket…</p>
              ) : shown ? (
                <>
                  <div className="staff-result__head">
                    <Icon name={shown.icon} size={24} />
                    <strong>{shown.title}</strong>
                  </div>
                  <p className="staff-result__message">{result.message}</p>
                  {result.attendee && (
                    <dl className="staff-result__facts">
                      <div><dt>Name</dt><dd>{result.attendee.name || "—"}</dd></div>
                      <div><dt>Student ID</dt><dd>{result.attendee.studentId || "—"}</dd></div>
                      <div><dt>Event</dt><dd>{result.attendee.eventTitle}</dd></div>
                      <div><dt>Seat</dt><dd>{result.attendee.seat || "Free seating"}</dd></div>
                      <div><dt>Ticket</dt><dd>#{result.attendee.ticketCode}</dd></div>
                      {result.attendee.checkedInAt && <div><dt>Checked in</dt><dd>{result.attendee.checkedInAt}</dd></div>}
                    </dl>
                  )}
                </>
              ) : (
                <p className="staff-result__hint">Waiting for a scan. Check the name against the attendee's ID card.</p>
              )}
            </div>

            {log.length > 0 && (
              <>
                <h3 className="staff-log__title">This session</h3>
                <ol className="staff-log">
                  {log.map((entry) => (
                    <li key={entry.id} className={`staff-log__item staff-log__item--${(RESULTS[entry.result] || RESULTS.invalid).tone}`}>
                      <span className="staff-log__time">{entry.at}</span>
                      <span className="staff-log__name">{entry.attendee?.name || "Unknown ticket"}</span>
                      <span className="staff-log__result">{(RESULTS[entry.result] || RESULTS.invalid).title}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        </div>

        <section className="staff-panel staff-attendees" aria-labelledby="attendees-title">
          <div className="staff-attendees__head">
            <h2 className="staff-panel__title" id="attendees-title"><Icon name="users" size={20} /> Attendee list</h2>
            {selected && (
              <input
                type="search"
                className="staff-attendees__search"
                placeholder="Search name, student ID or ticket"
                aria-label="Search attendees"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
          </div>
          {!selected ? (
            <p className="staff-result__hint">Pick an event under "Scanning for" to see who is registered and who has arrived.</p>
          ) : shownAttendees.length === 0 ? (
            <p className="staff-result__hint">{attendees.length ? "No attendee matches that search." : "No confirmed registrations for this event yet."}</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Student ID</th><th>Ticket</th><th>Seat</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {shownAttendees.map((attendee) => (
                    <tr key={attendee.id}>
                      <td><b>{attendee.name}</b></td>
                      <td>{attendee.studentId || "—"}</td>
                      <td>#{attendee.ticketCode}</td>
                      <td>{attendee.seat || "Free"}</td>
                      <td>
                        <span className={`sbadge ${isIn(attendee) ? "sbadge--checked-in" : "sbadge--not-checked-in"}`}>
                          {isIn(attendee) ? `In · ${attendee.checkedInAt || ""}` : "Not yet"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
