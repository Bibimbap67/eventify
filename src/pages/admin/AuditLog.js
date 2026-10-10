import React, { useCallback, useState } from "react";
import Icon from "../../components/Icon.js";
import { Modal } from "../../components/admin/ui.js";
import { TableSkeleton } from "../../components/Skeleton.js";
import { SectionHeading, Table } from "../../components/manager/parts.js";
import {
  LoadError, Pagination, SearchFilter, formatDateTime, roleLabel, timeAgo, toQuery, useApi, useFilters,
} from "../../components/admin/parts.js";

const PAGE_SIZE = 25;
const DEFAULTS = { q: "", action: "", actor: "", targetType: "", outcome: "", from: "", to: "", page: "1" };
const COLUMNS = ["When", "Who", "Action", "Target", "Outcome", "Details"];
const OUTCOMES = [
  { value: "", label: "All outcomes" },
  { value: "success", label: "Done" },
  { value: "denied", label: "Denied" },
  { value: "failed", label: "Failed" },
];
const OUTCOME_LABEL = { success: "Done", denied: "Denied", failed: "Failed" };

// Date inputs give a day in the viewer's time zone; the server filters on exact times.
const startOfDay = (day) => (day ? new Date(`${day}T00:00:00`).toISOString() : "");
const endOfDay = (day) => (day ? new Date(`${day}T23:59:59.999`).toISOString() : "");

export default function AuditLog() {
  const [filters, setFilters] = useFilters(DEFAULTS);
  const [open, setOpen] = useState(null);
  const page = Math.max(1, Number(filters.page) || 1);
  const query = toQuery({ ...filters, from: startOfDay(filters.from), to: endOfDay(filters.to), page, limit: PAGE_SIZE });
  const { data, error, loading, reload } = useApi(`/admin/audit-logs?${query}`);
  const onPage = useCallback((value) => setFilters({ page: value }), [setFilters]);
  const options = data?.options || { actions: [], actors: [], targetTypes: [] };
  const filtered = ["q", "action", "actor", "targetType", "outcome", "from", "to"].some((key) => filters[key]);

  const columns = [
    {
      label: "When",
      render: (entry) => (
        <span className="manager-mono">
          {timeAgo(entry.createdAt)}
          <span className="admin-cell-sub">{formatDateTime(entry.createdAt)}</span>
        </span>
      ),
    },
    {
      label: "Who",
      render: (entry) => (
        <span>
          <b>{entry.admin || "Unknown"}</b>
          <span className="admin-cell-sub">{entry.actorRole ? roleLabel(entry.actorRole) : "Old entry"}</span>
        </span>
      ),
    },
    { label: "Action", render: (entry) => <b>{entry.action}</b> },
    {
      label: "Target",
      render: (entry) => (
        <span>
          {entry.record || "—"}
          {entry.targetType && <span className="admin-cell-sub">{entry.targetType}</span>}
        </span>
      ),
    },
    { label: "Outcome", render: (entry) => <span className={`admin-outcome admin-outcome--${entry.outcome || "success"}`}>{OUTCOME_LABEL[entry.outcome] || "Done"}</span> },
    {
      label: "Details",
      render: (entry) => (
        <button type="button" className="manager-text-button" onClick={() => setOpen(entry)} aria-label={`Details of ${entry.action}`}>
          View
        </button>
      ),
    },
  ];

  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="System"
        title="Audit log"
        detail="Every administrative change is written here by the server: who did it (taken from their sign-in, not from the browser), what it touched, and whether it went through. Entries can't be edited or deleted."
        action={(
          <button type="button" className="manager-button" onClick={reload} disabled={loading} aria-busy={loading || undefined}>
            <Icon name="refresh" size={16} /> Refresh
          </button>
        )}
      />

      <div className="manager-toolbar">
        <SearchFilter label="Search the audit log" placeholder="Action, target or person" value={filters.q} onSearch={(q) => setFilters({ q })} />
        <label className="manager-toolbar__field">
          Action
          <select value={filters.action} onChange={(e) => setFilters({ action: e.target.value })}>
            <option value="">All actions</option>
            {options.actions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
        </label>
        <label className="manager-toolbar__field">
          Who
          <select value={filters.actor} onChange={(e) => setFilters({ actor: e.target.value })}>
            <option value="">Everyone</option>
            {options.actors.map((actor) => <option key={actor} value={actor}>{actor}</option>)}
          </select>
        </label>
        <label className="manager-toolbar__field">
          Target
          <select value={filters.targetType} onChange={(e) => setFilters({ targetType: e.target.value })}>
            <option value="">All types</option>
            {options.targetTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="manager-toolbar__field">
          From <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters({ from: e.target.value })} />
        </label>
        <label className="manager-toolbar__field">
          To <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} />
        </label>
        <label className="manager-toolbar__field">
          Outcome
          <select value={filters.outcome} onChange={(e) => setFilters({ outcome: e.target.value })}>
            {OUTCOMES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        {filtered && (
          <button type="button" className="manager-text-button" onClick={() => setFilters({ q: "", action: "", actor: "", targetType: "", outcome: "", from: "", to: "" })}>
            Clear filters
          </button>
        )}
      </div>

      {error && <LoadError message={error} onRetry={reload} />}
      {!data && loading && <TableSkeleton columns={COLUMNS} rows={8} />}
      {data && (
        <div className={loading ? "admin-busy" : undefined} aria-busy={loading || undefined}>
          <Table columns={columns} rows={data.items} empty={filtered ? "No entries match these filters." : "Nothing has been recorded yet."} emptyIcon="history" />
        </div>
      )}
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} noun="entry" onPage={onPage} busy={loading} />}

      {open && <EntryDetails entry={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function EntryDetails({ entry, onClose }) {
  const details = entry.details || {};
  const changes = Object.entries(details.changes || {});
  const facts = [
    ["Action", entry.action],
    ["Outcome", <span key="outcome" className={`admin-outcome admin-outcome--${entry.outcome || "success"}`}>{OUTCOME_LABEL[entry.outcome] || "Done"}</span>],
    ["When", `${formatDateTime(entry.createdAt)} (${new Date(entry.createdAt).toISOString()})`],
    ["Who", [entry.admin, entry.actorEmail, entry.actorRole && roleLabel(entry.actorRole)].filter(Boolean).join(" · ") || "Unknown"],
    ["Target", [entry.targetType, entry.record].filter(Boolean).join(": ") || "—"],
    ...(entry.targetId ? [["Target ID", <span key="id" className="manager-mono">{entry.targetId}</span>]] : []),
    ...(details.from !== undefined || details.to !== undefined ? [["Change", `${details.from ?? "—"} → ${details.to ?? "—"}`]] : []),
    ...(details.reason ? [["Reason", details.reason]] : []),
    ...(details.count ? [["Records", `${details.count} (${(details.ids || []).join(", ")}${details.count > (details.ids || []).length ? ", …" : ""})`]] : []),
    ...(details.role ? [["Role", details.role]] : []),
    ...(details.counts ? [["Exported", Object.entries(details.counts).map(([key, n]) => `${n} ${key}`).join(", ")]] : []),
  ];

  return (
    <Modal title="Audit entry" onClose={onClose} className="admin-dialog">
      <div className="admin-detail">
        <dl className="manager-definition-list">
          {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {changes.length > 0 && (
          <>
            <h3>What changed</h3>
            <div className="manager-table-wrap">
              <table className="manager-table">
                <thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
                <tbody>
                  {changes.map(([field, change]) => (
                    <tr key={field}>
                      <td data-label="Field"><b>{field}</b></td>
                      <td data-label="Before">{change.from ?? "—"}</td>
                      <td data-label="After">{change.to ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!entry.actorId && (
          <p className="admin-note">
            <Icon name="info" size={16} />
            Written by the old admin screen, before the server kept the log: the name and time were reported by the browser and can't be confirmed.
          </p>
        )}
      </div>
    </Modal>
  );
}
