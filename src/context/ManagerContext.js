import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.js";

const ManagerContext = createContext(null);
const STORAGE_KEY = "eventify_manager_data_v4";
const EMPTY_DATA = {
  events: [], registrations: [], venues: [], sessions: [], announcements: [], feedback: [], notifications: [],
};

function loadData() {
  try {
    const data = { ...EMPTY_DATA, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    const eventIds = new Set(data.events.map((event) => event.id));
    return {
      ...data,
      registrations: data.registrations.filter((item) => eventIds.has(item.eventId)),
      sessions: data.sessions.filter((item) => eventIds.has(item.eventId)),
      announcements: data.announcements.filter((item) => eventIds.has(item.eventId)),
      feedback: data.feedback.filter((item) => eventIds.has(item.eventId)),
      notifications: data.notifications.filter((item) => eventIds.has(item.eventId)),
    };
  } catch {
    return EMPTY_DATA;
  }
}

export function ManagerProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(loadData);
  const [toastMessage, setToastMessage] = useState("");

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const managerId = user?.managerId || "manager-1";
  const events = useMemo(() => data.events.filter((event) => event.managerId === managerId), [data.events, managerId]);
  const eventIds = useMemo(() => new Set(events.map((event) => event.id)), [events]);
  const scoped = useMemo(() => ({
    events,
    eventIds,
    registrations: data.registrations.filter((item) => eventIds.has(item.eventId)),
    venues: data.venues,
    sessions: data.sessions.filter((item) => eventIds.has(item.eventId)),
    announcements: data.announcements.filter((item) => eventIds.has(item.eventId)),
    feedback: data.feedback.filter((item) => eventIds.has(item.eventId)),
    notifications: data.notifications.filter((item) => eventIds.has(item.eventId)),
  }), [data, eventIds, events]);

  const toast = useCallback((message) => {
    setToastMessage(message);
    window.clearTimeout(toast.timeoutId);
    toast.timeoutId = window.setTimeout(() => setToastMessage(""), 2400);
  }, []);

  const updateEvent = useCallback((eventId, patch) => {
    setData((current) => ({ ...current, events: current.events.map((event) => event.id === eventId ? { ...event, ...patch } : event) }));
  }, []);

  const createEvent = useCallback((event) => {
    const newEvent = {
      ...event,
      id: `manager-${Date.now()}`,
      managerId,
      status: "Pending",
      preparationStatus: "Needs attention",
      completedAt: null,
    };
    setData((current) => ({ ...current, events: [newEvent, ...current.events] }));
    return newEvent;
  }, [managerId]);

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
  }, []);

  const updateRegistration = useCallback((registrationId, patch) => {
    setData((current) => ({ ...current, registrations: current.registrations.map((item) => item.id === registrationId ? { ...item, ...patch } : item) }));
  }, []);

  const submitAttendeeFeedback = useCallback((registrationId, response) => {
    const registration = data.registrations.find((item) => item.id === registrationId);
    if (!registration) return false;
    const feedback = {
      id: `mf-${Date.now()}`,
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
      notifications: [{ id: `mn-${Date.now()}`, eventId: registration.eventId, message: `New feedback received from ${registration.name}.`, date: new Date().toISOString().slice(0, 10), read: false }, ...current.notifications],
    }));
    return true;
  }, [data.registrations]);

  const addAttendeeRegistration = useCallback((registration) => {
    if (!data.events.some((event) => event.id === registration.eventId)) return null;
    const newRegistration = { ...registration };
    setData((current) => ({
      ...current,
      registrations: [newRegistration, ...current.registrations],
      notifications: [{ id: `mn-${Date.now()}`, eventId: registration.eventId, message: `New registration: ${registration.name}`, date: new Date().toISOString().slice(0, 10), read: false }, ...current.notifications],
    }));
    return newRegistration;
  }, [data.events]);

  const saveSession = useCallback((session) => {
    setData((current) => {
      const existing = current.sessions.some((item) => item.id === session.id);
      return { ...current, sessions: existing
        ? current.sessions.map((item) => item.id === session.id && eventIds.has(item.eventId) ? { ...item, ...session } : item)
        : [{ ...session, id: `ms-${Date.now()}` }, ...current.sessions] };
    });
  }, [eventIds]);

  const deleteSession = useCallback((sessionId) => {
    setData((current) => ({ ...current, sessions: current.sessions.filter((item) => !eventIds.has(item.eventId) || item.id !== sessionId) }));
  }, [eventIds]);

  const addAnnouncement = useCallback((announcement) => {
    const publishedAt = announcement.status === "Published" ? new Date().toISOString() : "";
    const newAnnouncement = { ...announcement, id: `ma-${Date.now()}`, publishedAt };
    setData((current) => ({
      ...current,
      announcements: [newAnnouncement, ...current.announcements],
      notifications: announcement.status === "Published"
        ? [{ id: `mn-${Date.now()}`, eventId: announcement.eventId, message: `Announcement published: ${announcement.title}`, date: new Date().toISOString().slice(0, 10), read: false }, ...current.notifications]
        : current.notifications,
    }));
  }, []);

  const updateAnnouncement = useCallback((announcementId, patch) => {
    setData((current) => ({ ...current, announcements: current.announcements.map((item) => item.id === announcementId && eventIds.has(item.eventId) ? { ...item, ...patch, publishedAt: patch.status === "Published" ? new Date().toISOString() : item.publishedAt } : item) }));
  }, [eventIds]);

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
  }, [managerId, toast]);

  const value = { ...scoped, allManagerEvents: data.events, allManagerRegistrations: data.registrations, toastMessage, toast, createEvent, deleteEvent, updateEvent, updateRegistration, addAttendeeRegistration, submitAttendeeFeedback, saveSession, deleteSession, addAnnouncement, updateAnnouncement, completeEvent };
  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
}

export function useManager() {
  const context = useContext(ManagerContext);
  if (!context) throw new Error("useManager must be used within a ManagerProvider");
  return context;
}