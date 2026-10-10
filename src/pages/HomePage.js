import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import Icon from "../components/Icon.js";
import { useSkeleton } from "../components/Skeleton.js";
import ScrollProgress from "../components/landing/ScrollProgress.js";
import CategoryStrip from "../components/landing/CategoryStrip.js";
import HowItWorks from "../components/landing/HowItWorks.js";
import { ComingUp, PosterWall } from "../components/landing/Board.js";
import { useAuth } from "../context/AuthContext.js";
import { useEventContext } from "../context/EventContext.js";
import { EVENT_CATEGORIES } from "../data/options.js";

// Featured first, then soonest first; events without an ISO date go last ("9" > any year).
const bySoonest = (a, b) =>
  Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (a.isoDate || "9").localeCompare(b.isoDate || "9");

export default function HomePage() {
  const { user } = useAuth();
  const { events, registrations, userProfile } = useEventContext();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/events");
    }
  };

  const upcomingEvents = events.filter((event) => event.status !== "COMPLETED").sort(bySoonest);
  const loadingEvents = useSkeleton(events.length === 0, "home");
  const programTerms = (userProfile.program || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => term.length > 3 && !["bachelor", "program", "major", "science", "information"].includes(term)) || [];
  const matchesProgram = (event) => {
    const searchableText = `${event.title} ${event.description} ${event.category}`.toLowerCase();
    return programTerms.some((term) => searchableText.includes(term));
  };
  // The next eight by date, plus later events that match the student's program (tagged in the list).
  const agendaEvents = upcomingEvents.filter((event, index) => index < 8 || matchesProgram(event)).slice(0, 11);

  const activeRegistrations = registrations.filter((r) => r.status === "Confirmed");
  const openCount = events.filter((event) => event.status === "REGISTRATION OPEN").length;

  let secondaryAction = { to: "/login", label: "Sign in", icon: "login" };
  if (user?.role === "user") secondaryAction = { to: "/my-events", label: "My events", icon: "ticket" };
  if (user?.role === "admin") secondaryAction = { to: "/admin", label: "Admin workspace", icon: "arrow" };
  if (user?.role === "manager") secondaryAction = { to: "/manager", label: "Manager workspace", icon: "arrow" };
  if (user?.role === "staff") secondaryAction = { to: "/staff", label: "Check-in desk", icon: "scan" };

  const actions = (
    <div className="landing-hero__actions">
      <Link to="/events" className="landing-btn landing-btn--primary">Browse events</Link>
      <Link to={secondaryAction.to} className="landing-btn landing-btn--ghost">
        <Icon name={secondaryAction.icon} size={16} /> {secondaryAction.label}
      </Link>
    </div>
  );

  return (
    <div className="home-page landing">
      <ScrollProgress focusTargetId="home-title" />
      <Navbar />

      {/* Hero: the headline pasted on the wall, the next three events pinned beside it */}
      <section className="home-hero landing-hero">
        <div className="home-hero__inner landing-hero__grid">
          <div className="landing-hero__copy">
            <h1 className="home-hero__title" id="home-title" tabIndex={-1}>
              <span>Campus events, from <span className="nowrap">sign-up</span> to certificate.</span>
            </h1>

            <p className="home-hero__lead">
              Browse talks, workshops and career fairs at National University MOA. Register in one tap,
              check in with your ticket pass, and collect your certificate.
            </p>

            <form className="home-search-bar" onSubmit={handleSearchSubmit} role="search">
              <div className="home-search-bar__input-wrap">
                <Icon name="search" size={18} />
                <input
                  type="text"
                  aria-label="Search events"
                  placeholder="Search by topic, speaker, or keyword (e.g. AI, Figma, Hackathon)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="home-search-bar__btn">
                Search
              </button>
            </form>

            {actions}

            {activeRegistrations.length > 0 && (
              <div className="home-hero__status-banner">
                <span className="status-banner__icon"><Icon name="ticket" size={20} /></span>
                <div className="status-banner__text">
                  <strong>Hello, {userProfile.name.split(" ")[0]}!</strong> You have{" "}
                  <b>{activeRegistrations.length} upcoming registered {activeRegistrations.length === 1 ? "event" : "events"}</b>.
                </div>
                <Link to="/my-events" className="status-banner__link">
                  View ticket pass <Icon name="arrow-right" size={14} />
                </Link>
              </div>
            )}
          </div>

          <PosterWall events={upcomingEvents.slice(0, 3)} loading={loadingEvents} />
        </div>
      </section>

      <ComingUp
        events={agendaEvents}
        loading={loadingEvents}
        total={upcomingEvents.length}
        openCount={openCount}
        matchesProgram={programTerms.length ? matchesProgram : null}
      >
        <CategoryStrip categories={EVENT_CATEGORIES.filter((c) => c !== "All")} />
      </ComingUp>

      <HowItWorks>{actions}</HowItWorks>

      <footer className="home-footer">
        <div className="home-footer__inner">
          <div className="home-footer__col">
            <strong>EVENTIFY CAMPUS PORTAL</strong>
            <p>National University MOA, School of Information Technology</p>
            <p>Empowering student builders, researchers, and campus organizations through seamless event participation.</p>
          </div>
          <div className="home-footer__links">
            <Link to="/events">Explore Events</Link>
            <Link to="/calendar">Event Calendar</Link>
            <Link to="/my-events">My Registrations</Link>
            <Link to="/schedule">Personal Schedule</Link>
            <Link to="/certificates">Earned Certificates</Link>
            {userProfile.role === "Administrator" && <Link to="/admin">Admin Workspace</Link>}
          </div>
        </div>
      </footer>
    </div>
  );
}
