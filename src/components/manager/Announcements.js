import React, { useRef, useState } from "react";
import Icon from "../Icon.js";
import { usePending } from "../Motion.js";
import { EmptyState, PanelHeader, StatusBadge } from "../ui.js";
import { SaveButton } from "./EventFields.js";
import { useManager } from "../../context/ManagerContext.js";

// Publish now or keep as a draft. `events` adds an event picker (the all-events page).
export function AnnouncementComposer({ eventId, events }) {
  const { addAnnouncement, toast } = useManager();
  const [form, setForm] = useState({ eventId: eventId || events?.[0]?.id || "", title: "", message: "" });
  const [sending, runSend] = usePending();
  const intent = useRef("Published");
  const patch = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (!form.eventId || !form.title.trim() || !form.message.trim()) {
      toast(events ? "Choose an event and enter an announcement title and message." : "Announcement title and message are required.", "error");
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

export function AnnouncementList({ items, showEvent }) {
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
