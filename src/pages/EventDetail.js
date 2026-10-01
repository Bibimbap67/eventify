import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import Navbar from "../components/Navbar.js";
import Icon from "../components/Icon.js";
import { useEventContext } from "../context/EventContext.js";
import { useManager } from "../context/ManagerContext.js";

// Helper for speaker profile avatars with graceful SVG fallback
function SpeakerAvatar({ name, src }) {
  const [error, setError] = useState(false);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  if (error || !src) {
    return (
      <div className="speaker-avatar speaker-avatar--fallback" aria-label={name}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className="speaker-avatar"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { events, registerForEvent, isEventRegistered, userProfile } = useEventContext();
  const { announcements } = useManager();

  const event = events.find((e) => e.id === id);
  const publishedAnnouncements = announcements.filter((item) => item.eventId === id && item.status === "Published");
  const existingReg = event ? isEventRegistered(event.id) : null;

  const [isRegistering, setIsRegistering] = useState(false);
  const [formName, setFormName] = useState(userProfile?.name || "");
  const [formEmail, setFormEmail] = useState(userProfile?.email || "");
  const [formStudentId, setFormStudentId] = useState(userProfile?.studentId || "");
  const [ticketType, setTicketType] = useState("Student Attendee");
  const [regError, setRegError] = useState("");

  if (!event) {
    return (
      <div className="event-detail-page">
        <Navbar />
        <main className="event-detail" style={{ textAlign: "center", padding: "80px 20px" }}>
          <h2>Event not found</h2>
          <p>The event you are looking for does not exist or has been archived.</p>
          <Link to="/events" className="btn-sm btn-sm--yellow" style={{ marginTop: "16px", display: "inline-block" }}>
            ← Back to all events
          </Link>
        </main>
      </div>
    );
  }

  const capacity = event.capacity || 500;
  const currentCount = Math.min(event.registered, capacity);
  const percentFilled = Math.min(100, Math.round((currentCount / capacity) * 100));
  const spotsRemaining = Math.max(0, capacity - currentCount);
  const registrationOpen = event.status === "REGISTRATION OPEN";
  const registrationUnavailableLabel =
    event.status === "COMPLETED"
      ? "Event completed"
      : event.status === "OPENS SOON"
      ? "Registration opens soon"
      : "Registration closed";

  // Dynamic capacity state & color logic (Green -> Yellow -> Red)
  let capacityColor = "var(--color-blue)";
  let capacityLevel = "open";
  let capacityBadgeText = `${spotsRemaining} SPOTS AVAILABLE`;
  let urgencyText = "Seats are available. Claim your free admission pass below.";

  if (percentFilled >= 100) {
    capacityColor = "var(--color-pink)";
    capacityLevel = "full";
    capacityBadgeText = "CAPACITY REACHED";
    urgencyText = "This event is fully booked. Additional registrations are placed on standby.";
  } else if (percentFilled >= 85) {
    capacityColor = "var(--color-pink)";
    capacityLevel = "urgent";
    capacityBadgeText = `ALMOST FULL (${spotsRemaining} SEATS LEFT)`;
    urgencyText = `Hurry! Over ${percentFilled}% of venue capacity has already been filled.`;
  } else if (percentFilled >= 60) {
    capacityColor = "var(--color-yellow)";
    capacityLevel = "filling";
    capacityBadgeText = `FILLING FAST (${percentFilled}% FILLED)`;
    urgencyText = "High student interest recorded. Secure your reservation early.";
  }

  // Handle registration confirmation
  const handleRegister = (e) => {
    e.preventDefault();
    setRegError("");

    if (!formName.trim() || !formEmail.trim()) {
      setRegError("Please fill in your name and email.");
      return;
    }

    try {
      const res = registerForEvent(event.id, {
        name: formName.trim(),
        email: formEmail.trim(),
        studentId: formStudentId.trim(),
        ticketType,
      });

      if (!res.success) {
        setRegError(res.message);
      } else {
        setIsRegistering(false);
      }
    } catch (error) {
      setRegError(error.message);
    }
  };

  return (
    <div className="event-detail-page">
      <Navbar />

      {/* TOP HERO BANNER */}
      <header className="event-hero-banner" style={{ "--hero-bg": event.heroBg || "var(--color-blue)" }}>
        <div className="event-hero-banner__inner">
          <Link to="/events" className="event-hero__back-link">
            ← Back to all events
          </Link>

          <div className="event-hero__badges">
            <span className="event-badge event-badge--yellow">{event.status || "REGISTRATION OPEN"}</span>
            <span className="event-badge event-badge--white">{event.category || "CONFERENCE"}</span>
            <span className={`event-badge event-badge--capacity event-badge--${capacityLevel}`}>
              {capacityBadgeText}
            </span>
          </div>

          <h1 className="event-hero__title">{event.title}</h1>
          <p className="event-hero__subtitle">Presented by {event.organizer || "National University"}</p>
        </div>
      </header>

      {/* MAIN BODY CONTENT */}
      <main className="event-detail-body">
        <div className="event-detail-container">
          <div className="event-detail-grid">
            {/* LEFT COLUMN: Overview, Capacity Gauge, Speakers, Agenda */}
            <div className="event-detail-left">
              {/* Event Description */}
              <section className="event-section-desc">
                <p className="event-lead-text">{event.description}</p>
                {event.requirements && (
                  <div className="event-reqs-box">
                    <strong>ENTRY REQUIREMENTS:</strong> {event.requirements}
                  </div>
                )}
              </section>

              {/* 4 Info Pills Grid (Date, Time, Venue, Capacity) */}
              <div className="event-info-pills">
                <div className="info-pill">
                  <div className="info-pill__icon"><Icon name="calendar" size={18} /></div>
                  <div className="info-pill__text">
                    <span className="info-pill__label">DATE</span>
                    <strong>{event.fullDate || event.date}</strong>
                  </div>
                </div>

                <div className="info-pill">
                  <div className="info-pill__icon"><Icon name="clock" size={18} /></div>
                  <div className="info-pill__text">
                    <span className="info-pill__label">SCHEDULE</span>
                    <strong>{event.time || "8:00 AM - 5:00 PM"}</strong>
                  </div>
                </div>

                <div className="info-pill">
                  <div className="info-pill__icon"><Icon name="pin" size={18} /></div>
                  <div className="info-pill__text">
                    <span className="info-pill__label">VENUE</span>
                    <strong>{event.fullLocation || event.location}</strong>
                  </div>
                </div>

                <div className="info-pill">
                  <div className="info-pill__icon"><Icon name="users" size={18} /></div>
                  <div className="info-pill__text">
                    <span className="info-pill__label">CAPACITY</span>
                    <strong>{capacity} attendee capacity</strong>
                  </div>
                </div>
              </div>

              {/* LIVE CAPACITY & SEAT METER */}
              <section className="capacity-gauge-card">
                <div className="capacity-gauge__head">
                  <div>
                    <span className="capacity-gauge__eyebrow">SEAT ALLOCATION MONITOR</span>
                    <h3 className="capacity-gauge__title">Event Capacity Status</h3>
                  </div>
                  <span className={`capacity-status-chip capacity-status-chip--${capacityLevel}`}>
                    {percentFilled}% RESERVED
                  </span>
                </div>

                {/* Progress track */}
                <div className="capacity-bar-track">
                  <div
                    className="capacity-bar-fill"
                    style={{
                      width: `${percentFilled}%`,
                      backgroundColor: capacityColor,
                    }}
                  />
                </div>

                {/* Stats Breakdown Row */}
                <div className="capacity-stats-row">
                  <div className="cap-stat">
                    <strong>{currentCount}</strong>
                    <span>Registered</span>
                  </div>
                  <div className="cap-stat">
                    <strong style={{ color: capacityColor }}>{spotsRemaining}</strong>
                    <span>Seats Remaining</span>
                  </div>
                  <div className="cap-stat">
                    <strong>{capacity}</strong>
                    <span>Total Hall Capacity</span>
                  </div>
                </div>

                <div className="capacity-urgency-note">
                  <Icon name="info" size={17} /> {urgencyText}
                </div>
              </section>

              {/* FEATURED SPEAKERS & PRESENTERS */}
              {event.speakers && event.speakers.length > 0 && (
                <section className="speakers-section">
                  <div className="section-header-block">
                    <h2 className="section-title">KEYNOTE & GUEST SPEAKERS</h2>
                    <p className="section-subtitle">Learn directly from technology pioneers and industry engineering leads.</p>
                  </div>

                  <div className="speakers-grid">
                    {event.speakers.map((sp) => (
                      <article key={sp.id} className="speaker-card">
                        <div className="speaker-card__header">
                          <SpeakerAvatar name={sp.name} src={sp.avatar} />
                          <div className="speaker-card__meta">
                            <h4 className="speaker-name">{sp.name}</h4>
                            <p className="speaker-role">
                              {sp.role} <span className="speaker-company">· {sp.company}</span>
                            </p>
                            <span className="speaker-time-badge">
                              <Icon name="clock" size={14} /> {sp.time} · {sp.room}
                            </span>
                          </div>
                        </div>
                        <div className="speaker-topic">
                          <span className="topic-tag">TOPIC</span>
                          <p className="topic-title">{sp.topic}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* EVENT AGENDA / TIMELINE */}
              {event.agenda && event.agenda.length > 0 && (
                <section className="agenda-section">
                  <div className="section-header-block">
                    <h2 className="section-title">SCHEDULE TIMELINE</h2>
                    <p className="section-subtitle">Full program agenda from morning check-in to evening ceremonies.</p>
                  </div>

                  <div className="agenda-timeline">
                    {event.agenda.map((slot, idx) => (
                      <div key={idx} className="agenda-item">
                        <div className="agenda-time">{slot.time}</div>
                        <div className="agenda-content">
                          <h4 className="agenda-title">{slot.title}</h4>
                          <div className="agenda-meta">
                            {slot.speaker && <span className="agenda-speaker"><Icon name="speaker" size={14} /> {slot.speaker}</span>}
                            <span className="agenda-room"><Icon name="pin" size={14} /> {slot.room}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {publishedAnnouncements.length > 0 && (
                <section className="event-announcements">
                  <div className="section-header-block">
                    <h2 className="section-title">EVENT UPDATES</h2>
                    <p className="section-subtitle">Published updates from the event manager.</p>
                  </div>
                  {publishedAnnouncements.map((announcement) => (
                    <article className="event-announcement" key={announcement.id}>
                      <h3>{announcement.title}</h3>
                      <p>{announcement.message}</p>
                    </article>
                  ))}
                </section>
              )}
            </div>

            {/* RIGHT COLUMN: Neo-brutalist "CLAIM YOUR TICKET" Card */}
            <aside className="event-detail-sidebar">
              <div className="ticket-claim-card">
                <div className="ticket-claim-card__icon">
                  <Icon name="ticket" size={28} />
                </div>

                <h3 className="ticket-claim-card__title">
                  {existingReg ? "YOUR DIGITAL PASS" : "CLAIM YOUR TICKET"}
                </h3>

                <p className="ticket-claim-card__desc">
                  {existingReg
                    ? "You are confirmed for this event! Present your digital pass or QR ticket at the check-in desk."
                    : "Register to claim your seat. Your ticket pass code appears immediately after confirmation."}
                </p>

                {/* Remaining indicator */}
                <div className="ticket-seats-chip">
                  <span>Available Seats:</span> <b>{spotsRemaining} of {capacity}</b>
                </div>

                {!existingReg ? (
                  user?.role !== "user" ? (
                    <p className="ticket-registration-note">Registration is available to attendee accounts.</p>
                  ) :
                  !isRegistering ? (
                    <button
                      type="button"
                      className="btn-ticket-register"
                      onClick={() => setIsRegistering(true)}
                      disabled={!registrationOpen || spotsRemaining <= 0}
                    >
                      {!registrationOpen
                        ? registrationUnavailableLabel
                        : spotsRemaining > 0
                        ? "Register now"
                        : "Event full"}
                    </button>
                  ) : (
                    /* Inline Interactive Registration Form */
                    <form className="ticket-form" onSubmit={handleRegister}>
                      <div className="ticket-form__field">
                        <label>YOUR FULL NAME</label>
                        <input
                          type="text"
                          required
                          className="input"
                          placeholder="Your full name"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                        />
                      </div>

                      <div className="ticket-form__field">
                        <label>EMAIL ADDRESS</label>
                        <input
                          type="email"
                          required
                          className="input"
                          placeholder="student@nu-moa.edu.ph"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                        />
                      </div>

                      <div className="ticket-form__field">
                        <label>STUDENT / ORG ID</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g. 2024-108429"
                          value={formStudentId}
                          onChange={(e) => setFormStudentId(e.target.value)}
                        />
                      </div>

                      <div className="ticket-form__field">
                        <label>ATTENDEE TYPE</label>
                        <select
                          className="input"
                          value={ticketType}
                          onChange={(e) => setTicketType(e.target.value)}
                        >
                          <option value="Student Attendee">Student Attendee</option>
                          <option value="Faculty / Staff">Faculty / Staff</option>
                          <option value="Guest / Alumni">Guest / Alumni</option>
                        </select>
                      </div>

                      {regError && (
                        <p style={{ color: "var(--color-pink)", fontSize: "12px", fontWeight: "bold", margin: "6px 0 10px" }}>
                          {regError}
                        </p>
                      )}

                      <div className="ticket-form__actions">
                        <button
                          type="button"
                          className="btn-sm"
                          onClick={() => setIsRegistering(false)}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn-sm btn-sm--yellow">
                          Confirm & Issue Pass
                        </button>
                      </div>
                    </form>
                  )
                ) : (
                  /* Confirmed Digital Ticket Pass */
                  <div className="digital-ticket-pass">
                    <div className="ticket-pass__header">
                      <span>✓ CONFIRMED TICKET</span>
                      <b>#{existingReg.ticketCode}</b>
                    </div>
                    <div className="ticket-pass__body">
                      <h4>{existingReg.name}</h4>
                      <p>{existingReg.ticketType} · {existingReg.studentId || "Student"}</p>
                      <div className="ticket-pass__seat">
                        <span>Assigned Seat:</span> <b>{existingReg.seat}</b>
                      </div>
                    </div>
                    <div className="ticket-pass__barcode">
                      <div className="barcode-lines" />
                      <small>VERIFIED QR / CHECK-IN PASS</small>
                    </div>

                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <Link to="/my-events" className="btn-sm btn-sm--yellow btn-block" style={{ textAlign: "center", textDecoration: "none" }}>
                        View in My Events →
                      </Link>
                    </div>
                  </div>
                )}

                <div className="ticket-security-notice">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Registration availability and duplicate sign-ups are checked automatically.</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
