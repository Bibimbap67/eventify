import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.js";
import { api, newId } from "../api.js";
import { useServerStore } from "./useServerStore.js";

const ManagerContext = createContext(null);
// State key -> MongoDB-backed API resource (see server/controllers/dataController.js).
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
  const { data, setData, loaded } = useServerStore(MANAGER_RESOURCES, user?.id || "guest");
  const [venues, setVenues] = useState([]);
  const [toastMessage, setToastMessage] = useState("");

  // Managers pick from the venues the admin set up.
  useEffect(() => {
    if (!user || user.role === "user") {
      setVenues([]);
      return;
    }
    api("/data/venues")
      .then((res) => setVenues(res.items.map((venue) => venue.name)))
      .catch(() => setVenues([]));
  }, [user]);

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

  const toast = useCallback((message) => {
    setToastMessage(message);
    window.clearTimeout(toast.timeoutId);
    toast.timeoutId = window.setTimeout(() => setToastMessage(""), 2400);
  }, []);

  const updateEvent = useCallback((eventId, patch) => {
    setData((current) => ({ ...current, events: current.events.map((event) => event.id === eventId ? { ...event, ...patch } : event) }));
  }, [setData]);

  const createEvent = useCallback((event) => {
    const newEvent = {
      ...event,
      id: newId("manager"),
      managerId,
      status: "Pending",
      preparationStatus: "Needs attention",
      completedAt: null,
    };
    setData((current) => ({ ...current, events: [newEvent, ...current.events] }));
    return newEvent;
  }, [managerId, setData]);

  const deleteEvent = useCallback((eventId) => {
    setData((current) => ({
      ...current,
      events: current.events.filter((event) => event.id !== eventId),
      registrations: current.registrations.filter((registration) => registration.eventId !== eventId),
      sessions: current.sessions.filter((session) => session.eventId !== eventId),
      announcements: current.announcements.filter((announcement) => announcement.eventId !== eventId),
      feedback: current.feedback.filter((item) => item.eventId !== eventId),
      notifications: current.notifications.filter((notification) => notification.eventId !== eventId),
    }));
  }, [setData]);

  const updateRegistration = useCallback((registrationId, patch) => {
    setData((current) => ({ ...current, registrations: current.registrations.map((item) => item.id === registrationId ? { ...item, ...patch } : item) }));
  }, [setData]);

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

  const saveSession = useCallback((session) => {
    setData((current) => {
      const existing = current.sessions.some((item) => item.id === session.id);
      return { ...current, sessions: existing
        ? current.sessions.map((item) => item.id === session.id && eventIds.has(item.eventId) ? { ...item, ...session } : item)
        : [{ ...session, id: newId("ms") }, ...current.sessions] };
    });
  }, [eventIds, setData]);

  const deleteSession = useCallback((sessionId) => {
    setData((current) => ({ ...current, sessions: current.sessions.filter((item) => !eventIds.has(item.eventId) || item.id !== sessionId) }));
  }, [eventIds, setData]);

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

  const updateAnnouncement = useCallback((announcementId, patch) => {
    setData((current) => ({ ...current, announcements: current.announcements.map((item) => item.id === announcementId && eventIds.has(item.eventId) ? { ...item, ...patch, publishedAt: patch.status === "Published" ? new Date().toISOString() : item.publishedAt } : item) }));
  }, [eventIds, setData]);

  const completeEvent = useCallback((eventId) => {
    setData((current) => ({
      ...current,
      events: current.events.map((event) => event.id === eventId && event.managerId === managerId
        ? { ...event, status: "Completed", preparationStatus: "Closed out", completedAt: new Date().toISOString().slice(0, 10) }
        : event),
      registrations: current.registrations.map((registration) => registration.eventId === eventId && registration.status === "Confirmed" && registration.attendanceStatus?.toLowerCase() === "checked in"
        ? { ...registration, attendanceStatus: "Attended" }
        : registration),
    }));
    toast("Event marked completed.");
  }, [managerId, toast, setData]);

  const value = { ...scoped, allManagerEvents: data.events, allManagerRegistrations: data.registrations, loadedManagerRegistrations: loaded.registrations, toastMessage, toast, createEvent, deleteEvent, updateEvent, updateRegistration, addAttendeeRegistration, submitAttendeeFeedback, saveSession, deleteSession, addAnnouncement, updateAnnouncement, completeEvent };
  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
}

export function useManager() {
  const context = useContext(ManagerContext);
  if (!context) throw new Error("useManager must be used within a ManagerProvider");
  return context;
}