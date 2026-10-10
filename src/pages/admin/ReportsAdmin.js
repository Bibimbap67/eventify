import React from "react";
import { Link } from "react-router-dom";
import { ADMIN_STATUSES, adminStatus, useAdmin } from "../../context/AdminContext.js";
import Icon from "../../components/Icon.js";
import Skeleton, { TableSkeleton } from "../../components/Skeleton.js";
import { Metric, SectionHeading, StatusBadge, Table, plural } from "../../components/manager/parts.js";
import {
  LoadError, SearchFilter, downloadCsv, formatDay, useApi, useFilters,
} from "../../components/admin/parts.js";

const DEFAULTS = { q: "", status: "", sort: "date" };
const SORTS = {
  date: (a, b) => (b.date || "").localeCompare(a.date || ""),
  registrations: (a, b) => b.confirmed - a.confirmed,
  attendance: (a, b) => b.rate - a.rate,
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
};
const COLUMNS = ["Event", "Date", "Status", "Registered", "Checked in", "Cancelled", "Feedback", "Open"];
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// Platform-wide numbers per event, counted by the server (GET /api/admin/reports/events).
export default function ReportsAdmin() {
  const { toast } = useAdmin();
  const [filters, setFilters] = useFilters(DEFAULTS);
  const { data, error, loading, reload } = useApi("/admin/reports/events");

  const all = (data?.events || []).map((event) => ({ ...event, status: adminStatus(event), rate: percent(event.checkedIn, event.confirmed) }));
  const q = filters.q.toLowerCase();
  const rows = all
    .filter((event) => (!filters.status || event.status === filters.status) && `${event.title} ${event.organizer} ${event.manager || ""}`.toLowerCase().includes(q))
    .sort(SORTS[filters.sort] || SORTS.date);
  const total = (key) => rows.reduce((sum, event) => sum + event[key], 0);
  const responses = total("responses");
  const average = responses ? rows.reduce((sum, event) => sum + (event.rating || 0) * event.responses, 0) / responses : null;

  function exportCsv() {
    downloadCsv(
      `eventify-event-report-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Event", "Date", "Status", "Organizer", "Manager", "Venue", "Capacity", "Confirmed", "Checked in", "Check-in rate (%)", "Cancelled", "Feedback responses", "Average rating"],
      rows.map((event) => [
        event.title, event.date, event.status, event.organizer, event.manager || "", event.venue, event.capacity,
        event.confirmed, event.checkedIn, event.rate, event.cancelled, event.responses, event.rating ?? "",
      ])
    );
    toast(`Report for ${plural(rows.length, "event")} downloaded.`);
  }

  const columns = [
    { label: "Event", render: (event) => <span><b>{event.title}</b><span className="admin-cell-sub">{event.manager ? `Managed by ${event.manager}` : event.organizer || "—"}</span></span> },
    { label: "Date", render: (event) => <span className="manager-mono">{formatDay(event.date)}</span> },
    { label: "Status", render: (event) => <StatusBadge value={event.status} /> },
    { label: "Registered", render: (event) => <span className="manager-mono">{event.confirmed} / {event.capacity || "—"}</span> },
    { label: "Checked in", render: (event) => <span className="manager-mono">{event.checkedIn} ({event.rate}%)</span> },
    { label: "Cancelled", render: (event) => <span className="manager-mono">{event.cancelled}</span> },
    {
      label: "Feedback",
      render: (event) => (event.responses
        ? <span className="manager-mono"><Icon name="star" size={16} /> {event.rating} <span className="admin-cell-sub">{plural(event.responses, "response")}</span></span>
        : <span className="manager-muted">None yet</span>),
    },
    {
      label: "Open",
      render: (event) => (
        <Link className="manager-inline-link" to={`/admin/registrations?eventId=${encodeURIComponent(event.id)}`}>
          Registrations <Icon name="arrow-right" size={16} />
        </Link>
      ),
    },
  ];

  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Oversight"
        title="Reports"
        detail="Registrations, check-ins and feedback for every event, counted on the server. Filter the list, then export exactly what you see."
        action={(
          <span className="manager-row-buttons">
            <button type="button" className="manager-button" onClick={reload} disabled={loading} aria-busy={loading || undefined}>
              <Icon name="refresh" size={16} /> Refresh
            </button>
            <button type="button" className="manager-button manager-button--primary" onClick={exportCsv} disabled={!rows.length}>
              <Icon name="download" size={16} /> Export CSV
            </button>
          </span>
        )}
      />

      {data ? (
        <div className="manager-metrics">
          <Metric icon="calendar-days" tone="blue" label="Events" value={rows.length} note={filters.status || filters.q ? "Matching the filters" : "On the platform"} />
          <Metric icon="ticket" tone="yellow" label="Confirmed" value={total("confirmed")} note={`${total("cancelled")} cancelled`} />
          <Metric icon="user-check" tone="mint" label="Checked in" value={total("checkedIn")} note={`${percent(total("checkedIn"), total("confirmed"))}% of confirmed`} />
          <Metric icon="message" tone="violet" label="Feedback" value={responses} note={average === null ? "No ratings yet" : `Average ${average.toFixed(1)} / 5`} />
        </div>
      ) : (
        !error && <div className="manager-metrics" aria-busy="true" aria-label="Loading">{[1, 2, 3, 4].map((key) => <Skeleton key={key} className="skeleton--stat" />)}</div>
      )}

      <div className="manager-toolbar">
        <SearchFilter label="Search events" placeholder="Search event, organizer or manager" value={filters.q} onSearch={(value) => setFilters({ q: value })} />
        <label className="manager-toolbar__field">
          Status
          <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}>
            <option value="">All</option>
            {ADMIN_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="manager-toolbar__field">
          Sort
          <select value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
            <option value="date">Date: latest first</option>
            <option value="registrations">Most registrations</option>
            <option value="attendance">Highest check-in rate</option>
            <option value="rating">Highest rating</option>
          </select>
        </label>
      </div>

      {error && <LoadError message={error} onRetry={reload} />}
      {!data && loading && <TableSkeleton columns={COLUMNS} rows={6} />}
      {data && (
        <div className={loading ? "admin-busy" : undefined} aria-busy={loading || undefined}>
          <Table columns={columns} rows={rows} empty={all.length ? "No events match these filters." : "No events yet."} emptyIcon="chart" />
        </div>
      )}
    </div>
  );
}
