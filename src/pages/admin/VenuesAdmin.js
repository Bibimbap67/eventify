import React, { useState } from "react";
import { useAdmin } from "../../context/AdminContext.js";
import Icon from "../../components/Icon.js";
import { ConfirmModal, Modal } from "../../components/admin/ui.js";
import { TableSkeleton } from "../../components/Skeleton.js";
import { SectionHeading, Table, plural } from "../../components/manager/parts.js";
import { SearchFilter, useFilters } from "../../components/admin/parts.js";

const CLOSED = ["Completed", "Rejected", "Cancelled", "Archived"];
const DEFAULTS = { q: "" };
const BLANK = { name: "", location: "", capacity: "" };

export default function VenuesAdmin() {
  const { db, venuesReady, add, update, remove, toast } = useAdmin();
  const [filters, setFilters] = useFilters(DEFAULTS);
  const [editing, setEditing] = useState(null); // venue | "new" | null
  const [deleting, setDeleting] = useState(null);

  // Admin events point at a venue by id, manager events by its name.
  const eventsAt = (venue) => db.events.filter((event) => (event.venueId ? event.venueId === venue.id : event.venue === venue.name));
  const upcomingAt = (venue) => eventsAt(venue).filter((event) => !CLOSED.includes(event.status));
  const q = filters.q.toLowerCase();
  const rows = db.venues.filter((venue) => `${venue.name} ${venue.location}`.toLowerCase().includes(q));

  const columns = [
    { label: "Venue", render: (venue) => <span><b>{venue.name}</b><span className="admin-cell-sub">{venue.location || "—"}</span></span> },
    { label: "Capacity", render: (venue) => <span className="manager-mono">{venue.capacity}</span> },
    { label: "Upcoming events", render: (venue) => plural(upcomingAt(venue).length, "event") },
    {
      label: "Actions",
      render: (venue) => {
        const busy = upcomingAt(venue).length;
        return (
          <span className="manager-row-buttons">
            <button type="button" className="manager-text-button" onClick={() => setEditing(venue)}>Edit</button>
            <button
              type="button"
              className="manager-text-button manager-text-button--danger"
              disabled={busy > 0}
              title={busy ? `${plural(busy, "upcoming event")} use this venue. Move or close them first.` : undefined}
              onClick={() => setDeleting(venue)}
            >
              Delete
            </button>
          </span>
        );
      },
    },
  ];

  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Platform"
        title="Venues"
        detail="The rooms event managers choose from when they plan an event. A venue can't be deleted while upcoming events use it."
        action={(
          // A venue added before the list has loaded would be replaced by the loaded list and lost.
          <button type="button" className="manager-button manager-button--primary" onClick={() => setEditing("new")} disabled={!venuesReady}>
            <Icon name="plus" size={16} /> Add venue
          </button>
        )}
      />

      <div className="manager-toolbar">
        <SearchFilter label="Search venues" placeholder="Search name or location" value={filters.q} onSearch={(value) => setFilters({ q: value })} />
      </div>

      {venuesReady ? (
        <Table columns={columns} rows={rows} empty={db.venues.length ? "No venues match your search." : "No venues yet."} emptyIcon="pin" />
      ) : (
        <TableSkeleton columns={["Venue", "Capacity", "Upcoming events", "Actions"]} rows={4} />
      )}

      {editing && (
        <VenueForm
          venue={editing === "new" ? null : editing}
          inUse={editing === "new" ? 0 : eventsAt(editing).length}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing === "new") add("venues", data);
            else update("venues", editing.id, data);
            toast(editing === "new" ? `${data.name} added.` : `${data.name} updated.`);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete venue?"
          message={`${deleting.name} disappears from the venue list for new events.${eventsAt(deleting).length ? " Past events that used it keep its name." : ""}`}
          confirmText="Delete venue"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            // Checked again in case an event was booked here while the dialog was open.
            if (upcomingAt(deleting).length) toast(`${deleting.name} is booked for an upcoming event and can't be deleted.`);
            else {
              remove("venues", deleting.id);
              toast(`${deleting.name} deleted.`);
            }
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}

function VenueForm({ venue, inUse, onClose, onSave }) {
  const [form, setForm] = useState(venue ? { name: venue.name, location: venue.location || "", capacity: String(venue.capacity || "") } : BLANK);
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  const renamed = venue && form.name.trim() !== venue.name;

  function submit(e) {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Enter the venue name.";
    if (!form.location.trim()) next.location = "Enter where it is (building and floor).";
    if (!(Number(form.capacity) > 0) || !Number.isInteger(Number(form.capacity))) next.capacity = "Enter a whole number above 0.";
    setErrors(next);
    if (!Object.keys(next).length) onSave({ name: form.name.trim(), location: form.location.trim(), capacity: Number(form.capacity) });
  }

  return (
    <Modal title={venue ? `Edit ${venue.name}` : "Add venue"} onClose={onClose} className="admin-dialog">
      {(closeAnimated) => (
        <form className="manager-form" onSubmit={submit} noValidate>
          <label className="manager-field manager-field--wide">
            Venue name
            <input value={form.name} onChange={set("name")} aria-invalid={Boolean(errors.name)} />
            {errors.name && <small>{errors.name}</small>}
          </label>
          <label className="manager-field">
            Location
            <input value={form.location} onChange={set("location")} placeholder="e.g. 4th Floor, SIT Building" aria-invalid={Boolean(errors.location)} />
            {errors.location && <small>{errors.location}</small>}
          </label>
          <label className="manager-field">
            Seating capacity
            <input type="number" min="1" value={form.capacity} onChange={set("capacity")} aria-invalid={Boolean(errors.capacity)} />
            {errors.capacity && <small>{errors.capacity}</small>}
          </label>
          {renamed && inUse > 0 && (
            <p className="admin-note manager-field--wide">
              <Icon name="alert" size={16} />
              {plural(inUse, "event")} already use this venue. Renaming it doesn't change the name shown on those events.
            </p>
          )}
          <div className="manager-form-actions">
            <button type="button" className="manager-button" onClick={closeAnimated}>Cancel</button>
            <button type="submit" className="manager-button manager-button--primary">{venue ? "Save changes" : "Add venue"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
