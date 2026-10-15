import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { useManager } from "../../context/ManagerContext.js";
import Icon from "../Icon.js";
import SoundToggle from "../SoundToggle.js";
import WorkspaceShell from "../WorkspaceShell.js";
import { plural } from "../ui.js";
import { PAST_STATUSES } from "../../data/eventStatus.js";

// Grouped by when a manager needs them: planning, the event day itself, and the follow-up.
// `badge` names a live count shown next to the link.
const NAVIGATION = [
  {
    group: "Workspace",
    items: [
      { label: "Overview", path: "/manager", icon: "dashboard", end: true },
      { label: "My events", path: "/manager/events", icon: "calendar-days", end: true },
    ],
  },
  {
    group: "Event day",
    items: [
      { label: "Registrations", path: "/manager/registrations", icon: "clipboard-check", badge: "pending" },
      { label: "Attendance", path: "/manager/attendance", icon: "scan" },
      { label: "Schedule", path: "/manager/schedule", icon: "schedule" },
      { label: "Participants", path: "/manager/participants", icon: "users" },
    ],
  },
  {
    group: "Follow-up",
    items: [
      { label: "Announcements", path: "/manager/announcements", icon: "megaphone", badge: "drafts" },
      { label: "Feedback", path: "/manager/feedback", icon: "message" },
      { label: "Reports", path: "/manager/reports", icon: "chart" },
    ],
  },
];
const PAGES = NAVIGATION.flatMap((group) => group.items);

export default function ManagerLayout() {
  const { user } = useAuth();
  const { events, registrations, announcements } = useManager();
  const location = useLocation();
  const current = PAGES.find((item) => item.path === location.pathname);
  const inWorkspace = location.pathname.startsWith("/manager/events/");
  const liveCount = events.filter((event) => !PAST_STATUSES.includes(event.status)).length;

  return (
    <WorkspaceShell
      id="manager-sidebar"
      brand="Event ops"
      navLabel="Event Manager navigation"
      assignment={(
        <div className="manager-assignment">
          <small>{plural(events.length, "assigned event")} · {liveCount} live</small>
          <strong>{user?.name || "Event Manager"}</strong>
        </div>
      )}
      navigation={NAVIGATION}
      badges={{
        pending: [registrations.filter((item) => item.status === "Pending").length, "pending"],
        drafts: [announcements.filter((item) => item.status === "Draft").length, "drafts"],
      }}
      crumb={inWorkspace ? <Link to="/manager/events">My events</Link> : "Event manager"}
      title={current?.label || (inWorkspace ? "Event workspace" : "Event operations")}
      actions={(
        <>
          <span className="manager-topbar__date">
            <Icon name="calendar" size={16} />
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <SoundToggle className="icon-btn manager-topbar__sound" />
          <Link to="/profile" className="icon-btn" aria-label="Your profile and password" title="Your profile and password">
            <Icon name="user" size={18} />
          </Link>
          <Link to="/manager/events?new=1" className="manager-button manager-button--primary manager-topbar__new">
            <Icon name="plus" size={16} /> <span>New event</span>
          </Link>
        </>
      )}
    />
  );
}
