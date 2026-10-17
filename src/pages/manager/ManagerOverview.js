import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { useManager } from "../../context/ManagerContext.js";
import Icon from "../../components/Icon.js";
import {
  CapacityBar, EmptyState, Metric, PanelHeader, StatusBadge, byDate, countRegistrations, countdownLabel,
  eventDate, plural, relativeDay,
} from "../../components/ui.js";
import { PAST_STATUSES } from "../../data/eventStatus.js";
import { isCheckedIn, shownStatus } from "../../data/checkIn.js";
import { formatTime, timeRange } from "../../data/time.js";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", icon: "sunrise" };
  if (hour < 18) return { text: "Good afternoon", icon: "sun" };
  return { text: "Good evening", icon: "moon" };
}

export default function ManagerOverview() {
  const { user } = useAuth();
  const { events, registrations, sessions, notifications, announcements } = useManager();
  const upcoming = events.filter((event) => !PAST_STATUSES.includes(event.status)).sort(byDate);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const pending = registrations.filter((item) => item.status === "Pending");
  const activeRegistrations = registrations.filter((item) => item.status !== "Cancelled").length;
  const prepCount = upcoming.filter((event) => event.preparationStatus !== "Ready").length;
  const checkedIn = registrations.filter(isCheckedIn).length;
  const nextEvent = upcoming[0];
  const nextCount = nextEvent ? countRegistrations(nextEvent.id, registrations) : 0;
  const nextSessions = sessions
    .filter((session) => upcoming.some((event) => event.id === session.eventId))
    .sort((a, b) => `${eventById.get(a.eventId).date} ${a.startTime}`.localeCompare(`${eventById.get(b.eventId).date} ${b.startTime}`))
    .slice(0, 5);

  // Each item links to the place where it gets fixed.
  const actionItems = [
    ...events.filter((event) => event.status === "Approved").map((event) => ({
      key: `event-${event.id}`, icon: "calendar-days", tone: "blue", to: `/manager/events/${event.id}/overview`,
      text: <><b>{event.title}</b>: registration is not open yet</>,
    })),
    ...pending.map((item) => ({
      key: `registration-${item.id}`, icon: "hourglass", tone: "yellow", to: "/manager/registrations?status=Pending",
      text: <><b>{item.name}</b>: registration needs review</>,
    })),
    ...announcements.filter((item) => item.status === "Draft").map((item) => ({
      key: `announcement-${item.id}`, icon: "megaphone", tone: "violet", to: `/manager/events/${item.eventId}/announcements`,
      text: <><b>{item.title}</b>: announcement is still a draft</>,
    })),
  ];
  const shownActions = actionItems.slice(0, 5);
  const hello = greeting();
  const firstName = (user?.name || "there").split(" ")[0];

  return (
    <div className="manager-page manager-overview">
      <section className="manager-welcome" aria-labelledby="manager-welcome-title">
        <div className="manager-welcome__copy">
          <span className="manager-sticker">Your assignment</span>
          <h2 id="manager-welcome-title"><Icon name={hello.icon} size={24} /> {hello.text}, {firstName}.</h2>
          <p>
            You have <b>{plural(upcoming.length, "upcoming event")}</b>
            {pending.length ? <> and <b>{plural(pending.length, "registration")}</b> waiting for review.</> : ". Every registration has been reviewed."}
          </p>
          <div className="manager-welcome__actions">
            {nextEvent && (
              <Link className="manager-button manager-button--primary manager-button--lg" to={`/manager/events/${nextEvent.id}/overview`}>
                Open next event <Icon name="arrow-right" size={16} />
              </Link>
            )}
            <Link className="manager-button manager-button--lg" to="/manager/attendance">
              <Icon name="scan" size={16} /> Check-in desk
            </Link>
          </div>
        </div>

        {nextEvent ? (
          <Link className="manager-next" to={`/manager/events/${nextEvent.id}/overview`} aria-label={`Next event: ${nextEvent.title}, ${countdownLabel(nextEvent.date)}`}>
            <span className="manager-next__countdown">{countdownLabel(nextEvent.date)}</span>
            <span className="manager-eyebrow">Next event</span>
            <span className="manager-next__title">{nextEvent.title}</span>
            <span className="manager-facts">
              <span><Icon name="calendar" size={16} /> {eventDate(nextEvent.date, { weekday: "short", month: "short", day: "numeric" })}</span>
              <span><Icon name="clock" size={16} /> {timeRange(nextEvent.startTime, nextEvent.endTime, "–")}</span>
              <span><Icon name="pin" size={16} /> {nextEvent.venue}</span>
            </span>
            <span className="manager-next__meter">
              <span><b>{nextCount}</b> / {nextEvent.capacity} registered</span>
              <StatusBadge value={shownStatus(nextEvent)} />
            </span>
            <CapacityBar value={nextCount} max={nextEvent.capacity} />
          </Link>
        ) : (
          <div className="manager-next manager-next--empty">
            <span className="manager-eyebrow">Next event</span>
            <span className="manager-next__title">Nothing scheduled</span>
            <span>Create an event and it will show up here once it is approved.</span>
          </div>
        )}
      </section>

      <div className="manager-metrics">
        <Metric icon="calendar-days" tone="blue" label="Assigned events" value={events.length} note={`${upcoming.length} upcoming`} to="/manager/events" />
        <Metric icon="ticket" tone="yellow" label="Active registrations" value={activeRegistrations} note="Across your events" to="/manager/registrations" />
        <Metric icon="alert-circle" tone="coral" label="Needs preparation" value={prepCount} note="Not marked ready" to="/manager/events" />
        <Metric icon="user-check" tone="mint" label="Checked in" value={checkedIn} note="Recorded attendance" to="/manager/attendance" />
      </div>

      <div className="manager-overview-grid">
        <section className="manager-panel" aria-labelledby="attention-title">
          <PanelHeader id="attention-title" eyebrow="Needs attention" title="Action list" aside={<span className="manager-count">{actionItems.length}</span>} />
          {shownActions.length ? (
            <ul className="manager-action-list">
              {shownActions.map((item) => (
                <li key={item.key}>
                  <Link to={item.to} className="manager-action-item">
                    <span className={`manager-icon-chip manager-icon-chip--${item.tone}`}><Icon name={item.icon} size={16} /></span>
                    <span>{item.text}</span>
                    <Icon name="arrow-right" size={16} className="manager-action-item__go" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="check" title="All clear">Your assignments are up to date.</EmptyState>
          )}
          {actionItems.length > shownActions.length && <p className="manager-muted">+{actionItems.length - shownActions.length} more on the Registrations and Announcements pages.</p>}
        </section>

        <section className="manager-panel" aria-labelledby="sessions-title">
          <PanelHeader
            id="sessions-title"
            eyebrow="Programme"
            title="Upcoming sessions"
            aside={<Link to="/manager/schedule" className="manager-inline-link">Full schedule <Icon name="arrow-right" size={16} /></Link>}
          />
          {nextSessions.length ? (
            <ul className="manager-session-list">
              {nextSessions.map((session) => {
                const event = eventById.get(session.eventId);
                return (
                  <li key={session.id}>
                    <span className="manager-session-list__when">
                      <b>{eventDate(event.date, { month: "short", day: "numeric" })}</b>
                      <time>{formatTime(session.startTime)}</time>
                    </span>
                    <span>
                      <strong>{session.title}</strong>
                      <small>{event.title} · {session.room}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="schedule" title="No sessions yet">Add sessions from an event's Schedule tab.</EmptyState>
          )}
        </section>
      </div>

      <section className="manager-panel" aria-labelledby="activity-title">
        <PanelHeader id="activity-title" eyebrow="Recent activity" title="Event updates" />
        {notifications.length ? (
          <ul className="manager-activity">
            {notifications.slice(0, 6).map((item) => {
              const kind = /feedback/i.test(item.message) ? ["message", "violet"] : /announcement/i.test(item.message) ? ["megaphone", "yellow"] : /registration/i.test(item.message) ? ["user-plus", "blue"] : ["bell", "mint"];
              return (
                <li key={item.id}>
                  <span className={`manager-icon-chip manager-icon-chip--${kind[1]}`}><Icon name={kind[0]} size={16} /></span>
                  <span>
                    {item.message}
                    <small>{eventById.get(item.eventId)?.title} · {relativeDay(item.date)}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon="activity" title="No recent updates" />
        )}
      </section>
    </div>
  );
}
