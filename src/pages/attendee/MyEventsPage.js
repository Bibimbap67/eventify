import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar.js";
import Icon from "../../components/Icon.js";
import { useEntering } from "../../components/Motion.js";
import { useEventContext } from "../../context/EventContext.js";
import TicketPassModal from "../../components/attendee/TicketPassModal.js";
import { ExitScanButton } from "../../components/attendee/ExitScan.js";
import { Pagination, usePaged } from "../../components/admin/parts.js";
import FeedbackModal from "../../components/attendee/FeedbackModal.js";
import CancelModal from "../../components/attendee/CancelModal.js";
import { notify } from "../../components/Toast.js";
import { seatOf } from "../../data/seating.js";
import { isCheckedIn } from "../../data/checkIn.js";
import { ATTENDEE_TYPE } from "../../data/student.js";
import { formatTimesIn } from "../../data/time.js";

const PAGE_SIZE = 10;

export default function MyEventsPage() {
  const entering = useEntering();
  const { events, registrations, cancelRegistration, submitFeedback } = useEventContext();
  const [activeTab, setActiveTab] = useState("upcoming");

  // Modals state
  const [ticketModalTarget, setTicketModalTarget] = useState(null);
  const [feedbackModalTarget, setFeedbackModalTarget] = useState(null);
  const [cancelModalTarget, setCancelModalTarget] = useState(null);

  // Filter registrations. A ticket for an event the organizer cancelled moves to Cancelled.
  const calledOff = (r) => events.find((event) => event.id === r.eventId)?.status === "CANCELLED";
  const upcomingRegs = registrations.filter(
    (r) => r.status === "Confirmed" && r.attendanceStatus !== "Attended" && !calledOff(r)
  );
  const pastRegs = registrations.filter(
    (r) => r.status === "Confirmed" && r.attendanceStatus === "Attended"
  );
  const cancelledRegs = registrations.filter((r) => r.status === "Cancelled" || calledOff(r));
  const tabRegs = { upcoming: upcomingRegs, past: pastRegs, cancelled: cancelledRegs }[activeTab];
  const { page, setPage, shown } = usePaged(tabRegs, PAGE_SIZE, activeTab);

  // Handlers
  const handleCancelConfirm = (regId) => {
    cancelRegistration(regId);
    setCancelModalTarget(null);
    notify("Your spot has been released for someone else.", "warning", "Registration cancelled");
  };

  const handleFeedbackSubmit = (feedbackData) => {
    if (feedbackModalTarget) {
      submitFeedback(feedbackModalTarget.id, feedbackData);
      setFeedbackModalTarget(null);
      notify("Thank you! Your feedback has been recorded.", "success", "Feedback sent");
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
                  Browse Campus Events <Icon name="arrow-right" size={16} />
                </Link>
              </div>
            ) : (
              <div className={`registrations-list${entering ? " stagger" : ""}`}>
                {shown.map((reg) => (
                  <article key={reg.id} className="registration-card">
                    <div className="reg-card__top">
                      <div className="reg-card__badges">
                        <span className="sbadge sbadge--confirmed">CONFIRMED TICKET</span>
                        <span
                          className={`sbadge ${
                            isCheckedIn(reg) ? "sbadge--checked-in" : "sbadge--not-checked-in"
                          }`}
                        >
                          {isCheckedIn(reg) ? <><Icon name="check" size={16} /> CHECKED IN</> : "NOT CHECKED IN"}
                        </span>
                      </div>
                      <span className="reg-card__code">#{reg.ticketCode}</span>
                    </div>

                    <h3 className="reg-card__title">{reg.eventTitle}</h3>

                    <div className="reg-card__details">
                      <div>
                        <small>DATE & TIME</small>
                        <strong>{reg.fullDate || reg.date} · {formatTimesIn(reg.time)}</strong>
                      </div>
                      <div>
                        <small>VENUE</small>
                        <strong>{reg.location}</strong>
                      </div>
                      <div>
                        <small>{seatOf(reg) ? "RESERVED SEAT" : "SEATING"}</small>
                        <strong>{seatOf(reg) || "Free seating"}</strong>
                      </div>
                      <div>
                        <small>REGISTRATION TYPE</small>
                        <strong>{ATTENDEE_TYPE}</strong>
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

                        {/* Staff scan the pass to check in; the attendee scans the exit QR on the way out. */}
                        {isCheckedIn(reg) && <ExitScanButton event={events.find((event) => event.id === reg.eventId)} />}

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
              <div className={`registrations-list${entering ? " stagger" : ""}`}>
                {shown.map((reg) => (
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
                          <span className="feedback-done-chip"><Icon name="check" size={16} /> Feedback Submitted</span>
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
              <div className={`registrations-list${entering ? " stagger" : ""}`}>
                {shown.map((reg) => (
                  <article key={reg.id} className="registration-card registration-card--cancelled">
                    <div className="reg-card__top">
                      <span className="sbadge sbadge--cancelled">CANCELLED</span>
                      <small>{calledOff(reg) ? "Event cancelled by the organizer" : `Cancelled on ${reg.cancelledAt || "Recently"}`}</small>
                    </div>

                    <h3 className="reg-card__title">{reg.eventTitle}</h3>
                    <p className="reg-card__note">
                      {reg.fullDate || reg.date} · {reg.location}
                    </p>

                    <div className="reg-card__footer">
                      <Link to={`/events/${reg.eventId}`} className="btn-sm btn-sm--yellow">
                        {calledOff(reg) ? "View Event" : "View Event & Re-register"}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        <Pagination page={page} limit={PAGE_SIZE} total={tabRegs.length} noun="ticket" onPage={setPage} buttonClass="btn-sm" />
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
    </div>
  );
}
