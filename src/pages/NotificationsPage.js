import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import Icon from "../components/Icon.js";
import { useEventContext } from "../context/EventContext.js";

export default function NotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useEventContext();
  const [filter, setFilter] = useState("all"); // "all" | "unread"

  const filteredNotifs = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="notifications-page">
      <Navbar />

      <main className="notifications-container">
        {/* Header */}
        <div className="notifications-header">
          <div>
            <span className="events-hero__eyebrow">ACTIVITY & UPDATES</span>
            <h1 className="notifications-title">NOTIFICATIONS</h1>
            <p className="notifications-subtitle">
              Real-time alerts regarding ticket confirmations, check-in updates, certificates, and schedule changes.
            </p>
          </div>

          <div className="notifications-header__actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn-sm btn-sm--yellow"
                onClick={markAllNotificationsRead}
              >
                Mark All as Read ({unreadCount})
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="notifications-filter-bar">
          <div className="notif-filters">
            <button
              type="button"
              className={`filter-btn ${filter === "all" ? "filter-btn--active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All Notifications ({notifications.length})
            </button>
            <button
              type="button"
              className={`filter-btn ${filter === "unread" ? "filter-btn--active" : ""}`}
              onClick={() => setFilter("unread")}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        {/* List */}
        {filteredNotifs.length === 0 ? (
          <div className="empty-events-box" style={{ marginTop: "24px" }}>
            <span className="empty-box__icon"><Icon name="bell" size={28} /></span>
            <h3>No notifications to display</h3>
            <p>You're all caught up! Updates regarding your registered campus events will appear here.</p>
          </div>
        ) : (
          <div className="notifications-full-list">
            {filteredNotifs.map((notif) => (
              <div
                key={notif.id}
                className={`notif-card ${!notif.read ? "notif-card--unread" : ""}`}
                onClick={() => markNotificationRead(notif.id)}
              >
                <div className="notif-card__icon">
                  {notif.type === "registration" && <Icon name="ticket" size={20} />}
                  {notif.type === "certificate" && <Icon name="certificate" size={20} />}
                  {notif.type === "attendance" && <Icon name="pin" size={20} />}
                  {notif.type === "reminder" && <Icon name="clock" size={20} />}
                  {notif.type === "feedback" && <Icon name="message" size={20} />}
                </div>

                <div className="notif-card__main">
                  <div className="notif-card__top">
                    <h4 className="notif-card__title">{notif.title}</h4>
                    <span className="notif-card__time">{notif.time}</span>
                  </div>
                  <p className="notif-card__message">{notif.message}</p>

                  <div className="notif-card__footer">
                    <Link
                      to={notif.link || "/my-events"}
                      className="notif-card__action"
                      onClick={() => markNotificationRead(notif.id)}
                    >
                      View Details →
                    </Link>
                    {!notif.read && <span className="notif-unread-pill">NEW</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
