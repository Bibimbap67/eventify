// Reserved-seating layout: seats run ten to a row (A1–A10, B1–B10, …, then AA1 after Z),
// filled up to the event's capacity. The React app draws the same map from
// src/data/seating.js; keep the two in step.
const SEATS_PER_ROW = 10;

function rowLabel(index) {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}

const seatId = (index) => `${rowLabel(Math.floor(index / SEATS_PER_ROW))}${(index % SEATS_PER_ROW) + 1}`;

// Position of a seat id on the map (A1 = 0), or -1 when it is not a seat id.
function seatIndex(seat) {
  const match = /^([A-Z]+)(\d+)$/.exec(String(seat || ""));
  if (!match) return -1;
  const row = [...match[1]].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
  const number = Number(match[2]);
  return number >= 1 && number <= SEATS_PER_ROW ? row * SEATS_PER_ROW + number - 1 : -1;
}

const onMap = (seat, capacity) => {
  const index = seatIndex(seat);
  return index >= 0 && index < Number(capacity || 0);
};

function firstFreeSeat(capacity, taken) {
  for (let index = 0; index < Number(capacity || 0); index += 1) {
    if (!taken.has(seatId(index))) return seatId(index);
  }
  return null;
}

module.exports = { SEATS_PER_ROW, seatId, seatIndex, onMap, firstFreeSeat };
