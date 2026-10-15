import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useEventContext } from "../context/EventContext.js";
import Logo from "./Logo.js";
import NotificationDropdown from "./NotificationDropdown.js";
import Icon from "./Icon.js";
import SoundToggle from "./SoundToggle.js";
import { avatarUri } from "./avatar.js";

// Each staff role's own area: [path, icon, navbar pill label, profile menu label].
const WORKSPACES = {
  admin: ["/admin", "arrow", "Admin", "Admin Dashboard"],
  manager: ["/manager", "arrow", "Manager workspace", "Event Manager Workspace"],
  staff: ["/staff", "scan", "Check-in desk", "Check-in Desk"],
};

const navClass = ({ isActive }) => `navbar__link ${isActive ? "navbar__link--active" : ""}`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const { notifications, registrations, userProfile } = useEventContext();
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeRegsCount = registrations.filter((r) => r.status === "Confirmed").length;
  const attendee = user?.role === "user";
  const workspace = WORKSPACES[user?.role];

  // [path, label]; attendees also get their own pages.
  const links = [
    ["/", "Home"],
    ["/events", "Explore Events"],
    ["/calendar", "Calendar"],
    ...(attendee ? [["/my-events", "My Events"], ["/schedule", "Schedule"], ["/certificates", "Certificates"]] : []),
  ];
  // [path, icon, label] in the profile menu.
  const menuLinks = [
    ...(attendee ? [["/my-events", "ticket", "My Registrations"], ["/schedule", "calendar", "My Schedule"], ["/certificates", "certificate", "My Certificates"]] : []),
    ["/verify", "shield", "Verify a Certificate"],
    ["/profile", "user", "Profile & Preferences"],
  ];

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeMobile = () => setMobileMenuOpen(false);
  const closeProfile = () => setProfileOpen(false);

  const handleSignOut = () => {
    logout();
    setProfileOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <header className="navbar">
      {/* Brand Logo */}
      <Link to="/" className="navbar__brand" onClick={closeMobile}>
        <Logo />
      </Link>

      {/* Main Navigation Links */}
      <nav className={`navbar__links ${mobileMenuOpen ? "navbar__links--open" : ""}`}>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={navClass} onClick={closeMobile}>
            {label}
            {to === "/my-events" && activeRegsCount > 0 && <span className="nav-counter-pill">{activeRegsCount}</span>}
          </NavLink>
        ))}

        {workspace && (
          <Link to={workspace[0]} className="navbar__pill" onClick={closeMobile}>
            <Icon name={workspace[1]} size={14} />
            {workspace[2]}
          </Link>
        )}
      </nav>

      {/* Right Controls: Notifications & Profile */}
      <div className="navbar__right">
        <SoundToggle className="navbar__icon-btn" />

        {/* Notification Icon & Dropdown */}
        <div className="menu-wrap" ref={notifRef}>
          <button
            type="button"
            className="navbar__icon-btn"
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications"
          >
            <Icon name="bell" size={18} />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>

          {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
        </div>

        {/* Profile Menu */}
        <div className="menu-wrap" ref={profileRef}>
          <button
            type="button"
            className="navbar__avatar-btn"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label="User Profile"
          >
            <img className="navbar__avatar-img" src={avatarUri(user?.id)} alt="" />
            <span className="navbar__user-name">{userProfile.name.split(" ")[0]}</span>
            <span className="navbar__caret"><Icon name="caret" size={16} /></span>
          </button>

          {profileOpen && (
            <div className="dropdown profile-dropdown">
              <div className="profile-dropdown__header">
                <strong>{userProfile.name}</strong>
                <small>{userProfile.role}</small>
                <small className="profile-dropdown__email">{userProfile.email}</small>
              </div>

              {menuLinks.map(([to, icon, label]) => (
                <Link key={to} to={to} onClick={closeProfile} className="profile-dropdown__link">
                  <Icon name={icon} size={17} /> {label}
                </Link>
              ))}

              <div className="profile-dropdown__divider" />

              {workspace && (
                <Link to={workspace[0]} onClick={closeProfile} className="profile-dropdown__link">
                  {workspace[3]}
                </Link>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                className="profile-dropdown__link profile-dropdown__signout"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          className="navbar__burger-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <Icon name={mobileMenuOpen ? "close" : "menu"} size={20} />
        </button>
      </div>
    </header>
  );
}
