import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar.js";
import Icon from "../../components/Icon.js";
import { useEventContext } from "../../context/EventContext.js";
import TicketPassModal from "../../components/attendee/TicketPassModal.js";
import { eventBanner } from "../../data/options.js";
import { seatOf } from "../../data/seating.js";
import { eventsClash, formatTimesIn, startSortKey } from "../../data/time.js";

export default function SchedulePage() {
  const { registrations, events } = useEventContext();
  const [viewMode, setViewMode] = useState("timeline"); // "timeline" | "days"
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Active confirmed registrations
  const activeRegs = useMemo(() => {
    // A cancelled event's tickets leave the itinerary; My Events still lists them.
    return registrations.filter((r) => r.status === "Confirmed" && events.find((e) => e.id === r.eventId)?.status !== "CANCELLED");
  }, [registrations, events]);

  // Map registrations to event details
  const scheduledItems = useMemo(() => {
    return activeRegs
      .map((reg) => {
        const ev = events.find((e) => e.id === reg.eventId);
        return {
          registration: reg,
          event: ev,
          date: ev?.fullDate || reg.fullDate || reg.date,
          time: ev?.time || formatTimesIn(reg.time),
          startTime: ev?.startTime || "08:00 AM",
          location: ev?.fullLocation || reg.location,
          sessions: ev?.agenda || [],
          speakers: ev?.speakers || [],
        };
      })
      .sort((a, b) => startSortKey(a.event?.isoDate, a.event?.startTime).localeCompare(startSortKey(b.event?.isoDate, b.event?.startTime)));
  }, [activeRegs, events]);

  // Conflict detection: two events on the same day whose times overlap (any venue).
  const conflicts = useMemo(() => {
    const clashList = [];
    const saved = (ev) => ev && { date: ev.isoDate, startTime: ev.startTime, endTime: ev.endTime };

    scheduledItems.forEach((item, index) => {
      scheduledItems.slice(index + 1).forEach((other) => {
        if (eventsClash(saved(item.event), saved(other.event))) {
          clashList.push({ date: item.date, event1: item.event.title, event2: other.event.title });
        }
      });
    });

    return clashList;
  }, [scheduledItems]);

  // Unique days for Day view
  const daysList = useMemo(() => {
    return [...new Set(scheduledItems.map((i) => i.date))];
  }, [scheduledItems]);

  const [activeDay, setActiveDay] = useState("");
  // Registrations arrive after the first render, so fall back to the first day until one is picked.
  const currentDay = daysList.includes(activeDay) ? activeDay : daysList[0];

  return (
    <div className="schedule-page">
      <Navbar />

      <main className="schedule-container">
        {/* Header */}
        <div className="schedule-header">
          <div>
            <span className="events-hero__eyebrow">ATTENDEE ITINERARY</span>
            <h1 className="schedule-title">MY PERSONAL SCHEDULE</h1>
            <p className="schedule-subtitle">
              Your chronological itinerary of keynote sessions, technical workshops, and campus activities.
            </p>
          </div>

          {/* View switcher */}
          <div className="schedule-view-toggles">
            <button
              type="button"
              className={`btn-sm ${viewMode === "timeline" ? "btn-sm--yellow" : ""}`}
              onClick={() => setViewMode("timeline")}
            >
              Timeline View
            </button>
            <button
              type="button"
              className={`btn-sm ${viewMode === "days" ? "btn-sm--yellow" : ""}`}
              onClick={() => setViewMode("days")}
            >
              Day-by-Day View
            </button>
            <Link to="/calendar?mine=1" className="btn-sm">
              <Icon name="calendar" size={16} /> Calendar View
            </Link>
          </div>
        </div>

        {/* Schedule Conflict Alert Banner */}
        {conflicts.length > 0 && (
          <div className="schedule-conflict-banner">
            <span className="conflict-icon"><Icon name="alert" size={18} /></span>
            <div className="conflict-text">
              <strong>SCHEDULE OVERLAP WARNING:</strong>
              {conflicts.map((c, i) => (
                <span key={i} className="conflict-detail">
                  {" "}You are registered for both <b>{c.event1}</b> and <b>{c.event2}</b> at the same time on <u>{c.date}</u>. Cancel one of them, since you can only attend one.
                </span>
              ))}
            </div>
          </div>
        )}

        {scheduledItems.length === 0 ? (
          <div className="empty-events-box" style={{ marginTop: "24px" }}>
            <span className="empty-box__icon"><Icon name="calendar" size={28} /></span>
            <h3>No events in your schedule yet</h3>
            <p>Once you register for campus events, their detailed schedules and speaker sessions will automatically populate your itinerary here.</p>
            <Link to="/events" className="btn-sm btn-sm--yellow">
              Explore Open Events <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        ) : (
          <>
            {/* TIMELINE VIEW */}
            {viewMode === "timeline" && (
              <div className="schedule-timeline-view">
                {scheduledItems.map((item, idx) => (
                  <section key={idx} className="schedule-event-block" style={{ "--banner": eventBanner(item.event || { id: item.registration.eventId }) }}>
                    {/* Event Banner */}
                    <div className="schedule-event-banner">
                      <div className="schedule-event-banner__left">
                        <span className="schedule-date-badge"><Icon name="calendar" size={15} /> {item.date}</span>
                        <h2 className="schedule-event-title">{item.event?.title}</h2>
                        <span className="schedule-event-venue"><Icon name="pin" size={15} /> {item.location}</span>
                      </div>

                      <div className="schedule-event-banner__right">
                        <span className="sbadge sbadge--confirmed">
                          {seatOf(item.registration) ? `Seat ${seatOf(item.registration)}` : "Free seating"}
                        </span>
                        <button
                          type="button"
                          className="btn-sm btn-sm--yellow"
                          onClick={() => setSelectedTicket(item.registration)}
                        >
                          View Pass
                        </button>
                      </div>
                    </div>

                    {/* Program Sessions Table */}
                    {item.sessions && item.sessions.length > 0 ? (
                      <div className="schedule-sessions-table">
                        {item.sessions.map((sess, sIdx) => (
                          <div key={sIdx} className="schedule-session-row">
                            <div className="session-time-col">
                              <strong>{sess.time}</strong>
                            </div>
                            <div className="session-desc-col">
                              <h4 className="session-name">{sess.title}</h4>
                              <div className="session-meta">
                                {sess.speaker && <span><Icon name="speaker" size={14} /> Speaker: <b>{sess.speaker}</b></span>}
                                <span><Icon name="pin" size={14} /> Room: {sess.room}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="schedule-sessions-fallback">
                        <p>Full-day schedule: <b>{item.time}</b> · Check in at {item.location}.</p>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}

            {/* DAY-BY-DAY VIEW */}
            {viewMode === "days" && (
              <div className="schedule-days-view">
                {/* Day selector tabs */}
                <div className="days-nav-strip">
                  {daysList.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={`day-tab-btn ${currentDay === day ? "day-tab-btn--active" : ""}`}
                      onClick={() => setActiveDay(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {/* Day content */}
                <div className="day-content-pane">
                  {scheduledItems
                    .filter((item) => item.date === currentDay)
                    .map((item, idx) => (
                      <article
                        key={idx}
                        className="day-event-card"
                        style={{ "--banner": eventBanner(item.event || { id: item.registration.eventId }) }}
                      >
                        <header className="day-event-card__head">
                          <span className="day-event-card__time"><Icon name="clock" size={15} /> {item.time}</span>
                          <h3 className="day-event-title">{item.event?.title || item.registration.eventTitle}</h3>
                          <p className="day-event-meta"><Icon name="pin" size={15} /> {item.location}</p>
                        </header>

                        <dl className="day-event-card__facts">
                          <div>
                            <dt>Seat</dt>
                            <dd>{seatOf(item.registration) || "Free seating"}</dd>
                          </div>
                          <div>
                            <dt>Ticket</dt>
                            <dd>#{item.registration.ticketCode}</dd>
                          </div>
                          <div>
                            <dt>Sessions</dt>
                            <dd>{item.sessions.length || "Full day"}</dd>
                          </div>
                        </dl>

                        {item.sessions.length > 0 && (
                          <ol className="day-sessions-list">
                            {item.sessions.map((s, i) => (
                              <li key={i} className="day-session-item">
                                <span className="day-session-time">{s.time}</span>
                                <div>
                                  <strong>{s.title}</strong>
                                  <small className="day-session-note">
                                    {s.speaker ? `${s.speaker} · ` : ""}Room: {s.room}
                                  </small>
                                </div>
                              </li>
                            ))}
                          </ol>
                        )}

                        <div className="day-event-card__actions">
                          <button type="button" className="btn-sm btn-sm--yellow" onClick={() => setSelectedTicket(item.registration)}>
                            <Icon name="qr" size={16} /> View Pass
                          </button>
                          <Link to={`/events/${item.registration.eventId}`} className="btn-sm">
                            Event Page <Icon name="arrow-right" size={16} />
                          </Link>
                        </div>
                      </article>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Ticket Modal */}
      {selectedTicket && (
        <TicketPassModal
          registration={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
