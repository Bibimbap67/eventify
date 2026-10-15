import React, { useEffect, useRef, useState } from "react";
import Icon from "../Icon.js";
import { useConfirm } from "../Modal.js";
import { CapacityBar, EmptyState, FilterChips, PersonCell, SearchField, StatusBadge, Table } from "../ui.js";
import { useManager } from "../../context/ManagerContext.js";
import { attendanceKey, checkInOpensAt, exitPhase, isCheckedIn, opensLabel } from "../../data/checkIn.js";
import { api } from "../../api.js";
import { seatOf } from "../../data/seating.js";

// The registration desk (confirm / cancel / check in) and the event-day attendance desk.

const ATTENDANCE_FILTERS = [
  { value: "All", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "checked-in", label: "Checked in" },
  { value: "attended", label: "Attended" },
];

const timeNow = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const matchesQuery = (item, query) => `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase());

// Rows you just acted on stay where they are until the search or filter changes. The next row
// never slides under the pointer, and a mistaken click can be undone on the same row.
function useKeptRows(resetKey) {
  const [kept, setKept] = useState({ key: resetKey, ids: new Set() });
  // The search or filter changed: start a fresh list (React re-renders straight away).
  if (kept.key !== resetKey) setKept({ key: resetKey, ids: new Set() });
  const ids = kept.key === resetKey ? kept.ids : new Set();
  const keep = (id) => setKept((current) => ({ key: current.key, ids: new Set(current.ids).add(id) }));
  return [ids, keep];
}

// Check in / undo, with a short green flash on the row that was just checked in.
function useCheckIn(onToggle) {
  const { updateRegistration, toast } = useManager();
  const [flashId, setFlashId] = useState(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  function toggle(item) {
    const checked = isCheckedIn(item);
    updateRegistration(item.id, { attendanceStatus: checked ? "Not Checked In" : "Checked in", checkedInAt: checked ? "" : timeNow() });
    toast(checked ? "Check-in undone." : `${item.name} checked in.`, checked ? "warning" : "success");
    onToggle?.(item.id);
    if (!checked) {
      setFlashId(item.id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlashId(null), 900);
    }
  }

  return [toggle, flashId];
}

// The manager's override when an attendee couldn't scan the exit QR (dead phone, left early with
// staff's OK). The server checks the ticket was checked in, records who did it in the audit log,
// and issues the certificate like a scan would.
function MarkExitedButton({ item }) {
  const { reloadManagerData, toast } = useManager();
  const [dialog, confirm] = useConfirm();
  const [busy, setBusy] = useState(false);

  const markExited = async () => {
    setBusy(true);
    try {
      const res = await api(`/registrations/${encodeURIComponent(item.id)}/exit`, { method: "POST" });
      toast(res.message, "success");
      reloadManagerData();
    } catch (err) {
      toast(err.message, "error");
    }
    setBusy(false);
  };

  return (
    <>
      <button
        type="button"
        className="manager-button manager-button--small"
        disabled={busy}
        onClick={() => confirm({
          title: "Mark as exited?",
          message: `Use this only if ${item.name} really attended and couldn't scan the exit QR. They get their certificate, and your name is recorded in the audit log.`,
          confirmText: "Mark exited",
          confirmVariant: "primary",
          onConfirm: markExited,
        })}
        aria-label={`Mark ${item.name} as exited`}
      >
        <Icon name="logout" size={16} /> Mark exited
      </button>
      {dialog}
    </>
  );
}

function CheckInControl({ item, event, onToggle }) {
  const state = attendanceKey(item.attendanceStatus);
  const opensAt = checkInOpensAt(event);
  const wait = opensAt ? opensAt - Date.now() : 0;
  const [, rerender] = useState(0);
  // Re-render the moment the event starts so the button unlocks without a page refresh.
  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => rerender((n) => n + 1), wait + 50);
    return () => clearTimeout(timer);
  }, [opensAt?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === "waiting" && wait > 0) {
    return (
      <button type="button" className="manager-button manager-button--small" disabled title="Check-in opens when the event starts">
        <Icon name="clock" size={16} /> Opens {opensLabel(opensAt)}
      </button>
    );
  }
  if (state === "attended") return <span className="manager-checkin__done"><Icon name="check" size={16} /> Attended</span>;
  if (state === "checked-in") {
    return (
      <span className="manager-row-buttons">
        <button type="button" className="manager-button manager-button--small" onClick={() => onToggle(item)} aria-label={`Undo check-in for ${item.name}`}>
          <Icon name="undo" size={16} /> Undo
        </button>
        {exitPhase(event) !== "before" && <MarkExitedButton item={item} />}
      </span>
    );
  }
  return (
    <button type="button" className="manager-button manager-button--small manager-button--go" onClick={() => onToggle(item)} aria-label={`Check in ${item.name}`}>
      <Icon name="user-check" size={16} /> Check in
    </button>
  );
}

function CheckInSummary({ checked, total }) {
  const pct = total ? Math.round(checked / total * 100) : 0;
  return (
    <div className="manager-checkin-summary">
      <div>
        <strong>{checked}<small> / {total}</small></strong>
        <span>checked in · {pct}%</span>
      </div>
      <CapacityBar value={checked} max={total || 1} label="Checked in" />
    </div>
  );
}

// Registrations with search, status chips and the confirm / cancel actions.
// `withCheckIn` (an event's Participants tab) adds the check-in button, so one roster does both jobs.
export function RegistrationDesk({ rows, showEvent, initialStatus = "All", withCheckIn = false }) {
  const { events, updateRegistration, toast } = useManager();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [kept, keep] = useKeptRows(`${query}|${status}`);
  const [toggleCheckIn, flashId] = useCheckIn(keep);
  const [dialog, confirm] = useConfirm();
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const visible = rows.filter((item) => kept.has(item.id) || ((status === "All" || item.status === status) && matchesQuery(item, query)));
  const confirmed = rows.filter((item) => item.status === "Confirmed");
  const options = ["All", "Pending", "Confirmed", "Cancelled"]
    .map((value) => ({ value, label: value, count: value === "All" ? rows.length : rows.filter((item) => item.status === value).length }))
    .filter((option) => option.value === "All" || option.count > 0 || option.value === status);

  const setRegistration = (item, patch) => {
    updateRegistration(item.id, patch);
    keep(item.id);
    toast(patch.status === "Cancelled" ? "Registration cancelled." : "Registration confirmed.", patch.status === "Cancelled" ? "warning" : "success");
  };

  const cancelButton = (row) => (
    <button
      type="button"
      className="manager-text-button manager-text-button--danger"
      onClick={() => confirm({
        title: "Cancel registration?",
        message: `${row.name} loses their seat and their ticket stops working.`,
        confirmText: "Cancel registration",
        onConfirm: () => setRegistration(row, { status: "Cancelled", attendanceStatus: "Not Checked In", checkedInAt: "" }),
      })}
    >
      Cancel
    </button>
  );

  const columns = [
    { label: "Participant", render: (row) => <PersonCell name={row.name} detail={row.email} seed={row.userId} /> },
    ...(showEvent ? [{ label: "Event", render: (row) => eventMap.get(row.eventId)?.title || "Assigned event" }] : []),
    ...(rows.some(seatOf) ? [{ label: "Seat", render: (row) => <span className="manager-mono">{seatOf(row) || "—"}</span> }] : []),
    { label: "Registered", render: (row) => <span className="manager-mono">{row.registrationDate || "—"}</span> },
    { label: "Registration", render: (row) => <StatusBadge value={row.status} /> },
    { label: "Attendance", render: (row) => <StatusBadge value={row.attendanceStatus} /> },
    {
      label: "Action",
      render: (row) => {
        if (row.status === "Pending") {
          return (
            <button type="button" className="manager-button manager-button--small manager-button--go" onClick={() => setRegistration(row, { status: "Confirmed" })} aria-label={`Confirm ${row.name}`}>
              <Icon name="check" size={16} /> Confirm
            </button>
          );
        }
        if (row.status === "Confirmed") {
          return withCheckIn
            ? <span className="manager-row-buttons"><CheckInControl item={row} event={eventMap.get(row.eventId)} onToggle={toggleCheckIn} />{!isCheckedIn(row) && cancelButton(row)}</span>
            : cancelButton(row);
        }
        return <span className="manager-muted">—</span>;
      },
    },
  ];

  return (
    <div className="manager-desk">
      {withCheckIn && <CheckInSummary checked={confirmed.filter(isCheckedIn).length} total={confirmed.length} />}
      <div className="manager-toolbar">
        <SearchField label="Search participants" placeholder="Search name or email" value={query} onChange={setQuery} />
        <FilterChips label="Filter by registration status" options={options} value={status} onChange={setStatus} />
      </div>
      <Table
        empty="No registrations match these filters."
        emptyIcon="clipboard-check"
        columns={columns}
        rows={visible}
        rowClass={(row) => (row.id === flashId ? "is-flash" : "")}
      />
      {dialog}
    </div>
  );
}

// Event-day check-in: progress summary, search, state chips and one big button per person.
export function AttendanceDesk({ rows, showEvent }) {
  const { events } = useManager();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [kept, keep] = useKeptRows(`${query}|${filter}`);
  const [toggle, flashId] = useCheckIn(keep);
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const visible = rows.filter((item) => kept.has(item.id) || ((filter === "All" || attendanceKey(item.attendanceStatus) === filter) && matchesQuery(item, query)));
  const options = ATTENDANCE_FILTERS.map((option) => ({
    ...option,
    count: option.value === "All" ? rows.length : rows.filter((item) => attendanceKey(item.attendanceStatus) === option.value).length,
  }));

  return (
    <div className="manager-desk">
      <CheckInSummary checked={rows.filter(isCheckedIn).length} total={rows.length} />
      <div className="manager-toolbar">
        <SearchField label="Search participants" placeholder="Search name or email" value={query} onChange={setQuery} />
        <FilterChips label="Filter by attendance" options={options} value={filter} onChange={setFilter} />
      </div>
      {visible.length ? (
        <ul className="manager-checkin-list">
          {visible.map((item) => (
            <li key={item.id} className={`manager-checkin${flashId === item.id ? " is-flash" : ""}`} data-state={attendanceKey(item.attendanceStatus)}>
              <PersonCell name={item.name} detail={showEvent ? `${eventMap.get(item.eventId)?.title || "Assigned event"} · ${item.email}` : item.email} seed={item.userId} />
              <StatusBadge value={item.attendanceStatus} />
              <span className="manager-checkin__time">{item.checkedInAt ? <><Icon name="clock" size={16} /> {item.checkedInAt}{item.exitedAt && ` · out ${item.exitedAt}`}</> : "—"}</span>
              <CheckInControl item={item} event={eventMap.get(item.eventId)} onToggle={toggle} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="users" title="No participants match">Confirmed participants for this selection appear here.</EmptyState>
      )}
    </div>
  );
}
