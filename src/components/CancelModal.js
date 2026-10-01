import React from "react";
import Icon from "./Icon.js";

export default function CancelModal({ registration, onConfirm, onClose }) {
  if (!registration) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head" style={{ background: "var(--color-pink)" }}>
          <h2>CANCEL REGISTRATION</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="modal__body">
          <p style={{ fontSize: "15px", lineHeight: "1.5", margin: "0 0 16px" }}>
            Are you sure you want to cancel your registration for{" "}
            <b>{registration.eventTitle}</b>?
          </p>
          <p className="notice" style={{ margin: "0 0 20px" }}>
            <Icon name="alert" size={17} /> Your reserved seat (<b>{registration.seat}</b>) will be released and made available to other students on the waitlist.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" className="btn-sm" onClick={onClose}>
              Keep My Registration
            </button>
            <button
              type="button"
              className="btn-sm btn-sm--danger"
              onClick={() => onConfirm(registration.id)}
            >
              Yes, Cancel Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
