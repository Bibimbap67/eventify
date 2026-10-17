import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useManager } from "../../context/ManagerContext.js";
import Icon from "../../components/Icon.js";
import { useConfirm } from "../../components/Modal.js";
import { usePending } from "../../components/Motion.js";
import SeatMap, { SeatingField } from "../../components/SeatMap.js";
import {
  CapacityBar,
  EmptyState,
  Metric,
  PanelHeader,
  PrepChip,
  SectionHeading,
  StatusBadge,
  countdownLabel,
  eventDate,
  eventRegistrations,
  getAttendance,
  plural,
} from "../../components/ui.js";
import { LIVE_STATUSES, PAST_STATUSES } from "../../data/eventStatus.js";
import {
  BookedTimes,
  CATEGORIES,
  OvertimeButtons,
  PREP_STATUSES,
  SaveButton,
  SpeakersField,
  VenueField,
  cleanSpeakers,
  clashOf,
  useVenueDay,
} from "../../components/manager/EventFields.js";
import { RegistrationDesk } from "../../components/manager/Desks.js";
import { EMPTY_SESSION, SessionDialog, SessionTimeline } from "../../components/manager/Sessions.js";
import { AnnouncementComposer, AnnouncementList } from "../../components/manager/Announcements.js";
import { FeedbackPanel, ReportPanel } from "../../components/manager/Results.js";
import { seatOf } from "../../data/seating.js";
import { isRunning } from "../../data/checkIn.js";
import { formatTime, timeRange } from "../../data/time.js";
import { summarizeFeedback } from "../../data/feedback.js";

// One event's workspace (/manager/events/:eventId/:tab): overview, details, schedule,
// participants, announcements, feedback and reports.

const WORKSPACE_TABS = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "details", label: "Details", icon: "edit" },
  { id: "schedule", label: "Schedule", icon: "schedule", count: "sessions" },
  { id: "participants", label: "Participants", icon: "users", count: "participants" },
  { id: "announcements", label: "Announcements", icon: "megaphone", count: "announcements" },
  { id: "feedback", label: "Feedback", icon: "message", count: "feedback" },
  { id: "reports", label: "Reports", icon: "chart" },
];

const longDate = (date) => eventDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

// Only events assigned to this manager account open here.
export default function EventWorkspacePage() {
  const { events } = useManager();
  const { eventId, tab } = useParams();
  const event = events.find((item) => item.id === eventId);
  return event ? (
    <EventWorkspace key={`${event.id}-${tab}`} event={event} tab={tab} />
  ) : (
    <EmptyState icon="alert-circle" title="This event is not assigned to your manager account.">
      <Link to="/manager/events">Back to my events</Link>
    </EmptyState>
  );
}

function EventWorkspace({ event, tab }) {
  const { registrations, sessions, announcements, feedback, toast, updateEvent, deleteSession, completeEvent } =
    useManager();
  const [form, setForm] = useState(event);
  const [errors, setErrors] = useState({});
  const [sessionEditor, setSessionEditor] = useState(null);
  const [savingDetails, runSaveDetails] = usePending();
  const [dialog, confirm] = useConfirm();
  const eventRows = eventRegistrations(event.id, registrations);
  const eventSessions = sessions
    .filter((item) => item.eventId === event.id)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const eventAnnouncements = announcements.filter((item) => item.eventId === event.id);
  const eventFeedback = feedback.filter((item) => item.eventId === event.id);
  const attendance = getAttendance(event.id, registrations);
  const feedbackAverage = summarizeFeedback(eventFeedback).average;
  const registrationCount = eventRows.length;
  const seatHolders = Object.fromEntries(
    eventRows.filter((row) => row.status === "Confirmed" && seatOf(row)).map((row) => [seatOf(row), row.name]),
  );
  const activeTab = WORKSPACE_TABS.some((item) => item.id === tab) ? tab : "overview";
  const tabCounts = {
    sessions: eventSessions.length,
    participants: registrationCount,
    announcements: eventAnnouncements.length,
    feedback: eventFeedback.length,
  };
  const base = `/manager/events/${event.id}`;
  const venueDay = useVenueDay(form.venue, form.date, event.id);
  const running = isRunning(event);

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
    else if (
      venueDay.capacity &&
      Number(form.capacity) > venueDay.capacity &&
      (form.venue !== event.venue || Number(form.capacity) !== Number(event.capacity))
    ) {
      nextErrors.capacity = `${form.venue} holds ${venueDay.capacity} people. Use ${venueDay.capacity} or less.`;
    }
    if (!form.startTime || !form.endTime || form.startTime >= form.endTime) {
      nextErrors.endTime = "End time must be after start time.";
    } else if (["venue", "date", "startTime", "endTime"].some((key) => form[key] !== event[key])) {
      const clash = clashOf(venueDay.bookings, form.startTime, form.endTime);
      if (clash) {
        nextErrors.endTime = `${form.venue} is booked for ${clash.title} from ${timeRange(clash.startTime, clash.endTime, " to ")}. Pick a free time.`;
      }
    }
    if (!form.organizer?.trim()) nextErrors.organizer = "Enter the organization running this event.";
    const speakers = cleanSpeakers(form.speakers);
    if (!speakers) nextErrors.speakers = "Give every speaker a name and a role, or remove the empty row.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const saved = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      capacity: Number(form.capacity),
      organizer: form.organizer.trim(),
      speakers,
    };
    runSaveDetails(() => {
      updateEvent(event.id, saved);
      setForm(saved);
      toast("Event details updated.");
    });
  }

  const removeSession = (session) =>
    confirm({
      title: "Remove session?",
      message: `"${session.title}" will be taken off the programme.`,
      confirmText: "Remove session",
      onConfirm: () => {
        deleteSession(session.id);
        toast("Session removed.", "warning");
      },
    });

  const quickActions = [
    {
      tab: "schedule",
      icon: "schedule",
      tone: "blue",
      title: "Manage schedule",
      note: plural(eventSessions.length, "session"),
    },
    {
      tab: "participants",
      icon: "users",
      tone: "yellow",
      title: "Review participants",
      note: `${registrationCount} registered`,
    },
    {
      tab: "announcements",
      icon: "megaphone",
      tone: "violet",
      title: "Publish an update",
      note: plural(eventAnnouncements.length, "announcement"),
    },
    {
      tab: "reports",
      icon: "chart",
      tone: "mint",
      title: "Review results",
      note: `${attendance.percentage}% checked in`,
    },
  ];

  return (
    <div className="manager-page manager-workspace">
      <Link className="manager-back-link" to="/manager/events">
        <Icon name="arrow-left" size={16} /> My events
      </Link>

      <header className="manager-workspace-head">
        <div className="manager-workspace-head__main">
          <span className="manager-kicker">
            {event.category} · {event.venue}
          </span>
          <h2>{event.title}</h2>
          <div className="manager-facts">
            <span>
              <Icon name="calendar" size={16} /> {longDate(event.date)}
            </span>
            <span>
              <Icon name="clock" size={16} /> {timeRange(event.startTime, event.endTime, "–")}
            </span>
            {!PAST_STATUSES.includes(event.status) && (
              <span className="manager-countdown">{countdownLabel(event.date)}</span>
            )}
          </div>
          <OvertimeButtons
            event={event}
            endTime={event.endTime}
            onExtend={(endTime, minutes) => {
              updateEvent(event.id, { endTime });
              setForm((current) => ({ ...current, endTime })); // so saving the details form keeps the overtime
              toast(`Added ${minutes} minutes. The event now ends at ${formatTime(endTime)}.`);
            }}
          />
        </div>
        <div className="manager-workspace-head__side">
          <StatusBadge value={event.status} />
          <div className="manager-head-meter">
            <strong>
              {registrationCount}
              <small> / {event.capacity}</small>
            </strong>
            <span>registered</span>
            <CapacityBar value={registrationCount} max={event.capacity} />
          </div>
        </div>
      </header>

      <nav className="manager-tabs" aria-label="Event workspace tabs">
        {WORKSPACE_TABS.map((item) => (
          <Link
            key={item.id}
            className={`manager-tab${item.id === activeTab ? " manager-tab--active" : ""}`}
            aria-current={item.id === activeTab ? "page" : undefined}
            to={`${base}/${item.id}`}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
            {item.count && <span className="manager-tab__count">{tabCounts[item.count]}</span>}
          </Link>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <div className="manager-metrics manager-metrics--compact">
            <Metric
              icon="ticket"
              tone="yellow"
              label="Registrations"
              value={`${registrationCount} / ${event.capacity}`}
              note={`${Math.round((registrationCount / event.capacity) * 100)}% capacity`}
            />
            <Metric
              icon="user-check"
              tone="mint"
              label="Checked in"
              value={`${attendance.checkedIn.length} / ${attendance.confirmed.length}`}
              note={`${attendance.percentage}% of confirmed`}
            />
            <Metric
              icon="schedule"
              tone="blue"
              label="Sessions"
              value={eventSessions.length}
              note="On the event programme"
            />
            <Metric
              icon="star"
              tone="violet"
              label="Feedback"
              value={eventFeedback.length}
              note={feedbackAverage === null ? "Available after event" : `${feedbackAverage.toFixed(1)} average rating`}
            />
          </div>
          <div className="manager-overview-grid">
            <section className="manager-panel" aria-labelledby="glance-title">
              <PanelHeader
                id="glance-title"
                eyebrow="Event information"
                title="At a glance"
                aside={
                  <Link to={`${base}/details`} className="manager-inline-link">
                    Edit details <Icon name="arrow-right" size={16} />
                  </Link>
                }
              />
              <dl className="manager-definition-list">
                <div>
                  <dt>
                    <Icon name="user" size={16} /> Organizer
                  </dt>
                  <dd>{event.organizer}</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="pin" size={16} /> Venue
                  </dt>
                  <dd>{event.venue}</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="clipboard" size={16} /> Requirements
                  </dt>
                  <dd>{event.requirements || "None listed"}</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="calendar" size={16} /> Next milestone
                  </dt>
                  <dd>{event.importantDate || "—"}</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="check-circle" size={16} /> Preparation
                  </dt>
                  <dd>
                    <PrepChip value={event.preparationStatus} />
                  </dd>
                </div>
              </dl>
            </section>
            <section className="manager-panel" aria-labelledby="quick-title">
              <PanelHeader id="quick-title" eyebrow="Quick actions" title="Keep this event moving" />
              <div className="manager-quick-actions">
                {quickActions.map((item) => (
                  <Link key={item.tab} to={`${base}/${item.tab}`}>
                    <span className={`manager-icon-chip manager-icon-chip--${item.tone}`}>
                      <Icon name={item.icon} size={20} />
                    </span>
                    <strong>{item.title}</strong>
                    <small>{item.note}</small>
                  </Link>
                ))}
              </div>
              {/* Only an approved event can be completed here; a pending or rejected one waits for the admin. */}
              {LIVE_STATUSES.includes(event.status) && (
                <button
                  type="button"
                  className="manager-button manager-button--complete"
                  onClick={() =>
                    confirm({
                      title: "Mark event completed?",
                      message:
                        "The event moves to your past events. Participants whose exit was verified get their certificates; the rest can still scan the exit QR until 2 hours after the scheduled end.",
                      confirmText: "Mark completed",
                      confirmVariant: "primary",
                      onConfirm: () => completeEvent(event.id),
                    })
                  }
                >
                  <Icon name="check-circle" size={16} /> Mark event completed
                </button>
              )}
              {event.status === "Completed" && (
                <p className="manager-complete-note">
                  <Icon name="check-circle" size={16} /> Completed {event.completedAt || ""}. Results and feedback are
                  in the Reports and Feedback tabs.
                </p>
              )}
              {["Completed", "Cancelled"].includes(event.status) && (
                <button
                  type="button"
                  className="manager-button"
                  onClick={() => {
                    // Archiving remembers the status it came from, so Restore can put it back.
                    updateEvent(event.id, {
                      status: "Archived",
                      archivedFrom: event.status,
                      archivedAt: new Date().toISOString().slice(0, 10),
                    });
                    toast("Event archived. It's under My events > Archive.");
                  }}
                >
                  <Icon name="archive" size={16} /> Archive event
                </button>
              )}
              {event.status === "Archived" && (
                <>
                  <p className="manager-complete-note">
                    <Icon name="archive" size={16} /> Archived {event.archivedAt || ""}. Its registrations, attendance
                    and certificates are kept.
                  </p>
                  <button
                    type="button"
                    className="manager-button"
                    onClick={() => {
                      updateEvent(event.id, { status: event.archivedFrom || "Completed" });
                      toast("Event restored.");
                    }}
                  >
                    <Icon name="restore" size={16} /> Restore event
                  </button>
                </>
              )}
            </section>
          </div>
        </>
      )}

      {activeTab === "details" && (
        <section className="manager-panel manager-form-panel">
          <SectionHeading
            eyebrow="Event setup"
            title="Event details"
            detail="Changes update the event workspace and its registration limits."
          />
          {running && (
            <p className="manager-complete-note manager-complete-note--locked">
              <Icon name="hourglass" size={16} /> This event is running, so its details are locked. You can still add
              overtime above or mark it completed.
            </p>
          )}
          <form className="manager-form" onSubmit={saveDetails}>
            <fieldset className="manager-form__lock" disabled={running}>
            <label className="manager-field manager-field--wide">
              Event title
              <input value={form.title} onChange={(e) => patchForm("title", e.target.value)} />
              {errors.title && <small>{errors.title}</small>}
            </label>
            <label className="manager-field manager-field--wide">
              Description
              <textarea rows="4" value={form.description} onChange={(e) => patchForm("description", e.target.value)} />
              {errors.description && <small>{errors.description}</small>}
            </label>
            <label className="manager-field">
              Date
              <input type="date" value={form.date} onChange={(e) => patchForm("date", e.target.value)} />
              {errors.date && <small>{errors.date}</small>}
            </label>
            <label className="manager-field">
              Category
              <select value={form.category} onChange={(e) => patchForm("category", e.target.value)}>
                {CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="manager-field">
              Start time
              <input type="time" value={form.startTime} onChange={(e) => patchForm("startTime", e.target.value)} />
            </label>
            <label className="manager-field">
              End time
              <input type="time" value={form.endTime} onChange={(e) => patchForm("endTime", e.target.value)} />
              {errors.endTime && <small>{errors.endTime}</small>}
            </label>
            <VenueField value={form.venue} onChange={(e) => patchForm("venue", e.target.value)} error={errors.venue} />
            <label className="manager-field">
              Capacity
              <input
                type="number"
                min="1"
                max={venueDay.capacity || undefined}
                value={form.capacity}
                onChange={(e) => patchForm("capacity", e.target.value)}
              />
              {errors.capacity ? (
                <small>{errors.capacity}</small>
              ) : (
                venueDay.capacity && <small className="manager-hint">Up to {venueDay.capacity} for this venue.</small>
              )}
            </label>
            <BookedTimes venue={form.venue} date={form.date} bookings={venueDay.bookings} />
            <label className="manager-field">
              Organizer
              <input
                value={form.organizer || ""}
                onChange={(e) => patchForm("organizer", e.target.value)}
                placeholder="e.g. CCIT Student Council"
              />
              {errors.organizer && <small>{errors.organizer}</small>}
            </label>
            <label className="manager-field">
              Requirements
              <textarea
                rows="2"
                value={form.requirements}
                onChange={(e) => patchForm("requirements", e.target.value)}
              />
            </label>
            <label className="manager-field">
              Preparation status
              <select value={form.preparationStatus} onChange={(e) => patchForm("preparationStatus", e.target.value)}>
                {PREP_STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <SeatingField
              value={form.seating}
              onChange={(seating) => patchForm("seating", seating)}
              capacity={form.capacity}
              locked={registrationCount > 0}
            />
            <SpeakersField
              value={form.speakers}
              onChange={(speakers) => patchForm("speakers", speakers)}
              error={errors.speakers}
            />
            <div className="manager-form-actions">
              <SaveButton pending={savingDetails}>Save event details</SaveButton>
              <button className="manager-button" type="button" onClick={() => setForm(event)} disabled={savingDetails}>
                Discard changes
              </button>
            </div>
            </fieldset>
          </form>
        </section>
      )}

      {activeTab === "schedule" && (
        <section className="manager-panel">
          <SectionHeading
            eyebrow="Programme"
            title="Sessions & speakers"
            detail="Room overlaps are checked before a session can be saved."
            action={
              <button
                type="button"
                className="manager-button manager-button--primary"
                onClick={() => setSessionEditor({ ...EMPTY_SESSION, eventId: event.id })}
              >
                <Icon name="plus" size={16} /> Add session
              </button>
            }
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
              <h3 className="manager-subheading">
                Seat map{" "}
                <span>
                  {Object.keys(seatHolders).length} / {event.capacity}
                </span>
              </h3>
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
      {activeTab === "reports" && (
        <ReportPanel event={event} registrations={registrations} feedback={eventFeedback} sessions={eventSessions} />
      )}

      {sessionEditor && <SessionDialog session={sessionEditor} onClose={() => setSessionEditor(null)} />}
      {dialog}
    </div>
  );
}
