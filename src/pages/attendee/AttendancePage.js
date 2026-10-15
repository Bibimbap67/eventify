import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar.js";
import Icon from "../../components/Icon.js";
import { useEntering } from "../../components/Motion.js";
import { useEventContext } from "../../context/EventContext.js";
import TicketPassModal from "../../components/attendee/TicketPassModal.js";
import { ExitScanButton } from "../../components/attendee/ExitScan.js";
import { seatOf } from "../../data/seating.js";
import { attendanceKey, isCheckedIn } from "../../data/checkIn.js";
import { formatTimesIn } from "../../data/time.js";

export default function AttendancePage() {
  const entering = useEntering();
  const { events, registrations } = useEventContext();
  const [selectedPass, setSelectedPass] = useState(null);

  const confirmedRegs = registrations.filter((r) => r.status === "Confirmed" && events.find((event) => event.id === r.eventId)?.status !== "CANCELLED");
  const checkedInCount = confirmedRegs.filter(isCheckedIn).length;
  const pendingCount = confirmedRegs.length - checkedInCount;

  return (
    <div className="attendance-page">
      <Navbar />

      <main className="attendance-container">
        {/* Header */}
        <div className="attendance-header">
          <div>
            <span className="events-hero__eyebrow">PARTICIPATION VERIFICATION</span>
            <h1 className="attendance-title">ATTENDANCE & CHECK-IN DESK</h1>
            <p className="attendance-subtitle">
              Verify your physical check-in status, present digital entry passes, and validate hours for official certificates.
            </p>
          </div>

          <Link to="/my-events" className="btn-sm">
            <Icon name="arrow-left" size={16} /> Back to My Events
          </Link>
        </div>

        {/* Attendance Summary Metrics */}
        <div className="attendance-stats-strip">
          <div className="att-stat-box">
            <span>REGISTERED EVENTS</span>
            <strong>{confirmedRegs.length}</strong>
          </div>
          <div className="att-stat-box">
            <span>VERIFIED & ATTENDED</span>
            <strong>{checkedInCount}</strong>
          </div>
          <div className="att-stat-box">
            <span>PENDING ON-SITE CHECK-IN</span>
            <strong className="att-stat-box__value--alert">{pendingCount}</strong>
          </div>
        </div>

        {/* Attendance Records Table / List */}
        {confirmedRegs.length === 0 ? (
          <div className="empty-events-box">
            <span className="empty-box__icon"><Icon name="pin" size={28} /></span>
            <h3>No event registrations to check in for</h3>
            <p>Register for upcoming events to view your check-in credentials here.</p>
            <Link to="/events" className="btn-sm btn-sm--yellow">
              Browse Events <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        ) : (
          <div className={`attendance-list${entering ? " stagger" : ""}`}>
            {confirmedRegs.map((reg) => {
              const state = attendanceKey(reg.attendanceStatus);
              return (
              <div key={reg.id} className="attendance-card">
                <div className="attendance-card__left">
                  <div className="attendance-card__status-line">
                    <span className={`sbadge sbadge--${state === "waiting" ? "not-checked-in" : state}`}>
                      {state === "waiting"
                        ? "NOT CHECKED IN"
                        : <><Icon name="check" size={16} /> {state === "attended" ? "ATTENDED" : "CHECKED IN"}</>}
                    </span>
                    <span className="attendance-card__date">{reg.fullDate || reg.date} · {formatTimesIn(reg.time)}</span>
                  </div>

                  <h3 className="attendance-card__title">{reg.eventTitle}</h3>
                  <p className="attendance-card__venue">
                    <Icon name="pin" size={15} /> {reg.location} · <b>{seatOf(reg) ? `Seat ${seatOf(reg)}` : "Free seating"}</b>
                  </p>

                  <div className="attendance-card__meta">
                    <span>Ticket Code: <b>#{reg.ticketCode}</b></span>
                    <span>Attendee: <b>{reg.name}</b></span>
                    {reg.checkedInAt && (
                      <span className="checkedin-time-text">
                        Check-in Time: <b>{reg.checkedInAt}</b>
                      </span>
                    )}
                    {reg.exitedAt && (
                      <span className="checkedin-time-text">
                        Exit Time: <b>{reg.exitedAt}</b>
                      </span>
                    )}
                  </div>
                </div>

                <div className="attendance-card__right">
                  <button
                    type="button"
                    className="btn-sm btn-sm--yellow"
                    onClick={() => setSelectedPass(reg)}
                  >
                    <Icon name="qr" size={16} /> Digital Pass & QR
                  </button>

                  {/* Staff scan the pass to check in; the attendee scans the exit QR on the way out. */}
                  {state === "attended" ? (
                    <Link to="/certificates" className="btn-sm">
                      <Icon name="certificate" size={16} /> View Certificate
                    </Link>
                  ) : state === "checked-in" ? (
                    <ExitScanButton event={events.find((event) => event.id === reg.eventId)} />
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Ticket Pass Modal */}
      {selectedPass && (
        <TicketPassModal
          registration={selectedPass}
          onClose={() => setSelectedPass(null)}
        />
      )}
    </div>
  );
}
