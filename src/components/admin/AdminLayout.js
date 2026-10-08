import React, { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { useAdmin } from "../../context/AdminContext.js";
import Logo from "../Logo.js";
import Icon from "../Icon.js";
import Toast from "../Toast.js";
import { PageTransition } from "../Motion.js";

const NAV = [
  { label: "Dashboard", path: "/admin" },
  { label: "Events", path: "/admin/events" },
  { label: "Registrations", path: "/admin/registrations" },
  { label: "Attendance", path: "/admin/attendance" },
  { label: "Users", path: "/admin/users" },
  { label: "Venues", path: "/admin/venues" },
  { label: "Sessions & Speakers", path: "/admin/sessions" },
  { label: "Announcements", path: "/admin/announcements" },
  { label: "Feedback", path: "/admin/feedback" },
  { label: "Certificates", path: "/admin/certificates" },
  { label: "Reports & Analytics", path: "/admin/reports" },
  { label: "Audit Logs", path: "/admin/audit-logs" },
  { label: "Settings", path: "/admin/settings" },
];

export default function AdminLayout() {
  // State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(""); // "notif", "profile", or ""

  // Context and router hooks
  const { user, logout } = useAuth();
  const { db, toastMsg, toast } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the page title using filter (from the current URL)
  const currentPage = NAV.filter((item) => item.path === location.pathname);
  let title = "Admin";
  if (currentPage.length > 0) {
    title = currentPage[0].label;
  }

  // Get the user's name
  let userName = "Admin";
  if (user) {
    userName = user.name;
  }

  // Sidebar class name
  let sidebarClass = "sidebar";
  if (isSidebarOpen) {
    sidebarClass = "sidebar sidebar--open";
  }

  // Event handlers
  const handleBurgerClick = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLinkClick = () => {
    setIsSidebarOpen(false);
  };

  const handleNotifClick = () => {
    if (openMenu === "notif") {
      setOpenMenu("");
    } else {
      setOpenMenu("notif");
    }
  };

  const handleProfileMenuClick = () => {
    if (openMenu === "profile") {
      setOpenMenu("");
    } else {
      setOpenMenu("profile");
    }
  };

  const handleProfileClick = () => {
    setOpenMenu("");
    toast("Profile settings are not available yet.");
  };

  const handleSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const notes = db.auditLogs.slice(0, 3).map((entry) => `${entry.action}: ${entry.record}`);

  // NavLink needs a function to know if the link is active
  const getLinkClass = ({ isActive }) => {
    if (isActive) {
      return "sidebar__link sidebar__link--active";
    }
    return "sidebar__link";
  };

  return (
    <div className="admin">
      <aside className={sidebarClass}>
        <div className="sidebar__logo">
          <Logo />
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              onClick={handleLinkClick}
              className={getLinkClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="admin__main">
        <header className="topbar">
          <button className="icon-btn topbar__burger" onClick={handleBurgerClick} aria-label="Menu">
            <Icon name="menu" size={19} />
          </button>
          <h1 className="topbar__title">{title}</h1>

          <div className="topbar__right">
            <div className="menu-wrap">
              <button className="btn-sm" onClick={handleNotifClick}>
                Activity ({notes.length})
              </button>
              {openMenu === "notif" && (
                <div className="dropdown">
                  {notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                  {notes.length === 0 && <p>No recent activity.</p>}
                </div>
              )}
            </div>

            <div className="menu-wrap">
              <button className="btn-sm btn-sm--yellow" onClick={handleProfileMenuClick}>
                {userName} <Icon name="caret" size={16} />
              </button>
              {openMenu === "profile" && (
                <div className="dropdown">
                  <button onClick={handleProfileClick}>Profile</button>
                  <button onClick={handleSignOut}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="admin__content">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      <Toast message={toastMsg} />
    </div>
  );
}