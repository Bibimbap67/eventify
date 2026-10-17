import React, { useState } from "react";
import Icon from "../Icon.js";
import { Modal } from "../Modal.js";
import { usePending } from "../Motion.js";
import { EmptyState } from "../ui.js";
import { SaveButton } from "./EventFields.js";
import { useManager } from "../../context/ManagerContext.js";
import { formatTime } from "../../data/time.js";

// An event's programme: the session timeline and the add / edit session dialog.

export const EMPTY_SESSION = { title: "", speaker: "", startTime: "", endTime: "", room: "" };

export function SessionTimeline({ sessions, eventTitle, onEdit, onRemove }) {
  if (!sessions.length) return <EmptyState icon="schedule" title="No sessions added">Use Add session to build the programme.</EmptyState>;
  return (
    <ol className="manager-timeline">
      {sessions.map((session) => (
        <li key={session.id} className="manager-session-row">
          <time>{formatTime(session.startTime)}<span>{formatTime(session.endTime)}</span></time>
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
export function SessionDialog({ session, events, onClose }) {
  const { sessions, saveSession, toast, events: managerEvents } = useManager();
  const [draft, setDraft] = useState(session);
  const listedSpeakers = managerEvents.find((event) => event.id === draft.eventId)?.speakers || [];
  const [saving, runSave] = usePending();
  const patch = (field) => (e) => setDraft((current) => ({ ...current, [field]: e.target.value }));

  function handleSubmit(e, close) {
    e.preventDefault();
    // VALIDATION
    if (!draft.title.trim() || !draft.speaker.trim() || !draft.room.trim() || !draft.startTime || !draft.endTime || draft.startTime >= draft.endTime) {
      toast("Add a title, speaker, room, and valid time range.", "error");
      return;
    }
    const conflict = sessions.find((item) => item.id !== draft.id && item.eventId === draft.eventId && item.room === draft.room.trim() && draft.startTime < item.endTime && item.startTime < draft.endTime);
    if (conflict) {
      toast(`Room conflict with ${conflict.title}.`, "error");
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
        <form className="manager-form" onSubmit={(e) => handleSubmit(e, close)}>
          {events && (
            <label className="manager-field manager-field--wide">Event
              <select value={draft.eventId} onChange={patch("eventId")}>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
            </label>
          )}
          <label className="manager-field manager-field--wide">Session title<input value={draft.title} onChange={patch("title")} /></label>
          <label className="manager-field">Speaker<input list="session-speakers" value={draft.speaker} onChange={patch("speaker")} /></label>
          <datalist id="session-speakers">{listedSpeakers.map((speaker, index) => <option key={index} value={speaker.name} />)}</datalist>
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
