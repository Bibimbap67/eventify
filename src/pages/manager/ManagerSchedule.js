import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useManager } from "../../context/ManagerContext.js";
import Icon from "../../components/Icon.js";
import { useConfirm } from "../../components/Modal.js";
import { DateTile, EmptyState, SectionHeading, byDate } from "../../components/ui.js";
import { EMPTY_SESSION, SessionDialog, SessionTimeline } from "../../components/manager/Sessions.js";

export default function ManagerSchedule() {
  const { events, sessions, deleteSession, toast } = useManager();
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
      toast("Session removed.", "warning");
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
