import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.js";
import { api, newId, newEventId } from "../api.js";
import { useServerStore } from "./useServerStore.js";
import { notify } from "../components/Toast.js";
import { checkInOpensAt, eventEndsAt } from "../data/checkIn.js";
import { LIVE_STATUSES } from "../data/eventStatus.js";

const ManagerContext = createContext(null);
// State key -> MongoDB-backed API resource (see server/controllers/dataController.js).
// These hold every event and its records, whether a manager or an admin made it.
const MANAGER_RESOURCES = {
  events: "manager-events",
  registrations: "manager-registrations",
  sessions: "manager-sessions",
  announcements: "manager-announcements",
  feedback: "manager-feedback",
  notifications: "manager-notifications",
};

export function ManagerProvider({ children }) {
  const { user } = useAuth();
  const { data, setData, loaded, reload } = useServerStore(MANAGER_RESOURCES, user?.id || "guest");
  const [venues, setVenues] = useState([]);

  // Managers pick from the venues the admin set up. Venue pickers re-read the list when they
  // open, so a venue the admin just added shows up without reloading the page.
  const loadVenues = useCallback(() => {
    if (!user || user.role === "user") {
      setVenues([]);
      return;
    }
    api("/data/venues")
      .then((res) => setVenues(res.items.map((venue) => venue.name)))
      .catch(() => {}); // keep the list we already have
  }, [user]);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  // The server marks an event Completed once its end time passes (server/utils/autoComplete.js).
  // Reload just after the next one starts (shown as Ongoing) or ends, so open screens show it
  // without a page refresh.
  useEffect(() => {
    const ends = data.events
      .filter((event) => LIVE_STATUSES.includes(event.status))
      .flatMap((event) => [checkInOpensAt(event)?.getTime(), eventEndsAt(event)?.getTime()])
      .filter((end) => end > Date.now());
    if (!ends.length) return undefined;
    const timer = setTimeout(reload, Math.min(Math.min(...ends) - Date.now() + 5000, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [data.events, reload]);

  const managerId = user?.managerId || user?.id;
  const events = useMemo(() => data.events.filter((event) => event.managerId === managerId), [data.events, managerId]);
  const eventIds = useMemo(() => new Set(events.map((event) => event.id)), [events]);
  const scoped = useMemo(() => ({
    events,
    eventIds,
    registrations: data.registrations.filter((item) => eventIds.has(item.eventId)),
    venues,
    sessions: data.sessions.filter((item) => eventIds.has(item.eventId)),
    announcements: data.announcements.filter((item) => eventIds.has(item.eventId)),
    feedback: data.feedback.filter((item) => eventIds.has(item.eventId)),
    notifications: data.notifications.filter((item) => eventIds.has(item.eventId)),
  }), [data, eventIds, events, venues]);

  // UPDATE EVENT
  const updateEvent = useCallback((eventId, patch) => {
    setData((current) => ({ ...current, events: current.events.map((event) => event.id === eventId ? { ...event, ...patch } : event) }));
  }, [setData]);

  // CREATE EVENT
  const createEvent = useCallback((event) => {
    const newEvent = {
      ...event,
      id: newEventId(event.title),
      managerId,
      status: "Pending",
      preparationStatus: "Needs attention",
      completedAt: null,
    };
    setData((current) => ({ ...current, events: [newEvent, ...current.events] }));
    return newEvent;
  }, [managerId, setData]);

  // DELETE EVENT
  // The server deletes the event's registrations, sessions and the rest with it (afterRemove in
  // dataController.js); screens only list records of events that still exist.
  const deleteEvent = useCallback((eventId) => {
    setData((current) => ({ ...current, events: current.events.filter((event) => event.id !== eventId) }));
  }, [setData]);

  // UPDATE REGISTRATION
  const updateRegistration = useCallback((registrationId, patch) => {
    setData((current) => ({ ...current, registrations: current.registrations.map((item) => item.id === registrationId ? { ...item, ...patch } : item) }));
  }, [setData]);

  // CREATE FEEDBACK
  const submitAttendeeFeedback = useCallback((registrationId, response) => {
    const registration = data.registrations.find((item) => item.id === registrationId);
    if (!registration) return false;
    const feedback = {
      id: newId("mf"),
      eventId: registration.eventId,
      participant: registration.name,
      rating: response.overall,
      organizationRating: response.organization,
      speakerRating: response.speaker,
      venueRating: response.venue,
      comment: response.comment,
      date: new Date().toISOString().slice(0, 10),
    };
    setData((current) => ({
      ...current,
      feedback: [feedback, ...current.feedback],
      registrations: current.registrations.map((item) => item.id === registrationId ? { ...item, feedback: response } : item),
      notifications: [{ id: newId("mn"), eventId: registration.eventId, message: `New feedback received from ${registration.name}.`, date: new Date().toISOString().slice(0, 10), read: false }, ...current.notifications],
    }));
    return true;
  }, [data.registrations, setData]);

  // CREATE REGISTRATION
  const addAttendeeRegistration = useCallback((registration) => {
    if (!data.events.some((event) => event.id === registration.eventId)) return null;
    const newRegistration = { ...registration };
    setData((current) => ({
      ...current,
      registrations: [newRegistration, ...current.registrations],
      notifications: [{ id: newId("mn"), eventId: registration.eventId, message: `New registration: ${registration.name}`, date: new Date().toISOString().slice(0, 10), read: false }, ...current.notifications],
    }));
    return newRegistration;
  }, [data.events, setData]);

  // CREATE OR UPDATE SESSION
  const saveSession = useCallback((session) => {
    setData((current) => {
      const existing = current.sessions.some((item) => item.id === session.id);
      return { ...current, sessions: existing
        ? current.sessions.map((item) => item.id === session.id && eventIds.has(item.eventId) ? { ...item, ...session } : item)
        : [{ ...session, id: newId("ms") }, ...current.sessions] };
    });
  }, [eventIds, setData]);

  // DELETE SESSION
  const deleteSession = useCallback((sessionId) => {
    setData((current) => ({ ...current, sessions: current.sessions.filter((item) => !eventIds.has(item.eventId) || item.id !== sessionId) }));
  }, [eventIds, setData]);

  // CREATE ANNOUNCEMENT
  const addAnnouncement = useCallback((announcement) => {
    const publishedAt = announcement.status === "Published" ? new Date().toISOString() : "";
    const newAnnouncement = { ...announcement, id: newId("ma"), publishedAt };
    setData((current) => ({
      ...current,
      announcements: [newAnnouncement, ...current.announcements],
      notifications: announcement.status === "Published"
        ? [{ id: newId("mn"), eventId: announcement.eventId, message: `Announcement published: ${announcement.title}`, date: new Date().toISOString().slice(0, 10), read: false }, ...current.notifications]
        : current.notifications,
    }));
  }, [setData]);

  // UPDATE ANNOUNCEMENT
  const updateAnnouncement = useCallback((announcementId, patch) => {
    setData((current) => ({ ...current, announcements: current.announcements.map((item) => item.id === announcementId && eventIds.has(item.eventId) ? { ...item, ...patch, publishedAt: patch.status === "Published" ? new Date().toISOString() : item.publishedAt } : item) }));
  }, [eventIds, setData]);

  // COMPLETE EVENT
  // Attendance isn't touched: only a verified exit (the exit QR, or Mark exited) makes a ticket
  // Attended, and the server issues those certificates as the event completes.
  const completeEvent = useCallback((eventId) => {
    setData((current) => ({
      ...current,
      events: current.events.map((event) => event.id === eventId && event.managerId === managerId
        ? { ...event, status: "Completed", preparationStatus: "Closed out", completedAt: new Date().toISOString().slice(0, 10) }
        : event),
    }));
    notify("Event marked completed.", "success");
  }, [managerId, setData]);

  const value = { ...scoped, allManagerEvents: data.events, allManagerRegistrations: data.registrations, loadedManagerRegistrations: loaded.registrations, allAnnouncements: data.announcements, reloadManagerData: reload, loadVenues, toast: notify, createEvent, deleteEvent, updateEvent, updateRegistration, addAttendeeRegistration, submitAttendeeFeedback, saveSession, deleteSession, addAnnouncement, updateAnnouncement, completeEvent };
  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
}

export function useManager() {
  const context = useContext(ManagerContext);
  if (!context) throw new Error("useManager must be used within a ManagerProvider");
  return context;
}