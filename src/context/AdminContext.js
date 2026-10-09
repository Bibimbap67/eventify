import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext.js";
import { useEventContext } from "./EventContext.js";
import { useManager } from "./ManagerContext.js";
import { api, newId } from "../api.js";
import { useServerStore } from "./useServerStore.js";

const Ctx = createContext(null);

// State key -> MongoDB-backed API resource (see server/controllers/dataController.js).
const ADMIN_RESOURCES = {
  venues: "venues",
  sessions: "sessions",
  announcements: "announcements",
  feedback: "feedback",
  auditLogs: "audit-logs",
};

function emptyAdminData() {
  return { venues: [], sessions: [], announcements: [], feedback: [], auditLogs: [] };
}

// Admin > Users labels <-> the role/status values stored on the user document.
const ROLE_LABELS = { admin: "Admin", manager: "Event Manager", staff: "Staff", user: "Attendee" };
const ROLE_VALUES = Object.fromEntries(Object.entries(ROLE_LABELS).map(([value, label]) => [label, value]));

function toUserPayload(row) {
  const payload = {};
  ["name", "email", "password"].forEach((key) => {
    if (row[key] !== undefined && row[key] !== "") payload[key] = row[key];
  });
  if (row.role !== undefined) payload.role = ROLE_VALUES[row.role] || row.role;
  if (row.status !== undefined) payload.status = String(row.status).toLowerCase();
  return payload;
}

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

function toAdminEvent(event) {
  return {
    ...event,
    date: event.adminDate || "",
    start: event.adminStart || "",
    end: event.adminEnd || "",
    status: ADMIN_STATUS[event.status] || event.status,
  };
}

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

function toManagerAdminEvent(event) {
  return {
    ...event,
    date: event.date || "",
    start: event.startTime || "",
    end: event.endTime || "",
    status: MANAGER_ADMIN_STATUS[event.status] || event.status,
  };
}

function toAdminRegistration(registration) {
  return {
    ...registration,
    date: registration.registrationDate || registration.date || "",
    checkedInAt: registration.checkedInAt || null,
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

export const initialSettings = {
  orgName: "School of Information Technology",
  portalTitle: "Eventify Portal",
  contactEmail: "events@nu-moa.edu.ph",
  timezone: "Asia/Manila (GMT+8)",
  academicTerm: "1st Term AY 2026-2027",
  defaultCapacity: 100,
  autoConfirmRegistrations: false,
  allowWaitlist: true,
  strictDoubleBooking: true,
  requireApproval: true,
  emailReminders: true,
  notifyOnPendingApproval: true,
  autoIssueCertificates: false,
};

export function AdminProvider({ children }) {
  const { user, accounts, createAccount, updateAccount, deleteAccount } = useAuth();
  const manager = useManager();
  const {
    allEvents, allRegistrations, allCertificates,
    updateEvent, addEvent, deleteEvent, deleteCertificate, updateRegistration, addRegistration, deleteRegistration,
    resetToDefaultSeed,
  } = useEventContext();
  const { data: collections, setData: setCollections } = useServerStore(ADMIN_RESOURCES, user?.id || "guest");
  const [settings, setSettings] = useState(initialSettings);
  const [toastMsg, setToastMsg] = useState("");

  // Settings live in one MongoDB document; the defaults apply until an admin saves once.
  useEffect(() => {
    api("/settings")
      .then((res) => setSettings({ ...initialSettings, ...res.settings }))
      .catch(() => {});
  }, []);

  const db = {
    ...collections,
    events: [...allEvents.map(toAdminEvent), ...manager.allManagerEvents.map(toManagerAdminEvent)],
    registrations: [...allRegistrations, ...manager.allManagerRegistrations].map(toAdminRegistration),
    users: accounts.map((account) => ({
      ...account,
      status: account.status === "inactive" ? "Inactive" : "Active",
      role: ROLE_LABELS[account.role] || "Attendee",
    })),
    certificates: allCertificates.map((certificate) => ({
      ...certificate,
      name: certificate.recipientName,
      date: certificate.issueDate,
    })),
  };

  const toast = useCallback((m) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(""), 2500);
  }, []);

  const update = useCallback((coll, id, patch) => {
    if (coll === "users") {
      updateAccount(id, toUserPayload(patch)).catch((err) => toast(err.message));
      return;
    }
    if (coll === "events") {
      if (manager.allManagerEvents.some((event) => event.id === id)) {
        manager.updateEvent(id, toManagerEventPatch(patch, collections.venues));
        return;
      }
      updateEvent(id, toPublicEventPatch(patch, collections.venues));
      return;
    }
    if (coll === "registrations") {
      const registrationPatch = { ...patch };
      if (Object.hasOwn(patch, "date")) {
        registrationPatch.registrationDate = patch.date;
        delete registrationPatch.date;
      }
      if (Object.hasOwn(patch, "status")) {
        registrationPatch.attendanceStatus = patch.status === "Cancelled" ? "Not Checked In" : undefined;
        if (registrationPatch.attendanceStatus === undefined) delete registrationPatch.attendanceStatus;
      }
      if (manager.allManagerRegistrations.some((registration) => registration.id === id)) manager.updateRegistration(id, registrationPatch);
      else updateRegistration(id, registrationPatch);
      return;
    }
    setCollections((current) => ({
      ...current,
      [coll]: (current[coll] || []).map((record) => record.id === id ? { ...record, ...patch } : record),
    }));
  }, [collections.venues, manager, setCollections, toast, updateAccount, updateEvent, updateRegistration]);

  const add = useCallback((coll, row) => {
    if (coll === "users") {
      createAccount(toUserPayload(row)).catch((err) => toast(err.message));
      return row;
    }
    const id = row.id || newId(coll);
    const newRecord = { ...row, id };
    if (coll === "events") {
      addEvent(makePublicEvent(newRecord, collections.venues));
    } else if (coll === "registrations") {
      const account = accounts.find((item) => item.email.toLowerCase() === String(row.email).toLowerCase());
      addRegistration({
        ...newRecord,
        userId: account?.id,
        eventTitle: allEvents.find((event) => event.id === row.eventId)?.title || "",
        registrationDate: row.date,
        attendanceStatus: "Not Checked In",
        checkedInAt: null,
      });
    } else {
      setCollections((current) => ({
        ...current,
        [coll]: [newRecord, ...(current[coll] || [])],
      }));
    }
    return newRecord;
  }, [accounts, addEvent, addRegistration, allEvents, collections.venues, createAccount, setCollections, toast]);

  const remove = useCallback((coll, id) => {
    if (coll === "users") {
      deleteAccount(id).catch((err) => toast(err.message));
      return;
    }
    if (coll === "events") {
      if (manager.allManagerEvents.some((event) => event.id === id)) manager.deleteEvent(id);
      deleteEvent(id);
      return;
    }
    if (coll === "certificates") {
      deleteCertificate(id);
      return;
    }
    if (coll === "registrations") {
      if (manager.allManagerRegistrations.some((registration) => registration.id === id)) {
        manager.updateRegistration(id, { status: "Cancelled", attendanceStatus: "Not checked in", checkedInAt: "" });
      } else deleteRegistration(id);
      return;
    }
    setCollections((current) => ({
      ...current,
      [coll]: (current[coll] || []).filter((record) => record.id !== id),
    }));
  }, [deleteAccount, deleteCertificate, deleteEvent, deleteRegistration, manager, setCollections, toast]);

  const logAction = useCallback((action, record, admin = "System") => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5);
    const time = `${dateStr} ${timeStr}`;
    setCollections((current) => ({
      ...current,
      auditLogs: [
        {
          id: newId("log"),
          action,
          admin: user?.name || admin,
          record: String(record || "System"),
          time,
        },
        ...(current.auditLogs || []),
      ],
    }));
  }, [setCollections, user]);

  const saveSettings = useCallback((next) => {
    setSettings(next);
    api("/settings", { method: "PUT", body: next }).catch((err) => toast(err.message));
  }, [toast]);

  const updateSettings = useCallback((patch) => {
    saveSettings({ ...settings, ...patch });
  }, [saveSettings, settings]);

  const resetDb = useCallback(() => {
    resetToDefaultSeed();
    setCollections(emptyAdminData());
    saveSettings(initialSettings);
  }, [resetToDefaultSeed, saveSettings, setCollections]);

  const clearAuditLogs = useCallback(() => {
    setCollections((current) => ({ ...current, auditLogs: [] }));
  }, [setCollections]);

  const venueName = useCallback(
    (id, eventId) => db.venues.find((v) => v.id === id)?.name || db.events.find((event) => event.id === eventId)?.venue || "—",
    [db.events, db.venues]
  );

  const eventTitle = useCallback(
    (id) => db.events.find((e) => e.id === id)?.title || "—",
    [db.events]
  );

  const registered = useCallback(
    (eventId) =>
      (db.registrations || []).filter((r) => r.eventId === eventId && r.status !== "Cancelled").length,
    [db.registrations]
  );

  return (
    <Ctx.Provider
      value={{
        db,
        settings,
        updateSettings,
        resetDb,
        clearAuditLogs,
        update,
        add,
        remove,
        logAction,
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
