import React from "react";
import { Link } from "react-router-dom";
import { useAdmin } from "../../context/AdminContext.js";
import { StatusBadge } from "../../components/admin/ui.js";
import Icon from "../../components/Icon.js";
import { CountUp } from "../../components/Motion.js";

const STATUSES = ["Pending", "Approved", "Published", "Completed", "Rejected", "Cancelled", "Archived"];

export default function AdminDashboard() {
  const { db, eventTitle, registered, update, toast } = useAdmin();
  const upcoming = db.events.filter((e) => ["Approved", "Published"].includes(e.status));
  const pending = db.events.filter((e) => e.status === "Pending");
  const stats = [
    ["Total events", db.events.length], ["Upcoming", upcoming.length],
    ["Registrations", db.registrations.filter((r) => r.status !== "Cancelled").length], ["Pending approvals", pending.length],
  ];
  const max = Math.max(1, ...STATUSES.map((s) => db.events.filter((e) => e.status === s).length));

  return (
    <>
      <div className="stats">
        {stats.map(([l, v]) => (
          <div className="stat" key={l}><span className="stat__label">{l}</span><strong><CountUp value={v} /></strong></div>
        ))}
      </div>
      <div className="grid-2">
        <section className="panel">
          <h2>Awaiting approval</h2>
          {pending.length === 0 && <p className="empty">Nothing pending.</p>}
          {pending.map((e) => (
            <div className="row" key={e.id}>
              <span>{e.title}<small>{e.organizer} · {e.date}</small></span>
              <button className="btn-sm btn-sm--yellow" onClick={() => { update("events", e.id, { status: "Approved" }); toast(`${e.title} approved.`); }}>Approve</button>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Event status overview</h2>
          {STATUSES.map((s) => {
            const n = db.events.filter((e) => e.status === s).length;
            return (
              <div className="bar" key={s}>
                <span>{s}</span><div className="bar__track"><div className="bar__fill" style={{ width: `${(n / max) * 100}%` }} /></div><b>{n}</b>
              </div>
            );
          })}
        </section>
        <section className="panel">
          <h2>Upcoming events</h2>
          {upcoming.map((e) => (
            <div className="row" key={e.id}><span>{e.title}<small>{e.date} · {registered(e.id)}/{e.capacity} registered</small></span><StatusBadge value={e.status} /></div>
          ))}
        </section>
        <section className="panel">
          <h2>Recent registrations</h2>
          {[...db.registrations].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((r) => (
            <div className="row" key={r.id}><span>{r.name}<small>{eventTitle(r.eventId)} · {r.date}</small></span><StatusBadge value={r.status} /></div>
          ))}
          <Link className="link" to="/admin/registrations">All registrations <Icon name="arrow-right" size={16} /></Link>
        </section>
      </div>
    </>
  );
}
