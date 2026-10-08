import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import EventCard from "../components/EventCard.js";
import Icon from "../components/Icon.js";
import { EventCardSkeleton, useSkeleton } from "../components/Skeleton.js";
import { Reveal } from "../components/Motion.js";
import { useAuth } from "../context/AuthContext.js";
import { useEventContext } from "../context/EventContext.js";
import { EVENT_CATEGORIES } from "../data/options.js";

const STEPS = [
  { icon: "user-plus", title: "Register", text: "Pick an event and claim your seat with one short form." },
  { icon: "ticket", title: "Get your ticket", text: "Your pass, seat and ticket code appear right after you register." },
  { icon: "qr", title: "Check in", text: "Show your pass at the door and the organizer marks you present." },
  { icon: "certificate", title: "Get your certificate", text: "Attend the event and your certificate is issued to your account." },
];

const ROLES = [
  { icon: "user", title: "Students", text: "Find events, keep your passes and schedule in one place, and collect certificates." },
  { icon: "calendar", title: "Event managers", text: "Run assigned events: sessions, check-ins, announcements and reports." },
  { icon: "shield", title: "Admins", text: "Approve events and manage users, venues and records for the whole campus." },
];

const DASHBOARD_PATH = { admin: "/admin", manager: "/manager", user: "/my-events" };

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

  return (
    <div className="home-page">
      <Navbar />

      {/* Hero Section */}
      <section className="home-hero landing-hero">
        <span className="landing-hero__ring" aria-hidden="true" />
        <div className="home-hero__inner landing-hero__inner">
          <Reveal className="landing-hero__copy">
            <div className="home-hero__badge">
              <span>NU MOA CAMPUS EVENTS</span>
              <b>AY 2026-2027</b>
            </div>

            <h1 className="home-hero__title">Campus events, from sign-up to certificate.</h1>

            <p className="home-hero__lead">
              Register for National University MOA events, show your pass at the door, and get your certificate when it ends.
            </p>

            <div className="landing-hero__actions">
              <Link to="/events" className="btn btn--primary landing-cta">
                Browse events <Icon name="arrow-right" size={20} />
              </Link>
              <Link to={user ? DASHBOARD_PATH[user.role] || "/events" : "/login"} className="btn btn--secondary landing-cta">
                {user ? "Go to dashboard" : "Sign in"}
              </Link>
            </div>

            {/* User Quick Stats Banner if registered */}
            {activeRegistrations.length > 0 && (
              <div className="home-hero__status-banner">
                <span className="status-banner__icon"><Icon name="ticket" size={20} /></span>
                <div className="status-banner__text">
                  <strong>Hello, {userProfile.name.split(" ")[0]}!</strong> You have{" "}
                  <b>{activeRegistrations.length} upcoming registered {activeRegistrations.length === 1 ? "event" : "events"}</b>.
                </div>
                <Link to="/my-events" className="status-banner__link">
                  View Ticket Pass <Icon name="arrow-right" size={16} />
                </Link>
              </div>
            )}
          </Reveal>

          {/* Decorative pass built from the next real event; the same events are listed below. */}
          <div className="landing-ticket" aria-hidden="true">
            <div className="landing-ticket__stub">
              <span>ADMIT ONE</span>
              <b>{nextEvent?.category || "Campus event"}</b>
            </div>
            <div className="landing-ticket__main">
              <strong className="landing-ticket__title">{nextEvent?.title || "Your next campus event"}</strong>
              <dl className="landing-ticket__facts">
                <div><dt>Date</dt><dd>{nextEvent?.date || "To be announced"}</dd></div>
                <div><dt>Venue</dt><dd>{nextEvent?.location?.split("·")[0] || "NU MOA"}</dd></div>
              </dl>
              <div className="landing-ticket__barcode" />
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter Chips */}
      <section className="categories-strip" id="browse-categories" aria-label="Browse events by category">
        <div className="categories-strip__inner">
          <div className="categories-strip__label">BROWSE BY CATEGORY:</div>
          <div className="categories-strip__scroll">
            {EVENT_CATEGORIES.filter((c) => c !== "All").map((category) => (
              <Link
                key={category}
                to={`/events?category=${encodeURIComponent(category)}`}
                className="category-pill"
              >
                {category}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-section--events">
        <div className="home-section__inner">
          <div className="section-head">
            <div>
              <span className="section-head__eyebrow">START HERE</span>
              <h2 className="section-head__title">UPCOMING CAMPUS EVENTS</h2>
            </div>
            <Link to="/events" className="section-head__link">
              View all {upcomingEvents.length} events <Icon name="arrow-right" size={16} />
            </Link>
          </div>

          {/* Quick Search Input */}
          <form className="home-search-bar landing-search" onSubmit={handleSearchSubmit}>
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
              Search events
            </button>
          </form>

          {loadingEvents ? (
            <div className="home-events-grid" aria-busy="true" aria-label="Loading events">
              <EventCardSkeleton />
              <EventCardSkeleton />
              <EventCardSkeleton />
            </div>
          ) : homeEvents.length > 0 ? (
            <div className="home-events-grid">
              {homeEvents.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          ) : (
            <div className="home-empty-state">
              <span className="section-head__eyebrow">NOTHING ON THE CALENDAR YET</span>
              <h3>No events are published right now.</h3>
              <p>Check back soon, or browse event categories to see what you are interested in.</p>
              <a className="home-empty-state__link" href="#browse-categories">Browse event categories <Icon name="arrow-down" size={16} /></a>
            </div>
          )}
        </div>
      </section>

      {recommendedEvents.length > 0 && (
        <section className="home-section home-section--alt">
          <div className="home-section__inner">
            <div className="section-head">
              <div>
                <span className="section-head__eyebrow">MATCHED TO YOUR PROFILE</span>
                <h2 className="section-head__title">MORE TO EXPLORE</h2>
              </div>
              <span className="section-head__note">Related to {userProfile.program}</span>
            </div>
            <div className="home-events-grid">
              {recommendedEvents.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          </div>
        </section>
      )}

      <section className="home-section landing-steps" aria-labelledby="how-it-works">
        <div className="home-section__inner">
          <h2 className="section-head__title" id="how-it-works">HOW IT WORKS</h2>
          <Reveal as="ol" className="landing-steps__list">
            {STEPS.map((step, index) => (
              <li key={step.title} className="landing-step">
                <span className="landing-step__num">{index + 1}</span>
                <span className="landing-step__icon"><Icon name={step.icon} size={24} /></span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="landing-roles" aria-label="Who uses Eventify">
        <Reveal as="ul" className="home-section__inner landing-roles__list">
          {ROLES.map((role) => (
            <li key={role.title}>
              <Icon name={role.icon} size={20} />
              <p><strong>{role.title}</strong> {role.text}</p>
            </li>
          ))}
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="home-footer__inner">
          <div className="home-footer__col">
            <strong>EVENTIFY CAMPUS PORTAL</strong>
            <p>National University MOA - School of Information Technology</p>
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
