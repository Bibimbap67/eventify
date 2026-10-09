import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useEventContext } from "../context/EventContext.js";
import Logo from "./Logo.js";
import NotificationDropdown from "./NotificationDropdown.js";
import Icon from "./Icon.js";
import SoundToggle from "./SoundToggle.js";

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

  const handleSignOut = () => {
    logout();
    setProfileOpen(false);
    navigate("/login", { replace: true });
  };

  const displayName = userProfile.name || user?.name || "Guest User";
  const userInitials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="navbar">
      {/* Brand Logo */}
      <Link to="/" className="navbar__brand" onClick={() => setMobileMenuOpen(false)}>
        <Logo />
      </Link>

      {/* Main Navigation Links */}
      <nav className={`navbar__links ${mobileMenuOpen ? "navbar__links--open" : ""}`}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `navbar__link ${isActive ? "navbar__link--active" : ""}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          Home
        </NavLink>

        <NavLink
          to="/events"
          className={({ isActive }) => `navbar__link ${isActive ? "navbar__link--active" : ""}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          Explore Events
        </NavLink>

        <NavLink
          to="/calendar"
          className={({ isActive }) => `navbar__link ${isActive ? "navbar__link--active" : ""}`}
          onClick={() => setMobileMenuOpen(false)}
        >
          Calendar
        </NavLink>

        {user?.role === "user" && <>
          <NavLink
            to="/my-events"
            className={({ isActive }) => `navbar__link ${isActive ? "navbar__link--active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            My Events
            {activeRegsCount > 0 && <span className="nav-counter-pill">{activeRegsCount}</span>}
          </NavLink>
          <NavLink
            to="/schedule"
            className={({ isActive }) => `navbar__link ${isActive ? "navbar__link--active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Schedule
          </NavLink>
          <NavLink
            to="/certificates"
            className={({ isActive }) => `navbar__link ${isActive ? "navbar__link--active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Certificates
          </NavLink>
        </>}

        {user?.role === "admin" && (
          <Link to="/admin" className="navbar__pill" onClick={() => setMobileMenuOpen(false)}>
            <Icon name="arrow" size={14} />
            Admin
          </Link>
        )}
        {user?.role === "manager" && (
          <Link to="/manager" className="navbar__pill" onClick={() => setMobileMenuOpen(false)}>
            <Icon name="arrow" size={14} />
            Manager workspace
          </Link>
        )}
        {user?.role === "staff" && (
          <Link to="/staff" className="navbar__pill" onClick={() => setMobileMenuOpen(false)}>
            <Icon name="scan" size={14} />
            Check-in desk
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

        {/* Attendee Profile Menu */}
        <div className="menu-wrap" ref={profileRef}>
          <button
            type="button"
            className="navbar__avatar-btn"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-label="User Profile"
          >
            <span className="navbar__avatar-initials">{userInitials}</span>
            <span className="navbar__user-name">{displayName.split(" ")[0]}</span>
            <span className="navbar__caret"><Icon name="caret" size={16} /></span>
          </button>

          {profileOpen && (
            <div className="dropdown profile-dropdown">
              <div className="profile-dropdown__header">
                <strong>{displayName}</strong>
                <small>{userProfile.role || (user?.role === "manager" ? "Event Manager" : user?.role === "admin" ? "Administrator" : "Student Attendee")}</small>
                <small className="profile-dropdown__email">{userProfile.email || user?.email}</small>
              </div>

              {user?.role === "user" && <>
                <Link
                to="/my-events"
                onClick={() => setProfileOpen(false)}
                className="profile-dropdown__link"
              >
                <Icon name="ticket" size={17} /> My Registrations
              </Link>
              <Link
                to="/schedule"
                onClick={() => setProfileOpen(false)}
                className="profile-dropdown__link"
              >
                <Icon name="calendar" size={17} /> My Schedule
              </Link>
              <Link
                to="/certificates"
                onClick={() => setProfileOpen(false)}
                className="profile-dropdown__link"
              >
                <Icon name="certificate" size={17} /> My Certificates
              </Link>
              <Link
                to="/profile"
                onClick={() => setProfileOpen(false)}
                className="profile-dropdown__link"
              >
                <Icon name="user" size={17} /> Profile & Preferences
              </Link>
              </>}

              <div className="profile-dropdown__divider" />

              {user?.role === "admin" && (
                <Link to="/admin" onClick={() => setProfileOpen(false)} className="profile-dropdown__link">
                  Admin Dashboard
                </Link>
              )}
              {user?.role === "manager" && (
                <Link to="/manager" onClick={() => setProfileOpen(false)} className="profile-dropdown__link">
                  Event Manager Workspace
                </Link>
              )}
              {user?.role === "staff" && (
                <Link to="/staff" onClick={() => setProfileOpen(false)} className="profile-dropdown__link">
                  Check-in Desk
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