import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext.js";
import { useManager } from "./ManagerContext.js";
import { newId } from "../api.js";
import { useServerStore, liveRegisteredCount } from "./useServerStore.js";
import { isReserved, seatOf } from "../data/seating.js";
import { ATTENDEE_TYPE } from "../data/student.js";
import { attendanceKey } from "../data/checkIn.js";
import { SAVED_TO_PUBLIC } from "../data/eventStatus.js";

const EventContext = createContext(null);

// State key -> MongoDB-backed API resource (see server/controllers/dataController.js).
// Events and registrations live in ManagerContext; this adds the attendee's own records.
const EVENT_RESOURCES = {
  certificates: "certificates",
  notifications: "notifications",
};

// The profile fields are stored on the user document in MongoDB.
function blankProfile(user) {
  return {
    id: user?.id || "guest",
    name: user?.name || "Guest User",
    email: user?.email || "",
    studentId: user?.studentId || "",
    role: { admin: "Administrator", manager: "Event Manager", staff: "Event Staff" }[user?.role] || ATTENDEE_TYPE,
    department: user?.department || "",
    program: user?.program || "",
    phone: user?.phone || "",
    avatar: user?.avatar || "",
    yearLevel: user?.yearLevel || "",
  };
}

function belongsToUser(record, user) {
  return record.userId ? record.userId === user?.id : Boolean(user?.email && record.email === user.email);
}

export function EventProvider({ children }) {
  const { user, updateProfile: saveProfile } = useAuth();
  const {
    allManagerEvents: allEvents,
    allManagerRegistrations: allRegistrations,
    loadedManagerRegistrations: loadedRegistrations,
    sessions: managerSessions,
    addAttendeeRegistration,
    submitAttendeeFeedback,
    updateRegistration,
    reloadManagerData,
  } = useManager();
  const { data, setData, reload } = useServerStore(EVENT_RESOURCES, user?.id || "guest");
  const { certificates: allCertificates, notifications: allNotifications } = data;
  // Works like a useState setter. Certificates have none: only the server issues them.
  const setNotifications = useCallback((update) => setData((current) => ({
    ...current,
    notifications: typeof update === "function" ? update(current.notifications) : update,
  })), [setData]);
  const userProfile = useMemo(() => blankProfile(user), [user]);

  const events = useMemo(() => {
    return allEvents
      .filter((event) => SAVED_TO_PUBLIC[event.status])
      .map((event) => {
        const sessions = managerSessions.filter((session) => session.eventId === event.id);
        // The speakers listed on the event, each with their session if one names them.
        // Older events only named speakers on their sessions.
        const listed = (event.speakers || []).filter((speaker) => speaker.name);
        const named = listed.length ? listed : [...new Set(sessions.map((session) => session.speaker).filter(Boolean))].map((name) => ({ name, kind: "Guest speaker" }));
        const speakers = named.map((speaker, index) => {
          const session = sessions.find((item) => item.speaker?.trim().toLowerCase() === speaker.name.trim().toLowerCase());
          return { id: `${event.id}-speaker-${index}`, ...speaker, topic: session?.title, time: session?.startTime, room: session?.room };
        });
        const date = new Date(`${event.date}T12:00:00`);
        return {
          ...event,
          status: SAVED_TO_PUBLIC[event.status],
          isoDate: event.date,
          date: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase(),
          fullDate: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
          time: `${event.startTime} - ${event.endTime}`,
          location: event.venue.toUpperCase(),
          fullLocation: event.venue,
          registered: liveRegisteredCount(event, loadedRegistrations, allRegistrations),
          speakers,
          agenda: sessions.map((session) => ({
            time: `${session.startTime} - ${session.endTime}`,
            title: session.title,
            speaker: session.speaker,
            room: session.room,
          })),
          featured: false,
          accent: "var(--color-blue)",
          heroBg: "var(--color-yellow)",
        };
      });
  }, [allEvents, allRegistrations, loadedRegistrations, managerSessions]);
  const registrations = useMemo(
    () => allRegistrations.filter((registration) => belongsToUser(registration, user)),
    [allRegistrations, user]
  );
  const certificates = useMemo(
    () => allCertificates.filter((certificate) => belongsToUser(certificate, user)),
    [allCertificates, user]
  );
  const notifications = useMemo(
    () => allNotifications.filter((notification) => belongsToUser(notification, user)),
    [allNotifications, user]
  );

  // Check if current user is registered for an event
  const isEventRegistered = useCallback(
    (eventId) => {
      return registrations.find((r) => r.eventId === eventId && r.status === "Confirmed") || null;
    },
    [registrations]
  );

  // Register for an event
  const registerForEvent = useCallback(
    (eventId, formData = {}) => {
      if (!user || user.role !== "user") throw new Error("Sign in with an attendee account to register.");
      const targetEvent = events.find((e) => e.id === eventId);
      if (!targetEvent) throw new Error("Event not found.");

      const existing = registrations.find((r) => r.eventId === eventId && r.status === "Confirmed");
      if (existing) {
        return { success: false, message: "You are already registered for this event.", registration: existing };
      }

      if (targetEvent.status !== "REGISTRATION OPEN") {
        return {
          success: false,
          message:
            targetEvent.status === "COMPLETED"
              ? "This event has already finished."
              : "Registration is not open for this event yet.",
        };
      }

      // targetEvent.registered counts every attendee (from the server), not only this user.
      if (targetEvent.registered >= targetEvent.capacity) {
        return { success: false, message: "Sorry, this event has reached maximum capacity." };
      }

      // Reserved seating: the attendee's own pick, which the server checks is still free.
      const reserved = isReserved(targetEvent);
      if (reserved && !formData.seat) return { success: false, message: "Pick your seat on the map first." };

      const now = new Date();
      const randomCode = `TKT-${Math.floor(1000 + Math.random() * 9000)}-${now.getFullYear()}`;

      const newRegistration = {
        id: newId("reg"),
        userId: user.id,
        eventId: targetEvent.id,
        eventTitle: targetEvent.title,
        date: targetEvent.date,
        fullDate: targetEvent.fullDate,
        time: targetEvent.time,
        location: targetEvent.location,
        status: "Confirmed",
        attendanceStatus: "Not Checked In",
        checkedInAt: null,
        registrationDate: now.toISOString().slice(0, 10),
        ticketCode: randomCode,
        seating: reserved ? "reserved" : "free",
        seat: reserved ? formData.seat : null,
        ticketType: ATTENDEE_TYPE,
        name: formData.name || userProfile.name,
        email: formData.email || userProfile.email,
        studentId: formData.studentId || userProfile.studentId,
        feedback: null,
      };

      addAttendeeRegistration(newRegistration);

      // Add notification
      const newNotif = {
        id: newId("notif"),
        userId: user.id,
        eventId: targetEvent.id,
        type: "registration",
        title: `Registration Confirmed: ${targetEvent.title}`,
        message: `Your ticket pass #${randomCode} is confirmed. View your schedule or ticket anytime under My Events.`,
        time: "Just now",
        timestamp: new Date().toISOString(),
        read: false,
        link: "/my-events",
      };
      setNotifications((prev) => [newNotif, ...prev]);

      return { success: true, registration: newRegistration };
    },
    [addAttendeeRegistration, events, registrations, setNotifications, userProfile, user]
  );

  // Cancel an existing registration
  const cancelRegistration = useCallback(
    (registrationId) => {
      const reg = registrations.find((r) => r.id === registrationId);
      if (!reg) return false;

      const patch = { status: "Cancelled", cancelledAt: new Date().toISOString().slice(0, 10) };
      updateRegistration(registrationId, patch);

      // Add cancellation notification
      setNotifications((prev) => [
        {
          id: newId("notif"),
          userId: user?.id,
          eventId: reg.eventId,
          type: "cancellation",
          title: `Registration Cancelled: ${reg.eventTitle}`,
          message: seatOf(reg) ? `Your registration is cancelled and seat ${seatOf(reg)} is free for someone else.` : "Your registration is cancelled and your spot is free for someone else.",
          time: "Just now",
          timestamp: new Date().toISOString(),
          read: false,
          link: "/my-events",
        },
        ...prev,
      ]);

      return true;
    },
    [registrations, setNotifications, updateRegistration, user]
  );

  const completeAttendance = useCallback(
    (registrationId) => {
      const reg = registrations.find((r) => r.id === registrationId);
      const eventCompleted = allEvents.some((event) => event.id === reg?.eventId && event.status === "Completed");
      if (!reg || reg.status !== "Confirmed" || attendanceKey(reg.attendanceStatus) !== "checked-in" || !eventCompleted) return false;

      // The server issues the certificate once this is saved.
      updateRegistration(registrationId, { attendanceStatus: "Attended" });

      return true;
    },
    [allEvents, registrations, updateRegistration]
  );

  // Submit post-event feedback
  const submitFeedback = useCallback(
    (registrationId, feedbackData) => {
      const reg = registrations.find((r) => r.id === registrationId);
      if (reg) {
        submitAttendeeFeedback(registrationId, feedbackData);
        setNotifications((prev) => [
          {
            id: newId("notif"),
            userId: reg.userId,
            eventId: reg.eventId,
            type: "feedback",
            title: `Feedback Received: ${reg.eventTitle}`,
            message: `Thank you for rating your experience! Your constructive insights help shape future campus events.`,
            time: "Just now",
            timestamp: new Date().toISOString(),
            read: false,
            link: "/my-events",
          },
          ...prev,
        ]);
      }

      return true;
    },
    [registrations, setNotifications, submitAttendeeFeedback]
  );

  // Notification actions
  const markNotificationRead = useCallback((notifId) => {
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
  }, [setNotifications]);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, [setNotifications]);

  // Profile update: saved to the user's document in MongoDB. Returns a promise.
  const updateProfile = useCallback((patch) => {
    const fields = ["name", "email", "studentId", "department", "program", "yearLevel", "phone", "avatar"];
    return saveProfile(Object.fromEntries(fields.filter((key) => key in patch).map((key) => [key, patch[key]])));
  }, [saveProfile]);

  // Re-reads everything from the server, e.g. after staff check a ticket in at the door.
  const refresh = useCallback(() => {
    reload();
    reloadManagerData();
  }, [reload, reloadManagerData]);

  return (
    <EventContext.Provider
      value={{
        events,
        registrations,
        certificates,
        allCertificates,
        notifications,
        userProfile,
        isEventRegistered,
        registerForEvent,
        cancelRegistration,
        completeAttendance,
        submitFeedback,
        refresh,
        markNotificationRead,
        markAllNotificationsRead,
        updateProfile,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export const useEventContext = () => {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error("useEventContext must be used within an EventProvider");
  }
  return ctx;
};
