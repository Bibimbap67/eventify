import React from "react";
import { useManager } from "../../context/ManagerContext.js";
import { DateTile, PanelHeader, SectionHeading, StatusBadge, eventDate } from "../../components/ui.js";
import { FeedbackPanel } from "../../components/manager/Results.js";

export default function ManagerFeedback() {
  const { events, feedback } = useManager();
  const withFeedback = events
    .map((event) => ({ event, items: feedback.filter((item) => item.eventId === event.id) }))
    .sort((a, b) => b.items.length - a.items.length);
  const quiet = withFeedback.filter((group) => !group.items.length);
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Post-event review" title="Feedback" detail="Participant comments and event ratings from your assignments." />
      {withFeedback.filter((group) => group.items.length).map(({ event, items }) => (
        <FeedbackPanel key={event.id} feedback={items} eyebrow={eventDate(event.date, { month: "short", day: "numeric", year: "numeric" })} title={event.title} />
      ))}
      {quiet.length > 0 && (
        <section className="manager-panel">
          <PanelHeader eyebrow="Waiting for responses" title="No feedback yet" />
          <ul className="manager-quiet-list">
            {quiet.map(({ event }) => <li key={event.id}><DateTile date={event.date} /> <span>{event.title}</span> <StatusBadge value={event.status} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
