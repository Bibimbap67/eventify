import React, { useCallback, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { useAdmin } from "../../context/AdminContext.js";
import Icon from "../Icon.js";
import SoundToggle from "../SoundToggle.js";
import WorkspaceShell from "../WorkspaceShell.js";
import { Avatar } from "../ui.js";
import { timeAgo, useApi, useDismiss } from "./parts.js";
import "./admin.css";

// Platform-wide jobs only. Running a single event (registrations, check-in, sessions,
// announcements) belongs to its Event Manager; the admin sees those through Oversight.
const NAVIGATION = [
  { group: "Overview", items: [{ label: "Dashboard", path: "/admin", icon: "dashboard", end: true }] },
  {
    group: "Platform",
    items: [
      { label: "Users & roles", path: "/admin/users", icon: "users" },
      { label: "Events & approvals", path: "/admin/events", icon: "calendar-days", badge: "pending" },
      { label: "Venues", path: "/admin/venues", icon: "pin" },
    ],
  },
  {
    group: "Oversight",
    items: [
      { label: "Reports", path: "/admin/reports", icon: "chart" },
      { label: "Registrations", path: "/admin/registrations", icon: "clipboard-check" },
      { label: "Certificates", path: "/admin/certificates", icon: "certificate" },
    ],
  },
  {
    group: "System",
    items: [
      { label: "Audit log", path: "/admin/audit-logs", icon: "history" },
      { label: "Settings", path: "/admin/settings", icon: "settings" },
    ],
  },
];

const COLLAPSED_KEY = "eventify_admin_sidebar";
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "collapsed";
  } catch {
    return false;
  }
};

export default function AdminLayout() {
  const { user } = useAuth();
  const { db, settings } = useAdmin();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const location = useLocation();
  const group = NAVIGATION.find((item) => item.items.some((page) => page.path === location.pathname));
  const page = group?.items.find((item) => item.path === location.pathname);
  const pending = db.events.filter((event) => event.status === "Pending").length;

  function toggleCollapsed() {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, value ? "expanded" : "collapsed");
      } catch {
        // private window: the choice lasts until the page reloads
      }
      return !value;
    });
  }

  return (
    <WorkspaceShell
      id="admin-sidebar"
      className={`admin${collapsed ? " admin--collapsed" : ""}`}
      brand="Admin"
      navLabel="Admin navigation"
      assignment={(
        <div className="manager-assignment admin-org">
          <small>{settings.academicTerm || "Platform administration"}</small>
          <strong>{settings.orgName}</strong>
        </div>
      )}
      navigation={NAVIGATION}
      badges={{ pending: [pending, "waiting for approval"] }}
      collapsed={collapsed}
      footer={(
        <button type="button" className="manager-signout admin-collapse" onClick={toggleCollapsed} aria-pressed={collapsed} title={collapsed ? "Expand sidebar" : undefined}>
          <Icon name={collapsed ? "panel-open" : "panel-close"} size={16} />
          <span>{collapsed ? "Expand" : "Collapse sidebar"}</span>
        </button>
      )}
      crumb={group ? `Admin · ${group.group}` : "Admin"}
      title={page?.label || "Admin"}
      actions={(signOut) => (
        <div className="admin-topbar__actions">
          <SoundToggle className="icon-btn" />
          <ActivityMenu />
          <ProfileMenu user={user} onSignOut={signOut} />
        </div>
      )}
    />
  );
}

// The latest audit entries, fetched each time the menu opens.
function ActivityMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const { data, loading, error } = useApi(open ? "/admin/audit-logs?limit=5" : null);

  return (
    <div className="admin-menu" ref={ref}>
      <button type="button" className="icon-btn" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="true" aria-label="Recent admin activity">
        <Icon name="bell" size={18} />
      </button>
      {open && (
        <div className="admin-menu__panel admin-menu__panel--wide">
          <p className="admin-menu__heading">Recent admin activity</p>
          {loading && !data && <p className="admin-menu__note">Loading…</p>}
          {error && <p className="admin-menu__note">{error}</p>}
          {data && !data.items.length && <p className="admin-menu__note">Nothing recorded yet.</p>}
          {data?.items.length > 0 && (
            <ul className="admin-activity-list">
              {data.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.action}</strong>
                  {item.record && <span> · {item.record}</span>}
                  <small>
                    {item.admin} · {timeAgo(item.createdAt)}
                    {item.outcome && item.outcome !== "success" && <b className={`admin-outcome admin-outcome--${item.outcome}`}>{item.outcome}</b>}
                  </small>
                </li>
              ))}
            </ul>
          )}
          <Link className="admin-menu__footer" to="/admin/audit-logs" onClick={close}>
            Open the audit log <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const name = user?.name || "Admin";

  return (
    <div className="admin-menu" ref={ref}>
      <button type="button" className="admin-profile-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="true">
        <Avatar name={name} seed={user?.id} />
        <span className="admin-profile-button__name">{name}</span>
        <Icon name="caret" size={16} />
      </button>
      {open && (
        <div className="admin-menu__panel">
          <p className="admin-menu__who">
            <strong>{name}</strong>
            <small>{user?.email}</small>
            <small>Administrator</small>
          </p>
          <Link className="admin-menu__item" to="/admin/settings?tab=profile" onClick={close}>
            <Icon name="user" size={16} /> Profile & password
          </Link>
          <button type="button" className="admin-menu__item" onClick={onSignOut}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
