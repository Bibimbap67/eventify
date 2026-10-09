import React from "react";
import Icon from "./Icon.js";
import Spinner from "./Spinner.js";
import { usePending } from "./Motion.js";
import { Modal } from "./admin/ui.js";
import { seatOf } from "../data/seating.js";

export default function CancelModal({ registration, onConfirm, onClose }) {
  const [cancelling, runCancel] = usePending();
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
            <Icon name="alert" size={17} />{" "}
            {seatOf(registration)
              ? <>Seat <b>{seatOf(registration)}</b> will be released, and anyone registering can pick it.</>
              : "Your spot will be released for another student."}
          </p>

          <div className="action-row">
            <button type="button" className="btn-sm" onClick={close} disabled={cancelling}>
              Keep My Registration
            </button>
            <button
              type="button"
              className="btn-sm btn-sm--danger"
              onClick={() => runCancel(() => onConfirm(registration.id))}
              disabled={cancelling}
              aria-busy={cancelling || undefined}
            >
              {cancelling ? <><Spinner /> Cancelling…</> : "Yes, Cancel Ticket"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
