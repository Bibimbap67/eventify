import React from "react";
import Icon from "./Icon.js";
import { Modal } from "./admin/ui.js";

export default function CancelModal({ registration, onConfirm, onClose }) {
  if (!registration) return null;

  return (
    <Modal title="CANCEL REGISTRATION" onClose={onClose} tone="danger">
      {(close) => (
        <>
          <p className="modal-text">
            Are you sure you want to cancel your registration for{" "}
            <b>{registration.eventTitle}</b>?
          </p>
          <p className="notice">
            <Icon name="alert" size={17} /> Your reserved seat (<b>{registration.seat}</b>) will be released and made available to other students on the waitlist.
          </p>

          <div className="action-row">
            <button type="button" className="btn-sm" onClick={close}>
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
        </>
      )}
    </Modal>
  );
}
