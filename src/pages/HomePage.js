import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import EventCard from "../components/EventCard.js";
import Icon from "../components/Icon.js";
import { EventCardSkeleton, useSkeleton } from "../components/Skeleton.js";
import Reveal from "../components/landing/Reveal.js";
import ScrollProgress from "../components/landing/ScrollProgress.js";
import CategoryMarquee from "../components/landing/CategoryMarquee.js";
import HeroShapes from "../components/landing/HeroShapes.js";
import StatsBand from "../components/landing/StatsBand.js";
import HowItWorks from "../components/landing/HowItWorks.js";
import { useAuth } from "../context/AuthContext.js";
import { useEventContext } from "../context/EventContext.js";
import { EVENT_CATEGORIES } from "../data/options.js";

const ROLES = [
  { icon: "graduation", title: "Students", text: "Find events, register, and keep every certificate in one place." },
  { icon: "clipboard", title: "Event managers", text: "Run registrations, check-ins, schedules and announcements." },
  { icon: "shield", title: "Admins", text: "Approve events, manage accounts and venues, and review reports." },
];

const STAGGER_MS = 60;

export default function HomePage() {
  const { user } = useAuth();
  const { events, registrations, userProfile } = useEventContext();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [railIndex, setRailIndex] = useState(0);
  const railRef = useRef(null);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/events");
    }
  };

  const upcomingEvents = events
    .filter((event) => event.status !== "COMPLETED")
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  const homeEvents = upcomingEvents.slice(0, 3);
  const nextEvent = homeEvents[0];
  const loadingEvents = useSkeleton(events.length === 0, "home");
  const programTerms = (userProfile.program || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => term.length > 3 && !["bachelor", "program", "major", "science", "information"].includes(term)) || [];
  const homeEventIds = new Set(homeEvents.map((event) => event.id));
  const recommendedEvents = programTerms.length
    ? upcomingEvents
      .filter((event) => {
        if (homeEventIds.has(event.id)) return false;
        const searchableText = `${event.title} ${event.description} ${event.category}`.toLowerCase();
        return programTerms.some((term) => searchableText.includes(term));
      })
      .slice(0, 3)
    : [];

  const activeRegistrations = registrations.filter((r) => r.status === "Confirmed");

  const stats = [
    {
      label: "Open for registration",
      value: events.filter((event) => event.status === "REGISTRATION OPEN").length,
      hint: "Events you can join today",
    },
    {
      label: "Seats taken",
      value: upcomingEvents.reduce((sum, event) => sum + (event.registered || 0), 0),
      hint: "Across upcoming events",
    },
    {
      label: "Seats still open",
      value: upcomingEvents.reduce((sum, event) => sum + Math.max(0, (event.capacity || 0) - (event.registered || 0)), 0),
      hint: "Grab one before they go",
    },
    {
      label: "Categories",
      value: new Set(events.map((event) => event.category).filter(Boolean)).size,
      hint: "From tech talks to career fairs",
    },
  ];

  let secondaryAction = { to: "/login", label: "Sign in", icon: "login" };
  if (user?.role === "user") secondaryAction = { to: "/my-events", label: "My events", icon: "ticket" };
  if (user?.role === "admin") secondaryAction = { to: "/admin", label: "Admin workspace", icon: "arrow" };
  if (user?.role === "manager") secondaryAction = { to: "/manager", label: "Manager workspace", icon: "arrow" };

  const handleRailScroll = () => {
    const rail = railRef.current;
    const first = rail?.firstElementChild;
    if (!first) return;
    const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || "0");
    setRailIndex(Math.min(homeEvents.length - 1, Math.round(rail.scrollLeft / step)));
  };

  const seatsLeft = nextEvent ? Math.max(0, (nextEvent.capacity || 0) - (nextEvent.registered || 0)) : 0;

  return (
    <div className="home-page landing">
      <ScrollProgress focusTargetId="home-title" />
      <Navbar />

      {/* Hero */}
      <section className="home-hero landing-hero">
        <div className="home-hero__inner landing-hero__grid">
          <div className="landing-hero__copy">
            <Reveal className="home-hero__badge">
              <span>CAMPUS EVENT PLATFORM</span>
              <b>AY 2026-2027</b>
            </Reveal>

            <Reveal as="h1" className="home-hero__title" id="home-title" tabIndex={-1} delay={STAGGER_MS}>
              Campus events, from sign-up to <em>certificate.</em>
            </Reveal>

            <Reveal as="p" className="home-hero__lead" delay={STAGGER_MS * 2}>
              Browse talks, workshops and career fairs at National University MOA. Register in one tap,
              check in with your ticket pass, and collect your certificate.
            </Reveal>

            <Reveal delay={STAGGER_MS * 3}>
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
            </Reveal>

            <Reveal className="landing-hero__actions" delay={STAGGER_MS * 4}>
              <Link to="/events" className="landing-btn landing-btn--primary">
                Browse events <Icon name="arrow-right" size={16} />
              </Link>
              <Link to={secondaryAction.to} className="landing-btn landing-btn--ghost">
                <Icon name={secondaryAction.icon} size={16} /> {secondaryAction.label}
              </Link>
            </Reveal>

            {activeRegistrations.length > 0 && (
              <Reveal className="home-hero__status-banner" delay={STAGGER_MS * 5}>
                <span className="status-banner__icon"><Icon name="ticket" size={20} /></span>
                <div className="status-banner__text">
                  <strong>Hello, {userProfile.name.split(" ")[0]}!</strong> You have{" "}
                  <b>{activeRegistrations.length} upcoming registered {activeRegistrations.length === 1 ? "event" : "events"}</b>.
                </div>
                <Link to="/my-events" className="status-banner__link">
                  View Ticket Pass <Icon name="arrow-right" size={14} />
                </Link>
              </Reveal>
            )}
          </div>

          <div className="landing-hero__visual">
            <HeroShapes />
            {nextEvent && (
              <Reveal delay={STAGGER_MS * 3}>
                <Link to={`/events/${nextEvent.id}`} className="landing-ticket" aria-label={`Next up: ${nextEvent.title}, ${nextEvent.date}`}>
                  <span className="landing-ticket__top">
                    <span className="landing-label">Next up</span>
                    <span className="landing-ticket__tag">{nextEvent.category || nextEvent.status}</span>
                  </span>
                  <span className="landing-ticket__title">{nextEvent.title}</span>
                  <span className="landing-ticket__perf" />
                  <span className="landing-ticket__facts">
                    <span><Icon name="calendar" size={16} /> {nextEvent.date}</span>
                    {nextEvent.time && nextEvent.time.trim() !== "-" && <span><Icon name="clock" size={16} /> {nextEvent.time}</span>}
                    <span><Icon name="pin" size={16} /> {(nextEvent.location || "").split("·")[0]}</span>
                  </span>
                  <span className="landing-ticket__foot">
                    <span className="landing-ticket__seats">
                      <b>{seatsLeft.toLocaleString()}</b> {seatsLeft === 1 ? "seat" : "seats"} left
                    </span>
                    <span className="landing-ticket__cta">View event <Icon name="arrow-right" size={16} /></span>
                  </span>
                </Link>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      <CategoryMarquee categories={EVENT_CATEGORIES.filter((c) => c !== "All")} />

      {/* Upcoming events: a grid on wide screens, a swipeable row on phones */}
      <section className="home-section home-section--events">
        <div className="home-section__inner">
          <Reveal className="section-head">
            <div>
              <span className="section-head__eyebrow">START HERE</span>
              <h2 className="section-head__title">UPCOMING CAMPUS EVENTS</h2>
            </div>
            <div className="landing-head-side">
              {homeEvents.length > 1 && (
                <span className="landing-rail-count" aria-hidden="true">
                  {railIndex + 1} / {homeEvents.length} <span>Swipe</span>
                </span>
              )}
              <Link to="/events" className="section-head__link">
                View all {upcomingEvents.length} events <Icon name="arrow-right" size={14} />
              </Link>
            </div>
          </Reveal>

          {loadingEvents ? (
            <div className="home-events-grid" aria-busy="true" aria-label="Loading events">
              <EventCardSkeleton />
              <EventCardSkeleton />
              <EventCardSkeleton />
            </div>
          ) : homeEvents.length > 0 ? (
            <div className="home-events-grid home-events-grid--rail" ref={railRef} onScroll={handleRailScroll}>
              {homeEvents.map((event, index) => (
                <Reveal key={event.id} className="landing-card-slot" delay={index * STAGGER_MS}>
                  <EventCard event={event} accentIndex={index} />
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal className="home-empty-state">
              <span className="section-head__eyebrow">NOTHING ON THE CALENDAR YET</span>
              <h3>No events are published right now.</h3>
              <p>Check back soon, or browse event categories to see what you are interested in.</p>
              <a className="home-empty-state__link" href="#browse-categories">Browse event categories <Icon name="arrow-up" size={16} /></a>
            </Reveal>
          )}
        </div>
      </section>

      {events.length > 0 && (
        <section className="home-section home-section--alt landing-stats-section" aria-labelledby="stats-title">
          <div className="home-section__inner">
            <Reveal className="section-head">
              <div>
                <span className="section-head__eyebrow">THIS TERM AT A GLANCE</span>
                <h2 className="section-head__title" id="stats-title">CAMPUS IN NUMBERS</h2>
              </div>
            </Reveal>
            <Reveal>
              <StatsBand stats={stats} />
            </Reveal>
          </div>
        </section>
      )}

      {recommendedEvents.length > 0 && (
        <section className="home-section">
          <div className="home-section__inner">
            <Reveal className="section-head">
              <div>
                <span className="section-head__eyebrow">MATCHED TO YOUR PROFILE</span>
                <h2 className="section-head__title">MORE TO EXPLORE</h2>
              </div>
              <span className="section-head__note">Related to {userProfile.program}</span>
            </Reveal>
            <div className="home-events-grid">
              {recommendedEvents.map((event, index) => (
                <Reveal key={event.id} className="landing-card-slot" delay={index * STAGGER_MS}>
                  <EventCard event={event} accentIndex={homeEvents.length + index} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <HowItWorks />

      <section className="home-section home-section--alt" aria-labelledby="roles-title">
        <div className="home-section__inner">
          <Reveal className="section-head">
            <div>
              <span className="section-head__eyebrow">WHO IT IS FOR</span>
              <h2 className="section-head__title" id="roles-title">BUILT FOR EVERY ROLE ON CAMPUS</h2>
            </div>
          </Reveal>
          <div className="landing-roles">
            {ROLES.map((role, index) => (
              <Reveal key={role.title} className="landing-role" delay={index * STAGGER_MS}>
                <span className="landing-role__icon"><Icon name={role.icon} size={24} /></span>
                <div>
                  <h3>{role.title}</h3>
                  <p>{role.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="cta-title">
        <Reveal className="landing-cta__inner">
          <h2 id="cta-title">Your next event is one click away.</h2>
          <div className="landing-hero__actions">
            <Link to="/events" className="landing-btn landing-btn--dark">
              Browse events <Icon name="arrow-right" size={16} />
            </Link>
            <Link to={secondaryAction.to} className="landing-btn landing-btn--light">
              <Icon name={secondaryAction.icon} size={16} /> {secondaryAction.label}
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="home-footer__inner">
          <div className="home-footer__col">
            <strong>EVENTIFY CAMPUS PORTAL</strong>
            <p>National University MOA · School of Information Technology</p>
            <p>Empowering student builders, researchers, and campus organizations through seamless event participation.</p>
          </div>
          <div className="home-footer__links">
            <Link to="/events">Explore Events</Link>
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
