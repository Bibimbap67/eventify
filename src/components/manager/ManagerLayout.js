import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { useManager } from "../../context/ManagerContext.js";
import Logo from "../Logo.js";
import Icon from "../Icon.js";
import Toast from "../Toast.js";
import SoundToggle from "../SoundToggle.js";
import { PageTransition } from "../Motion.js";
import { Avatar, PAST_STATUSES, plural } from "./parts.js";

// Grouped by when a manager needs them: planning, the event day itself, and the follow-up.
// `badge` names a live count shown next to the link.
const NAVIGATION = [
  {
    group: "Workspace",
    items: [
      { label: "Overview", path: "/manager", icon: "dashboard" },
      { label: "My events", path: "/manager/events", icon: "calendar-days" },
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
  const { user, logout } = useAuth();
  const { events, registrations, announcements, toastMessage } = useManager();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const current = PAGES.find((item) => item.path === location.pathname);
  const inWorkspace = location.pathname.startsWith("/manager/events/");
  const title = current?.label || (inWorkspace ? "Event workspace" : "Event operations");
  const liveCount = events.filter((event) => !PAST_STATUSES.includes(event.status)).length;
  const badges = {
    pending: registrations.filter((item) => item.status === "Pending").length,
    drafts: announcements.filter((item) => item.status === "Draft").length,
  };

  // The phone drawer closes with Escape, like the dialogs.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="manager-shell">
      <aside id="manager-sidebar" className={`manager-sidebar${mobileOpen ? " manager-sidebar--open" : ""}`}>
        <div className="manager-brand">
          <Logo />
          <span>Event ops</span>
        </div>

        <div className="manager-assignment">
          <Avatar name={user?.name || "Event Manager"} />
          <div>
            <strong>{user?.name || "Event Manager"}</strong>
            <small>{plural(events.length, "assigned event")} · {liveCount} live</small>
          </div>
        </div>

        <nav className="manager-nav" aria-label="Event Manager navigation">
          {NAVIGATION.map((group) => (
            <div className="manager-nav__group" key={group.group}>
              <span className="manager-nav__heading">{group.group}</span>
              {group.items.map((item) => {
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/manager" || item.path === "/manager/events"}
                    className={({ isActive }) => `manager-nav__link${isActive ? " manager-nav__link--active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="manager-nav__icon"><Icon name={item.icon} size={16} /></span>
                    <span className="manager-nav__label">{item.label}</span>
                    {count > 0 && (
                      <span className="manager-nav__badge">
                        {count}<span className="visually-hidden"> {item.badge === "pending" ? "pending" : "drafts"}</span>
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="manager-sidebar__foot">
          <button type="button" className="manager-signout" onClick={signOut}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="manager-scrim" aria-hidden="true" onClick={() => setMobileOpen(false)} />}

      <div className="manager-main">
        <header className="manager-topbar">
          <button
            className="manager-menu-toggle"
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            aria-controls="manager-sidebar"
          >
            <Icon name={mobileOpen ? "close" : "menu"} size={20} />
          </button>
          <div className="manager-topbar__title">
            <p>{inWorkspace ? <Link to="/manager/events">My events</Link> : "Event manager"}</p>
            <h1>{title}</h1>
          </div>
          <span className="manager-topbar__date">
            <Icon name="calendar" size={16} />
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <SoundToggle className="icon-btn manager-topbar__sound" />
          <Link to="/manager/events?new=1" className="manager-button manager-button--primary manager-topbar__new">
            <Icon name="plus" size={16} /> <span>New event</span>
          </Link>
        </header>
        <main className="manager-content"><PageTransition><Outlet /></PageTransition></main>
      </div>
      <Toast message={toastMessage} className="manager-toast" />
    </div>
  );
}
