import React from "react";
import { useManager } from "../../context/ManagerContext.js";
import { SectionHeading } from "../../components/ui.js";
import { AnnouncementComposer, AnnouncementList } from "../../components/manager/Announcements.js";

export default function ManagerAnnouncements() {
  const { events, announcements } = useManager();
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Participant communication" title="Announcements" detail="Publish an event update or save a draft. A published update goes to every ticket holder as a notification and an email." />
      {events.length > 0 && <AnnouncementComposer events={events} />}
      <AnnouncementList items={announcements} showEvent />
    </div>
  );
}
