import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import Icon from "../components/Icon.js";
import { useEventContext } from "../context/EventContext.js";
import TicketPassModal from "../components/TicketPassModal.js";
import FeedbackModal from "../components/FeedbackModal.js";
import CancelModal from "../components/CancelModal.js";

export default function MyEventsPage() {
  const { events, registrations, cancelRegistration, checkInAttendee, completeAttendance, submitFeedback } = useEventContext();
  const [activeTab, setActiveTab] = useState("upcoming");

  // Modals state
  const [ticketModalTarget, setTicketModalTarget] = useState(null);
  const [feedbackModalTarget, setFeedbackModalTarget] = useState(null);
  const [cancelModalTarget, setCancelModalTarget] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Filter registrations
  const upcomingRegs = registrations.filter(
    (r) => r.status === "Confirmed" && r.attendanceStatus !== "Attended"
  );
  const pastRegs = registrations.filter(
    (r) => r.status === "Confirmed" && r.attendanceStatus === "Attended"
  );
  const cancelledRegs = registrations.filter((r) => r.status === "Cancelled");

  // Handlers
  const handleCheckIn = (reg) => {
    checkInAttendee(reg.id);
    showToast(`Check-in recorded for ${reg.eventTitle}.`);
  };

  const handleCompleteAttendance = (reg) => {
    completeAttendance(reg.id);
    showToast(`${reg.eventTitle} is marked as attended. Feedback is now available in Past & Attended.`);
  };

  const handleCancelConfirm = (regId) => {
    cancelRegistration(regId);
    setCancelModalTarget(null);
    showToast("Registration cancelled. Your reserved seat has been released.");
  };

  const handleFeedbackSubmit = (feedbackData) => {
    if (feedbackModalTarget) {
      submitFeedback(feedbackModalTarget.id, feedbackData);
      setFeedbackModalTarget(null);
      showToast("Thank you! Your feedback has been recorded.");
    }
  };

  return (
    <div className="my-events-page">
      <Navbar />

      <main className="my-events-container">
        {/* Header */}
        <div className="my-events-header">
          <div>
            <span className="events-hero__eyebrow">ATTENDEE DASHBOARD</span>
            <h1 className="my-events-title">MY EVENTS & TICKETS</h1>
          </div>
          <Link to="/events" className="btn-sm btn-sm--yellow">
            + Discover More Events
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="my-events-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === "upcoming" ? "tab-btn--active" : ""}`}
            onClick={() => setActiveTab("upcoming")}
          >
            Upcoming Events ({upcomingRegs.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "past" ? "tab-btn--active" : ""}`}
            onClick={() => setActiveTab("past")}
          >
            Past & Attended ({pastRegs.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "cancelled" ? "tab-btn--active" : ""}`}
            onClick={() => setActiveTab("cancelled")}
          >
            Cancelled ({cancelledRegs.length})
          </button>
        </div>

        {/* TAB 1: UPCOMING */}
        {activeTab === "upcoming" && (
          <div className="tab-content">
            {upcomingRegs.length === 0 ? (
              <div className="empty-events-box">
                <span className="empty-box__icon"><Icon name="ticket" size={28} /></span>
                <h3>No upcoming event registrations</h3>
                <p>You haven't reserved tickets for any upcoming events yet. Explore open conferences and workshops today!</p>
                <Link to="/events" className="btn-sm btn-sm--yellow">
                  Browse Campus Events →
                </Link>
              </div>
            ) : (
              <div className="registrations-list">
                {upcomingRegs.map((reg) => (
                  <article key={reg.id} className="registration-card">
                    <div className="reg-card__top">
                      <div className="reg-card__badges">
                        <span className="sbadge sbadge--confirmed">CONFIRMED TICKET</span>
                        <span
                          className={`sbadge ${
                            reg.attendanceStatus === "Checked In" ? "sbadge--checked-in" : "sbadge--pending"
                          }`}
                        >
                          {reg.attendanceStatus === "Checked In" ? "✓ CHECKED IN" : "NOT CHECKED IN"}
                        </span>
                      </div>
                      <span className="reg-card__code">#{reg.ticketCode}</span>
                    </div>

                    <h3 className="reg-card__title">{reg.eventTitle}</h3>

                    <div className="reg-card__details">
                      <div>
                        <small>DATE & TIME</small>
                        <strong>{reg.fullDate || reg.date} · {reg.time}</strong>
                      </div>
                      <div>
                        <small>VENUE</small>
                        <strong>{reg.location}</strong>
                      </div>
                      <div>
                        <small>RESERVED SEAT</small>
                        <strong>{reg.seat}</strong>
                      </div>
                      <div>
                        <small>REGISTRATION TYPE</small>
                        <strong>{reg.ticketType || "Student Attendee"}</strong>
                      </div>
                    </div>

                    <div className="reg-card__footer">
                      <div className="reg-card__actions">
                        <button
                          type="button"
                          className="btn-sm btn-sm--yellow"
                          onClick={() => setTicketModalTarget(reg)}
                        >
                          <Icon name="ticket" size={16} /> View Digital Pass
                        </button>

                        {reg.attendanceStatus !== "Checked In" ? (
                          <button
                            type="button"
                            className="btn-sm"
                            onClick={() => handleCheckIn(reg)}
                          >
                            <Icon name="pin" size={16} /> Check in
                          </button>
                        ) : events.find((event) => event.id === reg.eventId)?.status === "COMPLETED" ? (
                          <button
                            type="button"
                            className="btn-sm btn-sm--blue"
                            onClick={() => handleCompleteAttendance(reg)}
                          >
                            Complete attendance
                          </button>
                        ) : (
                          <button type="button" className="btn-sm" disabled>Awaiting event completion</button>
                        )}

                        <Link to={`/events/${reg.eventId}`} className="btn-sm">
                          Event Info
                        </Link>
                      </div>

                      <button
                        type="button"
                        className="btn-sm btn-sm--danger"
                        onClick={() => setCancelModalTarget(reg)}
                      >
                        Cancel Ticket
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PAST / COMPLETED */}
        {activeTab === "past" && (
          <div className="tab-content">
            {pastRegs.length === 0 ? (
              <div className="empty-events-box">
                <span className="empty-box__icon"><Icon name="certificate" size={28} /></span>
                <h3>No completed event records</h3>
                <p>Events you attend and check in for will appear here alongside your official certificates of participation.</p>
              </div>
            ) : (
              <div className="registrations-list">
                {pastRegs.map((reg) => (
                  <article key={reg.id} className="registration-card registration-card--past">
                    <div className="reg-card__top">
                      <div className="reg-card__badges">
                        <span className="sbadge sbadge--active">ATTENDED</span>
                        <span className="sbadge sbadge--confirmed">COMPLETED</span>
                      </div>
                      <span className="reg-card__code">#{reg.ticketCode}</span>
                    </div>

                    <h3 className="reg-card__title">{reg.eventTitle}</h3>

                    <div className="reg-card__details">
                      <div>
                        <small>EVENT DATE</small>
                        <strong>{reg.fullDate || reg.date}</strong>
                      </div>
                      <div>
                        <small>VENUE</small>
                        <strong>{reg.location}</strong>
                      </div>
                      <div>
                        <small>CHECK-IN TIMESTAMP</small>
                        <strong>{reg.checkedInAt || "Verified"}</strong>
                      </div>
                    </div>

                    {/* Feedback Status Snippet */}
                    {reg.feedback && (
                      <div className="reg-card__feedback-summary">
                        <span>YOUR RATING: <b>{Array.from({ length: reg.feedback.overall }, (_, index) => <Icon key={index} name="star" size={12} />)}</b> ({reg.feedback.overall}/5)</span>
                        <p>“{reg.feedback.comment}”</p>
                      </div>
                    )}

                    <div className="reg-card__footer">
                      <div className="reg-card__actions">
                        <Link to="/certificates" className="btn-sm btn-sm--yellow">
                          <Icon name="certificate" size={16} /> View Certificate
                        </Link>

                        {!reg.feedback ? (
                          <button
                            type="button"
                            className="btn-sm"
                            onClick={() => setFeedbackModalTarget(reg)}
                          >
                            <Icon name="message" size={16} /> Give Feedback
                          </button>
                        ) : (
                          <span className="feedback-done-chip">✓ Feedback Submitted</span>
                        )}

                        <Link to={`/events/${reg.eventId}`} className="btn-sm">
                          Event Overview
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CANCELLED */}
        {activeTab === "cancelled" && (
          <div className="tab-content">
            {cancelledRegs.length === 0 ? (
              <div className="empty-events-box">
                <span className="empty-box__icon"><Icon name="check" size={28} /></span>
                <h3>No cancelled registrations</h3>
                <p>You have not cancelled any event reservations.</p>
              </div>
            ) : (
              <div className="registrations-list">
                {cancelledRegs.map((reg) => (
                  <article key={reg.id} className="registration-card registration-card--cancelled">
                    <div className="reg-card__top">
                      <span className="sbadge sbadge--cancelled">CANCELLED</span>
                      <small>Cancelled on {reg.cancelledAt || "Recently"}</small>
                    </div>

                    <h3 className="reg-card__title">{reg.eventTitle}</h3>
                    <p style={{ fontSize: "13px", color: "#666", margin: "4px 0 14px" }}>
                      {reg.fullDate || reg.date} · {reg.location}
                    </p>

                    <div className="reg-card__footer">
                      <Link to={`/events/${reg.eventId}`} className="btn-sm btn-sm--yellow">
                        View Event & Re-register
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Ticket Pass Modal */}
      {ticketModalTarget && (
        <TicketPassModal
          registration={ticketModalTarget}
          onClose={() => setTicketModalTarget(null)}
        />
      )}

      {/* Feedback Modal */}
      {feedbackModalTarget && (
        <FeedbackModal
          registration={feedbackModalTarget}
          onSubmit={handleFeedbackSubmit}
          onClose={() => setFeedbackModalTarget(null)}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalTarget && (
        <CancelModal
          registration={cancelModalTarget}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelModalTarget(null)}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
