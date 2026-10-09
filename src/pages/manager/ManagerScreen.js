import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { useManager } from "../../context/ManagerContext.js";
import Icon from "../../components/Icon.js";
import Spinner from "../../components/Spinner.js";
import { ConfirmModal, Modal } from "../../components/admin/ui.js";
import { useEntering, usePending } from "../../components/Motion.js";
import SeatMap, { SeatingField } from "../../components/SeatMap.js";
import { seatOf } from "../../data/seating.js";
import {
  CapacityBar, DateTile, EmptyState, FilterChips, Metric, PAST_STATUSES, PanelHeader, PersonCell, PrepChip,
  SearchField, SectionHeading, StatusBadge, Table, attendanceKey, countRegistrations, countdownLabel, eventDate,
  eventRegistrations, getAttendance, isCheckedIn, plural, relativeDay,
} from "../../components/manager/parts.js";

const CATEGORIES = ["Academic", "Career", "Workshop", "Seminar", "Competition", "Community", "Technology"];
const PREP_STATUSES = ["Needs attention", "In progress", "On track", "Venue confirmed", "Ready", "Closed out"];
const EMPTY_SESSION = { title: "", speaker: "", startTime: "", endTime: "", room: "" };
const EMPTY_EVENT = { title: "", category: "Academic", description: "", date: "", startTime: "", endTime: "", venue: "", capacity: "", seating: "free", organizer: "", requirements: "", importantDate: "" };

const WORKSPACE_TABS = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "details", label: "Details", icon: "edit" },
  { id: "schedule", label: "Schedule", icon: "schedule", count: "sessions" },
  { id: "participants", label: "Participants", icon: "users", count: "participants" },
  { id: "announcements", label: "Announcements", icon: "megaphone", count: "announcements" },
  { id: "feedback", label: "Feedback", icon: "message", count: "feedback" },
  { id: "reports", label: "Reports", icon: "chart" },
];

const ATTENDANCE_FILTERS = [
  { value: "All", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "checked-in", label: "Checked in" },
  { value: "attended", label: "Attended" },
];

const byDate = (a, b) => a.date.localeCompare(b.date);
const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const longDate = (date) => eventDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", icon: "sunrise" };
  if (hour < 18) return { text: "Good afternoon", icon: "sun" };
  return { text: "Good evening", icon: "moon" };
}

// A submit button that shows the spinner while its action is pending.
function SaveButton({ pending, pendingText = "Saving…", children, onClick }) {
  return (
    <button className="manager-button manager-button--primary" type="submit" onClick={onClick} disabled={pending} aria-busy={pending || undefined}>
      {pending ? <><Spinner /> {pendingText}</> : children}
    </button>
  );
}

// One confirm dialog per screen for actions that are hard to undo (cancel, remove, complete).
function useConfirm() {
  const [request, setRequest] = useState(null);
  const dialog = request && (
    <ConfirmModal
      {...request}
      onCancel={() => setRequest(null)}
      onConfirm={() => {
        request.onConfirm();
        setRequest(null);
      }}
    />
  );
  return [dialog, setRequest];
}

/* ------------------------------------------------------------------ Overview */

function ManagerOverview() {
  const { user } = useAuth();
  const { events, registrations, sessions, notifications, announcements } = useManager();
  const upcoming = events.filter((event) => !PAST_STATUSES.includes(event.status)).sort(byDate);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const pending = registrations.filter((item) => item.status === "Pending");
  const activeRegistrations = registrations.filter((item) => item.status !== "Cancelled").length;
  const prepCount = upcoming.filter((event) => event.preparationStatus !== "Ready").length;
  const checkedIn = registrations.filter(isCheckedIn).length;
  const nextEvent = upcoming[0];
  const nextCount = nextEvent ? countRegistrations(nextEvent.id, registrations) : 0;
  const nextSessions = sessions
    .filter((session) => upcoming.some((event) => event.id === session.eventId))
    .sort((a, b) => `${eventById.get(a.eventId).date} ${a.startTime}`.localeCompare(`${eventById.get(b.eventId).date} ${b.startTime}`))
    .slice(0, 5);

  // Each item links to the place where it gets fixed.
  const actionItems = [
    ...events.filter((event) => event.status === "Approved").map((event) => ({
      key: `event-${event.id}`, icon: "calendar-days", tone: "blue", to: `/manager/events/${event.id}/overview`,
      text: <><b>{event.title}</b>: registration is not open yet</>,
    })),
    ...pending.map((item) => ({
      key: `registration-${item.id}`, icon: "hourglass", tone: "yellow", to: "/manager/registrations?status=Pending",
      text: <><b>{item.name}</b>: registration needs review</>,
    })),
    ...announcements.filter((item) => item.status === "Draft").map((item) => ({
      key: `announcement-${item.id}`, icon: "megaphone", tone: "violet", to: `/manager/events/${item.eventId}/announcements`,
      text: <><b>{item.title}</b>: announcement is still a draft</>,
    })),
  ];
  const shownActions = actionItems.slice(0, 5);
  const hello = greeting();
  const firstName = (user?.name || "there").split(" ")[0];

  return (
    <div className="manager-page manager-overview">
      <section className="manager-welcome" aria-labelledby="manager-welcome-title">
        <div className="manager-welcome__copy">
          <span className="manager-sticker">Your assignment</span>
          <h2 id="manager-welcome-title"><Icon name={hello.icon} size={24} /> {hello.text}, {firstName}.</h2>
          <p>
            You have <b>{plural(upcoming.length, "upcoming event")}</b>
            {pending.length ? <> and <b>{plural(pending.length, "registration")}</b> waiting for review.</> : ". Every registration has been reviewed."}
          </p>
          <div className="manager-welcome__actions">
            {nextEvent && (
              <Link className="manager-button manager-button--primary manager-button--lg" to={`/manager/events/${nextEvent.id}/overview`}>
                Open next event <Icon name="arrow-right" size={16} />
              </Link>
            )}
            <Link className="manager-button manager-button--lg" to="/manager/attendance">
              <Icon name="scan" size={16} /> Check-in desk
            </Link>
          </div>
        </div>

        {nextEvent ? (
          <Link className="manager-next" to={`/manager/events/${nextEvent.id}/overview`} aria-label={`Next event: ${nextEvent.title}, ${countdownLabel(nextEvent.date)}`}>
            <span className="manager-next__countdown">{countdownLabel(nextEvent.date)}</span>
            <span className="manager-eyebrow">Next event</span>
            <span className="manager-next__title">{nextEvent.title}</span>
            <span className="manager-facts">
              <span><Icon name="calendar" size={16} /> {eventDate(nextEvent.date, { weekday: "short", month: "short", day: "numeric" })}</span>
              <span><Icon name="clock" size={16} /> {nextEvent.startTime}–{nextEvent.endTime}</span>
              <span><Icon name="pin" size={16} /> {nextEvent.venue}</span>
            </span>
            <span className="manager-next__meter">
              <span><b>{nextCount}</b> / {nextEvent.capacity} registered</span>
              <StatusBadge value={nextEvent.status} />
            </span>
            <CapacityBar value={nextCount} max={nextEvent.capacity} />
          </Link>
        ) : (
          <div className="manager-next manager-next--empty">
            <span className="manager-eyebrow">Next event</span>
            <span className="manager-next__title">Nothing scheduled</span>
            <span>Create an event and it will show up here once it is approved.</span>
          </div>
        )}
      </section>

      <div className="manager-metrics">
        <Metric icon="calendar-days" tone="blue" label="Assigned events" value={events.length} note={`${upcoming.length} upcoming`} to="/manager/events" />
        <Metric icon="ticket" tone="yellow" label="Active registrations" value={activeRegistrations} note="Across your events" to="/manager/registrations" />
        <Metric icon="alert-circle" tone="coral" label="Needs preparation" value={prepCount} note="Not marked ready" to="/manager/events" />
        <Metric icon="user-check" tone="mint" label="Checked in" value={checkedIn} note="Recorded attendance" to="/manager/attendance" />
      </div>

      <div className="manager-overview-grid">
        <section className="manager-panel" aria-labelledby="attention-title">
          <PanelHeader id="attention-title" eyebrow="Needs attention" title="Action list" aside={<span className="manager-count">{actionItems.length}</span>} />
          {shownActions.length ? (
            <ul className="manager-action-list">
              {shownActions.map((item) => (
                <li key={item.key}>
                  <Link to={item.to} className="manager-action-item">
                    <span className={`manager-icon-chip manager-icon-chip--${item.tone}`}><Icon name={item.icon} size={16} /></span>
                    <span>{item.text}</span>
                    <Icon name="arrow-right" size={16} className="manager-action-item__go" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="check" title="All clear">Your assignments are up to date.</EmptyState>
          )}
          {actionItems.length > shownActions.length && <p className="manager-muted">+{actionItems.length - shownActions.length} more on the Registrations and Announcements pages.</p>}
        </section>

        <section className="manager-panel" aria-labelledby="sessions-title">
          <PanelHeader
            id="sessions-title"
            eyebrow="Programme"
            title="Upcoming sessions"
            aside={<Link to="/manager/schedule" className="manager-inline-link">Full schedule <Icon name="arrow-right" size={16} /></Link>}
          />
          {nextSessions.length ? (
            <ul className="manager-session-list">
              {nextSessions.map((session) => {
                const event = eventById.get(session.eventId);
                return (
                  <li key={session.id}>
                    <span className="manager-session-list__when">
                      <b>{eventDate(event.date, { month: "short", day: "numeric" })}</b>
                      <time>{session.startTime}</time>
                    </span>
                    <span>
                      <strong>{session.title}</strong>
                      <small>{event.title} · {session.room}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="schedule" title="No sessions yet">Add sessions from an event's Schedule tab.</EmptyState>
          )}
        </section>
      </div>

      <section className="manager-panel" aria-labelledby="activity-title">
        <PanelHeader id="activity-title" eyebrow="Recent activity" title="Event updates" />
        {notifications.length ? (
          <ul className="manager-activity">
            {notifications.slice(0, 6).map((item) => {
              const kind = /feedback/i.test(item.message) ? ["message", "violet"] : /announcement/i.test(item.message) ? ["megaphone", "yellow"] : /registration/i.test(item.message) ? ["user-plus", "blue"] : ["bell", "mint"];
              return (
                <li key={item.id}>
                  <span className={`manager-icon-chip manager-icon-chip--${kind[1]}`}><Icon name={kind[0]} size={16} /></span>
                  <span>
                    {item.message}
                    <small>{eventById.get(item.eventId)?.title} · {relativeDay(item.date)}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon="activity" title="No recent updates" />
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ My events */

function ManagerEvents() {
  const { events, registrations, sessions, createEvent, toast } = useManager();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [dateOrder, setDateOrder] = useState("Soonest first");
  const [dateFilter, setDateFilter] = useState("");
  const [form, setForm] = useState(EMPTY_EVENT);
  const [formError, setFormError] = useState("");
  const [submitting, runSubmit] = usePending();
  const entering = useEntering();
  const creating = params.get("new") === "1";
  const setCreating = (open) => setParams(open ? { new: "1" } : {}, { replace: true });
  const patch = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.value }));

  const rows = useMemo(() => [...events]
    .filter((event) => event.title.toLowerCase().includes(query.toLowerCase()))
    .filter((event) => status === "All" || event.status === status)
    .filter((event) => !dateFilter || event.date >= dateFilter)
    .sort((a, b) => (dateOrder === "Soonest first" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))),
  [dateFilter, dateOrder, events, query, status]);
  const active = rows.filter((event) => !PAST_STATUSES.includes(event.status));
  const past = rows.filter((event) => PAST_STATUSES.includes(event.status));
  const statusOptions = ["All", ...new Set(events.map((event) => event.status))].map((value) => ({
    value,
    label: value,
    count: value === "All" ? events.length : events.filter((event) => event.status === value).length,
  }));

  function submitEvent(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.date || !form.startTime || !form.endTime || form.startTime >= form.endTime || !form.venue.trim() || !(Number(form.capacity) > 0)) {
      setFormError("Complete the required fields and enter a valid time range and capacity.");
      return;
    }
    setFormError("");
    const draft = { ...form, title: form.title.trim(), description: form.description.trim(), venue: form.venue.trim(), capacity: Number(form.capacity), organizer: form.organizer.trim() || "Event Manager" };
    runSubmit(() => {
      createEvent(draft);
      setForm(EMPTY_EVENT);
      setCreating(false);
      toast("Event submitted to the admin approval queue.");
    });
  }

  const renderCards = (list) => (
    <div className={`manager-event-grid${entering ? " stagger" : ""}`}>
      {list.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          count={countRegistrations(event.id, registrations)}
          speakers={[...new Set(sessions.filter((session) => session.eventId === event.id).map((session) => session.speaker).filter(Boolean))]}
        />
      ))}
    </div>
  );

  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Event ownership"
        title="My events"
        detail="Only events assigned to your manager account are listed."
        action={(
          <button className={`manager-button${creating ? "" : " manager-button--primary"}`} type="button" onClick={() => setCreating(!creating)} aria-expanded={creating}>
            <Icon name={creating ? "close" : "plus"} size={16} /> {creating ? "Close form" : "Create event"}
          </button>
        )}
      />

      {creating && (
        <section className="manager-panel manager-form-panel" aria-labelledby="new-event-title">
          <PanelHeader id="new-event-title" eyebrow="New event" title="Submit an event for approval" aside={<span className="manager-muted">An admin reviews it before registration opens.</span>} />
          <form className="manager-form" onSubmit={submitEvent}>
            <label className="manager-field manager-field--wide">Event title<input value={form.title} onChange={patch("title")} /></label>
            <label className="manager-field manager-field--wide">Description<textarea rows="3" value={form.description} onChange={patch("description")} /></label>
            <label className="manager-field">Date<input type="date" value={form.date} onChange={patch("date")} /></label>
            <label className="manager-field">Category<select value={form.category} onChange={patch("category")}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="manager-field">Start time<input type="time" value={form.startTime} onChange={patch("startTime")} /></label>
            <label className="manager-field">End time<input type="time" value={form.endTime} onChange={patch("endTime")} /></label>
            <label className="manager-field">Venue<input value={form.venue} onChange={patch("venue")} /></label>
            <label className="manager-field">Capacity<input type="number" min="1" value={form.capacity} onChange={patch("capacity")} /></label>
            <label className="manager-field">Organizer<input value={form.organizer} onChange={patch("organizer")} placeholder="Event Manager" /></label>
            <label className="manager-field">Requirements<textarea rows="2" value={form.requirements} onChange={patch("requirements")} /></label>
            <SeatingField value={form.seating} onChange={(seating) => setForm((current) => ({ ...current, seating }))} capacity={form.capacity} />
            {formError && <p className="manager-form-error" role="alert">{formError}</p>}
            <div className="manager-form-actions">
              <SaveButton pending={submitting} pendingText="Submitting…"><Icon name="send" size={16} /> Submit for approval</SaveButton>
            </div>
          </form>
        </section>
      )}

      <div className="manager-toolbar">
        <SearchField label="Search assigned events" placeholder="Search events" value={query} onChange={setQuery} />
        <label className="manager-toolbar__field">On or after <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} /></label>
        <select aria-label="Sort events by date" value={dateOrder} onChange={(e) => setDateOrder(e.target.value)}>
          <option>Soonest first</option>
          <option>Latest first</option>
        </select>
        <FilterChips label="Filter by event status" options={statusOptions} value={status} onChange={setStatus} />
      </div>

      {active.length > 0 && renderCards(active)}
      {past.length > 0 && (
        <>
          <h3 className="manager-subheading">Past & cancelled <span>{past.length}</span></h3>
          {renderCards(past)}
        </>
      )}
      {!rows.length && <EmptyState icon="search" title="No assigned events match these filters">Clear the search or pick another status.</EmptyState>}
    </div>
  );
}

function EventCard({ event, count, speakers }) {
  const isPast = PAST_STATUSES.includes(event.status);
  const base = `/manager/events/${event.id}`;
  return (
    <article className={`manager-event-card${isPast ? " is-past" : ""}`}>
      <div className="manager-event-card__top">
        <DateTile date={event.date} />
        <div className="manager-event-card__heading">
          <div className="manager-event-card__kicker">
            <span className="manager-kicker">{event.category} · {eventDate(event.date, { weekday: "short", month: "short", day: "numeric" })}</span>
            <StatusBadge value={event.status} />
          </div>
          <h3>{event.title}</h3>
        </div>
      </div>
      <div className="manager-facts">
        <span><Icon name="clock" size={16} /> {event.startTime}–{event.endTime}</span>
        <span><Icon name="pin" size={16} /> {event.venue}</span>
        <PrepChip value={event.preparationStatus} />
      </div>
      <div className="manager-event-card__meter">
        <span><b>{count}</b> / {event.capacity} registered</span>
        <span>{event.capacity ? Math.min(100, Math.round(count / event.capacity * 100)) : 0}%</span>
      </div>
      <CapacityBar value={count} max={event.capacity} label={`${event.title} registrations`} />
      {speakers.length > 0 && (
        <p className="manager-event-card__speakers">
          <Icon name="speaker" size={16} /> {speakers.slice(0, 2).join(" · ")}{speakers.length > 2 ? ` +${speakers.length - 2}` : ""}
        </p>
      )}
      <div className="manager-event-card__actions">
        <Link className="manager-button manager-button--primary" to={`${base}/overview`}>Open workspace <Icon name="arrow-right" size={16} /></Link>
        <Link className="manager-button manager-button--ghost" to={`${base}/details`}><Icon name="edit" size={16} /> Details</Link>
        <Link className="manager-button manager-button--ghost" to={`${base}/participants`}><Icon name="users" size={16} /> Participants</Link>
        <Link className="manager-button manager-button--ghost" to={`${base}/reports`}><Icon name="chart" size={16} /> Report</Link>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ Shared desks */

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
    updateRegistration(item.id, { attendanceStatus: checked ? "Not checked in" : "Checked in", checkedInAt: checked ? "" : timeNow() });
    toast(checked ? "Check-in undone." : `${item.name} checked in.`);
    onToggle?.(item.id);
    if (!checked) {
      setFlashId(item.id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlashId(null), 900);
    }
  }

  return [toggle, flashId];
}

function CheckInControl({ item, onToggle }) {
  const state = attendanceKey(item.attendanceStatus);
  if (state === "attended") return <span className="manager-checkin__done"><Icon name="check" size={16} /> Attended</span>;
  if (state === "checked-in") {
    return (
      <button type="button" className="manager-button manager-button--small" onClick={() => onToggle(item)} aria-label={`Undo check-in for ${item.name}`}>
        <Icon name="undo" size={16} /> Undo
      </button>
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
function RegistrationDesk({ rows, showEvent, initialStatus = "All", withCheckIn = false }) {
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
    toast(patch.status === "Cancelled" ? "Registration cancelled." : "Registration confirmed.");
  };

  const cancelButton = (row) => (
    <button
      type="button"
      className="manager-text-button manager-text-button--danger"
      onClick={() => confirm({
        title: "Cancel registration?",
        message: `${row.name} loses their seat and their ticket stops working.`,
        confirmText: "Cancel registration",
        onConfirm: () => setRegistration(row, { status: "Cancelled", attendanceStatus: "Not checked in", checkedInAt: "" }),
      })}
    >
      Cancel
    </button>
  );

  const columns = [
    { label: "Participant", render: (row) => <PersonCell name={row.name} detail={row.email} /> },
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
            ? <span className="manager-row-buttons"><CheckInControl item={row} onToggle={toggleCheckIn} />{!isCheckedIn(row) && cancelButton(row)}</span>
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
function AttendanceDesk({ rows, showEvent }) {
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
              <PersonCell name={item.name} detail={showEvent ? `${eventMap.get(item.eventId)?.title || "Assigned event"} · ${item.email}` : item.email} />
              <StatusBadge value={item.attendanceStatus} />
              <span className="manager-checkin__time">{item.checkedInAt ? <><Icon name="clock" size={16} /> {item.checkedInAt}</> : "—"}</span>
              <CheckInControl item={item} onToggle={toggle} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="users" title="No participants match">Confirmed participants for this selection appear here.</EmptyState>
      )}
    </div>
  );
}

function SessionTimeline({ sessions, eventTitle, onEdit, onRemove }) {
  if (!sessions.length) return <EmptyState icon="schedule" title="No sessions added">Use Add session to build the programme.</EmptyState>;
  return (
    <ol className="manager-timeline">
      {sessions.map((session) => (
        <li key={session.id} className="manager-session-row">
          <time>{session.startTime}<span>{session.endTime}</span></time>
          <div>
            <h4>{session.title}</h4>
            <p>
              {eventTitle && <>{eventTitle(session)} · </>}
              <Icon name="speaker" size={16} /> {session.speaker} · <Icon name="pin" size={16} /> {session.room}
            </p>
          </div>
          <div className="manager-row-actions">
            <button type="button" className="manager-text-button" onClick={() => onEdit(session)}><Icon name="edit" size={16} /> Edit</button>
            <button type="button" className="manager-text-button manager-text-button--danger" onClick={() => onRemove(session)}><Icon name="trash" size={16} /> Remove</button>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Add / edit a session in the shared dialog (Escape closes, focus returns to the trigger).
function SessionDialog({ session, events, onClose }) {
  const { sessions, saveSession, toast } = useManager();
  const [draft, setDraft] = useState(session);
  const [saving, runSave] = usePending();
  const patch = (field) => (e) => setDraft((current) => ({ ...current, [field]: e.target.value }));

  function save(e, close) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.speaker.trim() || !draft.room.trim() || !draft.startTime || !draft.endTime || draft.startTime >= draft.endTime) {
      toast("Add a title, speaker, room, and valid time range.");
      return;
    }
    const conflict = sessions.find((item) => item.id !== draft.id && item.eventId === draft.eventId && item.room === draft.room.trim() && draft.startTime < item.endTime && item.startTime < draft.endTime);
    if (conflict) {
      toast(`Room conflict with ${conflict.title}.`);
      return;
    }
    runSave(() => {
      saveSession({ ...draft, title: draft.title.trim(), speaker: draft.speaker.trim(), room: draft.room.trim() });
      toast(draft.id ? "Session updated." : "Session added.");
      close();
    });
  }

  return (
    <Modal title={draft.id ? "Edit session" : "Add session"} onClose={onClose} className="manager-dialog">
      {(close) => (
        <form className="manager-form" onSubmit={(e) => save(e, close)}>
          {events && (
            <label className="manager-field manager-field--wide">Event
              <select value={draft.eventId} onChange={patch("eventId")}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
            </label>
          )}
          <label className="manager-field manager-field--wide">Session title<input value={draft.title} onChange={patch("title")} /></label>
          <label className="manager-field">Speaker<input value={draft.speaker} onChange={patch("speaker")} /></label>
          <label className="manager-field">Room<input value={draft.room} onChange={patch("room")} /></label>
          <label className="manager-field">Start<input type="time" value={draft.startTime} onChange={patch("startTime")} /></label>
          <label className="manager-field">End<input type="time" value={draft.endTime} onChange={patch("endTime")} /></label>
          <div className="manager-form-actions">
            <SaveButton pending={saving}>Save session</SaveButton>
            <button className="manager-button" type="button" onClick={close}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// Publish now or keep as a draft. `events` adds an event picker (the all-events page).
function AnnouncementComposer({ eventId, events }) {
  const { addAnnouncement, toast } = useManager();
  const [form, setForm] = useState({ eventId: eventId || events?.[0]?.id || "", title: "", message: "" });
  const [sending, runSend] = usePending();
  const intent = useRef("Published");
  const patch = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (!form.eventId || !form.title.trim() || !form.message.trim()) {
      toast(events ? "Choose an event and enter an announcement title and message." : "Announcement title and message are required.");
      return;
    }
    const status = intent.current;
    const announcement = { eventId: form.eventId, status, title: form.title.trim(), message: form.message.trim() };
    runSend(() => {
      addAnnouncement(announcement);
      setForm((current) => ({ ...current, title: "", message: "" }));
      toast(status === "Published" ? "Announcement published." : "Draft saved.");
    });
  }

  return (
    <form className="manager-panel manager-composer" onSubmit={submit}>
      <PanelHeader eyebrow="New announcement" title="Tell participants what changed" aside={<span className="manager-muted">Shown on the event page. No email is sent.</span>} />
      <div className="manager-form">
        {events && (
          <label className="manager-field manager-field--wide">Event
            <select value={form.eventId} onChange={patch("eventId")}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
          </label>
        )}
        <label className="manager-field manager-field--wide">Title<input value={form.title} onChange={patch("title")} /></label>
        <label className="manager-field manager-field--wide">Message<textarea rows="3" value={form.message} onChange={patch("message")} /></label>
        <div className="manager-form-actions">
          <SaveButton pending={sending} pendingText="Sending…" onClick={() => { intent.current = "Published"; }}>
            <Icon name="send" size={16} /> Publish
          </SaveButton>
          <button className="manager-button" type="submit" disabled={sending} onClick={() => { intent.current = "Draft"; }}>Save as draft</button>
        </div>
      </div>
    </form>
  );
}

function AnnouncementList({ items, showEvent }) {
  const { events, updateAnnouncement, toast } = useManager();
  if (!items.length) return <EmptyState icon="megaphone" title="No announcements yet">Published updates show here and on the event page.</EmptyState>;
  return (
    <div className="manager-announcement-list">
      {items.map((item) => (
        <article key={item.id} data-status={item.status === "Draft" ? "draft" : "published"}>
          <div>
            <StatusBadge value={item.status} />
            <span className="manager-mono">
              {showEvent && <>{events.find((event) => event.id === item.eventId)?.title} · </>}
              {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "Not published"}
            </span>
          </div>
          <h3>{item.title}</h3>
          <p>{item.message}</p>
          {item.status === "Draft" && (
            <button type="button" className="manager-button manager-button--small manager-button--go" onClick={() => { updateAnnouncement(item.id, { status: "Published" }); toast("Announcement published."); }}>
              <Icon name="send" size={16} /> Publish draft
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function Stars({ value }) {
  return (
    <span className="manager-stars" role="img" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= Math.round(value) ? "is-on" : ""}><Icon name="star" size={16} /></span>)}
    </span>
  );
}

function FeedbackPanel({ feedback, eyebrow = "Participant feedback", title = "What participants said" }) {
  const count = feedback.length;
  const average = count ? feedback.reduce((sum, item) => sum + item.rating, 0) / count : 0;
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: feedback.filter((item) => item.rating === rating).length }));
  return (
    <section className="manager-panel">
      <SectionHeading eyebrow={eyebrow} title={title} detail="Use these responses to improve event execution and future programming." />
      <div className="manager-feedback-summary">
        <div className="manager-feedback-score">
          <strong>{count ? average.toFixed(1) : "—"}<small> / 5</small></strong>
          {count > 0 && <Stars value={average} />}
          <span>{plural(count, "response")}</span>
        </div>
        <div className="manager-rating-list">
          {distribution.map((item) => (
            <div key={item.rating}>
              <span>{item.rating} <Icon name="star" size={16} /></span>
              <div><span style={{ "--fill": `${count ? item.count / count * 100 : 0}%` }} /></div>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      </div>
      {count ? (
        <div className="manager-feedback-list">
          {feedback.map((item) => (
            <article key={item.id}>
              <div>
                <PersonCell name={item.participant} detail={item.date} />
                <Stars value={item.rating} />
              </div>
              <p>{item.comment}</p>
              <small>
                <span>Organization {item.organizationRating}/5</span>
                <span>Speaker {item.speakerRating}/5</span>
                <span>Venue {item.venueRating}/5</span>
              </small>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon="message" title="No feedback yet">Feedback is available after participants attend the event.</EmptyState>
      )}
    </section>
  );
}

function ReportPanel({ event, registrations, feedback, sessions, eyebrow = "Event report", title = "Results snapshot" }) {
  const count = countRegistrations(event.id, registrations);
  const attendance = getAttendance(event.id, registrations);
  const absenceCount = attendance.confirmed.length - attendance.checkedIn.length;
  const average = feedback.length ? feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length : null;

  function exportCsv() {
    const rows = [
      ["Event", "Registration count", "Capacity", "Checked in", "Absences", "Attendance %", "Feedback average", "Status"],
      [event.title, count, event.capacity, attendance.checkedIn.length, absenceCount, attendance.percentage, average?.toFixed(1) || "", event.status],
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `${event.id}-report.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  return (
    <section className="manager-panel">
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        detail="Counts are calculated from this assigned event's registrations and feedback."
        action={<button type="button" className="manager-button" onClick={exportCsv}><Icon name="download" size={16} /> Export CSV</button>}
      />
      <div className="manager-report-grid">
        <Metric icon="ticket" tone="yellow" label="Registrations" value={`${count} / ${event.capacity}`} note={`${Math.round(count / event.capacity * 100)}% of capacity`} />
        <Metric icon="user-check" tone="mint" label="Checked in" value={attendance.checkedIn.length} note={`${attendance.percentage}% of confirmed participants`} />
        <Metric icon="alert-circle" tone="coral" label="Absences" value={absenceCount} note="Confirmed but not checked in" />
        <Metric icon="star" tone="violet" label="Feedback" value={average === null ? "—" : average.toFixed(1)} note={plural(feedback.length, "response")} />
      </div>
      <dl className="manager-definition-list manager-definition-list--report">
        <div><dt>Event status</dt><dd><StatusBadge value={event.status} /></dd></div>
        <div><dt>Completed</dt><dd>{event.completedAt || "Not completed"}</dd></div>
        <div><dt>Sessions on programme</dt><dd>{sessions.length}</dd></div>
        <div><dt>Attendance summary</dt><dd>{attendance.checkedIn.length} attended · {absenceCount} absent</dd></div>
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ Event workspace */

function EventWorkspace({ event, tab }) {
  const { registrations, sessions, announcements, feedback, venues, toast, updateEvent, deleteSession, completeEvent } = useManager();
  const [form, setForm] = useState(event);
  const [errors, setErrors] = useState({});
  const [sessionEditor, setSessionEditor] = useState(null);
  const [savingDetails, runSaveDetails] = usePending();
  const [dialog, confirm] = useConfirm();
  const eventRows = eventRegistrations(event.id, registrations);
  const eventSessions = sessions.filter((item) => item.eventId === event.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const eventAnnouncements = announcements.filter((item) => item.eventId === event.id);
  const eventFeedback = feedback.filter((item) => item.eventId === event.id);
  const attendance = getAttendance(event.id, registrations);
  const registrationCount = eventRows.length;
  const seatHolders = Object.fromEntries(eventRows.filter((row) => row.status === "Confirmed" && seatOf(row)).map((row) => [seatOf(row), row.name]));
  const activeTab = WORKSPACE_TABS.some((item) => item.id === tab) ? tab : "overview";
  const tabCounts = { sessions: eventSessions.length, participants: registrationCount, announcements: eventAnnouncements.length, feedback: eventFeedback.length };
  const base = `/manager/events/${event.id}`;

  function patchForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function saveDetails(submitEvent) {
    submitEvent.preventDefault();
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = "Event title is required.";
    if (!form.description.trim()) nextErrors.description = "Description is required.";
    if (!form.date || Number.isNaN(Date.parse(`${form.date}T12:00:00`))) nextErrors.date = "Choose a valid event date.";
    if (!form.venue) nextErrors.venue = "Choose a venue.";
    if (!(Number(form.capacity) > 0)) nextErrors.capacity = "Capacity must be greater than zero.";
    if (!form.startTime || !form.endTime || form.startTime >= form.endTime) nextErrors.endTime = "End time must be after start time.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const saved = { ...form, title: form.title.trim(), description: form.description.trim(), capacity: Number(form.capacity) };
    runSaveDetails(() => {
      updateEvent(event.id, saved);
      setForm(saved);
      toast("Event details updated.");
    });
  }

  const removeSession = (session) => confirm({
    title: "Remove session?",
    message: `"${session.title}" will be taken off the programme.`,
    confirmText: "Remove session",
    onConfirm: () => {
      deleteSession(session.id);
      toast("Session removed.");
    },
  });

  const quickActions = [
    { tab: "schedule", icon: "schedule", tone: "blue", title: "Manage schedule", note: plural(eventSessions.length, "session") },
    { tab: "participants", icon: "users", tone: "yellow", title: "Review participants", note: `${registrationCount} registered` },
    { tab: "announcements", icon: "megaphone", tone: "violet", title: "Publish an update", note: plural(eventAnnouncements.length, "announcement") },
    { tab: "reports", icon: "chart", tone: "mint", title: "Review results", note: `${attendance.percentage}% checked in` },
  ];

  return (
    <div className="manager-page manager-workspace">
      <Link className="manager-back-link" to="/manager/events"><Icon name="arrow-left" size={16} /> My events</Link>

      <header className="manager-workspace-head">
        <div className="manager-workspace-head__main">
          <span className="manager-kicker">{event.category} · {event.venue}</span>
          <h2>{event.title}</h2>
          <div className="manager-facts">
            <span><Icon name="calendar" size={16} /> {longDate(event.date)}</span>
            <span><Icon name="clock" size={16} /> {event.startTime}–{event.endTime}</span>
            {!PAST_STATUSES.includes(event.status) && <span className="manager-countdown">{countdownLabel(event.date)}</span>}
          </div>
        </div>
        <div className="manager-workspace-head__side">
          <StatusBadge value={event.status} />
          <div className="manager-head-meter">
            <strong>{registrationCount}<small> / {event.capacity}</small></strong>
            <span>registered</span>
            <CapacityBar value={registrationCount} max={event.capacity} />
          </div>
        </div>
      </header>

      <nav className="manager-tabs" aria-label="Event workspace tabs">
        {WORKSPACE_TABS.map((item) => (
          <Link key={item.id} className={`manager-tab${item.id === activeTab ? " manager-tab--active" : ""}`} aria-current={item.id === activeTab ? "page" : undefined} to={`${base}/${item.id}`}>
            <Icon name={item.icon} size={16} />
            {item.label}
            {item.count && <span className="manager-tab__count">{tabCounts[item.count]}</span>}
          </Link>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <div className="manager-metrics manager-metrics--compact">
            <Metric icon="ticket" tone="yellow" label="Registrations" value={`${registrationCount} / ${event.capacity}`} note={`${Math.round(registrationCount / event.capacity * 100)}% capacity`} />
            <Metric icon="user-check" tone="mint" label="Checked in" value={`${attendance.checkedIn.length} / ${attendance.confirmed.length}`} note={`${attendance.percentage}% of confirmed`} />
            <Metric icon="schedule" tone="blue" label="Sessions" value={eventSessions.length} note="On the event programme" />
            <Metric
              icon="star"
              tone="violet"
              label="Feedback"
              value={eventFeedback.length}
              note={eventFeedback.length ? `${(eventFeedback.reduce((sum, item) => sum + item.rating, 0) / eventFeedback.length).toFixed(1)} average rating` : "Available after event"}
            />
          </div>
          <div className="manager-overview-grid">
            <section className="manager-panel" aria-labelledby="glance-title">
              <PanelHeader
                id="glance-title"
                eyebrow="Event information"
                title="At a glance"
                aside={<Link to={`${base}/details`} className="manager-inline-link">Edit details <Icon name="arrow-right" size={16} /></Link>}
              />
              <dl className="manager-definition-list">
                <div><dt><Icon name="user" size={16} /> Organizer</dt><dd>{event.organizer}</dd></div>
                <div><dt><Icon name="pin" size={16} /> Venue</dt><dd>{event.venue}</dd></div>
                <div><dt><Icon name="clipboard" size={16} /> Requirements</dt><dd>{event.requirements || "None listed"}</dd></div>
                <div><dt><Icon name="calendar" size={16} /> Next milestone</dt><dd>{event.importantDate || "—"}</dd></div>
                <div><dt><Icon name="check-circle" size={16} /> Preparation</dt><dd><PrepChip value={event.preparationStatus} /></dd></div>
              </dl>
            </section>
            <section className="manager-panel" aria-labelledby="quick-title">
              <PanelHeader id="quick-title" eyebrow="Quick actions" title="Keep this event moving" />
              <div className="manager-quick-actions">
                {quickActions.map((item) => (
                  <Link key={item.tab} to={`${base}/${item.tab}`}>
                    <span className={`manager-icon-chip manager-icon-chip--${item.tone}`}><Icon name={item.icon} size={20} /></span>
                    <strong>{item.title}</strong>
                    <small>{item.note}</small>
                  </Link>
                ))}
              </div>
              {!PAST_STATUSES.includes(event.status) && (
                <button
                  type="button"
                  className="manager-button manager-button--complete"
                  onClick={() => confirm({
                    title: "Mark event completed?",
                    message: "Checked-in participants become Attended and the event moves to your past events.",
                    confirmText: "Mark completed",
                    confirmVariant: "primary",
                    onConfirm: () => completeEvent(event.id),
                  })}
                >
                  <Icon name="check-circle" size={16} /> Mark event completed
                </button>
              )}
              {event.status === "Completed" && <p className="manager-complete-note"><Icon name="check-circle" size={16} /> Completed {event.completedAt || ""}. Results and feedback are in the Reports and Feedback tabs.</p>}
            </section>
          </div>
        </>
      )}

      {activeTab === "details" && (
        <section className="manager-panel manager-form-panel">
          <SectionHeading eyebrow="Event setup" title="Event details" detail="Changes update the event workspace and its registration limits." />
          <form className="manager-form" onSubmit={saveDetails}>
            <label className="manager-field manager-field--wide">Event title<input value={form.title} onChange={(e) => patchForm("title", e.target.value)} />{errors.title && <small>{errors.title}</small>}</label>
            <label className="manager-field manager-field--wide">Description<textarea rows="4" value={form.description} onChange={(e) => patchForm("description", e.target.value)} />{errors.description && <small>{errors.description}</small>}</label>
            <label className="manager-field">Date<input type="date" value={form.date} onChange={(e) => patchForm("date", e.target.value)} />{errors.date && <small>{errors.date}</small>}</label>
            <label className="manager-field">Category<select value={form.category} onChange={(e) => patchForm("category", e.target.value)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="manager-field">Start time<input type="time" value={form.startTime} onChange={(e) => patchForm("startTime", e.target.value)} /></label>
            <label className="manager-field">End time<input type="time" value={form.endTime} onChange={(e) => patchForm("endTime", e.target.value)} />{errors.endTime && <small>{errors.endTime}</small>}</label>
            <label className="manager-field">Venue<select value={form.venue} onChange={(e) => patchForm("venue", e.target.value)}><option value="">Choose venue</option>{venues.map((item) => <option key={item}>{item}</option>)}</select>{errors.venue && <small>{errors.venue}</small>}</label>
            <label className="manager-field">Capacity<input type="number" min="1" value={form.capacity} onChange={(e) => patchForm("capacity", e.target.value)} />{errors.capacity && <small>{errors.capacity}</small>}</label>
            <label className="manager-field">Requirements<textarea rows="2" value={form.requirements} onChange={(e) => patchForm("requirements", e.target.value)} /></label>
            <label className="manager-field">Preparation status<select value={form.preparationStatus} onChange={(e) => patchForm("preparationStatus", e.target.value)}>{PREP_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <SeatingField value={form.seating} onChange={(seating) => patchForm("seating", seating)} capacity={form.capacity} locked={registrationCount > 0} />
            <div className="manager-form-actions">
              <SaveButton pending={savingDetails}>Save event details</SaveButton>
              <button className="manager-button" type="button" onClick={() => setForm(event)} disabled={savingDetails}>Discard changes</button>
            </div>
          </form>
        </section>
      )}

      {activeTab === "schedule" && (
        <section className="manager-panel">
          <SectionHeading
            eyebrow="Programme"
            title="Sessions & speakers"
            detail="Room overlaps are checked before a session can be saved."
            action={<button type="button" className="manager-button manager-button--primary" onClick={() => setSessionEditor({ ...EMPTY_SESSION, eventId: event.id })}><Icon name="plus" size={16} /> Add session</button>}
          />
          <SessionTimeline sessions={eventSessions} onEdit={setSessionEditor} onRemove={removeSession} />
        </section>
      )}

      {activeTab === "participants" && (
        <section className="manager-panel">
          <SectionHeading
            eyebrow="Participant list"
            title="Roster & check-in"
            detail={`${plural(eventRows.length, "participant")} for ${event.title}. Confirm sign-ups, check people in at the door, and undo a mistaken check-in.`}
          />
          {event.seating === "reserved" && (
            <div className="manager-seatmap">
              <h3 className="manager-subheading">Seat map <span>{Object.keys(seatHolders).length} / {event.capacity}</span></h3>
              <p className="manager-muted">Hover a taken seat to see who holds it.</p>
              <SeatMap capacity={event.capacity} taken={Object.keys(seatHolders)} holders={seatHolders} />
            </div>
          )}
          <RegistrationDesk rows={eventRows} withCheckIn />
        </section>
      )}

      {activeTab === "announcements" && (
        <>
          <AnnouncementComposer eventId={event.id} />
          <AnnouncementList items={eventAnnouncements} />
        </>
      )}

      {activeTab === "feedback" && <FeedbackPanel feedback={eventFeedback} />}
      {activeTab === "reports" && <ReportPanel event={event} registrations={registrations} feedback={eventFeedback} sessions={eventSessions} />}

      {sessionEditor && <SessionDialog session={sessionEditor} onClose={() => setSessionEditor(null)} />}
      {dialog}
    </div>
  );
}

/* ------------------------------------------------------------------ All-events pages */

function ManagerRegistrations({ registrations }) {
  const [params] = useSearchParams();
  const initialStatus = params.get("status") || "All";
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Registration desk" title="Registrations" detail="Review sign-ups across your assigned events only." />
      <RegistrationDesk key={initialStatus} rows={registrations} showEvent initialStatus={initialStatus} />
    </div>
  );
}

function ManagerAttendance({ events, registrations }) {
  const [eventId, setEventId] = useState("All");
  const rows = registrations.filter((item) => item.status === "Confirmed" && (eventId === "All" || item.eventId === eventId));
  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Event day"
        title="Attendance"
        detail="Check participants in and correct accidental check-ins."
        action={(
          <select className="manager-select" aria-label="Choose assigned event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="All">All assigned events</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        )}
      />
      <section className="manager-panel">
        <AttendanceDesk key={eventId} rows={rows} showEvent={eventId === "All"} />
      </section>
    </div>
  );
}

function ManagerSchedule({ events, sessions, deleteSession, toast }) {
  const [eventId, setEventId] = useState("All");
  const [editing, setEditing] = useState(null);
  const [dialog, confirm] = useConfirm();
  const groups = events
    .filter((event) => eventId === "All" || event.id === eventId)
    .sort(byDate)
    .map((event) => ({ event, sessions: sessions.filter((item) => item.eventId === event.id).sort((a, b) => a.startTime.localeCompare(b.startTime)) }))
    .filter((group) => group.sessions.length);

  const removeSession = (session) => confirm({
    title: "Remove session?",
    message: `"${session.title}" will be taken off the programme.`,
    confirmText: "Remove session",
    onConfirm: () => {
      deleteSession(session.id);
      toast("Session removed.");
    },
  });

  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Programme coordination"
        title="Schedule"
        detail="Manage speakers, rooms, and time slots for your assigned events."
        action={<button type="button" className="manager-button manager-button--primary" onClick={() => setEditing({ ...EMPTY_SESSION, eventId: eventId !== "All" ? eventId : events[0]?.id || "" })}><Icon name="plus" size={16} /> Add session</button>}
      />
      <div className="manager-toolbar">
        <select aria-label="Filter schedule event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="All">All assigned events</option>
          {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
        </select>
      </div>
      {groups.map(({ event, sessions: list }) => (
        <section className="manager-panel manager-schedule-group" key={event.id}>
          <div className="manager-schedule-group__head">
            <DateTile date={event.date} />
            <div>
              <span className="manager-kicker">{event.venue}</span>
              <h3>{event.title}</h3>
            </div>
            <Link className="manager-inline-link" to={`/manager/events/${event.id}/schedule`}>Open <Icon name="arrow-right" size={16} /></Link>
          </div>
          <SessionTimeline sessions={list} onEdit={setEditing} onRemove={removeSession} />
        </section>
      ))}
      {!groups.length && <EmptyState icon="schedule" title="No sessions to display">Add a session to start the programme.</EmptyState>}
      {editing && <SessionDialog session={editing} events={events} onClose={() => setEditing(null)} />}
      {dialog}
    </div>
  );
}

function ManagerParticipants({ events, registrations }) {
  const [query, setQuery] = useState("");
  const rows = registrations.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Participant roster" title="Participants" detail="Operational contact details for participants in your assigned events." />
      <div className="manager-toolbar">
        <SearchField label="Search participant roster" placeholder="Search participants" value={query} onChange={setQuery} />
        <span className="manager-muted">{plural(rows.length, "participant")}</span>
      </div>
      <Table
        empty="No participants match your search."
        emptyIcon="users"
        rows={rows}
        columns={[
          { label: "Name", render: (row) => <PersonCell name={row.name} detail={row.email} /> },
          { label: "Event", render: (row) => events.find((event) => event.id === row.eventId)?.title },
          { label: "Phone", render: (row) => row.phone || <span className="manager-muted">Not provided</span> },
          { label: "Registration", render: (row) => <StatusBadge value={row.status} /> },
          { label: "Attendance", render: (row) => <StatusBadge value={row.attendanceStatus} /> },
        ]}
      />
    </div>
  );
}

function ManagerAnnouncements({ events, announcements }) {
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Participant communication" title="Announcements" detail="Publish an event update or save a draft. No email or push notification is sent." />
      {events.length > 0 && <AnnouncementComposer events={events} />}
      <AnnouncementList items={announcements} showEvent />
    </div>
  );
}

function ManagerFeedback({ events, feedback }) {
  const withFeedback = events
    .map((event) => ({ event, items: feedback.filter((item) => item.eventId === event.id) }))
    .sort((a, b) => b.items.length - a.items.length);
  const quiet = withFeedback.filter((group) => !group.items.length);
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Post-event review" title="Feedback" detail="Participant comments and event ratings from your assignments." />
      {withFeedback.filter((group) => group.items.length).map(({ event, items }) => (
        <FeedbackPanel key={event.id} feedback={items} eyebrow={eventDate(event.date, { month: "short", day: "numeric", year: "numeric" })} title={event.title} />
      ))}
      {quiet.length > 0 && (
        <section className="manager-panel">
          <PanelHeader eyebrow="Waiting for responses" title="No feedback yet" />
          <ul className="manager-quiet-list">
            {quiet.map(({ event }) => <li key={event.id}><DateTile date={event.date} /> <span>{event.title}</span> <StatusBadge value={event.status} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

function ManagerReports({ events, registrations, feedback, sessions }) {
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Event performance" title="Reports" detail="Event-level results calculated from assigned participant and feedback records." />
      {[...events].sort(byDate).map((event) => (
        <ReportPanel
          key={event.id}
          event={event}
          eyebrow={`${event.category} · ${eventDate(event.date, { month: "short", day: "numeric", year: "numeric" })}`}
          title={event.title}
          registrations={registrations}
          feedback={feedback.filter((item) => item.eventId === event.id)}
          sessions={sessions.filter((item) => item.eventId === event.id)}
        />
      ))}
      {!events.length && <EmptyState icon="chart" title="No events to report on" />}
    </div>
  );
}

export default function ManagerScreen({ section }) {
  const manager = useManager();
  const { eventId, tab } = useParams();
  const event = manager.events.find((item) => item.id === eventId);
  if (section === "event") {
    return event
      ? <EventWorkspace key={`${event.id}-${tab}`} event={event} tab={tab} />
      : <EmptyState icon="alert-circle" title="This event is not assigned to your manager account."><Link to="/manager/events">Back to my events</Link></EmptyState>;
  }
  if (section === "events") return <ManagerEvents />;
  if (section === "registrations") return <ManagerRegistrations {...manager} />;
  if (section === "attendance") return <ManagerAttendance {...manager} />;
  if (section === "schedule") return <ManagerSchedule {...manager} />;
  if (section === "participants") return <ManagerParticipants {...manager} />;
  if (section === "announcements") return <ManagerAnnouncements {...manager} />;
  if (section === "feedback") return <ManagerFeedback {...manager} />;
  if (section === "reports") return <ManagerReports {...manager} />;
  return <ManagerOverview />;
}
