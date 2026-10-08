import React, { useEffect, useState } from "react";
import Logo from "./Logo.js";

// A grey block with a shimmer. Always decorative: the region around it sets aria-busy.
export default function Skeleton({ className = "", style }) {
  return <span className={`skeleton${className ? ` ${className}` : ""}`} style={style} aria-hidden="true" />;
}

// Same box model as EventCard so the grid does not jump when real cards replace it.
export function EventCardSkeleton() {
  return (
    <div className="event-card event-card--skeleton" aria-hidden="true">
      <div className="event-card__accent" />
      <div className="event-card__body">
        <div className="event-card__top"><Skeleton style={{ width: 96, height: 26 }} /></div>
        <Skeleton className="skeleton--title" />
        <Skeleton className="skeleton--title" style={{ width: "60%" }} />
        <Skeleton className="skeleton--line" />
        <Skeleton className="skeleton--line" style={{ width: "80%" }} />
        <Skeleton className="skeleton--box" />
        <Skeleton className="skeleton--line" style={{ width: "70%", marginTop: 14 }} />
      </div>
    </div>
  );
}

// Uses the real table markup and column headers so row height and widths match.
export function TableSkeleton({ columns, rows = 5 }) {
  return (
    <div className="table-wrap" aria-busy="true" aria-label="Loading">
      <table className="table">
        <thead>
          <tr>{columns.map((label) => <th key={label}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {columns.map((label) => (
                <td key={label}><Skeleton className="skeleton--cell" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The frame of the page that is about to appear, built from the real layout classes,
// shown while a saved session is being verified.
export function ShellSkeleton({ role }) {
  if (role === "admin" || role === "manager") {
    const shell = role === "admin"
      ? { root: "admin", side: "sidebar", logo: "sidebar__logo", link: "sidebar__link", main: "admin__main", bar: "topbar", content: "admin__content" }
      : { root: "manager-shell", side: "manager-sidebar", logo: "manager-brand", link: "manager-nav__link", main: "manager-main", bar: "manager-topbar", content: "manager-content" };
    return (
      <div className={`${shell.root} shell-skeleton`} aria-busy="true" aria-label="Loading">
        <aside className={shell.side}>
          <div className={shell.logo}><Logo /></div>
          {Array.from({ length: 8 }, (_, i) => <div key={i} className={shell.link}><Skeleton style={{ width: `${50 + (i % 3) * 15}%` }} /></div>)}
        </aside>
        <div className={shell.main}>
          <header className={shell.bar}><Skeleton className="skeleton--title" style={{ width: 180, margin: 0 }} /></header>
          <main className={shell.content}>
            <div className="shell-skeleton__stats">
              {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="skeleton--stat" />)}
            </div>
            <Skeleton className="skeleton--panel" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="events-page shell-skeleton" aria-busy="true" aria-label="Loading">
      <header className="navbar"><Logo /></header>
      <main className="explore-main">
        <Skeleton style={{ width: 140, marginBottom: 12 }} />
        <Skeleton className="skeleton--heading" />
        <div className="events-grid">
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </div>
      </main>
    </div>
  );
}

// Event page while the event list is still loading (direct link / refresh).
export function EventDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading event">
      <header className="event-hero-banner">
        <div className="event-hero-banner__inner">
          <Skeleton style={{ width: 170, height: 32, marginBottom: 20 }} />
          <Skeleton style={{ width: 260, height: 26, marginBottom: 16 }} />
          <Skeleton className="skeleton--heading" style={{ width: "70%" }} />
          <Skeleton style={{ width: 240, height: 18 }} />
        </div>
      </header>
      <main className="event-detail-body">
        <div className="event-detail-container event-detail-grid">
          <div>
            <Skeleton className="skeleton--line" />
            <Skeleton className="skeleton--line" />
            <Skeleton className="skeleton--line" style={{ width: "60%" }} />
            <Skeleton className="skeleton--panel" />
          </div>
          <Skeleton className="skeleton--ticket" />
        </div>
      </main>
    </div>
  );
}

// True while a list that started empty may still be loading.
// ponytail: guesses from "empty" because the contexts don't expose a loading flag;
// swap for a real `ready`/`accountsLoading` flag once the context provides one.
// - never shown if data is already there on mount (no artificial delay)
// - gives up after `maxWait` so a truly empty list shows its empty state
// - once shown, stays at least `minShow` so it doesn't flash
export function useSkeleton(isEmpty, resetKey, { maxWait = 1500, minShow = 300 } = {}) {
  const [state, setState] = useState(() => ({ key: resetKey, pending: isEmpty, start: Date.now() }));
  if (state.key !== resetKey) {
    // New page in the same component: decide again, during render, so no frame shows the wrong state.
    setState({ key: resetKey, pending: isEmpty, start: Date.now() });
  }

  const { pending, start } = state;
  useEffect(() => {
    if (!pending) return undefined;
    const wait = isEmpty ? maxWait - (Date.now() - start) : minShow - (Date.now() - start);
    const timer = setTimeout(() => setState((s) => ({ ...s, pending: false })), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [pending, isEmpty, start, maxWait, minShow]);

  return pending && state.key === resetKey;
}
