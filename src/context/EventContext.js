import React, { createContext, useContext, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "./AuthContext.js";
import { useManager } from "./ManagerContext.js";
import { newId } from "../api.js";
import { useServerStore, liveRegisteredCount } from "./useServerStore.js";

const EventContext = createContext(null);

// State key -> MongoDB-backed API resource (see server/controllers/dataController.js).
const EVENT_RESOURCES = {
  events: "events",
  registrations: "registrations",
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
    role: user?.role === "admin" ? "Administrator" : user?.role === "manager" ? "Event Manager" : "Student Attendee",
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
    allManagerEvents: managerEvents,
    allManagerRegistrations: managerRegistrations,
    loadedManagerRegistrations,
    sessions: managerSessions,
    addAttendeeRegistration,
    submitAttendeeFeedback,
    updateRegistration: updateManagerRegistration,
  } = useManager();
  const { data, setData, loaded, ready } = useServerStore(EVENT_RESOURCES, user?.id || "guest");
  const {
    events: allEvents,
    registrations: allRegistrations,
    certificates: allCertificates,
    notifications: allNotifications,
  } = data;
  // Setters that work like the old useState setters, one per collection.
  const { setEvents, setRegistrations, setCertificates, setNotifications } = useMemo(() => {
    const setter = (key) => (update) => setData((current) => ({
      ...current,
      [key]: typeof update === "function" ? update(current[key]) : update,
    }));
    return {
      setEvents: setter("events"),
      setRegistrations: setter("registrations"),
      setCertificates: setter("certificates"),
      setNotifications: setter("notifications"),
    };
  }, [setData]);
  const userProfile = useMemo(() => blankProfile(user), [user]);

  const events = useMemo(() => {
    const publicStatus = {
      "Registration Open": "REGISTRATION OPEN",
      Published: "REGISTRATION OPEN",
      Approved: "OPENS SOON",
      Completed: "COMPLETED",
    };
    const managerEventRows = managerEvents
      .filter((event) => publicStatus[event.status])
      .map((event) => {
        const sessions = managerSessions.filter((session) => session.eventId === event.id);
        const speakers = [...new Map(sessions.filter((session) => session.speaker).map((session) => [session.speaker, {
          id: session.id,
          name: session.speaker,
          role: "Guest speaker",
          company: event.organizer,
          topic: session.title,
          time: session.startTime,
          room: session.room,
        }])).values()];
        const date = new Date(`${event.date}T12:00:00`);
        return {
          ...event,
          status: publicStatus[event.status],
          date: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase(),
          fullDate: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
          time: `${event.startTime} - ${event.endTime}`,
          location: event.venue.toUpperCase(),
          fullLocation: event.venue,
          registered: liveRegisteredCount(event, loadedManagerRegistrations, managerRegistrations),
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
    const localEventRows = allEvents
      .filter((event) => ["REGISTRATION OPEN", "OPENS SOON", "COMPLETED"].includes(event.status))
      .map((event) => ({
        ...event,
        registered: liveRegisteredCount(event, loaded.registrations, allRegistrations),
      }));
    return [...new Map([...managerEventRows, ...localEventRows].map((event) => [event.id, event])).values()];
  }, [allEvents, allRegistrations, loaded.registrations, loadedManagerRegistrations, managerEvents, managerRegistrations, managerSessions]);
  const registrations = useMemo(
    () => [
      ...allRegistrations.filter((registration) => belongsToUser(registration, user)),
      ...managerRegistrations.filter((registration) => belongsToUser(registration, user)),
    ],
    [allRegistrations, managerRegistrations, user]
  );
  const certificates = useMemo(
    () => allCertificates.filter((certificate) => belongsToUser(certificate, user)),
    [allCertificates, user]
  );
  const notifications = useMemo(
    () => allNotifications.filter((notification) => belongsToUser(notification, user)),
    [allNotifications, user]
  );

  // Issue certificates for attended, completed events. Waits for the server data so it never
  // duplicates a certificate that already exists. Managers cannot issue certificates.
  const canIssueCertificates = ready && ["user", "admin"].includes(user?.role);
  useEffect(() => {
    if (!canIssueCertificates) return;
    const completedEventIds = new Set([
      ...managerEvents.filter((event) => event.status === "Completed").map((event) => event.id),
      ...allEvents.filter((event) => ["Completed", "COMPLETED"].includes(event.status)).map((event) => event.id),
    ]);
    const eligibleRegistrations = [...managerRegistrations, ...allRegistrations].filter((registration) =>
      registration.status === "Confirmed" &&
      registration.attendanceStatus === "Attended" &&
      completedEventIds.has(registration.eventId) &&
      registration.userId
    );
    const issuedKeys = new Set(allCertificates.map((certificate) => `${certificate.eventId}:${certificate.userId}`));
    const newCertificates = eligibleRegistrations
      .filter((registration) => !issuedKeys.has(`${registration.eventId}:${registration.userId}`))
      .map((registration) => {
        const now = new Date();
        const credentialId = `CERT-NU-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        return {
          id: newId("cert"),
          userId: registration.userId,
          credentialId,
          eventId: registration.eventId,
          eventTitle: registration.eventTitle,
          organizer: "School of Information Technology · National University MOA",
          recipientName: registration.name || "Attendee",
          issueDate: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          hoursEarned: "5 Continuing Professional Development Hours",
          status: "Issued",
          signatoryName: "Dr. Ronald Reyes",
          signatoryRole: "Dean, School of Information Technology",
          verificationUrl: `https://nu-moa.edu.ph/verify/${credentialId}`,
        };
      });
    if (newCertificates.length) {
      setCertificates((current) => {
        const currentKeys = new Set(current.map((certificate) => `${certificate.eventId}:${certificate.userId}`));
        const additions = newCertificates.filter((certificate) => !currentKeys.has(`${certificate.eventId}:${certificate.userId}`));
        return additions.length ? [...additions, ...current] : current;
      });
    }
  }, [allCertificates, allEvents, allRegistrations, canIssueCertificates, managerEvents, managerRegistrations, setCertificates]);

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

      const now = new Date();
      const randomCode = `TKT-${Math.floor(1000 + Math.random() * 9000)}-${now.getFullYear()}`;
      const randomSeat = `Section ${String.fromCharCode(65 + Math.floor(Math.random() * 3))} · Row ${
        Math.floor(Math.random() * 8) + 1
      } · Seat ${Math.floor(Math.random() * 30) + 1}`;

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
        seat: randomSeat,
        ticketType: formData.ticketType || "Student Attendee",
        name: formData.name || userProfile.name,
        email: formData.email || userProfile.email,
        studentId: formData.studentId || userProfile.studentId,
        feedback: null,
      };

      // Update registrations
      if (managerEvents.some((event) => event.id === eventId)) {
        addAttendeeRegistration(newRegistration);
      } else {
        setRegistrations((prev) => [newRegistration, ...prev]);
      }

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
    [addAttendeeRegistration, events, managerEvents, registrations, setNotifications, setRegistrations, userProfile, user]
  );

  // Cancel an existing registration
  const cancelRegistration = useCallback(
    (registrationId) => {
      const reg = registrations.find((r) => r.id === registrationId);
      if (!reg) return false;

      const patch = { status: "Cancelled", cancelledAt: new Date().toISOString().slice(0, 10) };
      if (managerRegistrations.some((item) => item.id === registrationId)) updateManagerRegistration(registrationId, patch);
      else setRegistrations((prev) => prev.map((item) => item.id === registrationId ? { ...item, ...patch } : item));

      // Add cancellation notification
      setNotifications((prev) => [
        {
          id: newId("notif"),
          userId: user?.id,
          eventId: reg.eventId,
          type: "reminder",
          title: `Registration Cancelled: ${reg.eventTitle}`,
          message: `Your reservation has been cancelled and seat ${reg.seat || "allocation"} has been freed.`,
          time: "Just now",
          timestamp: new Date().toISOString(),
          read: false,
          link: "/my-events",
        },
        ...prev,
      ]);

      return true;
    },
    [managerRegistrations, registrations, setNotifications, setRegistrations, updateManagerRegistration, user]
  );

  // Simulate attendee check-in
  const checkInAttendee = useCallback(
    (registrationId) => {
      const reg = registrations.find((r) => r.id === registrationId);
      if (!reg || reg.status !== "Confirmed" || reg.attendanceStatus?.toLowerCase() !== "not checked in") return false;

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      const checkInPatch = { attendanceStatus: "Checked in", checkedInAt: timeStr };
      if (managerRegistrations.some((item) => item.id === registrationId)) updateManagerRegistration(registrationId, checkInPatch);
      else setRegistrations((prev) => prev.map((item) => item.id === registrationId ? { ...item, attendanceStatus: "Checked In", checkedInAt: timeStr } : item));

      // Add notifications
      setNotifications((prev) => [
        {
          id: newId("notif"),
          userId: reg.userId,
          eventId: reg.eventId,
          type: "attendance",
          title: `Checked In: ${reg.eventTitle}`,
          message: `Attendance confirmed at ${timeStr}. Welcome to the event!`,
          time: "Just now",
          timestamp: new Date().toISOString(),
          read: false,
          link: "/my-events",
        },
        ...prev,
      ]);

      return true;
    },
    [managerRegistrations, registrations, setNotifications, setRegistrations, updateManagerRegistration]
  );

  const completeAttendance = useCallback(
    (registrationId) => {
      const reg = registrations.find((r) => r.id === registrationId);
      const eventCompleted = managerEvents.some((event) => event.id === reg?.eventId && event.status === "Completed") ||
        allEvents.some((event) => event.id === reg?.eventId && ["Completed", "COMPLETED"].includes(event.status));
      if (!reg || reg.status !== "Confirmed" || reg.attendanceStatus?.toLowerCase() !== "checked in" || !eventCompleted) return false;

      if (managerRegistrations.some((item) => item.id === registrationId)) updateManagerRegistration(registrationId, { attendanceStatus: "Attended" });
      else setRegistrations((prev) => prev.map((item) => item.id === registrationId ? { ...item, attendanceStatus: "Attended" } : item));

      return true;
    },
    [allEvents, managerEvents, managerRegistrations, registrations, setRegistrations, updateManagerRegistration]
  );

  // Submit post-event feedback
  const submitFeedback = useCallback(
    (registrationId, feedbackData) => {
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === registrationId
            ? {
                ...r,
                feedback: {
                  ...feedbackData,
                  submittedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
                },
              }
            : r
        )
      );

      const reg = registrations.find((r) => r.id === registrationId);
      if (reg) {
        if (managerRegistrations.some((item) => item.id === registrationId)) submitAttendeeFeedback(registrationId, feedbackData);
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
    [managerRegistrations, registrations, setNotifications, setRegistrations, submitAttendeeFeedback]
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

  // Admin "reset": deletes these records from the database (the sync sends the deletes).
  const resetToDefaultSeed = useCallback(() => {
    setData({ events: [], registrations: [], certificates: [], notifications: [] });
  }, [setData]);

  const updateEvent = useCallback((eventId, patch) => {
    setEvents((current) => current.map((event) => event.id === eventId ? { ...event, ...patch } : event));
  }, [setEvents]);

  const addEvent = useCallback((event) => {
    setEvents((current) => [event, ...current]);
  }, [setEvents]);

  const deleteEvent = useCallback((eventId) => {
    setEvents((current) => current.filter((event) => event.id !== eventId));
    setRegistrations((current) => current.filter((registration) => registration.eventId !== eventId));
    setCertificates((current) => current.filter((certificate) => certificate.eventId !== eventId));
    setNotifications((current) => current.filter((notification) => notification.eventId !== eventId));
  }, [setCertificates, setEvents, setNotifications, setRegistrations]);

  const deleteCertificate = useCallback((certificateId) => {
    setCertificates((current) => current.filter((certificate) => certificate.id !== certificateId));
  }, [setCertificates]);

  const updateRegistration = useCallback((registrationId, patch) => {
    setRegistrations((current) => current.map((registration) => registration.id === registrationId
      ? { ...registration, ...patch }
      : registration));
  }, [setRegistrations]);

  const addRegistration = useCallback((registration) => {
    setRegistrations((current) => [registration, ...current]);
  }, [setRegistrations]);

  const deleteRegistration = useCallback((registrationId) => {
    setRegistrations((current) => current.filter((registration) => registration.id !== registrationId));
  }, [setRegistrations]);

  return (
    <EventContext.Provider
      value={{
        events,
        allEvents,
        registrations,
        allRegistrations,
        certificates,
        allCertificates,
        notifications,
        userProfile,
        isEventRegistered,
        registerForEvent,
        cancelRegistration,
        checkInAttendee,
        completeAttendance,
        submitFeedback,
        markNotificationRead,
        markAllNotificationsRead,
        updateProfile,
        resetToDefaultSeed,
        updateEvent,
        addEvent,
        deleteEvent,
        deleteCertificate,
        updateRegistration,
        addRegistration,
        deleteRegistration,
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
