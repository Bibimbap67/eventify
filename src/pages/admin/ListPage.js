import React, { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAdmin } from "../../context/AdminContext.js";
import { DataTable, StatusBadge, Modal, FormField, ConfirmModal } from "../../components/admin/ui.js";

const B = (r) => <StatusBadge value={r.status} />;
const nowTime = () => new Date().toTimeString().slice(0, 5);
const today = () => new Date().toISOString().slice(0, 10);

// Config per admin sub-page: table columns, filters, row actions, plus full CRUD forms.
const PAGES = (c) => ({
  registrations: {
    collection: "registrations",
    singular: "Registration",
    title: "Registrations",
    rows: c.db.registrations || [],
    search: ["name", "email"],
    filter: "status",
    cols: [
      ["Participant", (r) => <b>{r.name}</b>],
      ["Email", (r) => r.email],
      ["Event", (r) => c.eventTitle(r.eventId)],
      ["Registered", (r) => r.date],
      ["Status", B],
    ],
    actions: (r) => [
      r.status === "Pending" && [
        "Confirm",
        () => {
          c.update("registrations", r.id, { status: "Confirmed" });
          c.logAction("Confirmed registration", `${r.name} · ${c.eventTitle(r.eventId)}`);
          c.toast(`${r.name} confirmed.`);
        },
      ],
      r.status !== "Cancelled" && [
        "Cancel",
        () => {
          c.update("registrations", r.id, { status: "Cancelled", checkedInAt: null });
          c.logAction("Cancelled registration", `${r.name} · ${c.eventTitle(r.eventId)}`);
          c.toast(`${r.name} registration cancelled.`);
        },
      ],
    ],
    canEdit: true,
    canDelete: true,
    getItemLabel: (r) => `${r.name} (${c.eventTitle(r.eventId)})`,
    form: {
      createLabel: "+ Add Registration",
      defaults: {
        name: "",
        email: "",
        eventId: c.db.events?.[0]?.id || "",
        status: "Confirmed",
        date: today(),
      },
      fields: [
        { key: "name", label: "PARTICIPANT FULL NAME", type: "text", required: true },
        {
          key: "email",
          label: "EMAIL ADDRESS",
          type: "email",
          required: true,
          validate: (v) => (/\S+@\S+\.\S+/.test(v) ? null : "Valid email required."),
        },
        {
          key: "eventId",
          label: "EVENT",
          type: "select",
          options: (c.db.events || []).map((e) => ({
            value: e.id,
            label: `${e.title} (${c.registered(e.id)}/${e.capacity})`,
          })),
          required: true,
        },
        {
          key: "status",
          label: "STATUS",
          type: "select",
          options: ["Confirmed", "Pending", "Cancelled"],
          required: true,
        },
        { key: "date", label: "REGISTRATION DATE", type: "date", required: true },
      ],
    },
  },

  attendance: {
    collection: "registrations",
    title: "Attendance",
    rows: (c.db.registrations || []).filter((r) => r.status === "Confirmed"),
    search: ["name"],
    customFilter: {
      label: "Attendance Status",
      options: ["All", "Checked In", "Not Checked In"],
      filterFn: (r, val) => {
        if (val === "Checked In") return Boolean(r.checkedInAt);
        if (val === "Not Checked In") return !r.checkedInAt;
        return true;
      },
    },
    summary: (rows) =>
      `${rows.filter((r) => r.checkedInAt).length} of ${rows.length} confirmed participants checked in`,
    cols: [
      ["Participant", (r) => <b>{r.name}</b>],
      ["Event", (r) => c.eventTitle(r.eventId)],
      ["Status", (r) => <StatusBadge value={r.checkedInAt ? "Checked In" : "Not Checked In"} />],
      ["Check-in time", (r) => r.checkedInAt || "—"],
    ],
    actions: (r) => [
      !r.checkedInAt
        ? [
            "Check in",
            () => {
              const time = nowTime();
              c.update("registrations", r.id, { checkedInAt: time });
              c.logAction("Checked in attendee", `${r.name} at ${time}`);
              c.toast(`${r.name} checked in at ${time}.`);
            },
          ]
        : [
            "Undo check-in",
            () => {
              c.update("registrations", r.id, { checkedInAt: null });
              c.logAction("Undid check-in", r.name);
              c.toast(`Check-in removed for ${r.name}.`);
            },
          ],
    ],
  },

  users: {
    collection: "users",
    singular: "User",
    title: "Users",
    rows: c.db.users || [],
    search: ["name", "email"],
    filter: "role",
    cols: [
      ["Name", (r) => <b>{r.name}</b>],
      ["Email", (r) => r.email],
      ["Role", (r) => r.role],
      ["Status", B],
    ],
    actions: (r) => [
      [
        r.status === "Active" ? "Deactivate" : "Activate",
        () => {
          const next = r.status === "Active" ? "Inactive" : "Active";
          c.update("users", r.id, { status: next });
          c.logAction(`${next === "Active" ? "Activated" : "Deactivated"} user`, r.name);
          c.toast(`${r.name} is now ${next}.`);
        },
      ],
    ],
    canEdit: true,
    canDelete: true,
    getItemLabel: (r) => r.name,
    form: {
      createLabel: "+ Add User",
      defaults: { name: "", email: "", role: "Attendee", status: "Active" },
      fields: [
        { key: "name", label: "FULL NAME", type: "text", required: true },
        {
          key: "email",
          label: "EMAIL ADDRESS",
          type: "email",
          required: true,
          validate: (v) => (/\S+@\S+\.\S+/.test(v) ? null : "Valid email required."),
        },
        {
          key: "role",
          label: "ROLE",
          type: "select",
          options: ["Admin", "Event Manager", "Staff", "Attendee"],
          required: true,
        },
        {
          key: "status",
          label: "STATUS",
          type: "select",
          options: ["Active", "Inactive"],
          required: true,
        },
      ],
    },
  },

  venues: {
    collection: "venues",
    singular: "Venue",
    title: "Venues",
    rows: c.db.venues || [],
    search: ["name", "location"],
    cols: [
      ["Venue", (r) => <b>{r.name}</b>],
      ["Location", (r) => r.location],
      ["Capacity", (r) => r.capacity],
      [
        "Scheduled events",
        (r) =>
          (c.db.events || []).filter(
            (e) => e.venueId === r.id && !["Rejected", "Cancelled", "Archived"].includes(e.status)
          ).length,
      ],
    ],
    canEdit: true,
    canDelete: true,
    checkCanDelete: (r) => {
      const active = (c.db.events || []).filter(
        (e) => e.venueId === r.id && !["Rejected", "Cancelled", "Archived"].includes(e.status)
      );
      if (active.length > 0) {
        return {
          allowed: false,
          reason: `Cannot delete: ${active.length} active event(s) are scheduled at this venue.`,
        };
      }
      return { allowed: true };
    },
    getItemLabel: (r) => r.name,
    form: {
      createLabel: "+ Add Venue",
      defaults: { name: "", location: "", capacity: "" },
      fields: [
        { key: "name", label: "VENUE NAME", type: "text", required: true },
        { key: "location", label: "LOCATION / BUILDING / FLOOR", type: "text", required: true },
        {
          key: "capacity",
          label: "SEATING / ROOM CAPACITY",
          type: "number",
          required: true,
          validate: (v) => (Number(v) > 0 ? null : "Capacity must be greater than 0."),
        },
      ],
      transform: (data) => ({ ...data, capacity: Number(data.capacity) }),
    },
  },

  sessions: {
    collection: "sessions",
    singular: "Session",
    title: "Sessions & Speakers",
    rows: c.db.sessions || [],
    search: ["title", "speaker"],
    cols: [
      ["Session", (r) => <b>{r.title}</b>],
      ["Event", (r) => c.eventTitle(r.eventId)],
      ["Speaker", (r) => r.speaker],
      ["Time", (r) => r.time],
      ["Room", (r) => r.room],
    ],
    canEdit: true,
    canDelete: true,
    getItemLabel: (r) => r.title,
    form: {
      createLabel: "+ Add Session",
      defaults: {
        title: "",
        eventId: c.db.events?.[0]?.id || "",
        speaker: "",
        time: "",
        room: "",
      },
      fields: [
        { key: "title", label: "SESSION TITLE", type: "text", required: true },
        {
          key: "eventId",
          label: "ASSOCIATED EVENT",
          type: "select",
          options: (c.db.events || []).map((e) => ({ value: e.id, label: e.title })),
          required: true,
        },
        { key: "speaker", label: "SPEAKER / FACILITATOR", type: "text", required: true },
        {
          key: "time",
          label: "SCHEDULE / TIME",
          type: "text",
          placeholder: "e.g. 2026-10-15 10:00",
          required: true,
        },
        { key: "room", label: "ROOM / LOCATION", type: "text", required: true },
      ],
    },
  },

  announcements: {
    collection: "announcements",
    singular: "Announcement",
    title: "Announcements",
    rows: c.db.announcements || [],
    search: ["title"],
    filter: "status",
    cols: [
      ["Title", (r) => <b>{r.title}</b>],
      ["Event", (r) => c.eventTitle(r.eventId)],
      ["Date", (r) => r.date],
      ["Status", B],
    ],
    actions: (r) => [
      [
        r.status === "Published" ? "Unpublish" : "Publish",
        () => {
          const next = r.status === "Published" ? "Draft" : "Published";
          c.update("announcements", r.id, { status: next });
          c.logAction(`${next === "Published" ? "Published" : "Unpublished"} announcement`, r.title);
          c.toast(`Announcement ${next.toLowerCase()}.`);
        },
      ],
    ],
    canEdit: true,
    canDelete: true,
    getItemLabel: (r) => r.title,
    form: {
      createLabel: "+ New Announcement",
      defaults: {
        title: "",
        eventId: c.db.events?.[0]?.id || "",
        date: today(),
        status: "Published",
      },
      fields: [
        { key: "title", label: "ANNOUNCEMENT TITLE", type: "text", required: true },
        {
          key: "eventId",
          label: "TARGET EVENT",
          type: "select",
          options: (c.db.events || []).map((e) => ({ value: e.id, label: e.title })),
          required: true,
        },
        { key: "date", label: "PUBLISH DATE", type: "date", required: true },
        {
          key: "status",
          label: "STATUS",
          type: "select",
          options: ["Draft", "Published"],
          required: true,
        },
      ],
    },
  },

  feedback: {
    collection: "feedback",
    singular: "Feedback",
    title: "Feedback",
    rows: c.db.feedback || [],
    search: ["comment"],
    summary: (rows) =>
      `Average rating ${(
        rows.reduce((s, r) => s + (Number(r.rating) || 0), 0) / (rows.length || 1)
      ).toFixed(1)} / 5 from ${rows.length} responses`,
    cols: [
      ["Event", (r) => c.eventTitle(r.eventId)],
      ["Comment", (r) => r.comment],
      ["Rating", (r) => `${r.rating} / 5`],
      ["Submitted", (r) => r.date],
    ],
    canEdit: true,
    canDelete: true,
    getItemLabel: (r) => `Feedback for ${c.eventTitle(r.eventId)}`,
    form: {
      createLabel: "+ Add Feedback",
      defaults: {
        eventId: c.db.events?.[0]?.id || "",
        comment: "",
        rating: "5",
        date: today(),
      },
      fields: [
        {
          key: "eventId",
          label: "EVENT",
          type: "select",
          options: (c.db.events || []).map((e) => ({ value: e.id, label: e.title })),
          required: true,
        },
        { key: "comment", label: "FEEDBACK COMMENT", type: "textarea", required: true },
        {
          key: "rating",
          label: "RATING (1 to 5)",
          type: "select",
          options: ["5", "4", "3", "2", "1"],
          required: true,
        },
        { key: "date", label: "SUBMISSION DATE", type: "date", required: true },
      ],
      transform: (data) => ({ ...data, rating: Number(data.rating) }),
    },
  },

  certificates: {
    collection: "certificates",
    singular: "Certificate",
    title: "Certificates",
    rows: c.db.certificates || [],
    search: ["name"],
    filter: "status",
    cols: [
      ["Participant", (r) => <b>{r.name}</b>],
      ["Event", (r) => c.eventTitle(r.eventId)],
      ["Status", B],
      ["Issued", (r) => r.date],
    ],
    actions: (r) => [
      r.status === "Eligible" && [
        "Issue",
        () => {
          const d = today();
          c.update("certificates", r.id, { status: "Issued", date: d });
          c.logAction("Issued certificate", `${r.name} · ${c.eventTitle(r.eventId)}`);
          c.toast(`Certificate issued to ${r.name}.`);
        },
      ],
    ],
    canEdit: true,
    canDelete: true,
    getItemLabel: (r) => `${r.name} (${c.eventTitle(r.eventId)})`,
    form: {
      createLabel: "+ Issue Certificate",
      defaults: {
        name: "",
        eventId: c.db.events?.[0]?.id || "",
        status: "Issued",
        date: today(),
      },
      fields: [
        { key: "name", label: "RECIPIENT FULL NAME", type: "text", required: true },
        {
          key: "eventId",
          label: "EVENT",
          type: "select",
          options: (c.db.events || []).map((e) => ({ value: e.id, label: e.title })),
          required: true,
        },
        {
          key: "status",
          label: "CERTIFICATE STATUS",
          type: "select",
          options: ["Issued", "Eligible"],
          required: true,
        },
        { key: "date", label: "ISSUE DATE", type: "date", required: true },
      ],
    },
  },

  reports: {
    title: "Reports & Analytics",
    search: ["title"],
    csv: true,
    rows: (c.db.events || []).map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      registered: c.registered(e.id),
      attended: (c.db.registrations || []).filter((r) => r.eventId === e.id && r.checkedInAt).length,
    })),
    cols: [
      ["Event", (r) => <b>{r.title}</b>],
      ["Status", B],
      ["Registered", (r) => r.registered],
      ["Attended", (r) => r.attended],
    ],
  },

  "audit-logs": {
    collection: "auditLogs",
    title: "Audit Logs",
    rows: c.db.auditLogs || [],
    search: ["action", "record", "admin"],
    clearLogs: true,
    note: "Tracks administrative operations across the Eventify platform in real-time.",
    cols: [
      ["Action", (r) => <b>{r.action}</b>],
      ["Administrator", (r) => r.admin],
      ["Record", (r) => r.record],
      ["Timestamp", (r) => r.time],
    ],
  },
});

export default function ListPage() {
  const ctx = useAdmin();
  const { page } = useParams();
  const [q, setQ] = useState("");
  const [f, setF] = useState("All");

  // Form modal state (for Create & Edit)
  const [editingItem, setEditingItem] = useState(null); // null | "new" | record
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState(null); // null | { record, label, collection, singular }
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);

  const cfg = PAGES(ctx)[page];
  if (!cfg) return <Navigate to="/admin" replace />;

  const isAttendance = page === "attendance";
  const opts = isAttendance
    ? cfg.customFilter.options
    : cfg.filter
    ? ["All", ...new Set((cfg.rows || []).map((r) => r[cfg.filter]).filter(Boolean))]
    : [];

  const rows = (cfg.rows || []).filter((r) => {
    const matchFilter = isAttendance
      ? cfg.customFilter.filterFn(r, f)
      : f === "All" || r[cfg.filter] === f;

    const matchSearch =
      !q ||
      cfg.search.some((k) =>
        String(r[k] || "")
          .toLowerCase()
          .includes(q.toLowerCase())
      );

    return matchFilter && matchSearch;
  });

  function exportCsv() {
    const head = cfg.cols.map(([l]) => l).join(",");
    const body = rows.map((r) =>
      cfg.cols
        .map(([, fn]) => {
          const v = fn(r);
          return typeof v === "object" ? r.status || "" : `"${String(v || "").replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const url = URL.createObjectURL(new Blob([[head, ...body].join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), {
      href: url,
      download: `${page}-report.csv`,
    }).click();
    URL.revokeObjectURL(url);
    ctx.toast("CSV downloaded.");
  }

  // Open modal for Create
  function openCreate() {
    setFormData(cfg.form?.defaults || {});
    setErrors({});
    setEditingItem("new");
  }

  // Open modal for Edit
  function openEdit(record) {
    const initial = {};
    if (cfg.form?.fields) {
      cfg.form.fields.forEach((fld) => {
        initial[fld.key] = record[fld.key] !== undefined ? String(record[fld.key]) : "";
      });
    }
    setFormData(initial);
    setErrors({});
    setEditingItem(record);
  }

  // Form field change handler
  const handleFieldChange = (key) => (e) => {
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: null }));
    }
  };

  // Validate form
  function validateForm() {
    if (!cfg.form?.fields) return true;
    const errs = {};
    cfg.form.fields.forEach((field) => {
      const val = formData[field.key];
      if (field.required && (val === undefined || val === null || String(val).trim() === "")) {
        errs[field.key] = "Required.";
      } else if (field.validate && val) {
        const customErr = field.validate(val, formData, ctx);
        if (customErr) errs[field.key] = customErr;
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Save form submission (Create or Edit)
  function handleSave(e) {
    e.preventDefault();
    if (!validateForm()) return;

    let payload = { ...formData };
    if (cfg.form?.transform) {
      payload = cfg.form.transform(payload);
    }

    const singular = cfg.singular || "Item";
    const label =
      payload.name || payload.title || payload.comment || cfg.getItemLabel?.(payload) || singular;

    if (editingItem === "new") {
      ctx.add(cfg.collection, payload);
      ctx.logAction(`Created ${singular.toLowerCase()}`, label);
      ctx.toast(`${singular} created successfully.`);
    } else {
      ctx.update(cfg.collection, editingItem.id, payload);
      ctx.logAction(`Updated ${singular.toLowerCase()}`, label);
      ctx.toast(`${singular} updated successfully.`);
    }

    setEditingItem(null);
  }

  // Trigger deletion check/prompt
  function promptDelete(record) {
    if (cfg.checkCanDelete) {
      const check = cfg.checkCanDelete(record, ctx.db);
      if (!check.allowed) {
        ctx.toast(check.reason || "This item cannot be deleted.");
        return;
      }
    }

    const singular = cfg.singular || "Item";
    const label = cfg.getItemLabel ? cfg.getItemLabel(record) : record.name || record.title || singular;
    setDeleteTarget({ record, label, collection: cfg.collection, singular });
  }

  // Execute deletion
  function executeDelete() {
    if (!deleteTarget) return;
    const { record, label, collection, singular } = deleteTarget;
    ctx.remove(collection, record.id);
    ctx.logAction(`Deleted ${singular.toLowerCase()}`, label);
    ctx.toast(`${singular} "${label}" deleted.`);
    setDeleteTarget(null);
  }

  return (
    <>
      {cfg.note && <p className="notice">{cfg.note}</p>}

      <div className="toolbar">
        <input
          className="input"
          placeholder={`Search ${cfg.title.toLowerCase()}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {(cfg.filter || isAttendance) && (
          <select className="input" value={f} onChange={(e) => setF(e.target.value)}>
            {opts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}

        {cfg.csv && (
          <button className="btn-sm btn-sm--yellow" onClick={exportCsv}>
            Export CSV
          </button>
        )}

        {cfg.clearLogs && rows.length > 0 && (
          <button className="btn-sm btn-sm--danger" onClick={() => setShowClearLogsConfirm(true)}>
            Clear Logs
          </button>
        )}

        {cfg.form && (
          <button className="btn-sm btn-sm--yellow" onClick={openCreate}>
            {cfg.form.createLabel || `+ Add ${cfg.singular}`}
          </button>
        )}
      </div>

      {cfg.summary && <p className="notice">{cfg.summary(rows)}</p>}

      <DataTable
        rows={rows}
        columns={cfg.cols.map(([label, render]) => ({ label, render }))}
        renderActions={(r) => {
          const customActions = cfg.actions
            ? cfg.actions(r)
                .filter(Boolean)
                .map(([label, fn]) => (
                  <button key={label} className="btn-sm" onClick={fn}>
                    {label}
                  </button>
                ))
            : [];

          const editBtn = cfg.canEdit && (
            <button key="edit" className="btn-sm" onClick={() => openEdit(r)}>
              Edit
            </button>
          );

          const deleteBtn = cfg.canDelete && (
            <button key="delete" className="btn-sm btn-sm--danger" onClick={() => promptDelete(r)}>
              Delete
            </button>
          );

          const all = [...customActions, editBtn, deleteBtn].filter(Boolean);
          return all.length > 0 ? <>{all}</> : null;
        }}
      />

      {/* Create / Edit Modal */}
      {editingItem && (
        <Modal
          title={editingItem === "new" ? cfg.form?.createLabel || `Create ${cfg.singular}` : `Edit ${cfg.singular}`}
          onClose={() => setEditingItem(null)}
        >
          <form onSubmit={handleSave} noValidate>
            {cfg.form?.fields.map((field) => {
              if (field.type === "select") {
                return (
                  <FormField key={field.key} label={field.label} error={errors[field.key]}>
                    <select
                      className="input"
                      value={formData[field.key] || ""}
                      onChange={handleFieldChange(field.key)}
                    >
                      <option value="">Select option</option>
                      {field.options.map((opt) => {
                        const val = typeof opt === "object" ? opt.value : opt;
                        const text = typeof opt === "object" ? opt.label : opt;
                        return (
                          <option key={val} value={val}>
                            {text}
                          </option>
                        );
                      })}
                    </select>
                  </FormField>
                );
              }

              if (field.type === "textarea") {
                return (
                  <FormField key={field.key} label={field.label} error={errors[field.key]}>
                    <textarea
                      className="input"
                      rows={3}
                      value={formData[field.key] || ""}
                      onChange={handleFieldChange(field.key)}
                    />
                  </FormField>
                );
              }

              return (
                <FormField key={field.key} label={field.label} error={errors[field.key]}>
                  <input
                    type={field.type}
                    className="input"
                    placeholder={field.placeholder || ""}
                    value={formData[field.key] || ""}
                    onChange={handleFieldChange(field.key)}
                  />
                </FormField>
              );
            })}

            <button type="submit" className="btn-sm btn-sm--yellow btn-block">
              {editingItem === "new" ? "Save & Create" : "Save Changes"}
            </button>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.singular}`}
          message={`Are you sure you want to permanently delete "${deleteTarget.label}"? This action cannot be undone.`}
          confirmText="Yes, Delete"
          confirmVariant="danger"
          onConfirm={executeDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Clear Logs Confirmation Modal */}
      {showClearLogsConfirm && (
        <ConfirmModal
          title="Clear Audit Logs"
          message="Are you sure you want to clear all audit logs? All historical admin activity logs will be wiped."
          confirmText="Clear All Logs"
          confirmVariant="danger"
          onConfirm={() => {
            ctx.clearAuditLogs();
            ctx.toast("Audit logs cleared.");
            setShowClearLogsConfirm(false);
          }}
          onCancel={() => setShowClearLogsConfirm(false)}
        />
      )}
    </>
  );
}
