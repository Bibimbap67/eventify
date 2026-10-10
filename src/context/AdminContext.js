import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext.js";
import { useEventContext } from "./EventContext.js";
import { useManager } from "./ManagerContext.js";
import { api, newId } from "../api.js";
import { useServerStore } from "./useServerStore.js";

const Ctx = createContext(null);

// Venues are the only collection the admin area keeps in memory itself. Events, registrations
// and certificates come from EventContext and ManagerContext. Users, reports and the audit log
// are read a page at a time from /api/users and /api/admin, and the server writes the audit log.
const ADMIN_RESOURCES = { venues: "venues" };

const PUBLIC_STATUS = {
  Pending: "PENDING",
  Approved: "OPENS SOON",
  Published: "REGISTRATION OPEN",
  Completed: "COMPLETED",
  Rejected: "REJECTED",
  Cancelled: "CANCELLED",
  Archived: "ARCHIVED",
};
const ADMIN_STATUS = Object.fromEntries(Object.entries(PUBLIC_STATUS).map(([admin, attendee]) => [attendee, admin]));

const MANAGER_ADMIN_STATUS = {
  "Pending Approval": "Pending",
  Pending: "Pending",
  Approved: "Approved",
  Published: "Published",
  "Registration Open": "Published",
  "Registration Closed": "Published",
  Ongoing: "Published",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export const ADMIN_STATUSES = Object.keys(PUBLIC_STATUS);

// Admin-created and manager-created events store their status in different words.
export const adminStatus = (event) => (event.scope === "admin"
  ? ADMIN_STATUS[event.status] || event.status
  : MANAGER_ADMIN_STATUS[event.status] || event.status);

function toAdminEvent(event) {
  return {
    ...event,
    date: event.adminDate || "",
    start: event.adminStart || "",
    end: event.adminEnd || "",
    status: ADMIN_STATUS[event.status] || event.status,
  };
}

function toManagerAdminEvent(event) {
  return {
    ...event,
    date: event.date || "",
    start: event.startTime || "",
    end: event.endTime || "",
    status: MANAGER_ADMIN_STATUS[event.status] || event.status,
  };
}

function formatEventDate(date) {
  if (!date) return "";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).toUpperCase();
}

function toPublicEventPatch(patch, venues) {
  const result = { ...patch };
  if (Object.hasOwn(patch, "date")) {
    result.adminDate = patch.date;
    result.date = formatEventDate(patch.date);
    result.fullDate = patch.date ? new Date(`${patch.date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    }) : "";
  }
  if (Object.hasOwn(patch, "start")) result.adminStart = patch.start;
  if (Object.hasOwn(patch, "end")) result.adminEnd = patch.end;
  if (Object.hasOwn(patch, "start") || Object.hasOwn(patch, "end")) {
    const start = patch.start ?? "";
    const end = patch.end ?? "";
    result.startTime = start;
    result.endTime = end;
    result.time = start && end ? `${start} - ${end}` : start || end;
  }
  if (Object.hasOwn(patch, "venueId")) {
    const venue = venues.find((item) => item.id === patch.venueId);
    if (venue) {
      result.location = venue.name.toUpperCase();
      result.fullLocation = `${venue.name} · ${venue.location}`;
    }
  }
  if (Object.hasOwn(patch, "status")) result.status = PUBLIC_STATUS[patch.status] || patch.status;
  return result;
}

function toManagerEventPatch(patch, venues) {
  const result = { ...patch };
  if (Object.hasOwn(patch, "start")) result.startTime = patch.start;
  if (Object.hasOwn(patch, "end")) result.endTime = patch.end;
  if (Object.hasOwn(patch, "venueId")) {
    const venue = venues.find((item) => item.id === patch.venueId);
    if (venue) result.venue = venue.name;
  }
  if (Object.hasOwn(patch, "status")) result.status = ["Approved", "Published"].includes(patch.status) ? "Registration Open" : patch.status;
  return result;
}

function makePublicEvent(event, venues) {
  const venue = venues.find((item) => item.id === event.venueId);
  return {
    ...toPublicEventPatch(event, venues),
    id: event.id,
    category: "Academic",
    status: PUBLIC_STATUS[event.status] || "PENDING",
    featured: false,
    accent: "var(--color-blue)",
    heroBg: "var(--color-yellow)",
    image: "",
    description: "Event details will be provided by the organizer.",
    fullDate: event.date ? new Date(`${event.date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    }) : "",
    date: formatEventDate(event.date),
    time: `${event.start || ""} - ${event.end || ""}`,
    startTime: event.start || "",
    endTime: event.end || "",
    location: venue?.name.toUpperCase() || "LOCATION TO BE ANNOUNCED",
    fullLocation: venue ? `${venue.name} · ${venue.location}` : "Location to be announced",
    registered: 0,
    requirements: "",
    speakers: [],
    agenda: [],
  };
}

// What the Settings page edits. Each one is used: the organization and term head the admin
// sidebar, and the capacity pre-fills new events. The server refuses any other key.
export const initialSettings = {
  orgName: "School of Information Technology",
  academicTerm: "1st Term AY 2026-2027",
  defaultCapacity: 100,
};

export function AdminProvider({ children }) {
  const { user } = useAuth();
  const manager = useManager();
  const { allEvents, allRegistrations, allCertificates, updateEvent, addEvent, deleteEvent } = useEventContext();
  const { data: collections, setData: setCollections, ready: venuesReady } = useServerStore(ADMIN_RESOURCES, user?.id || "guest");
  const [settings, setSettings] = useState(initialSettings);
  const [toastMsg, setToastMsg] = useState("");

  // Settings live in one MongoDB document; the defaults apply until an admin saves once.
  useEffect(() => {
    api("/settings")
      .then((res) => setSettings({ ...initialSettings, ...res.settings }))
      .catch(() => {});
  }, []);

  const db = {
    venues: collections.venues,
    events: [...allEvents.map(toAdminEvent), ...manager.allManagerEvents.map(toManagerAdminEvent)],
    registrations: [...allRegistrations, ...manager.allManagerRegistrations],
    certificates: allCertificates,
  };

  const toast = useCallback((m) => {
    setToastMsg(m);
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => setToastMsg(""), 2600);
  }, []);

  const update = useCallback((coll, id, patch) => {
    if (coll === "events") {
      if (manager.allManagerEvents.some((event) => event.id === id)) manager.updateEvent(id, toManagerEventPatch(patch, collections.venues));
      else updateEvent(id, toPublicEventPatch(patch, collections.venues));
      return;
    }
    setCollections((current) => ({
      ...current,
      [coll]: (current[coll] || []).map((record) => record.id === id ? { ...record, ...patch } : record),
    }));
  }, [collections.venues, manager, setCollections, updateEvent]);

  const add = useCallback((coll, row) => {
    const record = { ...row, id: row.id || newId(coll) };
    if (coll === "events") addEvent(makePublicEvent(record, collections.venues));
    else setCollections((current) => ({ ...current, [coll]: [record, ...(current[coll] || [])] }));
    return record;
  }, [addEvent, collections.venues, setCollections]);

  const remove = useCallback((coll, id) => {
    if (coll === "events") {
      if (manager.allManagerEvents.some((event) => event.id === id)) manager.deleteEvent(id);
      deleteEvent(id);
      return;
    }
    setCollections((current) => ({
      ...current,
      [coll]: (current[coll] || []).filter((record) => record.id !== id),
    }));
  }, [deleteEvent, manager, setCollections]);

  // Resolves with the saved settings, or rejects with the server's message (shown by the form).
  const saveSettings = useCallback(async (values) => {
    const res = await api("/settings", { method: "PUT", body: values });
    setSettings({ ...initialSettings, ...res.settings });
  }, []);

  const venueName = useCallback(
    (id, eventId) => db.venues.find((v) => v.id === id)?.name || db.events.find((event) => event.id === eventId)?.venue || "—",
    [db.events, db.venues]
  );

  const eventTitle = useCallback(
    (id) => db.events.find((e) => e.id === id)?.title || "—",
    [db.events]
  );

  const registered = useCallback(
    (eventId) => db.registrations.filter((r) => r.eventId === eventId && r.status !== "Cancelled").length,
    [db.registrations]
  );

  return (
    <Ctx.Provider
      value={{
        db,
        venuesReady,
        settings,
        saveSettings,
        update,
        add,
        remove,
        toast,
        toastMsg,
        venueName,
        eventTitle,
        registered,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAdmin = () => useContext(Ctx);
