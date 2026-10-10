import React, { useCallback } from "react";
import { useAdmin } from "../../context/AdminContext.js";
import { TableSkeleton } from "../../components/Skeleton.js";
import { Avatar, SectionHeading, StatusBadge, Table } from "../../components/manager/parts.js";
import {
  LoadError, Pagination, SearchFilter, formatDay, toQuery, useApi, useFilters,
} from "../../components/admin/parts.js";

const PAGE_SIZE = 25;
const DEFAULTS = { q: "", eventId: "", status: "", attendance: "", from: "", to: "", sort: "-registrationDate", page: "1" };
const COLUMNS = ["Attendee", "Event", "Registered", "Status", "Attendance", "Ticket"];

// Read-only oversight across every event, filtered and paged by the server. Confirming,
// cancelling and checking people in stay with each event's manager and the door staff.
export default function RegistrationsAdmin() {
  const { db } = useAdmin();
  const [filters, setFilters] = useFilters(DEFAULTS);
  const page = Math.max(1, Number(filters.page) || 1);
  const { data, error, loading, reload } = useApi(`/admin/registrations?${toQuery({ ...filters, page, limit: PAGE_SIZE })}`);
  const onPage = useCallback((value) => setFilters({ page: value }), [setFilters]);
  const events = [...db.events].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const filtered = ["q", "eventId", "status", "attendance", "from", "to"].some((key) => filters[key]);
  const summary = data?.summary;
  const rate = summary?.confirmed ? Math.round((summary.checkedIn / summary.confirmed) * 100) : 0;

  const columns = [
    {
      label: "Attendee",
      render: (row) => (
        <span className="manager-person">
          <Avatar name={row.name} />
          <span>
            <strong>{row.name || "—"}</strong>
            <small>{row.email || row.studentId || "—"}</small>
          </span>
        </span>
      ),
    },
    { label: "Event", render: (row) => row.eventTitle },
    { label: "Registered", render: (row) => <span className="manager-mono">{formatDay(row.registrationDate)}</span> },
    { label: "Status", render: (row) => <StatusBadge value={row.status || "—"} /> },
    {
      label: "Attendance",
      render: (row) => (
        <span>
          <StatusBadge value={row.attendanceStatus || "Not Checked In"} />
          {row.checkedInAt && <span className="admin-cell-sub">{row.checkedInAt}{row.checkedInBy ? ` · ${row.checkedInBy}` : ""}</span>}
        </span>
      ),
    },
    {
      label: "Ticket",
      render: (row) => (
        <span className="manager-mono">
          {row.ticketCode || "—"}
          {row.seating === "reserved" && row.seat && <span className="admin-cell-sub">Seat {row.seat}</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Oversight"
        title="Registrations"
        detail="Every registration on the platform, read-only. Event managers confirm, cancel and check people in for their own events, and staff scan tickets at the door."
      />

      <div className="manager-toolbar">
        <SearchFilter label="Search registrations" placeholder="Name, email, ticket code or student ID" value={filters.q} onSearch={(q) => setFilters({ q })} />
        <label className="manager-toolbar__field">
          Event
          <select value={filters.eventId} onChange={(e) => setFilters({ eventId: e.target.value })}>
            <option value="">All events</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}{event.date ? ` (${formatDay(event.date)})` : ""}</option>)}
          </select>
        </label>
        <label className="manager-toolbar__field">
          Status
          <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}>
            <option value="">All</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </label>
        <label className="manager-toolbar__field">
          Attendance
          <select value={filters.attendance} onChange={(e) => setFilters({ attendance: e.target.value })}>
            <option value="">All</option>
            <option value="checked-in">Checked in</option>
            <option value="not-checked-in">Not checked in</option>
          </select>
        </label>
        <label className="manager-toolbar__field">
          From <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters({ from: e.target.value })} />
        </label>
        <label className="manager-toolbar__field">
          To <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ to: e.target.value })} />
        </label>
        <label className="manager-toolbar__field">
          Sort
          <select value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
            <option value="-registrationDate">Newest first</option>
            <option value="registrationDate">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="-name">Name Z–A</option>
          </select>
        </label>
        {filtered && (
          <button type="button" className="manager-text-button" onClick={() => setFilters({ q: "", eventId: "", status: "", attendance: "", from: "", to: "" })}>
            Clear filters
          </button>
        )}
      </div>

      {summary && (
        <ul className="admin-summary" aria-label={filtered ? "Totals for these filters" : "Totals"}>
          <li><b>{summary.total}</b> {filtered ? "matching" : "registrations"}</li>
          <li><b>{summary.confirmed}</b> confirmed</li>
          <li><b>{summary.checkedIn}</b> checked in ({rate}%)</li>
          <li><b>{summary.pending}</b> pending</li>
          <li><b>{summary.cancelled}</b> cancelled</li>
        </ul>
      )}

      {error && <LoadError message={error} onRetry={reload} />}
      {!data && loading && <TableSkeleton columns={COLUMNS} rows={8} />}
      {data && (
        <div className={loading ? "admin-busy" : undefined} aria-busy={loading || undefined}>
          <Table columns={columns} rows={data.items} empty={filtered ? "No registrations match these filters." : "No registrations yet."} emptyIcon="clipboard-check" />
        </div>
      )}
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} noun="registration" onPage={onPage} busy={loading} />}
    </div>
  );
}
