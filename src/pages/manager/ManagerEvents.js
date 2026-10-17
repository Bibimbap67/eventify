import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useManager } from "../../context/ManagerContext.js";
import Icon from "../../components/Icon.js";
import { useEntering, usePending } from "../../components/Motion.js";
import { SeatingField } from "../../components/SeatMap.js";
import {
  ArchiveSwitch,
  CapacityBar,
  DateTile,
  EmptyState,
  FilterChips,
  PanelHeader,
  PrepChip,
  SearchField,
  SectionHeading,
  StatusBadge,
  countRegistrations,
  eventDate,
} from "../../components/ui.js";
import { PAST_STATUSES } from "../../data/eventStatus.js";
import {
  BookedTimes,
  CATEGORIES,
  EMPTY_EVENT,
  SaveButton,
  SpeakersField,
  VenueField,
  cleanSpeakers,
  clashOf,
  useVenueDay,
} from "../../components/manager/EventFields.js";
import { timeRange } from "../../data/time.js";
import { Pagination, usePaged } from "../../components/admin/parts.js";

// Past and archived events pile up over the terms; upcoming ones always show in full.
const PAGE_SIZE = 12;

// The event's listed speakers; older events only named speakers on their sessions.
function speakerNames(event, sessions) {
  if (event.speakers?.length) return event.speakers.map((speaker) => speaker.name);
  return [
    ...new Set(
      sessions
        .filter((session) => session.eventId === event.id)
        .map((session) => session.speaker)
        .filter(Boolean),
    ),
  ];
}

export default function ManagerEvents() {
  const { events, registrations, sessions, createEvent, toast } = useManager();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [view, setView] = useState("current"); // "current" | "archive"
  const [dateOrder, setDateOrder] = useState("Soonest first");
  const [dateFilter, setDateFilter] = useState("");
  const [form, setForm] = useState(EMPTY_EVENT);
  const [formError, setFormError] = useState("");
  const [submitting, runSubmit] = usePending();
  const entering = useEntering();
  const creating = params.get("new") === "1";
  const setCreating = (open) => setParams(open ? { new: "1" } : {}, { replace: true });
  const patch = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.value }));
  const venueDay = useVenueDay(form.venue, form.date);
  // Local date, not toISOString(): that is UTC and lags a day before 8am in PH.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const archived = events.filter((event) => event.status === "Archived");
  const inView = useMemo(
    () => events.filter((event) => (event.status === "Archived") === (view === "archive")),
    [events, view],
  );
  const rows = useMemo(
    () =>
      [...inView]
        .filter((event) => event.title.toLowerCase().includes(query.toLowerCase()))
        .filter((event) => status === "All" || event.status === status)
        .filter((event) => !dateFilter || event.date >= dateFilter)
        .sort((a, b) => (dateOrder === "Soonest first" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))),
    [dateFilter, dateOrder, inView, query, status],
  );
  const active = rows.filter((event) => !PAST_STATUSES.includes(event.status));
  const past = rows.filter((event) => PAST_STATUSES.includes(event.status));
  const pagedList = view === "archive" ? rows : past;
  const { page, setPage, shown } = usePaged(
    pagedList,
    PAGE_SIZE,
    [view, query, status, dateFilter, dateOrder].join("|"),
    "page",
  );
  const pager = <Pagination page={page} limit={PAGE_SIZE} total={pagedList.length} noun="event" onPage={setPage} />;
  const statusOptions = ["All", ...new Set(inView.map((event) => event.status))].map((value) => ({
    value,
    label: value,
    count: value === "All" ? inView.length : inView.filter((event) => event.status === value).length,
  }));

  function submitEvent(e) {
    e.preventDefault();
    const speakers = cleanSpeakers(form.speakers);
    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.date ||
      !form.startTime ||
      !form.endTime ||
      form.startTime >= form.endTime ||
      !form.venue.trim() ||
      !(Number(form.capacity) > 0) ||
      !form.organizer.trim()
    ) {
      setFormError("Complete the required fields, including the organizer, and enter a valid time range and capacity.");
      return;
    }
    if (form.date < today) {
      setFormError("Pick today or a later date.");
      return;
    }
    if (venueDay.capacity && Number(form.capacity) > venueDay.capacity) {
      setFormError(
        `${form.venue} holds ${venueDay.capacity} people. Set the capacity to ${venueDay.capacity} or less.`,
      );
      return;
    }
    const clash = clashOf(venueDay.bookings, form.startTime, form.endTime);
    if (clash) {
      setFormError(
        `${form.venue} is booked for ${clash.title} from ${timeRange(clash.startTime, clash.endTime, " to ")} that day. Pick a free time or another venue.`,
      );
      return;
    }
    if (!speakers) {
      setFormError("Give every speaker a name and a role, or remove the empty row.");
      return;
    }
    setFormError("");
    const draft = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      venue: form.venue.trim(),
      capacity: Number(form.capacity),
      organizer: form.organizer.trim(),
      speakers,
    };
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
          speakers={speakerNames(event, sessions)}
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
        action={
          <button
            className={`manager-button${creating ? "" : " manager-button--primary"}`}
            type="button"
            onClick={() => setCreating(!creating)}
            aria-expanded={creating}
          >
            <Icon name={creating ? "close" : "plus"} size={16} /> {creating ? "Close form" : "Create event"}
          </button>
        }
      />

      {creating && (
        <section className="manager-panel manager-form-panel" aria-labelledby="new-event-title">
          <PanelHeader
            id="new-event-title"
            eyebrow="New event"
            title="Submit an event for approval"
            aside={<span className="manager-muted">An admin reviews it before registration opens.</span>}
          />
          <form className="manager-form" onSubmit={submitEvent}>
            <label className="manager-field manager-field--wide">
              Event title
              <input value={form.title} onChange={patch("title")} />
            </label>
            <label className="manager-field manager-field--wide">
              Description
              <textarea rows="3" value={form.description} onChange={patch("description")} />
            </label>
            <label className="manager-field">
              Date
              <input type="date" value={form.date} min={today} onChange={patch("date")} />
            </label>
            <label className="manager-field">
              Category
              <select value={form.category} onChange={patch("category")}>
                {CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="manager-field">
              Start time
              <input type="time" value={form.startTime} onChange={patch("startTime")} />
            </label>
            <label className="manager-field">
              End time
              <input type="time" value={form.endTime} onChange={patch("endTime")} />
            </label>
            <VenueField value={form.venue} onChange={patch("venue")} />
            <label className="manager-field">
              Capacity
              <input
                type="number"
                min="1"
                max={venueDay.capacity || undefined}
                value={form.capacity}
                onChange={patch("capacity")}
              />
              {venueDay.capacity && <small className="manager-hint">Up to {venueDay.capacity} for this venue.</small>}
            </label>
            <BookedTimes venue={form.venue} date={form.date} bookings={venueDay.bookings} />
            <label className="manager-field">
              Organizer
              <input value={form.organizer} onChange={patch("organizer")} placeholder="e.g. CCIT Student Council" />
            </label>
            <label className="manager-field">
              Requirements
              <textarea rows="2" value={form.requirements} onChange={patch("requirements")} />
            </label>
            <SeatingField
              value={form.seating}
              onChange={(seating) => setForm((current) => ({ ...current, seating }))}
              capacity={form.capacity}
            />
            <SpeakersField
              value={form.speakers}
              onChange={(speakers) => setForm((current) => ({ ...current, speakers }))}
            />
            {formError && (
              <p className="manager-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="manager-form-actions">
              <SaveButton pending={submitting} pendingText="Submitting…">
                <Icon name="send" size={16} /> Submit for approval
              </SaveButton>
            </div>
          </form>
        </section>
      )}

      <ArchiveSwitch
        value={view}
        onChange={(next) => {
          setView(next);
          setStatus("All");
        }}
        current={events.length - archived.length}
        archived={archived.length}
      />

      <div className="manager-toolbar">
        <SearchField label="Search assigned events" placeholder="Search events" value={query} onChange={setQuery} />
        <label className="manager-toolbar__field">
          On or after <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </label>
        <select aria-label="Sort events by date" value={dateOrder} onChange={(e) => setDateOrder(e.target.value)}>
          <option>Soonest first</option>
          <option>Latest first</option>
        </select>
        {view === "current" && (
          <FilterChips label="Filter by event status" options={statusOptions} value={status} onChange={setStatus} />
        )}
      </div>

      {view === "archive" ? (
        rows.length > 0 && (
          <>
            {renderCards(shown)}
            {pager}
          </>
        )
      ) : (
        <>
          {active.length > 0 && renderCards(active)}
          {past.length > 0 && (
            <>
              <h3 className="manager-subheading">
                Past & cancelled <span>{past.length}</span>
              </h3>
              {renderCards(shown)}
              {pager}
            </>
          )}
        </>
      )}
      {!rows.length &&
        (view === "archive" && !archived.length ? (
          <EmptyState icon="archive" title="Nothing archived yet">
            Open a completed or cancelled event and choose Archive event. It moves here with its registrations,
            attendance and certificates.
          </EmptyState>
        ) : (
          <EmptyState icon="search" title="No assigned events match these filters">
            Clear the search or pick another status.
          </EmptyState>
        ))}
    </div>
  );
}

function EventCard({ event, count, speakers }) {
  const isPast = PAST_STATUSES.includes(event.status);
  const base = `/manager/events/${event.id}`;
  return (
    <article
      className={`manager-event-card${isPast ? " is-past" : ""}${event.status === "Completed" ? " is-completed" : ""}`}
    >
      <div className="manager-event-card__top">
        <DateTile date={event.date} />
        <div className="manager-event-card__heading">
          <div className="manager-event-card__kicker">
            <span className="manager-kicker">
              {event.category} · {eventDate(event.date, { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <StatusBadge value={event.status} />
          </div>
          <h3>{event.title}</h3>
        </div>
      </div>
      <div className="manager-facts">
        <span>
          <Icon name="clock" size={16} /> {timeRange(event.startTime, event.endTime, "–")}
        </span>
        <span>
          <Icon name="pin" size={16} /> {event.venue}
        </span>
        <PrepChip value={event.preparationStatus} />
      </div>
      <div className="manager-event-card__meter">
        <span>
          <b>{count}</b> / {event.capacity} registered
        </span>
        <span>{event.capacity ? Math.min(100, Math.round((count / event.capacity) * 100)) : 0}%</span>
      </div>
      <CapacityBar value={count} max={event.capacity} label={`${event.title} registrations`} />
      {speakers.length > 0 && (
        <p className="manager-event-card__speakers">
          <Icon name="speaker" size={16} /> {speakers.slice(0, 2).join(" · ")}
          {speakers.length > 2 ? ` +${speakers.length - 2}` : ""}
        </p>
      )}
      <div className="manager-event-card__actions">
        <Link className="manager-button manager-button--primary" to={`${base}/overview`}>
          Open workspace <Icon name="arrow-right" size={16} />
        </Link>
        <Link className="manager-button manager-button--ghost" to={`${base}/details`}>
          <Icon name="edit" size={16} /> Details
        </Link>
        <Link className="manager-button manager-button--ghost" to={`${base}/participants`}>
          <Icon name="users" size={16} /> Participants
        </Link>
        <Link className="manager-button manager-button--ghost" to={`${base}/reports`}>
          <Icon name="chart" size={16} /> Report
        </Link>
      </div>
    </article>
  );
}
