import React, { useState } from "react";
import { useManager } from "../../context/ManagerContext.js";
import { SectionHeading } from "../../components/ui.js";
import { AttendanceDesk } from "../../components/manager/Desks.js";

export default function ManagerAttendance() {
  const { events, registrations } = useManager();
  const [eventId, setEventId] = useState("All");
  const rows = registrations.filter((item) => item.status === "Confirmed" && (eventId === "All" || item.eventId === eventId));
  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Event day"
        title="Attendance"
        detail="Check participants in and correct accidental check-ins."
        action={(
          <select className="manager-select" aria-label="Choose assigned event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="All">All assigned events</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        )}
      />
      <section className="manager-panel">
        <AttendanceDesk key={eventId} rows={rows} showEvent={eventId === "All"} />
      </section>
    </div>
  );
}
