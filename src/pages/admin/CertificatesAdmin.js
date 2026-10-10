import React, { useCallback } from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "../../context/AdminContext.js";
import Icon from "../../components/Icon.js";
import { TableSkeleton, useSkeleton } from "../../components/Skeleton.js";
import { SectionHeading, StatusBadge, Table } from "../../components/manager/parts.js";
import { Pagination, SearchFilter, useFilters } from "../../components/admin/parts.js";

const PAGE_SIZE = 25;
const DEFAULTS = { q: "", eventId: "", page: "1" };
const COLUMNS = ["Recipient", "Event", "Credential ID", "Issued", "Status", "Verify"];

// Issued certificates, read-only. They are created automatically when a checked-in attendee
// completes an event, so there is nothing to issue or edit by hand here.
export default function CertificatesAdmin() {
  const { db, eventTitle } = useAdmin();
  const [filters, setFilters] = useFilters(DEFAULTS);
  const page = Math.max(1, Number(filters.page) || 1);
  const onPage = useCallback((value) => setFilters({ page: value }), [setFilters]);
  const loading = useSkeleton(db.certificates.length === 0, "certificates");

  const q = filters.q.toLowerCase();
  const rows = db.certificates.filter((item) => (!filters.eventId || item.eventId === filters.eventId)
    && `${item.recipientName} ${item.credentialId} ${item.eventTitle}`.toLowerCase().includes(q));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const eventIds = [...new Set(db.certificates.map((item) => item.eventId))];

  const columns = [
    {
      label: "Recipient",
      render: (item) => (
        <span>
          <b>{item.recipientName || "—"}</b>
          {!item.userId && <span className="admin-cell-sub">Not linked to an account</span>}
        </span>
      ),
    },
    { label: "Event", render: (item) => item.eventTitle || eventTitle(item.eventId) },
    { label: "Credential ID", render: (item) => <span className="manager-mono">{item.credentialId || "—"}</span> },
    { label: "Issued", render: (item) => <span className="manager-mono">{item.issueDate || "—"}</span> },
    { label: "Status", render: (item) => <StatusBadge value={item.status || "Issued"} /> },
    {
      label: "Verify",
      render: (item) => (item.credentialId ? (
        <Link className="manager-inline-link" to={`/verify/${encodeURIComponent(item.credentialId)}`} target="_blank" rel="noreferrer">
          Public check <Icon name="external" size={16} />
        </Link>
      ) : <span className="manager-muted">No credential ID</span>),
    },
  ];

  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Oversight"
        title="Certificates"
        detail="Certificates are issued automatically when a checked-in attendee completes an event. Anyone can confirm one on the public check page with its credential ID."
      />

      <div className="manager-toolbar">
        <SearchFilter label="Search certificates" placeholder="Recipient, event or credential ID" value={filters.q} onSearch={(value) => setFilters({ q: value })} />
        <label className="manager-toolbar__field">
          Event
          <select value={filters.eventId} onChange={(e) => setFilters({ eventId: e.target.value })}>
            <option value="">All events</option>
            {eventIds.map((id) => <option key={id} value={id}>{eventTitle(id) === "—" ? id : eventTitle(id)}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <TableSkeleton columns={COLUMNS} rows={6} />
      ) : (
        <Table
          columns={columns}
          rows={shown}
          empty={db.certificates.length ? "No certificates match these filters." : "No certificates issued yet."}
          emptyIcon="certificate"
        />
      )}
      {!loading && <Pagination page={page} limit={PAGE_SIZE} total={rows.length} noun="certificate" onPage={onPage} />}
    </div>
  );
}
