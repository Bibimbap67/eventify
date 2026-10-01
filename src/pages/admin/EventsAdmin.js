import React, { useState } from "react";
import { useAdmin } from "../../context/AdminContext.js";
import { ORGANIZERS } from "../../data/options.js";
import { DataTable, StatusBadge, Modal, FormField, ConfirmModal } from "../../components/admin/ui.js";

// Allowed status transitions: action label -> [from statuses, to status]
const ACTIONS = [
  ["Approve", ["Pending"], "Approved"],
  ["Reject", ["Pending"], "Rejected"],
  ["Publish", ["Approved"], "Published"],
  ["Cancel", ["Approved", "Published"], "Cancelled"],
  ["Archive", ["Completed", "Rejected", "Cancelled"], "Archived"],
];

const BLANK = {
  title: "",
  organizer: ORGANIZERS[0],
  date: "",
  start: "",
  end: "",
  venueId: "",
  capacity: "",
};

export default function EventsAdmin() {
  const { db, update, add, remove, logAction, toast, venueName, registered } = useAdmin();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [sortDesc, setSortDesc] = useState(false);
  const [editing, setEditing] = useState(null); // event object | "new" | null
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [deleteEvent, setDeleteEvent] = useState(null);

  const rows = (db.events || [])
    .filter(
      (e) =>
        (status === "All" || e.status === status) &&
        (e.title || "").toLowerCase().includes(q.toLowerCase())
    )
    .sort((a, b) => (sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));

  function openForm(ev) {
    setForm(ev ? { ...ev, capacity: String(ev.capacity) } : BLANK);
    setErrors({});
    setEditing(ev || "new");
  }

  function validate() {
    const e = {};
    ["title", "date", "start", "end", "venueId", "capacity"].forEach((k) => {
      if (!form[k]) e[k] = "Required.";
    });
    const cap = Number(form.capacity);
    const venue = (db.venues || []).find((v) => v.id === form.venueId);
    if (form.capacity && !(cap > 0)) e.capacity = "Must be a positive number.";
    else if (venue && cap > venue.capacity) e.capacity = `Exceeds venue capacity (${venue.capacity}).`;
    if (form.start && form.end && form.end <= form.start) e.end = "End must be after start.";
    if (!e.date && !e.start && !e.end && form.venueId) {
      const clash = (db.events || []).find(
        (o) =>
          o.id !== form.id &&
          o.venueId === form.venueId &&
          o.date === form.date &&
          !["Rejected", "Cancelled", "Archived"].includes(o.status) &&
          form.start < o.end &&
          o.start < form.end
      );
      if (clash) e.venueId = `Conflict: ${clash.title} uses this venue ${clash.start}–${clash.end}.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save(e) {
    e.preventDefault();
    if (!validate()) return;
    const data = { ...form, capacity: Number(form.capacity), title: form.title.trim() };
    if (editing === "new") {
      add("events", { ...data, status: "Pending" });
      logAction("Created event", data.title);
      toast("Event created and set to Pending.");
    } else {
      update("events", form.id, data);
      logAction("Updated event", data.title);
      toast("Event updated.");
    }
    setEditing(null);
  }

  function handleStatusChange(event, toStatus, label) {
    update("events", event.id, { status: toStatus });
    logAction(`${label} event`, event.title);
    toast(`${event.title}: ${toStatus}.`);
  }

  function handleDelete(event) {
    setDeleteEvent(event);
  }

  function confirmDelete() {
    if (!deleteEvent) return;
    remove("events", deleteEvent.id);
    logAction("Deleted event", deleteEvent.title);
    toast(`Event "${deleteEvent.title}" deleted.`);
    setDeleteEvent(null);
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="toolbar">
        <input
          className="input"
          placeholder="Search events"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {[
            "All",
            "Pending",
            "Approved",
            "Published",
            "Completed",
            "Rejected",
            "Cancelled",
            "Archived",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn-sm" onClick={() => setSortDesc(!sortDesc)}>
          Date {sortDesc ? "↓" : "↑"}
        </button>
        <button className="btn-sm btn-sm--yellow" onClick={() => openForm(null)}>
          + Create event
        </button>
      </div>

      <DataTable
        rows={rows}
        columns={[
          { label: "Title", render: (r) => <b>{r.title}</b> },
          { label: "Organizer", render: (r) => r.organizer },
          { label: "Date", render: (r) => r.date },
          { label: "Venue", render: (r) => venueName(r.venueId, r.id) },
          { label: "Registered", render: (r) => `${registered(r.id)}/${r.capacity}` },
          { label: "Status", render: (r) => <StatusBadge value={r.status} /> },
        ]}
        renderActions={(r) => (
          <>
            <button className="btn-sm" onClick={() => openForm(r)}>
              View / Edit
            </button>
            {ACTIONS.filter(([, from]) => from.includes(r.status)).map(([label, , to]) => (
              <button
                key={label}
                className="btn-sm"
                onClick={() => handleStatusChange(r, to, label)}
              >
                {label}
              </button>
            ))}
            <button className="btn-sm btn-sm--danger" onClick={() => handleDelete(r)}>
              Delete
            </button>
          </>
        )}
      />

      {editing && (
        <Modal
          title={editing === "new" ? "Create event" : "Event details"}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save} noValidate>
            <FormField label="TITLE" error={errors.title}>
              <input className="input" value={form.title} onChange={set("title")} />
            </FormField>
            <FormField label="ORGANIZER">
              <select className="input" value={form.organizer} onChange={set("organizer")}>
                {ORGANIZERS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </FormField>
            <FormField label="DATE" error={errors.date}>
              <input type="date" className="input" value={form.date} onChange={set("date")} />
            </FormField>
            <div className="two">
              <FormField label="START" error={errors.start}>
                <input type="time" className="input" value={form.start} onChange={set("start")} />
              </FormField>
              <FormField label="END" error={errors.end}>
                <input type="time" className="input" value={form.end} onChange={set("end")} />
              </FormField>
            </div>
            <FormField label="VENUE" error={errors.venueId}>
              <select className="input" value={form.venueId} onChange={set("venueId")}>
                <option value="">Select venue</option>
                {(db.venues || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.capacity})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="CAPACITY" error={errors.capacity}>
              <input
                type="number"
                className="input"
                value={form.capacity}
                onChange={set("capacity")}
              />
            </FormField>
            <button type="submit" className="btn-sm btn-sm--yellow btn-block">
              {editing === "new" ? "Create event" : "Save changes"}
            </button>
          </form>
        </Modal>
      )}

      {deleteEvent && (
        <ConfirmModal
          title="Delete Event"
          message={`Are you sure you want to permanently delete event "${deleteEvent.title}"? Registrations linked to this event will also be affected.`}
          confirmText="Yes, Delete"
          confirmVariant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteEvent(null)}
        />
      )}
    </>
  );
}
