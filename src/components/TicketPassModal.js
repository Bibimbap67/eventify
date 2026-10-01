import React from "react";
import Icon from "./Icon.js";

export default function TicketPassModal({ registration, onClose }) {
  if (!registration) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ticket-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>EVENT ADMISSION PASS</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="modal__body ticket-modal__body">
          <div className="printable-ticket">
            <div className="printable-ticket__top">
              <span className="printable-ticket__org">NATIONAL UNIVERSITY · EVENTIFY</span>
              <span className="printable-ticket__code">#{registration.ticketCode}</span>
            </div>

            <h3 className="printable-ticket__title">{registration.eventTitle}</h3>

            <div className="printable-ticket__grid">
              <div>
                <small>ATTENDEE</small>
                <strong>{registration.name}</strong>
              </div>
              <div>
                <small>TICKET TYPE</small>
                <strong>{registration.ticketType || "General Admission"}</strong>
              </div>
              <div>
                <small>DATE & TIME</small>
                <strong>{registration.fullDate || registration.date} · {registration.time}</strong>
              </div>
              <div>
                <small>VENUE</small>
                <strong>{registration.location}</strong>
              </div>
            </div>

            <div className="printable-ticket__seat-box">
              <span>RESERVED SEAT:</span>
              <b>{registration.seat}</b>
            </div>

            <div className="printable-ticket__barcode">
              <div className="barcode-bars" />
              <span>{registration.ticketCode} · OFFICIAL CHECK-IN PASS</span>
            </div>

            <div className="printable-ticket__status">
              ATTENDANCE STATUS: <b>{registration.attendanceStatus || "Not Checked In"}</b>
              {registration.checkedInAt && <span> (Checked in at {registration.checkedInAt})</span>}
            </div>
          </div>

          <div className="ticket-modal__actions">
            <button type="button" className="btn-sm btn-sm--yellow" onClick={handlePrint}>
              <Icon name="print" size={16} /> Print / Save Pass
            </button>
            <button type="button" className="btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
