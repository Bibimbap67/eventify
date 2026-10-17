import React from "react";
import { useManager } from "../../context/ManagerContext.js";
import { EmptyState, SectionHeading, byDate, eventDate } from "../../components/ui.js";
import { ReportPanel } from "../../components/manager/Results.js";
import { Pagination, usePaged } from "../../components/admin/parts.js";

const PAGE_SIZE = 5;

export default function ManagerReports() {
  const { events, registrations, feedback, sessions } = useManager();
  const sorted = [...events].sort(byDate);
  const { page, setPage, shown } = usePaged(sorted, PAGE_SIZE, "", "page");
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Event performance" title="Reports" detail="Event-level results calculated from assigned participant and feedback records." />
      <div className="manager-page">
        {shown.map((event) => (
          <ReportPanel
            key={event.id}
            event={event}
            eyebrow={`${event.category} · ${eventDate(event.date, { month: "short", day: "numeric", year: "numeric" })}`}
            title={event.title}
            registrations={registrations}
            feedback={feedback.filter((item) => item.eventId === event.id)}
            sessions={sessions.filter((item) => item.eventId === event.id)}
          />
        ))}
      </div>
      <Pagination page={page} limit={PAGE_SIZE} total={sorted.length} noun="event" onPage={setPage} />
      {!events.length && <EmptyState icon="chart" title="No events to report on" />}
    </div>
  );
}
