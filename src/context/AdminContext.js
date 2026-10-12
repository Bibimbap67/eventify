import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext.js";
import { useEventContext } from "./EventContext.js";
import { useManager } from "./ManagerContext.js";
import { api, newId } from "../api.js";
import { useServerStore } from "./useServerStore.js";
import { notify } from "../components/Toast.js";
import { adminStatus } from "../data/eventStatus.js";

const Ctx = createContext(null);

// Venues are the only collection the admin area keeps in memory itself. Events and registrations
// come from ManagerContext, certificates from EventContext. Users, reports and the audit log
// are read a page at a time from /api/users and /api/admin, and the server writes the audit log.
const ADMIN_RESOURCES = { venues: "venues" };

// Every event is saved the same way, whether a manager or an admin made it. The admin screens
// show it with their own status words and start / end fields.
function toAdminEvent(event) {
  return {
    ...event,
    date: event.date || "",
    start: event.startTime || "",
    end: event.endTime || "",
    status: adminStatus(event),
  };
}

// The admin form's fields (start, end, venueId, admin status words) as the event saves them.
function toSavedPatch(patch, venues) {
  const { start, end, ...result } = patch;
  if (Object.hasOwn(patch, "start")) result.startTime = start;
  if (Object.hasOwn(patch, "end")) result.endTime = end;
  if (Object.hasOwn(patch, "venueId")) {
    const venue = venues.find((item) => item.id === patch.venueId);
    if (venue) result.venue = venue.name;
  }
  // Approving an event opens registration straight away.
  if (Object.hasOwn(patch, "status")) result.status = ["Approved", "Published"].includes(patch.status) ? "Registration Open" : patch.status;
  return result;
}

// What the admin's short Create event form leaves out, so the public pages have something to show.
const ADMIN_EVENT_DEFAULTS = {
  category: "Academic",
  description: "Event details will be provided by the organizer.",
  requirements: "",
  speakers: [],
  createdByAdmin: true,
};

// What the Settings page edits. Each one is used: the organization and term head the admin
// sidebar, and the capacity pre-fills new events. The server refuses any other key.
export const initialSettings = {
  orgName: "National University - Mall of Asia",
  academicTerm: "1st Term AY 2026-2027",
  defaultCapacity: 100,
};

export function AdminProvider({ children }) {
  const { user } = useAuth();
  const manager = useManager();
  const { allCertificates } = useEventContext();
  const { data: collections, setData: setCollections, ready: venuesReady } = useServerStore(ADMIN_RESOURCES, user?.id || "guest");
  const [settings, setSettings] = useState(initialSettings);

  // Settings live in one MongoDB document; the defaults apply until an admin saves once.
  useEffect(() => {
    api("/settings")
      .then((res) => setSettings({ ...initialSettings, ...res.settings }))
      .catch(() => {});
  }, []);

  const db = {
    venues: collections.venues,
    events: manager.allManagerEvents.map(toAdminEvent),
    registrations: manager.allManagerRegistrations,
    certificates: allCertificates,
  };

  const update = useCallback((coll, id, patch) => {
    if (coll === "events") {
      manager.updateEvent(id, toSavedPatch(patch, collections.venues));
      return;
    }
    setCollections((current) => ({
      ...current,
      [coll]: (current[coll] || []).map((record) => record.id === id ? { ...record, ...patch } : record),
    }));
  }, [collections.venues, manager, setCollections]);

  const add = useCallback((coll, row) => {
    // An admin's event belongs to the admin, so it never shows in a manager's workspace.
    if (coll === "events") return manager.createEvent({ ...ADMIN_EVENT_DEFAULTS, ...toSavedPatch(row, collections.venues) });
    const record = { ...row, id: row.id || newId(coll) };
    setCollections((current) => ({ ...current, [coll]: [record, ...(current[coll] || [])] }));
    return record;
  }, [collections.venues, manager, setCollections]);

  const remove = useCallback((coll, id) => {
    if (coll === "events") {
      manager.deleteEvent(id);
      return;
    }
    setCollections((current) => ({
      ...current,
      [coll]: (current[coll] || []).filter((record) => record.id !== id),
    }));
  }, [manager, setCollections]);

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
        toast: notify,
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
