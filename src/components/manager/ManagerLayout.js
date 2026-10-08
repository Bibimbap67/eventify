import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { useManager } from "../../context/ManagerContext.js";
import Logo from "../Logo.js";
import Icon from "../Icon.js";
import Toast from "../Toast.js";
import SoundToggle from "../SoundToggle.js";
import { PageTransition } from "../Motion.js";

const NAVIGATION = [
  { label: "Overview", path: "/manager" },
  { label: "My Events", path: "/manager/events" },
  { label: "Registrations", path: "/manager/registrations" },
  { label: "Attendance", path: "/manager/attendance" },
  { label: "Schedule", path: "/manager/schedule" },
  { label: "Participants", path: "/manager/participants" },
  { label: "Announcements", path: "/manager/announcements" },
  { label: "Feedback", path: "/manager/feedback" },
  { label: "Reports", path: "/manager/reports" },
];

export default function ManagerLayout() {
  const { user, logout } = useAuth();
  const { toastMessage } = useManager();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const current = NAVIGATION.find((item) => item.path === location.pathname);
  const title = current?.label || (location.pathname.includes("/events/") ? "Event Workspace" : "Event Operations");

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="manager-shell">
      <aside className={`manager-sidebar${mobileOpen ? " manager-sidebar--open" : ""}`}>
        <div className="manager-brand"><Logo /><span>EVENT OPERATIONS</span></div>
        <div className="manager-assignment">
          <span>MANAGER WORKSPACE</span>
          <strong>{user?.name || "Event Manager"}</strong>
          <small>Assigned events only</small>
        </div>
        <nav className="manager-nav" aria-label="Event Manager navigation">
          {NAVIGATION.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/manager" || item.path === "/manager/events"}
              className={({ isActive }) => `manager-nav__link${isActive ? " manager-nav__link--active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <span>{item.label}</span>
              <Icon name="arrow" size={14} />
            </NavLink>
          ))}
        </nav>
        <div className="manager-sidebar__foot">
          <span className="manager-role-mark">EM</span>
          <span><strong>Event Manager</strong><small>Event workspace</small></span>
          <button type="button" onClick={signOut} aria-label="Sign out"><Icon name="arrow" size={17} /></button>
        </div>
      </aside>

      <div className="manager-main">
        <header className="manager-topbar">
          <button className="manager-menu-toggle" type="button" onClick={() => setMobileOpen((open) => !open)} aria-label="Toggle navigation"><Icon name="menu" size={20} /></button>
          <div>
            <p>EVENTIFY / EVENT MANAGER</p>
            <h1>{title}</h1>
          </div>
          <SoundToggle className="icon-btn manager-topbar__sound" />
          <span className="manager-topbar__date">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
        </header>
        <main className="manager-content"><PageTransition><Outlet /></PageTransition></main>
      </div>
      <Toast message={toastMessage} className="manager-toast" />
    </div>
  );
}