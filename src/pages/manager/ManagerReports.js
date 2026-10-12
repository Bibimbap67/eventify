import React from "react";
import { useManager } from "../../context/ManagerContext.js";
import { EmptyState, SectionHeading, byDate, eventDate } from "../../components/ui.js";
import { ReportPanel } from "../../components/manager/Results.js";

export default function ManagerReports() {
  const { events, registrations, feedback, sessions } = useManager();
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Event performance" title="Reports" detail="Event-level results calculated from assigned participant and feedback records." />
      {[...events].sort(byDate).map((event) => (
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
      {!events.length && <EmptyState icon="chart" title="No events to report on" />}
    </div>
  );
}
