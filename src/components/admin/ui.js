import React from "react";
import Icon from "../Icon.js";
import { useDialog } from "../Motion.js";

export function StatusBadge({ value }) {
  const statusText = String(value || "").toLowerCase();
  const statusName = statusText.split(" ").join("-");

  return <span className={"sbadge sbadge--" + statusName}>{value}</span>;
}

// Shared by admin and attendee dialogs. `children` may be a function that receives the
// animated close, for "Cancel" buttons inside the dialog.
export function Modal({ title, onClose, children, className = "", tone }) {
  // Escape, focus return and the exit animation live in useDialog.
  const [dialogRef, close] = useDialog(onClose);

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className={`modal${className ? ` ${className}` : ""}`} ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={handleModalClick}>
        <div className={`modal__head${tone ? ` modal__head--${tone}` : ""}`}>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal__body">{typeof children === "function" ? children(close) : children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({
  title = "Confirm Action",
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  confirmVariant = "danger",
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      {(close) => (
        <>
          <p className="modal-text">{message}</p>
          <div className="action-row">
            <button type="button" className="btn-sm" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn-sm ${confirmVariant === "danger" ? "btn-sm--danger" : "btn-sm--yellow"}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
