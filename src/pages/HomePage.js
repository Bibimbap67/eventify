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

  const featuredEvents = events.filter((e) => e.featured);
  const upcomingEvents = events.filter((e) => e.status !== "COMPLETED").slice(0, 4);
  const recommendedEvents = events.filter((e) => ["Technology", "Workshop"].includes(e.category)).slice(0, 3);

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
            DISCOVER, ATTEND & EXCEL IN CAMPUS EVENTS.
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
      <section className="categories-strip">
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

      {/* Featured Events Showcase */}
      <section className="home-section">
        <div className="home-section__inner">
          <div className="section-head">
            <div>
              <span className="section-head__eyebrow">HANDPICKED HIGHLIGHTS</span>
              <h2 className="section-head__title">FEATURED CAMPUS EXPERIENCES</h2>
            </div>
            <Link to="/events" className="section-head__link">
              View all {events.length} events →
            </Link>
          </div>

          <div className="featured-events-grid">
            {featuredEvents.map((event) => (
              <div key={event.id} className="featured-card-wrapper">
                <EventCard event={event} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recommended for You based on Profile Track */}
      <section className="home-section home-section--alt">
        <div className="home-section__inner">
          <div className="section-head">
            <div>
              <span className="section-head__eyebrow">CURATED DISCOVERY</span>
              <h2 className="section-head__title">RECOMMENDED FOR {userProfile.program.toUpperCase()}</h2>
            </div>
            <span className="section-head__note">Based on software & engineering tracks</span>
          </div>

          <div className="events-grid">
            {recommendedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Events Carousel/Grid */}
      <section className="home-section">
        <div className="home-section__inner">
          <div className="section-head">
            <div>
              <span className="section-head__eyebrow">NEXT ON THE CALENDAR</span>
              <h2 className="section-head__title">UPCOMING THIS TERM</h2>
            </div>
            <Link to="/events" className="section-head__link">
              Filter by date & venue →
            </Link>
          </div>

          <div className="events-grid">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      </section>

      {/* Attendee Call To Action Banner */}
      <section className="home-cta-strip">
        <div className="home-cta-strip__inner">
          <div className="home-cta-strip__content">
            <h3>READY TO JOIN THE NEXT TECH SUMMIT OR SPRINT?</h3>
            <p>
              Claim your digital ticket in seconds. Digital passes include reserved seating, QR check-in codes, and official participation certificates.
            </p>
          </div>
          <Link to="/events" className="home-cta-strip__btn">
            Browse All Events Now
          </Link>
        </div>
      </section>

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
