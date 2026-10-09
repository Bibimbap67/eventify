// Reserved-seating layout: seats run ten to a row (A1–A10, B1–B10, …, then AA1 after Z),
// with an aisle after seat 5, filled up to the event's capacity. The server checks seats
// against the same layout in server/utils/seating.js; keep the two in step.
export const SEATS_PER_ROW = 10;
export const AISLE_AFTER = 5;

function rowLabel(index) {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}

// [{ label: "A", seats: ["A1", …, "A10"] }, …]; the last row is padded with nulls.
export function seatRows(capacity) {
  const total = Math.max(0, Math.floor(Number(capacity) || 0));
  return Array.from({ length: Math.ceil(total / SEATS_PER_ROW) }, (_, row) => {
    const label = rowLabel(row);
    const seats = Array.from({ length: SEATS_PER_ROW }, (_, col) => (row * SEATS_PER_ROW + col < total ? `${label}${col + 1}` : null));
    return { label, seats };
  });
}

export const isReserved = (event) => event?.seating === "reserved";

// The seat printed on a ticket. Free-seating tickets have none, whatever older records hold.
export const seatOf = (registration) => (registration?.seating === "reserved" && registration.seat) || "";
