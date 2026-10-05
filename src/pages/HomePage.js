import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import EventCard from "../components/EventCard.js";
import Icon from "../components/Icon.js";
import { useEventContext } from "../context/EventContext.js";
import { EVENT_CATEGORIES } from "../data/options.js";

export default function HomePage() {
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
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-hero__badge">
            <span>CAMPUS EVENT PLATFORM</span>
            <b>AY 2026-2027</b>
          </div>

          <h1 className="home-hero__title">
            FIND CAMPUS EVENTS.
          </h1>

          <p className="home-hero__lead">
            Explore technical conferences, developer hackathons, design workshops, and career recruitment expos across National University.
          </p>

          {/* Quick Search Input */}
          <form className="home-search-bar" onSubmit={handleSearchSubmit}>
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
              Explore Events
            </button>
          </form>

          {/* User Quick Stats Banner if registered */}
          {activeRegistrations.length > 0 && (
            <div className="home-hero__status-banner">
              <span className="status-banner__icon"><Icon name="ticket" size={20} /></span>
              <div className="status-banner__text">
                <strong>Hello, {userProfile.name.split(" ")[0]}!</strong> You have{" "}
                <b>{activeRegistrations.length} upcoming registered {activeRegistrations.length === 1 ? "event" : "events"}</b>.
              </div>
              <Link to="/my-events" className="status-banner__link">
                View Ticket Pass →
              </Link>
            </div>
          )}
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
              View all {upcomingEvents.length} events →
            </Link>
          </div>

          {homeEvents.length > 0 ? (
            <div className="home-events-grid">
              {homeEvents.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          ) : (
            <div className="home-empty-state">
              <span className="section-head__eyebrow">NOTHING ON THE CALENDAR YET</span>
              <h3>No events are published right now.</h3>
              <p>Check back soon, or browse event categories to see what you are interested in.</p>
              <a className="home-empty-state__link" href="#browse-categories">Browse event categories ↓</a>
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

      {/* Footer */}
      <footer className="home-footer">
        <div className="home-footer__inner">
          <div className="home-footer__col">
            <strong>EVENTIFY CAMPUS PORTAL</strong>
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
