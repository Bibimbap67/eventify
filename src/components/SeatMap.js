import React, { useEffect, useId, useMemo, useState } from "react";
import Icon from "./Icon.js";
import { Modal } from "./admin/ui.js";
import { api } from "../api.js";
import { AISLE_AFTER, SEATS_PER_ROW, seatRows } from "../data/seating.js";

// The reserved-seating map: a stage, lettered rows of ten with an aisle, and three seat states.
// With `onSelect` the open seats are buttons; without it the map is a picture (a preview,
// or the manager's view, where `holders` names who sits where).
export default function SeatMap({ capacity, taken = [], selected = "", onSelect, holders }) {
  const rows = useMemo(() => seatRows(capacity), [capacity]);
  const takenSet = useMemo(() => new Set(taken), [taken]);
  const open = rows.reduce((sum, row) => sum + row.seats.filter((seat) => seat && !takenSet.has(seat)).length, 0);

  const seat = (id, number) => {
    const isTaken = takenSet.has(id);
    const isSelected = id === selected;
    const className = `seatmap__seat${isTaken ? " is-taken" : ""}${isSelected ? " is-selected" : ""}`;
    if (!onSelect) {
      return <span className={className} title={holders?.[id] ? `${id} · ${holders[id]}` : id}>{number}</span>;
    }
    return (
      <button
        type="button"
        className={className}
        disabled={isTaken}
        aria-pressed={isSelected}
        aria-label={`Seat ${id}${isTaken ? ", taken" : ""}`}
        onClick={() => onSelect(isSelected ? "" : id)}
      >
        {number}
      </button>
    );
  };

  return (
    <div className="seatmap">
      <div className="seatmap__stage">STAGE / SCREEN</div>
      <div className="seatmap__scroll">
        <div className="seatmap__grid" aria-hidden={onSelect ? undefined : "true"}>
          {rows.map((row) => (
            <div className="seatmap__row" key={row.label}>
              <span className="seatmap__label" aria-hidden="true">{row.label}</span>
              {row.seats.map((id, index) => (
                <React.Fragment key={index}>
                  {index === AISLE_AFTER && <span className="seatmap__aisle" />}
                  {id ? seat(id, index + 1) : <span className="seatmap__seat seatmap__seat--none" />}
                </React.Fragment>
              ))}
              <span className="seatmap__label" aria-hidden="true">{row.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="seatmap__legend">
        <span><i className="seatmap__key" /> Available ({open})</span>
        {onSelect && <span><i className="seatmap__key is-selected" /> Your seat</span>}
        <span><i className="seatmap__key is-taken" /> Taken ({takenSet.size})</span>
        <span className="seatmap__size">{rows.length} {rows.length === 1 ? "row" : "rows"} · {SEATS_PER_ROW} per row</span>
      </div>
    </div>
  );
}

// The attendee's seat picker. Taken seats load fresh each time it opens.
export function SeatPickerModal({ event, initial = "", onPick, onClose }) {
  const [taken, setTaken] = useState(null);
  const [error, setError] = useState("");
  const [seat, setSeat] = useState(initial);

  useEffect(() => {
    api(`/events/${event.id}/seats`)
      .then((data) => {
        setTaken(data.taken);
        setSeat((current) => (data.taken.includes(current) ? "" : current));
      })
      .catch((err) => setError(err.message));
  }, [event.id]);

  return (
    <Modal title="PICK YOUR SEAT" onClose={onClose} className="seat-modal">
      {(close) => (
        <>
          {error ? (
            <p className="form-error" role="alert">{error}</p>
          ) : taken === null ? (
            <p className="seat-modal__loading">Loading the seat map…</p>
          ) : (
            <SeatMap capacity={event.capacity} taken={taken} selected={seat} onSelect={setSeat} />
          )}
          <div className="seat-modal__ticket">
            <small>YOUR SEAT</small>
            <b>{seat ? `SEAT ${seat}` : "NO SEAT YET"}</b>
            <span>{seat ? "It is held for you once you confirm your registration." : "Tap an open seat on the map."}</span>
          </div>
          <div className="action-row">
            <button type="button" className="btn-sm" onClick={close}>Cancel</button>
            <button
              type="button"
              className="btn-sm btn-sm--yellow"
              disabled={!seat}
              onClick={() => {
                onPick(seat);
                close();
              }}
            >
              <Icon name="check" size={16} /> {seat ? `Use seat ${seat}` : "Use seat"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

const SEATING_OPTIONS = [
  { value: "free", icon: "users", title: "Free seating", text: "First come, first served. Tickets carry no seat number." },
  { value: "reserved", icon: "armchair", title: "Reserved seating", text: "Attendees pick their own seat on a map when they register." },
];

// Event forms: free vs reserved seating, with a preview of the map for reserved.
// `locked` once people have registered (the server refuses the change too).
export function SeatingField({ value, onChange, capacity, locked = false }) {
  const name = useId();
  const current = value === "reserved" ? "reserved" : "free";
  const seats = Math.floor(Number(capacity) || 0);
  return (
    <fieldset className="seating-field">
      <legend>Seating</legend>
      <div className="seating-field__options">
        {SEATING_OPTIONS.map((option) => (
          <label key={option.value} className={`seating-option${current === option.value ? " is-on" : ""}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={current === option.value}
              disabled={locked && current !== option.value}
              onChange={() => onChange(option.value)}
            />
            <Icon name={option.icon} size={20} />
            <span>
              <strong>{option.title}</strong>
              <small>{option.text}</small>
            </span>
          </label>
        ))}
      </div>
      {locked && <p className="seating-field__note"><Icon name="info" size={16} /> Seating is locked because people have already registered.</p>}
      {current === "reserved" && (
        seats > 0
          ? <SeatMap capacity={seats} />
          : <p className="seating-field__note">Enter a capacity to preview the seat map.</p>
      )}
    </fieldset>
  );
}
