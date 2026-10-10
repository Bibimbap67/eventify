import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ADMIN_STATUSES, useAdmin } from "../../context/AdminContext.js";
import Icon from "../../components/Icon.js";
import Skeleton from "../../components/Skeleton.js";
import { ConfirmModal } from "../../components/admin/ui.js";
import { DateTile, EmptyState, Metric, PanelHeader, SectionHeading, plural } from "../../components/manager/parts.js";
import { LoadError, ROLES, timeAgo, useApi } from "../../components/admin/parts.js";

const LIVE = ["Approved", "Published"];
const OUTCOME_ICON = { success: ["check", "mint"], failed: ["alert", "yellow"], denied: ["ban", "coral"] };

// Platform health at a glance. Account, registration and activity numbers are counted by the
// server (GET /api/admin/overview); event numbers come from the same event list the Events page
// edits, so approving from here updates every count at once.
export default function AdminDashboard() {
  const { db, settings, update, toast } = useAdmin();
  const { data, error, loading, reload } = useApi("/admin/overview");
  const [rejecting, setRejecting] = useState(null);

  const pending = db.events.filter((event) => event.status === "Pending").sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const live = db.events.filter((event) => LIVE.includes(event.status)).length;
  const byStatus = ADMIN_STATUSES.map((status) => [status, db.events.filter((event) => event.status === status).length]);
  const users = data?.users;
  const registrations = data?.registrations;
  const checkInRate = registrations?.confirmed ? Math.round((registrations.checkedIn / registrations.confirmed) * 100) : 0;

  function approve(event) {
    update("events", event.id, { status: "Approved" });
    toast(`${event.title} approved.`);
  }

  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Platform overview"
        title="Platform health"
        detail={`${settings.orgName}${settings.academicTerm ? ` · ${settings.academicTerm}` : ""}. Counts are live from the database.`}
        action={(
          <button type="button" className="manager-button" onClick={reload} disabled={loading} aria-busy={loading || undefined}>
            <Icon name="refresh" size={16} /> Refresh
          </button>
        )}
      />

      {error && <LoadError message={error} onRetry={reload} />}

      {data ? (
        <div className="manager-metrics">
          <Metric icon="users" tone="blue" label="Accounts" value={users.total} note={users.new30d ? `${users.new30d} new in the last 30 days` : "No new accounts in 30 days"} to="/admin/users" />
          <Metric icon="hourglass" tone="coral" label="Waiting for approval" value={pending.length} note="Events submitted by managers" to="/admin/events?status=Pending" />
          <Metric icon="calendar-days" tone="yellow" label="Live events" value={live} note="Approved or open for registration" to="/admin/events" />
          <Metric icon="ticket" tone="mint" label="Confirmed registrations" value={registrations.confirmed} note={`${registrations.checkedIn} checked in (${checkInRate}%)`} to="/admin/reports" />
        </div>
      ) : (
        !error && (
          <div className="manager-metrics" aria-busy="true" aria-label="Loading">
            {[1, 2, 3, 4].map((key) => <Skeleton key={key} className="skeleton--stat" />)}
          </div>
        )
      )}

      <div className="admin-grid">
        <div className="admin-stack">
          <section className="manager-panel" aria-labelledby="queue-title">
            <PanelHeader
              id="queue-title"
              eyebrow="Needs a decision"
              title="Awaiting approval"
              aside={<span className="manager-count">{pending.length}</span>}
            />
            {pending.length ? (
              <>
                <ul className="admin-queue">
                  {pending.slice(0, 5).map((event) => (
                    <li key={event.id}>
                      {event.date ? <DateTile date={event.date} /> : <span className="manager-icon-chip"><Icon name="calendar" size={16} /></span>}
                      <span>
                        <strong>{event.title}</strong>
                        <small>{[event.organizer, event.venue, event.capacity && `${event.capacity} seats`].filter(Boolean).join(" · ")}</small>
                      </span>
                      <span className="manager-row-buttons">
                        <button type="button" className="manager-button manager-button--small manager-button--go" onClick={() => approve(event)}>
                          <Icon name="check" size={16} /> Approve
                        </button>
                        <button type="button" className="manager-text-button manager-text-button--danger" onClick={() => setRejecting(event)}>
                          Reject
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="manager-muted">
                  Approving a manager's event opens registration right away.{" "}
                  {pending.length > 5 && <Link className="manager-inline-link" to="/admin/events?status=Pending">See all {pending.length}</Link>}
                </p>
              </>
            ) : (
              <EmptyState icon="check" title="Nothing waiting">New events from managers show up here.</EmptyState>
            )}
          </section>
          <section className="manager-panel" aria-labelledby="attendance-title">
            <PanelHeader id="attendance-title" eyebrow="Oversight" title="Registrations" aside={<Link to="/admin/reports" className="manager-inline-link">Reports <Icon name="arrow-right" size={16} /></Link>} />
            {registrations ? (
              <dl className="manager-definition-list">
                <div><dt>Confirmed</dt><dd>{registrations.confirmed}</dd></div>
                <div><dt>Checked in</dt><dd>{registrations.checkedIn} ({checkInRate}% of confirmed)</dd></div>
                <div><dt>Pending</dt><dd>{registrations.pending}</dd></div>
                <div><dt>Cancelled</dt><dd>{registrations.cancelled}</dd></div>
                <div><dt>Certificates</dt><dd>{plural(data.certificates, "issued certificate")}</dd></div>
                <div><dt>Venues</dt><dd>{data.venues}</dd></div>
              </dl>
            ) : !error && <Skeleton className="skeleton--panel" />}
          </section>
        </div>

        <section className="manager-panel" aria-labelledby="activity-title">
          <PanelHeader
            id="activity-title"
            eyebrow="Audit log"
            title="Recent admin activity"
            aside={<Link to="/admin/audit-logs" className="manager-inline-link">Open log <Icon name="arrow-right" size={16} /></Link>}
          />
          {!data && !error && <Skeleton className="skeleton--panel" />}
          {data && (data.recentActivity.length ? (
            <ul className="manager-activity admin-activity">
              {data.recentActivity.map((item) => {
                const [icon, tone] = OUTCOME_ICON[item.outcome || "success"] || OUTCOME_ICON.success;
                return (
                  <li key={item.id}>
                    <span className={`manager-icon-chip manager-icon-chip--${tone}`} aria-hidden="true"><Icon name={icon} size={16} /></span>
                    <span>
                      {item.action}{item.record ? `: ${item.record}` : ""}
                      {item.outcome && item.outcome !== "success" && <> <b className={`admin-outcome admin-outcome--${item.outcome}`}>{item.outcome}</b></>}
                      <small>{item.admin} · {timeAgo(item.createdAt)}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="history" title="No admin activity yet">Changes to users, events, venues and settings are recorded here.</EmptyState>
          ))}
        </section>
      </div>

      <div className="admin-grid">
        <section className="manager-panel" aria-labelledby="roles-title">
          <PanelHeader id="roles-title" eyebrow="Accounts" title="Users by role" aside={<Link to="/admin/users" className="manager-inline-link">Manage <Icon name="arrow-right" size={16} /></Link>} />
          {users ? (
            <>
              <Bars rows={[...ROLES].reverse().map((role) => [role.many, users.roles[role.value] || 0, `/admin/users?role=${role.value}`])} />
              <p className="manager-muted admin-bars-note">
                {plural(users.active, "active account")} ·{" "}
                <Link className="manager-inline-link" to="/admin/users?status=inactive">{users.inactive} inactive</Link>
              </p>
            </>
          ) : !error && <Skeleton className="skeleton--panel" />}
        </section>

        <section className="manager-panel" aria-labelledby="pipeline-title">
          <PanelHeader id="pipeline-title" eyebrow="Events" title="Events by status" aside={<span className="manager-muted">{plural(db.events.length, "event")}</span>} />
          <Bars rows={byStatus.map(([status, count]) => [status, count, `/admin/events?status=${status}`])} />
        </section>
      </div>

      {rejecting && (
        <ConfirmModal
          title="Reject event?"
          message={`${rejecting.title} won't be published and nobody can register.${rejecting.scope === "manager" ? " Its manager sees it as rejected in their workspace." : ""}`}
          confirmText="Reject event"
          onCancel={() => setRejecting(null)}
          onConfirm={() => {
            update("events", rejecting.id, { status: "Rejected" });
            toast(`${rejecting.title} rejected.`);
            setRejecting(null);
          }}
        />
      )}
    </div>
  );
}

// Labelled bars, one color: the label says what each row is and the number says how many.
function Bars({ rows }) {
  const max = Math.max(1, ...rows.map(([, count]) => count));
  return (
    <ul className="admin-bars">
      {rows.map(([label, count, to]) => (
        <li key={label}>
          <Link to={to}>{label}</Link>
          <span className="admin-bars__track" aria-hidden="true"><span style={{ "--fill": `${(count / max) * 100}%` }} /></span>
          <b>{count}</b>
        </li>
      ))}
    </ul>
  );
}
