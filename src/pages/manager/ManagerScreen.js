import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useManager } from "../../context/ManagerContext.js";
import Icon from "../../components/Icon.js";
import { CountUp, useEntering } from "../../components/Motion.js";

const WORKSPACE_TABS = [
  ["overview", "Overview"], ["details", "Details"], ["schedule", "Schedule"],
  ["participants", "Participants"], ["announcements", "Announcements"],
  ["feedback", "Feedback"], ["reports", "Reports"],
];
const EMPTY_SESSION = { title: "", speaker: "", startTime: "", endTime: "", room: "" };

function eventRegistrations(eventId, registrations) {
  return registrations.filter((item) => item.eventId === eventId && item.status !== "Cancelled");
}

function countRegistrations(eventId, registrations) {
  return eventRegistrations(eventId, registrations).length;
}

function getAttendance(eventId, registrations) {
  const confirmed = registrations.filter((item) => item.eventId === eventId && item.status === "Confirmed");
  const checkedIn = confirmed.filter((item) => ["Checked in", "Attended"].includes(item.attendanceStatus));
  return { confirmed, checkedIn, percentage: confirmed.length ? Math.round(checkedIn.length / confirmed.length * 100) : 0 };
}

function StatusBadge({ value }) {
  return <span className={`manager-status manager-status--${String(value).toLowerCase().replace(/[^a-z]+/g, "-")}`}>{value}</span>;
}

function SectionHeading({ eyebrow, title, detail, action }) {
  return (
    <div className="manager-section-heading">
      <div><span>{eyebrow}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div>
      {action}
    </div>
  );
}

function Metric({ label, value, note }) {
  return <div className="manager-metric"><span>{label}</span><strong><CountUp value={value} /></strong><small>{note}</small></div>;
}

function Table({ columns, rows, empty = "No records to show." }) {
  const entering = useEntering();
  if (!rows.length) return <div className="manager-empty">{empty}</div>;
  return (
    <div className={`manager-table-wrap${entering ? " stagger" : ""}`}><table className="manager-table"><thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

function RegistrationTable({ rows, events, onStatus }) {
  const eventMap = new Map(events.map((event) => [event.id, event]));
  return <Table
    empty="No registrations for this event yet."
    columns={[
      { label: "Participant", render: (row) => <><strong>{row.name}</strong><small className="manager-cell-note">{row.email}</small></> },
      { label: "Event", render: (row) => eventMap.get(row.eventId)?.title || "Assigned event" },
      { label: "Registered", render: (row) => row.registrationDate },
      { label: "Registration", render: (row) => <StatusBadge value={row.status} /> },
      { label: "Attendance", render: (row) => <StatusBadge value={row.attendanceStatus} /> },
      { label: "Action", render: (row) => row.status === "Pending"
        ? <button className="manager-button manager-button--small" onClick={() => onStatus(row.id, { status: "Confirmed" })}>Confirm</button>
        : row.status === "Confirmed" ? <button className="manager-text-button" onClick={() => onStatus(row.id, { status: "Cancelled", attendanceStatus: "Not checked in", checkedInAt: "" })}>Cancel registration</button> : "—" },
    ]}
    rows={rows}
  />;
}

function ManagerOverview() {
  const { events, registrations, sessions, notifications, announcements } = useManager();
  const upcoming = [...events].filter((event) => event.status !== "Completed" && event.status !== "Cancelled").sort((a, b) => a.date.localeCompare(b.date));
  const activeParticipants = registrations.filter((item) => item.status !== "Cancelled").length;
  const prepCount = events.filter((event) => !["Completed", "Cancelled"].includes(event.status) && event.preparationStatus !== "Ready").length;
  const nextEvent = upcoming[0];
  const nextSessions = sessions.filter((session) => upcoming.some((event) => event.id === session.eventId)).slice(0, 5);
  const actionItems = [
    ...events.filter((event) => event.status === "Approved").map((event) => `${event.title}: registration is not open yet`),
    ...registrations.filter((item) => item.status === "Pending").map((item) => `${item.name}: registration needs review`),
    ...announcements.filter((item) => item.status === "Draft").map((item) => `${item.title}: announcement is still a draft`),
  ].slice(0, 4);

  return <div className="manager-page manager-overview">
    <SectionHeading eyebrow="YOUR ASSIGNMENT" title="What needs your attention?" detail="A working view of the events and participants assigned to you." />
    <div className="manager-metrics">
      <Metric label="Assigned events" value={events.length} note={`${upcoming.length} upcoming`} />
      <Metric label="Active registrations" value={activeParticipants} note="Across your events" />
      <Metric label="Needs preparation" value={prepCount} note="Not marked ready" />
      <Metric label="Checked in" value={registrations.filter((item) => ["Checked in", "Attended"].includes(item.attendanceStatus)).length} note="Recorded attendance" />
    </div>
    <div className="manager-overview-grid">
      <section className="manager-panel manager-next-event">
        <div className="manager-panel__header"><div><span>NEXT EVENT</span><h3>{nextEvent?.title || "No upcoming event"}</h3></div>{nextEvent && <StatusBadge value={nextEvent.status} />}</div>
        {nextEvent && <>
          <div className="manager-event-facts"><span>{new Date(`${nextEvent.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span><span>{nextEvent.startTime}–{nextEvent.endTime}</span><span>{nextEvent.venue}</span></div>
          <div className="manager-progress-label"><span>Registration progress</span><strong>{countRegistrations(nextEvent.id, registrations)} / {nextEvent.capacity}</strong></div>
          <div className="manager-progress"><span style={{ width: `${Math.min(100, countRegistrations(nextEvent.id, registrations) / nextEvent.capacity * 100)}%` }} /></div>
          <Link className="manager-inline-link" to={`/manager/events/${nextEvent.id}/overview`}>Open event workspace <Icon name="arrow-right" size={16} /></Link>
        </>}
      </section>
      <section className="manager-panel manager-attention">
        <div className="manager-panel__header"><div><span>NEEDS ATTENTION</span><h3>Action list</h3></div><span className="manager-count">{actionItems.length}</span></div>
        {actionItems.length ? <ul>{actionItems.map((item) => <li key={item}><span className="manager-attention__dot" />{item}</li>)}</ul> : <p className="manager-muted">No open actions. Your assignments are up to date.</p>}
      </section>
    </div>
    <div className="manager-overview-grid manager-overview-grid--lower">
      <section className="manager-panel">
        <div className="manager-panel__header"><div><span>PROGRAMME</span><h3>Upcoming sessions</h3></div><Link to="/manager/schedule" className="manager-inline-link">Full schedule <Icon name="arrow-right" size={16} /></Link></div>
        <ul className="manager-session-list">{nextSessions.map((session) => {
          const event = events.find((item) => item.id === session.eventId);
          return <li key={session.id}><time>{session.startTime}</time><div><strong>{session.title}</strong><small>{event?.title} · {session.room}</small></div></li>;
        })}</ul>
      </section>
      <section className="manager-panel">
        <div className="manager-panel__header"><div><span>RECENT ACTIVITY</span><h3>Event updates</h3></div></div>
        {notifications.slice(0, 4).map((item) => <p className="manager-activity" key={item.id}><span>{item.date}</span>{item.message}</p>)}
        {!notifications.length && <p className="manager-muted">No recent updates.</p>}
      </section>
    </div>
  </div>;
}

function ManagerEvents() {
  const { events, registrations, sessions, createEvent, toast } = useManager();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [dateOrder, setDateOrder] = useState("Soonest first");
  const [dateFilter, setDateFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const entering = useEntering();
  const [form, setForm] = useState({ title: "", category: "Academic", description: "", date: "", startTime: "", endTime: "", venue: "", capacity: "", organizer: "", requirements: "", importantDate: "" });
  const [formError, setFormError] = useState("");
  const rows = useMemo(() => [...events]
    .filter((event) => event.title.toLowerCase().includes(query.toLowerCase()))
    .filter((event) => status === "All statuses" || event.status === status)
    .filter((event) => !dateFilter || event.date >= dateFilter)
    .sort((a, b) => {
      const aPast = ["Completed", "Cancelled"].includes(a.status);
      const bPast = ["Completed", "Cancelled"].includes(b.status);
      if (aPast !== bPast) return aPast ? 1 : -1;
      return dateOrder === "Soonest first" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    }),
  [dateFilter, dateOrder, events, query, status]);
  const statuses = ["All statuses", ...new Set(events.map((event) => event.status))];

  function submitEvent(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.date || !form.startTime || !form.endTime || form.startTime >= form.endTime || !form.venue.trim() || !(Number(form.capacity) > 0)) {
      setFormError("Complete the required fields and enter a valid time range and capacity.");
      return;
    }
    createEvent({ ...form, title: form.title.trim(), description: form.description.trim(), venue: form.venue.trim(), capacity: Number(form.capacity), organizer: form.organizer.trim() || "Event Manager" });
    setForm({ title: "", category: "Academic", description: "", date: "", startTime: "", endTime: "", venue: "", capacity: "", organizer: "", requirements: "", importantDate: "" });
    setFormError("");
    setCreating(false);
    toast("Event submitted to the admin approval queue.");
  }

  return <div className="manager-page">
    <SectionHeading eyebrow="EVENT OWNERSHIP" title="My events" detail="Only events assigned to your manager account are listed." action={<button className="manager-button manager-button--primary" onClick={() => setCreating((current) => !current)}>{creating ? "Cancel" : "Create event"}</button>} />
    {creating && <section className="manager-panel manager-form-panel"><form className="manager-form" onSubmit={submitEvent}>
      <label className="manager-field manager-field--wide">Event title<input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} /></label>
      <label className="manager-field manager-field--wide">Description<textarea rows="3" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} /></label>
      <label className="manager-field">Date<input type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} /></label>
      <label className="manager-field">Category<select value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}>{["Academic", "Career", "Workshop", "Seminar", "Competition", "Community", "Technology"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="manager-field">Start time<input type="time" value={form.startTime} onChange={(e) => setForm((current) => ({ ...current, startTime: e.target.value }))} /></label>
      <label className="manager-field">End time<input type="time" value={form.endTime} onChange={(e) => setForm((current) => ({ ...current, endTime: e.target.value }))} /></label>
      <label className="manager-field">Venue<input value={form.venue} onChange={(e) => setForm((current) => ({ ...current, venue: e.target.value }))} /></label>
      <label className="manager-field">Capacity<input type="number" min="1" value={form.capacity} onChange={(e) => setForm((current) => ({ ...current, capacity: e.target.value }))} /></label>
      <label className="manager-field">Organizer<input value={form.organizer} onChange={(e) => setForm((current) => ({ ...current, organizer: e.target.value }))} /></label>
      <label className="manager-field">Requirements<textarea rows="2" value={form.requirements} onChange={(e) => setForm((current) => ({ ...current, requirements: e.target.value }))} /></label>
      {formError && <p className="manager-form-error" role="alert">{formError}</p>}
      <div className="manager-form-actions"><button className="manager-button manager-button--primary" type="submit">Submit for approval</button></div>
    </form></section>}
    <div className="manager-toolbar">
      <input aria-label="Search assigned events" placeholder="Search events" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Filter event status" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
      <label>On or after <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
      <select aria-label="Sort events by date" value={dateOrder} onChange={(event) => setDateOrder(event.target.value)}><option>Soonest first</option><option>Latest first</option></select>
    </div>
    <div className={`manager-event-list${entering ? " stagger" : ""}`}>{rows.map((event) => {
      const count = countRegistrations(event.id, registrations);
      const progress = Math.min(100, Math.round(count / event.capacity * 100));
      const speakers = [...new Set(sessions.filter((session) => session.eventId === event.id).map((session) => session.speaker).filter(Boolean))];
      return <article className="manager-event-row" key={event.id}>
        <div className="manager-event-date"><strong>{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-US", { day: "2-digit" })}</strong><span>{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span></div>
        <div className="manager-event-row__main"><div className="manager-event-row__title"><div><span>{event.category} · {event.venue}</span><h3>{event.title}</h3></div><StatusBadge value={event.status} /></div>
          <div className="manager-event-row__stats"><span>{event.startTime}–{event.endTime}</span><span>{count} / {event.capacity} registered</span><span>Prep: {event.preparationStatus}</span>{speakers.length > 0 && <span>Speakers: {speakers.slice(0, 2).join(" · ")}{speakers.length > 2 ? ` +${speakers.length - 2}` : ""}</span>}</div>
          <div className="manager-progress"><span style={{ width: `${progress}%` }} /></div>
          <div className="manager-event-actions">
            <Link className="manager-button manager-button--primary" to={`/manager/events/${event.id}/overview`}>Open event</Link>
            <Link className="manager-button" to={`/manager/events/${event.id}/details`}>Edit details</Link>
            <Link className="manager-button" to={`/manager/events/${event.id}/participants`}>Participants</Link>
            <Link className="manager-button" to={`/manager/events/${event.id}/reports`}>Report</Link>
          </div>
        </div>
      </article>;
    })}</div>
    {!rows.length && <div className="manager-empty">No assigned events match these filters.</div>}
  </div>;
}

function EventWorkspace({ event, tab }) {
  const { events, registrations, sessions, announcements, feedback, venues, toast, updateEvent, updateRegistration, saveSession, deleteSession, addAnnouncement, updateAnnouncement, completeEvent } = useManager();
  const [form, setForm] = useState(event);
  const [errors, setErrors] = useState({});
  const [sessionModal, setSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState(EMPTY_SESSION);
  const [announcementForm, setAnnouncementForm] = useState({ title: "", message: "", status: "Published" });
  const eventRows = eventRegistrations(event.id, registrations);
  const eventSessions = sessions.filter((item) => item.eventId === event.id).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const eventAnnouncements = announcements.filter((item) => item.eventId === event.id);
  const eventFeedback = feedback.filter((item) => item.eventId === event.id);
  const attendance = getAttendance(event.id, registrations);
  const registrationCount = eventRows.length;
  const activeTab = WORKSPACE_TABS.some(([id]) => id === tab) ? tab : "overview";

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
    updateEvent(event.id, saved);
    setForm(saved);
    toast("Event details updated.");
  }

  function saveSessionForm(submitEvent) {
    submitEvent.preventDefault();
    if (!sessionForm.title.trim() || !sessionForm.speaker.trim() || !sessionForm.room.trim() || !sessionForm.startTime || !sessionForm.endTime || sessionForm.startTime >= sessionForm.endTime) {
      toast("Add a title, speaker, room, and valid time range.");
      return;
    }
    const conflict = eventSessions.find((item) => item.id !== sessionForm.id && item.room === sessionForm.room && sessionForm.startTime < item.endTime && item.startTime < sessionForm.endTime);
    if (conflict) {
      toast(`Room conflict with ${conflict.title}.`);
      return;
    }
    saveSession({ ...sessionForm, eventId: event.id, title: sessionForm.title.trim(), speaker: sessionForm.speaker.trim(), room: sessionForm.room.trim() });
    setSessionModal(false);
    setSessionForm(EMPTY_SESSION);
    toast(sessionForm.id ? "Session updated." : "Session added.");
  }

  function publishAnnouncement(submitEvent) {
    submitEvent.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      toast("Announcement title and message are required.");
      return;
    }
    addAnnouncement({ ...announcementForm, eventId: event.id, title: announcementForm.title.trim(), message: announcementForm.message.trim() });
    setAnnouncementForm({ title: "", message: "", status: "Published" });
    toast(announcementForm.status === "Published" ? "Announcement published to this event." : "Announcement saved as draft.");
  }

  const setRegistrationStatus = (id, patch) => {
    updateRegistration(id, patch);
    toast(patch.status === "Cancelled" ? "Registration cancelled." : "Registration confirmed.");
  };

  return <div className="manager-page manager-workspace">
    <Link className="manager-back-link" to="/manager/events"><Icon name="arrow-left" size={16} /> My events</Link>
    <div className="manager-workspace-head">
      <div><span>{event.category} · {event.venue}</span><h2>{event.title}</h2><p>{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {event.startTime}–{event.endTime}</p></div>
      <StatusBadge value={event.status} />
    </div>
    <nav className="manager-tabs" aria-label="Event workspace tabs">
      {WORKSPACE_TABS.map(([id, label]) => <Link key={id} className={id === activeTab ? "manager-tab manager-tab--active" : "manager-tab"} to={`/manager/events/${event.id}/${id}`}>{label}</Link>)}
    </nav>

    {activeTab === "overview" && <>
      <div className="manager-metrics manager-metrics--compact">
        <Metric label="Registrations" value={`${registrationCount} / ${event.capacity}`} note={`${Math.round(registrationCount / event.capacity * 100)}% capacity`} />
        <Metric label="Checked in" value={`${attendance.checkedIn.length} / ${attendance.confirmed.length}`} note={`${attendance.percentage}% of confirmed`} />
        <Metric label="Sessions" value={eventSessions.length} note="On the event programme" />
        <Metric label="Feedback" value={eventFeedback.length} note={eventFeedback.length ? `${(eventFeedback.reduce((sum, item) => sum + item.rating, 0) / eventFeedback.length).toFixed(1)} average rating` : "Available after event"} />
      </div>
      <div className="manager-overview-grid">
        <section className="manager-panel"><div className="manager-panel__header"><div><span>EVENT INFORMATION</span><h3>At a glance</h3></div><Link to={`/manager/events/${event.id}/details`} className="manager-inline-link">Edit details <Icon name="arrow-right" size={16} /></Link></div>
          <dl className="manager-definition-list"><div><dt>Organizer</dt><dd>{event.organizer}</dd></div><div><dt>Venue</dt><dd>{event.venue}</dd></div><div><dt>Requirements</dt><dd>{event.requirements}</dd></div><div><dt>Next milestone</dt><dd>{event.importantDate}</dd></div><div><dt>Preparation</dt><dd>{event.preparationStatus}</dd></div></dl>
        </section>
        <section className="manager-panel"><div className="manager-panel__header"><div><span>QUICK ACTIONS</span><h3>Keep this event moving</h3></div></div>
          <div className="manager-quick-actions"><Link to={`/manager/events/${event.id}/schedule`}>Manage schedule <Icon name="arrow-right" size={16} /></Link><Link to={`/manager/events/${event.id}/participants`}>Review participants <Icon name="arrow-right" size={16} /></Link><Link to={`/manager/events/${event.id}/announcements`}>Publish update <Icon name="arrow-right" size={16} /></Link><Link to={`/manager/events/${event.id}/reports`}>Review results <Icon name="arrow-right" size={16} /></Link></div>
          {!['Completed', 'Cancelled'].includes(event.status) && <button type="button" className="manager-button manager-button--complete" onClick={() => completeEvent(event.id)}>Mark event completed</button>}
          {event.status === "Completed" && <p className="manager-complete-note">Completed {event.completedAt || ""}. Event results and feedback are available below.</p>}
        </section>
      </div>
    </>}

    {activeTab === "details" && <section className="manager-panel manager-form-panel"><SectionHeading eyebrow="EVENT SETUP" title="Event details" detail="Changes update the event workspace and its registration limits." />
      <form className="manager-form" onSubmit={saveDetails}>
        <label className="manager-field manager-field--wide">Event title<input value={form.title} onChange={(e) => patchForm("title", e.target.value)} />{errors.title && <small>{errors.title}</small>}</label>
        <label className="manager-field manager-field--wide">Description<textarea rows="4" value={form.description} onChange={(e) => patchForm("description", e.target.value)} />{errors.description && <small>{errors.description}</small>}</label>
        <label className="manager-field">Date<input type="date" value={form.date} onChange={(e) => patchForm("date", e.target.value)} />{errors.date && <small>{errors.date}</small>}</label>
        <label className="manager-field">Category<select value={form.category} onChange={(e) => patchForm("category", e.target.value)}>{["Technology", "Academic", "Career", "Workshop", "Seminar", "Competition", "Community"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="manager-field">Start time<input type="time" value={form.startTime} onChange={(e) => patchForm("startTime", e.target.value)} /></label>
        <label className="manager-field">End time<input type="time" value={form.endTime} onChange={(e) => patchForm("endTime", e.target.value)} />{errors.endTime && <small>{errors.endTime}</small>}</label>
        <label className="manager-field">Venue<select value={form.venue} onChange={(e) => patchForm("venue", e.target.value)}><option value="">Choose venue</option>{venues.map((item) => <option key={item}>{item}</option>)}</select>{errors.venue && <small>{errors.venue}</small>}</label>
        <label className="manager-field">Capacity<input type="number" min="1" value={form.capacity} onChange={(e) => patchForm("capacity", e.target.value)} />{errors.capacity && <small>{errors.capacity}</small>}</label>
        <label className="manager-field">Requirements<textarea rows="2" value={form.requirements} onChange={(e) => patchForm("requirements", e.target.value)} /></label>
        <label className="manager-field">Preparation status<select value={form.preparationStatus} onChange={(e) => patchForm("preparationStatus", e.target.value)}>{["Needs attention", "In progress", "Venue confirmed", "Ready", "Closed out"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="manager-form-actions"><button className="manager-button manager-button--primary" type="submit">Save event details</button><button className="manager-button" type="button" onClick={() => setForm(event)}>Discard changes</button></div>
      </form>
    </section>}

    {activeTab === "schedule" && <section className="manager-panel"><SectionHeading eyebrow="PROGRAMME" title="Sessions & speakers" detail="Room overlaps are checked before a session can be saved." action={<button className="manager-button manager-button--primary" onClick={() => { setSessionForm(EMPTY_SESSION); setSessionModal(true); }}>Add session</button>} />
      <div className="manager-timeline">{eventSessions.map((session) => <article key={session.id} className="manager-session-row"><time>{session.startTime}<span>{session.endTime}</span></time><div><h3>{session.title}</h3><p>{session.speaker} · {session.room}</p></div><div className="manager-row-actions"><button className="manager-text-button" onClick={() => { setSessionForm(session); setSessionModal(true); }}>Edit</button><button className="manager-text-button manager-text-button--danger" onClick={() => { deleteSession(session.id); toast("Session removed."); }}>Remove</button></div></article>)}{!eventSessions.length && <p className="manager-empty">No sessions added.</p>}</div>
    </section>}

    {activeTab === "participants" && <section className="manager-panel"><SectionHeading eyebrow="PARTICIPANT LIST" title="Registrations & attendance" detail={`${eventRows.length} participants across ${event.title}.`} />
      <RegistrationTable rows={eventRows} events={events} onStatus={setRegistrationStatus} />
      <div className="manager-attendance-controls">{attendance.confirmed.map((item) => { const checkedIn = ["Checked in", "Attended"].includes(item.attendanceStatus); const attended = item.attendanceStatus === "Attended"; return <div key={item.id} className="manager-attendance-item"><div><strong>{item.name}</strong><small>{item.email} · {item.checkedInAt ? `Checked in ${item.checkedInAt}` : "Not checked in"}</small></div><button className="manager-button manager-button--small" disabled={item.status !== "Confirmed" || attended} onClick={() => { updateRegistration(item.id, { attendanceStatus: checkedIn ? "Not checked in" : "Checked in", checkedInAt: checkedIn ? "" : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }); toast(checkedIn ? "Check-in undone." : `${item.name} checked in.`); }}>{attended ? "Attended" : checkedIn ? "Undo check-in" : "Check in"}</button></div>; })}</div>
    </section>}

    {activeTab === "announcements" && <section className="manager-panel"><SectionHeading eyebrow="PARTICIPANT COMMUNICATION" title="Event announcements" detail="Published announcements appear on the event details page." />
      <form className="manager-announcement-form" onSubmit={publishAnnouncement}><label className="manager-field">Title<input value={announcementForm.title} onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))} /></label><label className="manager-field">Message<textarea rows="3" value={announcementForm.message} onChange={(e) => setAnnouncementForm((f) => ({ ...f, message: e.target.value }))} /></label><div className="manager-form-actions"><select aria-label="Announcement status" value={announcementForm.status} onChange={(e) => setAnnouncementForm((f) => ({ ...f, status: e.target.value }))}><option>Published</option><option>Draft</option></select><button className="manager-button manager-button--primary" type="submit">{announcementForm.status === "Published" ? "Publish announcement" : "Save draft"}</button></div></form>
      <div className="manager-announcement-list">{eventAnnouncements.map((item) => <article key={item.id}><div><StatusBadge value={item.status} /><time>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "Not published"}</time></div><h3>{item.title}</h3><p>{item.message}</p>{item.status === "Draft" && <button className="manager-text-button" onClick={() => { updateAnnouncement(item.id, { status: "Published" }); toast("Announcement published."); }}>Publish draft</button>}</article>)}{!eventAnnouncements.length && <p className="manager-empty">No announcements for this event.</p>}</div>
    </section>}

    {activeTab === "feedback" && <FeedbackPanel feedback={eventFeedback} />}
    {activeTab === "reports" && <ReportPanel event={event} registrations={registrations} feedback={eventFeedback} sessions={eventSessions} />}

    {sessionModal && <div className="manager-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSessionModal(false); }}><section className="manager-modal" role="dialog" aria-modal="true" aria-labelledby="session-form-title"><div className="manager-panel__header"><div><span>PROGRAMME</span><h3 id="session-form-title">{sessionForm.id ? "Edit session" : "Add session"}</h3></div><button className="manager-close" onClick={() => setSessionModal(false)} aria-label="Close"><Icon name="close" size={20} /></button></div><form className="manager-form" onSubmit={saveSessionForm}><label className="manager-field manager-field--wide">Session title<input autoFocus value={sessionForm.title} onChange={(e) => setSessionForm((f) => ({ ...f, title: e.target.value }))} /></label><label className="manager-field">Speaker<input value={sessionForm.speaker} onChange={(e) => setSessionForm((f) => ({ ...f, speaker: e.target.value }))} /></label><label className="manager-field">Room<input value={sessionForm.room} onChange={(e) => setSessionForm((f) => ({ ...f, room: e.target.value }))} /></label><label className="manager-field">Start<input type="time" value={sessionForm.startTime} onChange={(e) => setSessionForm((f) => ({ ...f, startTime: e.target.value }))} /></label><label className="manager-field">End<input type="time" value={sessionForm.endTime} onChange={(e) => setSessionForm((f) => ({ ...f, endTime: e.target.value }))} /></label><div className="manager-form-actions"><button className="manager-button manager-button--primary" type="submit">Save session</button><button className="manager-button" type="button" onClick={() => setSessionModal(false)}>Cancel</button></div></form></section></div>}
  </div>;
}

function FeedbackPanel({ feedback }) {
  const count = feedback.length;
  const average = count ? feedback.reduce((sum, item) => sum + item.rating, 0) / count : 0;
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: feedback.filter((item) => item.rating === rating).length }));
  return <section className="manager-panel"><SectionHeading eyebrow="PARTICIPANT FEEDBACK" title="What participants said" detail="Use these responses to improve event execution and future programming." />
    <div className="manager-feedback-summary"><strong>{count ? average.toFixed(1) : "—"}<small> / 5</small></strong><span>{count} responses</span></div>
    <div className="manager-rating-list">{distribution.map((item) => <div key={item.rating}><span>{item.rating} stars</span><div><span style={{ width: `${count ? item.count / count * 100 : 0}%` }} /></div><strong>{item.count}</strong></div>)}</div>
    <div className="manager-feedback-list">{feedback.map((item) => <article key={item.id}><div><strong>{item.participant}</strong><span>{item.date} · {item.rating}/5 overall</span></div><p>{item.comment}</p><small>Organization {item.organizationRating}/5 · Speaker {item.speakerRating}/5 · Venue {item.venueRating}/5</small></article>)}{!feedback.length && <p className="manager-empty">Feedback is available after participants attend the event.</p>}</div>
  </section>;
}

function ReportPanel({ event, registrations, feedback, sessions }) {
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

  return <section className="manager-panel"><SectionHeading eyebrow="EVENT REPORT" title="Results snapshot" detail="Counts are calculated from this assigned event's registrations and feedback." action={<button className="manager-button" onClick={exportCsv}>Export CSV</button>} />
    <div className="manager-report-grid"><Metric label="Registrations" value={`${count} / ${event.capacity}`} note={`${Math.round(count / event.capacity * 100)}% of capacity`} /><Metric label="Checked in" value={attendance.checkedIn.length} note={`${attendance.percentage}% of confirmed participants`} /><Metric label="Absences" value={absenceCount} note="Confirmed but not checked in" /><Metric label="Feedback" value={average === null ? "—" : average.toFixed(1)} note={`${feedback.length} responses`} /></div>
    <dl className="manager-definition-list manager-definition-list--report"><div><dt>Event status</dt><dd><StatusBadge value={event.status} /></dd></div><div><dt>Completed</dt><dd>{event.completedAt || "Not completed"}</dd></div><div><dt>Sessions on programme</dt><dd>{sessions.length}</dd></div><div><dt>Attendance summary</dt><dd>{attendance.checkedIn.length} attended · {absenceCount} absent</dd></div></dl>
  </section>;
}

function ManagerRegistrations({ events, registrations, updateRegistration, toast }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const rows = registrations.filter((item) => (status === "All statuses" || item.status === status) && `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="manager-page"><SectionHeading eyebrow="REGISTRATION DESK" title="Registrations" detail="Review sign-ups across your assigned events only." />
    <div className="manager-toolbar"><input aria-label="Search participants" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filter registration status" value={status} onChange={(e) => setStatus(e.target.value)}>{["All statuses", "Confirmed", "Pending", "Cancelled"].map((item) => <option key={item}>{item}</option>)}</select></div>
    <RegistrationTable rows={rows} events={events} onStatus={(id, patch) => { updateRegistration(id, patch); toast(patch.status === "Confirmed" ? "Registration confirmed." : "Registration cancelled."); }} />
  </div>;
}

function ManagerAttendance({ events, registrations, updateRegistration, toast }) {
  const [eventId, setEventId] = useState("All assigned events");
  const rows = registrations.filter((item) => item.status === "Confirmed" && (eventId === "All assigned events" || item.eventId === eventId));
  const checkedIn = rows.filter((item) => ["Checked in", "Attended"].includes(item.attendanceStatus)).length;
  return <div className="manager-page"><SectionHeading eyebrow="EVENT DAY" title="Attendance" detail="Check participants in and correct accidental check-ins." />
    <div className="manager-toolbar"><select aria-label="Choose assigned event" value={eventId} onChange={(e) => setEventId(e.target.value)}><option>All assigned events</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select><div className="manager-attendance-total"><strong>{checkedIn} / {rows.length}</strong><span>{rows.length ? Math.round(checkedIn / rows.length * 100) : 0}% checked in</span></div></div>
    <div className="manager-attendance-list">{rows.map((item) => { const attended = item.attendanceStatus === "Attended"; const checked = ["Checked in", "Attended"].includes(item.attendanceStatus); return <div className="manager-attendance-item" key={item.id}><div><strong>{item.name}</strong><small>{events.find((event) => event.id === item.eventId)?.title} · {item.email}</small></div><StatusBadge value={item.attendanceStatus} /><span className="manager-checkin-time">{item.checkedInAt || "—"}</span><button className="manager-button manager-button--small" disabled={attended} onClick={() => { updateRegistration(item.id, { attendanceStatus: checked ? "Not checked in" : "Checked in", checkedInAt: checked ? "" : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }); toast(checked ? "Check-in undone." : `${item.name} checked in.`); }}>{attended ? "Attended" : checked ? "Undo" : "Check in"}</button></div>; })}{!rows.length && <div className="manager-empty">No confirmed participants for this selection.</div>}</div>
  </div>;
}

function ManagerSchedule({ events, sessions, saveSession, deleteSession, toast }) {
  const [eventId, setEventId] = useState("All assigned events");
  const [editing, setEditing] = useState(null);
  const eventSessions = sessions.filter((item) => eventId === "All assigned events" || item.eventId === eventId).sort((a, b) => `${a.eventId}${a.startTime}`.localeCompare(`${b.eventId}${b.startTime}`));
  function save(e) {
    e.preventDefault();
    if (!editing.title.trim() || !editing.speaker.trim() || !editing.room.trim() || !editing.startTime || !editing.endTime || editing.startTime >= editing.endTime) {
      toast("Complete the session fields and enter a valid time range.");
      return;
    }
    const overlap = eventSessions.find((item) => item.id !== editing.id && item.eventId === editing.eventId && item.room === editing.room && editing.startTime < item.endTime && item.startTime < editing.endTime);
    if (overlap) { toast(`Room conflict with ${overlap.title}.`); return; }
    saveSession(editing);
    setEditing(null);
    toast("Session saved.");
  }
  return <div className="manager-page"><SectionHeading eyebrow="PROGRAMME COORDINATION" title="Schedule" detail="Manage speakers, rooms, and time slots for your assigned events." action={<button className="manager-button manager-button--primary" onClick={() => setEditing({ ...EMPTY_SESSION, eventId: events[0]?.id || "" })}>Add session</button>} />
    <div className="manager-toolbar"><select aria-label="Filter schedule event" value={eventId} onChange={(e) => setEventId(e.target.value)}><option>All assigned events</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></div>
    <div className="manager-timeline">{eventSessions.map((session) => <article key={session.id} className="manager-session-row"><time>{session.startTime}<span>{session.endTime}</span></time><div><h3>{session.title}</h3><p>{events.find((event) => event.id === session.eventId)?.title} · {session.speaker} · {session.room}</p></div><div className="manager-row-actions"><button className="manager-text-button" onClick={() => setEditing(session)}>Edit</button><button className="manager-text-button manager-text-button--danger" onClick={() => { deleteSession(session.id); toast("Session removed."); }}>Remove</button></div></article>)}{!eventSessions.length && <p className="manager-empty">No sessions to display.</p>}</div>
    {editing && <div className="manager-modal-backdrop"><section className="manager-modal" role="dialog" aria-modal="true" aria-labelledby="global-session-title"><div className="manager-panel__header"><div><span>PROGRAMME</span><h3 id="global-session-title">{editing.id ? "Edit session" : "Add session"}</h3></div><button className="manager-close" onClick={() => setEditing(null)} aria-label="Close"><Icon name="close" size={20} /></button></div><form className="manager-form" onSubmit={save}><label className="manager-field manager-field--wide">Event<select value={editing.eventId} onChange={(e) => setEditing((current) => ({ ...current, eventId: e.target.value }))}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label><label className="manager-field manager-field--wide">Session title<input value={editing.title} onChange={(e) => setEditing((current) => ({ ...current, title: e.target.value }))} /></label><label className="manager-field">Speaker<input value={editing.speaker} onChange={(e) => setEditing((current) => ({ ...current, speaker: e.target.value }))} /></label><label className="manager-field">Room<input value={editing.room} onChange={(e) => setEditing((current) => ({ ...current, room: e.target.value }))} /></label><label className="manager-field">Start<input type="time" value={editing.startTime} onChange={(e) => setEditing((current) => ({ ...current, startTime: e.target.value }))} /></label><label className="manager-field">End<input type="time" value={editing.endTime} onChange={(e) => setEditing((current) => ({ ...current, endTime: e.target.value }))} /></label><div className="manager-form-actions"><button className="manager-button manager-button--primary" type="submit">Save session</button><button className="manager-button" type="button" onClick={() => setEditing(null)}>Cancel</button></div></form></section></div>}
  </div>;
}

function ManagerParticipants({ events, registrations }) {
  const [query, setQuery] = useState("");
  const rows = registrations.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="manager-page"><SectionHeading eyebrow="PARTICIPANT ROSTER" title="Participants" detail="Operational contact details for participants in your assigned events." /><div className="manager-toolbar"><input aria-label="Search participant roster" placeholder="Search participants" value={query} onChange={(e) => setQuery(e.target.value)} /></div><Table empty="No participants match your search." rows={rows} columns={[{ label: "Name", render: (row) => <strong>{row.name}</strong> }, { label: "Event", render: (row) => events.find((event) => event.id === row.eventId)?.title }, { label: "Contact", render: (row) => <>{row.email}<small className="manager-cell-note">{row.phone || "No phone provided"}</small></> }, { label: "Registration", render: (row) => <StatusBadge value={row.status} /> }, { label: "Attendance", render: (row) => <StatusBadge value={row.attendanceStatus} /> }]} /></div>;
}

function ManagerAnnouncements({ events, announcements, addAnnouncement, updateAnnouncement, toast }) {
  const [form, setForm] = useState({ eventId: events[0]?.id || "", title: "", message: "", status: "Published" });
  function submit(e) {
    e.preventDefault();
    if (!form.eventId || !form.title.trim() || !form.message.trim()) { toast("Choose an event and enter an announcement title and message."); return; }
    addAnnouncement({ ...form, title: form.title.trim(), message: form.message.trim() });
    setForm((current) => ({ ...current, title: "", message: "" }));
    toast(form.status === "Published" ? "Announcement published." : "Draft saved.");
  }
  return <div className="manager-page"><SectionHeading eyebrow="PARTICIPANT COMMUNICATION" title="Announcements" detail="Publish an event update or save a draft. No email or push notification is sent." />
    <form className="manager-announcement-form manager-panel" onSubmit={submit}><label className="manager-field">Event<select value={form.eventId} onChange={(e) => setForm((current) => ({ ...current, eventId: e.target.value }))}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label><label className="manager-field">Title<input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} /></label><label className="manager-field">Message<textarea rows="3" value={form.message} onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))} /></label><div className="manager-form-actions"><select aria-label="Announcement status" value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}><option>Published</option><option>Draft</option></select><button className="manager-button manager-button--primary">{form.status === "Published" ? "Publish" : "Save draft"}</button></div></form>
    <div className="manager-announcement-list">{announcements.map((item) => <article key={item.id}><div><strong>{events.find((event) => event.id === item.eventId)?.title}</strong><StatusBadge value={item.status} /></div><h3>{item.title}</h3><p>{item.message}</p>{item.status === "Draft" && <button className="manager-text-button" onClick={() => { updateAnnouncement(item.id, { status: "Published" }); toast("Announcement published."); }}>Publish draft</button>}</article>)}</div>
  </div>;
}

function ManagerFeedback({ events, feedback }) {
  return <div className="manager-page"><SectionHeading eyebrow="POST-EVENT REVIEW" title="Feedback" detail="Participant comments and event ratings from your assignments." />{events.map((event) => <div className="manager-feedback-event" key={event.id}><h3 className="manager-feedback-event__title">{event.title}</h3><FeedbackPanel feedback={feedback.filter((item) => item.eventId === event.id)} /></div>)}</div>;
}

function ManagerReports({ events, registrations, feedback, sessions }) {
  return <div className="manager-page"><SectionHeading eyebrow="EVENT PERFORMANCE" title="Reports" detail="Event-level results calculated from assigned participant and feedback records." />{events.map((event) => <div className="manager-report-card" key={event.id}><h3>{event.title}</h3><ReportPanel event={event} registrations={registrations} feedback={feedback.filter((item) => item.eventId === event.id)} sessions={sessions.filter((item) => item.eventId === event.id)} /></div>)}</div>;
}

export default function ManagerScreen({ section }) {
  const manager = useManager();
  const { eventId, tab } = useParams();
  const event = manager.events.find((item) => item.id === eventId);
  if (section === "event") return event ? <EventWorkspace key={`${event.id}-${tab}`} event={event} tab={tab} /> : <div className="manager-empty">This event is not assigned to your manager account.</div>;
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