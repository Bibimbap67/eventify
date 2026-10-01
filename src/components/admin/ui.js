import React, { useEffect } from "react";
import Icon from "../Icon.js";

export function StatusBadge({ value }) {
  const statusText = String(value || "").toLowerCase();
  const statusName = statusText.split(" ").join("-");

  return <span className={"sbadge sbadge--" + statusName}>{value}</span>;
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={handleModalClick}>
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
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
      <p style={{ margin: "0 0 18px", fontSize: "14px", lineHeight: "1.5" }}>{message}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button type="button" className="btn-sm" onClick={onCancel}>
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
    </Modal>
  );
}

export function FormField({ label, error, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}

export function DataTable({ columns, rows, renderActions }) {
  if (!rows || rows.length === 0) {
    return <p className="empty">No records match your filters.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label}>{column.label}</th>
            ))}
            {renderActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.label}>{column.render(row)}</td>
              ))}
              {renderActions && <td className="table__actions">{renderActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}