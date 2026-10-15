import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "../../context/AdminContext.js";
import { ADMIN_STATUSES } from "../../data/eventStatus.js";
import { EVENT_CATEGORIES, ORGANIZERS } from "../../data/options.js";
import Icon from "../../components/Icon.js";
import { ConfirmModal, Modal } from "../../components/Modal.js";
import { SeatingField } from "../../components/SeatMap.js";
import { TableSkeleton, useSkeleton } from "../../components/Skeleton.js";
import {
  ArchiveSwitch, CapacityBar, FilterChips, SectionHeading, StatusBadge, Table, plural,
} from "../../components/ui.js";
import { LoadError, SearchFilter, formatDay, useApi, useFilters } from "../../components/admin/parts.js";
import { formatTime, timeRange } from "../../data/time.js";
import { useManager } from "../../context/ManagerContext.js";
import { OvertimeButtons } from "../../components/manager/EventFields.js";
import { AnnouncementComposer } from "../../components/manager/Announcements.js";

// Status changes the admin can make: label -> [from statuses, to status, needs confirming].
const ACTIONS = [
  ["Approve", ["Pending"], "Approved", false],
  ["Publish", ["Approved"], "Published", false],
  ["Reject", ["Pending"], "Rejected", true],
  // A rejection made by mistake: the event goes back to Pending and its manager is told (the server notifies).
  ["Undo rejection", ["Rejected"], "Pending", false],
  ["Cancel", ["Approved", "Published"], "Cancelled", true],
  ["Archive", ["Completed", "Rejected", "Cancelled"], "Archived", false],
  // Back to the status it was archived from (older archives didn't record one: Completed).
  ["Restore", ["Archived"], (event) => event.archivedFrom || "Completed", false],
];
const CONFIRM = {
  Reject: (event) => `${event.title} won't be published and nobody can register.${event.createdByAdmin ? "" : " Its manager sees it as rejected in their workspace."}`,
  Cancel: (event) => `${event.title} is called off. Registration closes and existing tickets stop working at the check-in desk.`,
};
const CLOSED = ["Rejected", "Cancelled", "Archived"];
const DEFAULTS = { view: "current", status: "", q: "", sort: "soonest" };
const COLUMNS = ["Event", "Date", "Venue", "Registered", "Status", "Actions"];

export default function EventsAdmin() {
  const { db, settings, update, add, remove, toast, venueName, registered } = useAdmin();
  const [filters, setFilters] = useFilters(DEFAULTS);
  const [editing, setEditing] = useState(null); // event | "new" | null
  const [viewing, setViewing] = useState(null);
  const [confirming, setConfirming] = useState(null); // { event, label, to } | { event, label: "Delete" }
  const loading = useSkeleton(db.events.length === 0, "events");

  const q = filters.q.toLowerCase();
  const archived = db.events.filter((event) => event.status === "Archived");
  const inView = filters.view === "archive" ? archived : db.events.filter((event) => event.status !== "Archived");
  const rows = inView
    .filter((event) => (!filters.status || event.status === filters.status) && `${event.title} ${event.organizer || ""}`.toLowerCase().includes(q))
    .sort((a, b) => (filters.sort === "latest" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  const statusOptions = [{ value: "", label: "All", count: inView.length }, ...ADMIN_STATUSES.filter((status) => status !== "Archived").map((status) => ({
    value: status, label: status, count: inView.filter((event) => event.status === status).length,
  }))].filter((option) => !option.value || option.count > 0 || option.value === filters.status);

  function changeStatus(event, label, to) {
    // Archiving remembers the status it came from, so Restore can put the event back exactly.
    const archiving = to === "Archived" ? { archivedFrom: event.status, archivedAt: new Date().toISOString().slice(0, 10) } : {};
    update("events", event.id, { status: to, ...archiving });
    if (to === "Rejected") {
      toast(`${event.title}: rejected.`, "warning", undefined, { label: "Undo", onClick: () => changeStatus(event, "Undo rejection", "Pending") });
      return;
    }
    const done = { Restore: "restored", "Undo rejection": "rejection undone, back to pending" }[label] || to.toLowerCase();
    toast(`${event.title}: ${done}.`, CLOSED.includes(to) ? "warning" : "success");
  }

  const columns = [
    {
      label: "Event",
      render: (event) => (
        <span>
          <b>{event.title}</b>
          <span className="admin-cell-sub">{event.organizer || "—"}{event.createdByAdmin ? " · created by an admin" : ""}</span>
        </span>
      ),
    },
    {
      label: "Date",
      render: (event) => (
        <span className="manager-mono">
          {formatDay(event.date)}
          {event.start && <span className="admin-cell-sub">{timeRange(event.start, event.end, "–")}</span>}
        </span>
      ),
    },
    { label: "Venue", render: (event) => venueName(event.venueId, event.id) },
    {
      label: "Registered",
      render: (event) => (
        <span className="admin-meter-cell">
          <span className="manager-mono">{registered(event.id)} / {event.capacity || 0}</span>
          <CapacityBar value={registered(event.id)} max={event.capacity || 0} label={`${event.title} registrations`} />
        </span>
      ),
    },
    {
      label: "Status",
      render: (event) => (
        <span>
          <StatusBadge value={event.status} />
          {event.status === "Archived" && event.archivedAt && <span className="admin-cell-sub">Since {formatDay(event.archivedAt)}</span>}
        </span>
      ),
    },
    {
      label: "Actions",
      render: (event) => (
        <span className="manager-row-buttons">
          {ACTIONS.filter(([, from]) => from.includes(event.status)).map(([label, , target, confirm]) => {
            const to = typeof target === "function" ? target(event) : target;
            return (
              <button
                key={label}
                type="button"
                className={label === "Approve" || label === "Publish"
                  ? "manager-button manager-button--small manager-button--go"
                  : `manager-text-button${confirm ? " manager-text-button--danger" : ""}`}
                onClick={() => (confirm ? setConfirming({ event, label, to }) : changeStatus(event, label, to))}
              >
                {label}
              </button>
            );
          })}
          <button type="button" className="manager-text-button" onClick={() => setViewing(event)}>Details</button>
          <button type="button" className="manager-text-button manager-text-button--danger" onClick={() => setConfirming({ event, label: "Delete" })}>Delete</button>
        </span>
      ),
    },
  ];

  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Platform"
        title="Events & approvals"
        detail="Approve or reject events that managers submit, publish them, and keep the calendar tidy. Each event's sessions, registrations and check-in are run by its manager."
        action={(
          <button type="button" className="manager-button manager-button--primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={16} /> Create event
          </button>
        )}
      />

      <ArchiveSwitch
        value={filters.view}
        onChange={(view) => setFilters({ view, status: "" })}
        current={db.events.length - archived.length}
        archived={archived.length}
      />

      <div className="manager-toolbar">
        <SearchFilter label="Search events" placeholder="Search title or organizer" value={filters.q} onSearch={(value) => setFilters({ q: value })} />
        <label className="manager-toolbar__field">
          Sort
          <select value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
            <option value="soonest">Date: soonest first</option>
            <option value="latest">Date: latest first</option>
          </select>
        </label>
        {filters.view !== "archive" && <FilterChips label="Filter by status" options={statusOptions} value={filters.status} onChange={(status) => setFilters({ status })} />}
      </div>

      {loading ? (
        <TableSkeleton columns={COLUMNS} rows={6} />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          empty={filters.view === "archive" && !archived.length
            ? "Nothing archived yet. Archive a completed, rejected or cancelled event to keep it here with its records."
            : db.events.length ? "No events match these filters." : "No events yet."}
          emptyIcon="calendar-days"
        />
      )}
      {!loading && rows.length > 0 && <p className="admin-pager__count">{plural(rows.length, "event")}</p>}

      {viewing && (
        <EventDetails
          event={db.events.find((item) => item.id === viewing.id) || viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}

      {editing && (
        <EventForm
          event={editing === "new" ? null : editing}
          defaultCapacity={settings.defaultCapacity}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing === "new") {
              add("events", { ...data, status: "Pending" });
              toast("Event created. It is pending until you approve it.");
            } else {
              update("events", editing.id, data);
              toast("Event updated.");
            }
            setEditing(null);
          }}
        />
      )}

      {confirming?.label === "Delete" && (
        <ConfirmModal
          title="Delete event permanently?"
          message={`This deletes ${confirming.event.title} and everything attached to it: ${plural(registered(confirming.event.id), "registration")}, tickets, certificates, sessions, announcements and feedback. Cancelling or archiving keeps the history.`}
          confirmText="Delete event"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            remove("events", confirming.event.id);
            toast(`${confirming.event.title} deleted.`, "warning");
            setConfirming(null);
          }}
        />
      )}
      {confirming && confirming.label !== "Delete" && (
        <ConfirmModal
          title={`${confirming.label} event?`}
          message={CONFIRM[confirming.label](confirming.event)}
          confirmText={`${confirming.label} event`}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            changeStatus(confirming.event, confirming.label, confirming.to);
            setConfirming(null);
          }}
        />
      )}
    </div>
  );
}

// Oversight of one event. Its schedule belongs to its manager, so it is listed here but edited
// only in the manager workspace; the admin may post announcements and add overtime.
function EventDetails({ event, onClose, onEdit }) {
  const { venueName, update, toast } = useAdmin();
  const { allAnnouncements } = useManager();
  const announcements = allAnnouncements.filter((item) => item.eventId === event.id);
  const { data, error, reload } = useApi(`/admin/events/${encodeURIComponent(event.id)}`);
  const facts = [
    ["Status", <StatusBadge key="status" value={event.status} />],
    ["Date", `${formatDay(event.date)}${event.start ? ` · ${timeRange(event.start, event.end, "–")}` : ""}`],
    ["Venue", venueName(event.venueId, event.id)],
    ["Capacity", `${event.capacity || 0} · ${event.seating === "reserved" ? "reserved seats" : "free seating"}`],
    ["Organizer", event.organizer || "—"],
    ["Run by", event.createdByAdmin ? "Created in the admin area (no event manager)" : "Its event manager"],
  ];

  return (
    <Modal title={event.title} onClose={onClose} className="admin-dialog">
      {(closeAnimated) => (
        <div className="admin-detail">
          <dl className="manager-definition-list">
            {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <OvertimeButtons
            event={event}
            endTime={event.end}
            onExtend={(end, minutes) => {
              update("events", event.id, { end });
              toast(`Added ${minutes} minutes. ${event.title} now ends at ${formatTime(end)}.`);
            }}
          />

          <h3><Icon name="speaker" size={16} /> Speakers</h3>
          {event.speakers?.length ? (
            <ul className="admin-plain-list">
              {event.speakers.map((speaker, index) => (
                <li key={index}>
                  <b>{speaker.name}</b>
                  <small>{[speaker.kind, speaker.role].filter(Boolean).join(" · ")}</small>
                </li>
              ))}
            </ul>
          ) : <p className="manager-muted">No speakers listed.</p>}

          {error && <LoadError message={error} onRetry={reload} />}
          {data && (
            <>
              <ul className="admin-summary" aria-label="Registrations and feedback">
                <li><b>{data.registrations.confirmed}</b> confirmed</li>
                <li><b>{data.registrations.checkedIn}</b> checked in</li>
                <li><b>{data.registrations.cancelled}</b> cancelled</li>
                <li><b>{data.feedback.rating ?? "—"}</b> rating ({data.feedback.responses})</li>
              </ul>

              <h3><Icon name="schedule" size={16} /> Sessions</h3>
              {data.sessions.length ? (
                <ul className="admin-plain-list">
                  {data.sessions.map((session) => (
                    <li key={session.id}>
                      <b>{session.title}</b>
                      <small>
                        {[session.speaker, session.startTime && timeRange(session.startTime, session.endTime, "–"), session.room || session.time]
                          .filter(Boolean).join(" · ")}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : <p className="manager-muted">No sessions yet.</p>}

            </>
          )}

          <h3><Icon name="megaphone" size={16} /> Announcements</h3>
          {announcements.length ? (
            <ul className="admin-plain-list">
              {announcements.map((item) => (
                <li key={item.id}>
                  <b>{item.title}</b> <StatusBadge value={item.status || "Draft"} />
                  {item.message && <small>{item.message}</small>}
                </li>
              ))}
            </ul>
          ) : <p className="manager-muted">No announcements yet.</p>}
          <AnnouncementComposer eventId={event.id} />
          {!data && !error && <p className="manager-muted">Loading sessions…</p>}

          <p className="admin-note">
            <Icon name="info" size={16} />
            Sessions and speakers are managed in the event manager's workspace and shown here read-only.
          </p>
          <div className="admin-dialog-actions">
            <Link className="manager-button" to={`/admin/registrations?eventId=${encodeURIComponent(event.id)}`}>
              <Icon name="clipboard-check" size={16} /> Registrations
            </Link>
            <button type="button" className="manager-button" onClick={closeAnimated}>Close</button>
            <button type="button" className="manager-button manager-button--primary" onClick={onEdit}>
              <Icon name="edit" size={16} /> Edit event
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EventForm({ event, defaultCapacity, onClose, onSave }) {
  const { db, registered } = useAdmin();
  // Manager events store the venue by name; preselect the matching venue.
  const [form, setForm] = useState(() => (event
    ? { ...event, capacity: String(event.capacity || ""), venueId: event.venueId || db.venues.find((venue) => venue.name === event.venue)?.id || "" }
    : { title: "", category: "Academic", organizer: ORGANIZERS[0], date: "", start: "", end: "", venueId: "", capacity: String(defaultCapacity || ""), seating: "free" }));
  const [errors, setErrors] = useState({});
  const set = useCallback((key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value })), []);
  const organizers = form.organizer && !ORGANIZERS.includes(form.organizer) ? [form.organizer, ...ORGANIZERS] : ORGANIZERS;

  function validate() {
    const next = {};
    ["title", "date", "start", "end", "venueId", "capacity"].forEach((key) => {
      if (!String(form[key] || "").trim()) next[key] = "Required.";
    });
    const capacity = Number(form.capacity);
    const venue = db.venues.find((item) => item.id === form.venueId);
    if (form.capacity && !(capacity > 0)) next.capacity = "Must be a positive number.";
    else if (venue && capacity > venue.capacity) next.capacity = `Exceeds the venue's capacity (${venue.capacity}).`;
    if (form.start && form.end && form.end <= form.start) next.end = "End must be after start.";
    if (!next.date && !next.start && !next.end && venue) {
      const clash = db.events.find((other) => other.id !== form.id
        && (other.venueId ? other.venueId === venue.id : other.venue === venue.name)
        && other.date === form.date
        && !CLOSED.includes(other.status)
        && form.start < other.end && other.start < form.end);
      if (clash) next.venueId = `Conflict: ${clash.title} uses this venue ${timeRange(clash.start, clash.end, "–")}.`;
    }
    setErrors(next);
    return !Object.keys(next).length;
  }

  function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    const { title, category, organizer, date, start, end, venueId, seating } = form;
    onSave({ title: title.trim(), category: category || "Academic", organizer, date, start, end, venueId, seating, capacity: Number(form.capacity) });
  }

  const field = (key, label, input) => (
    <label className="manager-field">
      {label}
      {input}
      {errors[key] && <small>{errors[key]}</small>}
    </label>
  );

  return (
    <Modal title={event ? `Edit ${event.title}` : "Create event"} onClose={onClose} className="admin-dialog">
      {(closeAnimated) => (
        <form className="manager-form" onSubmit={submit} noValidate>
          <label className="manager-field manager-field--wide">
            Title
            <input value={form.title} onChange={set("title")} aria-invalid={Boolean(errors.title)} />
            {errors.title && <small>{errors.title}</small>}
          </label>
          {field("category", "Category", (
            <select value={form.category || "Academic"} onChange={set("category")}>
              {EVENT_CATEGORIES.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}
            </select>
          ))}
          {field("organizer", "Organizer", (
            <select value={form.organizer} onChange={set("organizer")}>
              {organizers.map((name) => <option key={name}>{name}</option>)}
            </select>
          ))}
          {field("date", "Date", <input type="date" value={form.date} onChange={set("date")} aria-invalid={Boolean(errors.date)} />)}
          {field("start", "Start", <input type="time" value={form.start} onChange={set("start")} aria-invalid={Boolean(errors.start)} />)}
          {field("end", "End", <input type="time" value={form.end} onChange={set("end")} aria-invalid={Boolean(errors.end)} />)}
          {field("venueId", "Venue", (
            <select value={form.venueId} onChange={set("venueId")} aria-invalid={Boolean(errors.venueId)}>
              <option value="">Select venue</option>
              {db.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name} ({venue.capacity})</option>)}
            </select>
          ))}
          {field("capacity", "Capacity", <input type="number" min="1" value={form.capacity} onChange={set("capacity")} aria-invalid={Boolean(errors.capacity)} />)}
          <div className="manager-field--wide">
            <SeatingField
              value={form.seating}
              onChange={(seating) => setForm((current) => ({ ...current, seating }))}
              capacity={form.capacity}
              locked={Boolean(event) && registered(event.id) > 0}
            />
          </div>
          <div className="manager-form-actions">
            <button type="button" className="manager-button" onClick={closeAnimated}>Cancel</button>
            <button type="submit" className="manager-button manager-button--primary">{event ? "Save changes" : "Create event"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
