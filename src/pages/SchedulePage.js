import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import Icon from "../components/Icon.js";
import { useEventContext } from "../context/EventContext.js";
import TicketPassModal from "../components/TicketPassModal.js";

export default function SchedulePage() {
  const { registrations, events } = useEventContext();
  const [viewMode, setViewMode] = useState("timeline"); // "timeline" | "days"
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Active confirmed registrations
  const activeRegs = useMemo(() => {
    return registrations.filter((r) => r.status === "Confirmed");
  }, [registrations]);

  // Map registrations to event details
  const scheduledItems = useMemo(() => {
    return activeRegs
      .map((reg) => {
        const ev = events.find((e) => e.id === reg.eventId);
        return {
          registration: reg,
          event: ev,
          date: ev?.fullDate || reg.fullDate || reg.date,
          time: ev?.time || reg.time,
          startTime: ev?.startTime || "08:00 AM",
          location: ev?.fullLocation || reg.location,
          sessions: ev?.agenda || [],
          speakers: ev?.speakers || [],
        };
      })
      .sort((a, b) => (a.event?.date || "").localeCompare(b.event?.date || ""));
  }, [activeRegs, events]);

  // Conflict detection: Detect if two events share the same date
  const conflicts = useMemo(() => {
    const dateMap = {};
    const clashList = [];

    scheduledItems.forEach((item) => {
      const d = item.event?.date;
      if (!d) return;
      if (dateMap[d]) {
        clashList.push({
          date: item.date,
          event1: dateMap[d].event?.title,
          event2: item.event?.title,
        });
      } else {
        dateMap[d] = item;
      }
    });

    return clashList;
  }, [scheduledItems]);

  // Unique days for Day view
  const daysList = useMemo(() => {
    return [...new Set(scheduledItems.map((i) => i.date))];
  }, [scheduledItems]);

  const [activeDay, setActiveDay] = useState(daysList[0] || "");

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
                  {" "}You are registered for both <b>{c.event1}</b> and <b>{c.event2}</b> on <u>{c.date}</u>. Please plan your attendance or release one of the seats if unable to participate in both.
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
                  <section key={idx} className="schedule-event-block">
                    {/* Event Banner */}
                    <div className="schedule-event-banner">
                      <div className="schedule-event-banner__left">
                        <span className="schedule-date-badge"><Icon name="calendar" size={15} /> {item.date}</span>
                        <h2 className="schedule-event-title">{item.event?.title}</h2>
                        <span className="schedule-event-venue"><Icon name="pin" size={15} /> {item.location}</span>
                      </div>

                      <div className="schedule-event-banner__right">
                        <span className="sbadge sbadge--confirmed">
                          Seat: {item.registration.seat}
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
                      className={`day-tab-btn ${activeDay === day ? "day-tab-btn--active" : ""}`}
                      onClick={() => setActiveDay(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {/* Day content */}
                <div className="day-content-pane">
                  {scheduledItems
                    .filter((item) => item.date === activeDay)
                    .map((item, idx) => (
                      <div key={idx} className="day-event-card">
                        <div className="day-event-header">
                          <div>
                            <span className="sbadge sbadge--active">{item.time}</span>
                            <h3 style={{ margin: "8px 0 4px", fontSize: "20px" }}>
                              {item.event?.title}
                            </h3>
                            <p style={{ margin: 0, fontSize: "14px", color: "#444" }}>
                              <Icon name="pin" size={15} /> {item.location} · <b>Seat {item.registration.seat}</b>
                            </p>
                          </div>
                          <Link to={`/events/${item.registration.eventId}`} className="btn-sm">
                            Event Page <Icon name="arrow-right" size={16} />
                          </Link>
                        </div>

                        {item.sessions && item.sessions.length > 0 && (
                          <div className="day-sessions-list">
                            {item.sessions.map((s, i) => (
                              <div key={i} className="day-session-item">
                                <span className="day-session-time">{s.time}</span>
                                <div>
                                  <strong>{s.title}</strong>
                                  <small style={{ display: "block", color: "#555" }}>
                                    {s.speaker ? `${s.speaker} · ` : ""}Room: {s.room}
                                  </small>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
