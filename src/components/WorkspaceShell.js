import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import Logo from "./Logo.js";
import Icon from "./Icon.js";
import { PageTransition } from "./Motion.js";

// The frame shared by the admin area and the event manager workspace: a sidebar of grouped links,
// a phone drawer, and a top bar over the routed page. A link's `badge` names an entry in `badges`,
// [count, words read after the count]. `footer` goes above Sign out; `actions` (the top bar's right
// side) may be a function that receives signOut, for menus that sign out too.
export default function WorkspaceShell({
  id, className = "", brand, navLabel, assignment, navigation, badges = {}, collapsed = false, footer, crumb, title, actions,
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <div className={`manager-shell${className ? ` ${className}` : ""}`}>
      <aside id={id} className={`manager-sidebar${mobileOpen ? " manager-sidebar--open" : ""}`}>
        <div className="manager-brand">
          <Logo />
          <span>{brand}</span>
        </div>

        {assignment}

        <nav className="manager-nav" aria-label={navLabel}>
          {navigation.map((section) => (
            <div className="manager-nav__group" key={section.group}>
              <span className="manager-nav__heading">{section.group}</span>
              {section.items.map((item) => {
                const [count, words] = badges[item.badge] || [0];
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) => `manager-nav__link${isActive ? " manager-nav__link--active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="manager-nav__icon"><Icon name={item.icon} size={16} /></span>
                    <span className="manager-nav__label">{item.label}</span>
                    {count > 0 && (
                      <span className="manager-nav__badge">
                        {count}<span className="visually-hidden"> {words}</span>
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="manager-sidebar__foot">
          {footer}
          <button type="button" className="manager-signout" onClick={signOut} title={collapsed ? "Sign out" : undefined}>
            <Icon name="logout" size={16} /> <span>Sign out</span>
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
            aria-controls={id}
          >
            <Icon name={mobileOpen ? "close" : "menu"} size={20} />
          </button>
          <div className="manager-topbar__title">
            <p>{crumb}</p>
            <h1>{title}</h1>
          </div>
          {typeof actions === "function" ? actions(signOut) : actions}
        </header>
        <main className="manager-content"><PageTransition><Outlet /></PageTransition></main>
      </div>
    </div>
  );
}
