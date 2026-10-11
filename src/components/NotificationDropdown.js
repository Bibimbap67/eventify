import React from "react";
import { Link } from "react-router-dom";
import { useEventContext } from "../context/EventContext.js";
import { notificationKind } from "../data/options.js";
import Icon from "./Icon.js";

export default function NotificationDropdown({ onClose }) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useEventContext();

  const handleItemClick = (notif) => {
    markNotificationRead(notif.id);
    if (onClose) onClose();
  };

  return (
    <div className="notif-dropdown">
      <div className="notif-dropdown__header">
        <span className="notif-dropdown__title">NOTIFICATIONS</span>
        <button
          type="button"
          className="notif-dropdown__mark-btn"
          onClick={markAllNotificationsRead}
        >
          Mark all read
        </button>
      </div>

      <div className="notif-dropdown__list">
        {notifications.length === 0 ? (
          <p className="notif-dropdown__empty">No notifications yet.</p>
        ) : (
          notifications.slice(0, 5).map((notif) => {
            const kind = notificationKind(notif.type);
            return (
              <Link
                key={notif.id}
                to={notif.link || "/my-events"}
                className={`notif-item ${!notif.read ? "notif-item--unread" : ""}`}
                data-tone={kind.tone}
                onClick={() => handleItemClick(notif)}
              >
                <span className="notif-item__icon" aria-hidden="true"><Icon name={kind.icon} size={18} /></span>
                <div className="notif-item__content">
                  <h5 className="notif-item__title">{notif.title}</h5>
                  <p className="notif-item__message">{notif.message}</p>
                  <span className="notif-item__time">
                    {notif.time}
                    {!notif.read && <b className="notif-unread-pill">NEW</b>}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="notif-dropdown__footer">
        <Link to="/notifications" onClick={onClose} className="notif-dropdown__view-all">
          View all notifications <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </div>
  );
}
