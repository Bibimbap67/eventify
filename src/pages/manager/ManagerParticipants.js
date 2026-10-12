import React, { useState } from "react";
import { useManager } from "../../context/ManagerContext.js";
import { PersonCell, SearchField, SectionHeading, StatusBadge, Table, plural } from "../../components/ui.js";

export default function ManagerParticipants() {
  const { events, registrations } = useManager();
  const [query, setQuery] = useState("");
  const rows = registrations.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Participant roster" title="Participants" detail="Operational contact details for participants in your assigned events." />
      <div className="manager-toolbar">
        <SearchField label="Search participant roster" placeholder="Search participants" value={query} onChange={setQuery} />
        <span className="manager-muted">{plural(rows.length, "participant")}</span>
      </div>
      <Table
        empty="No participants match your search."
        emptyIcon="users"
        rows={rows}
        columns={[
          { label: "Name", render: (row) => <PersonCell name={row.name} detail={row.email} seed={row.userId} /> },
          { label: "Event", render: (row) => events.find((event) => event.id === row.eventId)?.title },
          { label: "Phone", render: (row) => row.phone || <span className="manager-muted">Not provided</span> },
          { label: "Registration", render: (row) => <StatusBadge value={row.status} /> },
          { label: "Attendance", render: (row) => <StatusBadge value={row.attendanceStatus} /> },
        ]}
      />
    </div>
  );
}
