import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import EventCard from "../components/EventCard.js";
import Icon from "../components/Icon.js";
import { useEntering } from "../components/Motion.js";
import { EventCardSkeleton, useSkeleton } from "../components/Skeleton.js";
import { useEventContext } from "../context/EventContext.js";
import { EVENT_CATEGORIES } from "../data/options.js";

export default function EventsPage() {
  const entering = useEntering();
  const { events, isEventRegistered } = useEventContext();
  const loadingEvents = useSkeleton(events.length === 0, "events");
  const [searchParams, setSearchParams] = useSearchParams();

  // URL query params synchronization
  const queryParam = searchParams.get("q") || "";
  const categoryParam = searchParams.get("category") || "All";

  const [query, setQuery] = useState(queryParam);
  const [category, setCategory] = useState(categoryParam);
  const [statusFilter, setStatusFilter] = useState("All");
  const [venueFilter, setVenueFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date-asc");

  // Keep internal state in sync with URL
  useEffect(() => {
    if (queryParam) setQuery(queryParam);
    if (categoryParam) setCategory(categoryParam);
  }, [queryParam, categoryParam]);

  // Unique venues list
  const venuesList = useMemo(() => {
    return ["All", ...new Set(events.map((e) => e.location.split("·")[0].trim()))];
  }, [events]);

  // Reset all filters
  const resetFilters = () => {
    setQuery("");
    setCategory("All");
    setStatusFilter("All");
    setVenueFilter("All");
    setSortBy("date-asc");
    setSearchParams({});
  };

  // Filter & sort logic
  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();

    return events
      .filter((e) => {
        const matchesQuery =
          !q ||
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.organizer.toLowerCase().includes(q);

        const matchesCategory = category === "All" || e.category.toLowerCase() === category.toLowerCase();

        const matchesStatus =
          statusFilter === "All"
            ? true
            : statusFilter === "Registered"
            ? Boolean(isEventRegistered(e.id))
            : e.status === statusFilter;

        const matchesVenue =
          venueFilter === "All" || e.location.toLowerCase().includes(venueFilter.toLowerCase());

        return matchesQuery && matchesCategory && matchesStatus && matchesVenue;
      })
      .sort((a, b) => {
        if (sortBy === "date-asc") {
          return a.date.localeCompare(b.date);
        }
        if (sortBy === "popularity") {
          const pctA = a.registered / a.capacity;
          const pctB = b.registered / b.capacity;
          return pctB - pctA;
        }
        if (sortBy === "title-asc") {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });
  }, [events, query, category, statusFilter, venueFilter, sortBy, isEventRegistered]);

  const activeFiltersCount =
    (query ? 1 : 0) +
    (category !== "All" ? 1 : 0) +
    (statusFilter !== "All" ? 1 : 0) +
    (venueFilter !== "All" ? 1 : 0);

  return (
    <div className="events-explore-page">
      <Navbar />

      <main className="explore-main">
        {/* Page Header */}
        <div className="explore-header">
          <div>
            <span className="events-hero__eyebrow">CAMPUS PROGRAMME & EXPERIENCES</span>
            <h1 className="explore-header__title">EXPLORE EVENTS</h1>
          </div>
          <span className="explore-header__count">
            Showing <b>{filteredEvents.length}</b> of {events.length} events
          </span>
        </div>

        {/* Search & Comprehensive Filters Bar */}
        <section className="explore-filters-bar">
          {/* Search Row */}
          <div className="explore-search-wrap">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Search by title, speaker, keyword, or hall..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchParams((prev) => {
                  if (e.target.value) prev.set("q", e.target.value);
                  else prev.delete("q");
                  return prev;
                });
              }}
              aria-label="Search events"
            />
            {query && (
              <button
                type="button"
                className="explore-search-clear"
                onClick={() => {
                  setQuery("");
                  setSearchParams((prev) => {
                    prev.delete("q");
                    return prev;
                  });
                }}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>

          {/* Controls Grid */}
          <div className="explore-controls-grid">
            {/* Category Filter */}
            <div className="control-item">
              <label>CATEGORY</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSearchParams((prev) => {
                    if (e.target.value !== "All") prev.set("category", e.target.value);
                    else prev.delete("category");
                    return prev;
                  });
                }}
              >
                {EVENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Venue Filter */}
            <div className="control-item">
              <label>VENUE / ROOM</label>
              <select value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}>
                {venuesList.map((ven) => (
                  <option key={ven} value={ven}>
                    {ven}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="control-item">
              <label>STATUS / AVAILABILITY</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="REGISTRATION OPEN">Registration Open</option>
                <option value="OPENS SOON">Opens Soon</option>
                <option value="COMPLETED">Completed Events</option>
                <option value="Registered">My Registered Only</option>
              </select>
            </div>

            {/* Sort Filter */}
            <div className="control-item">
              <label>SORT BY</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date-asc">Schedule (Soonest First)</option>
                <option value="popularity">Demand (Highest % Reserved)</option>
                <option value="title-asc">Alphabetical (A - Z)</option>
              </select>
            </div>
          </div>

          {/* Active filters pill & reset */}
          {activeFiltersCount > 0 && (
            <div className="active-filters-strip">
              <span>{activeFiltersCount} filters active</span>
              <button type="button" className="btn-reset-filters" onClick={resetFilters}>
                Reset all filters
              </button>
            </div>
          )}
        </section>

        {/* Events Grid */}
        <section className="explore-results">
          {loadingEvents ? (
            <div className="events-grid" aria-busy="true" aria-label="Loading events">
              {Array.from({ length: 6 }, (_, i) => <EventCardSkeleton key={i} />)}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="events-empty-card">
              <div className="empty-card__icon"><Icon name="search" size={24} /></div>
              <h3>No events match your criteria</h3>
              <p>
                We couldn't find any events matching “{query || category || statusFilter}”. Try adjusting your keywords, selecting a different category, or resetting your filters.
              </p>
              <button type="button" className="btn-sm btn-sm--yellow" onClick={resetFilters}>
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className={`events-grid${entering ? " stagger" : ""}`}>
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
