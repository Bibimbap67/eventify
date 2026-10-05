import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "./AuthContext.js";
import { useManager } from "./ManagerContext.js";

const EventContext = createContext(null);

const STORAGE_KEYS = {
  EVENTS: "eventify_events_v3",
  REGISTRATIONS: "eventify_registrations_v3",
  CERTIFICATES: "eventify_certificates_v3",
  NOTIFICATIONS: "eventify_notifications_v3",
};

function blankProfile(user) {
  return {
    id: user?.id || "guest",
    name: user?.name || "Guest User",
    email: user?.email || "",
    studentId: "",
    role: user?.role === "admin" ? "Administrator" : user?.role === "manager" ? "Event Manager" : "Student Attendee",
    department: "",
    program: "",
    phone: "",
    avatar: "",
    yearLevel: "",
  };
}

function belongsToUser(record, user) {
  return record.userId ? record.userId === user?.id : Boolean(user?.email && record.email === user.email);
}

function loadStored(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (err) {
    return fallback;
  }
}

export function EventProvider({ children }) {
  const { user } = useAuth();
  const {
    allManagerEvents: managerEvents,
    allManagerRegistrations: managerRegistrations,
    sessions: managerSessions,
    addAttendeeRegistration,
    submitAttendeeFeedback,
    updateRegistration: updateManagerRegistration,
  } = useManager();
  const [allEvents, setEvents] = useState(() => loadStored(STORAGE_KEYS.EVENTS, []));
  const [allRegistrations, setRegistrations] = useState(() => loadStored(STORAGE_KEYS.REGISTRATIONS, []));
  const [allCertificates, setCertificates] = useState(() => loadStored(STORAGE_KEYS.CERTIFICATES, []));
  const [allNotifications, setNotifications] = useState(() => loadStored(STORAGE_KEYS.NOTIFICATIONS, []));
  const [userProfile, setUserProfile] = useState(() => blankProfile(null));

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
          registered: managerRegistrations.filter((registration) => registration.eventId === event.id && registration.status === "Confirmed").length,
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
        registered: allRegistrations.filter((registration) => registration.eventId === event.id && registration.status === "Confirmed").length,
      }));
    return [...new Map([...managerEventRows, ...localEventRows].map((event) => [event.id, event])).values()];
  }, [allEvents, allRegistrations, managerEvents, managerRegistrations, managerSessions]);
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

  useEffect(() => {
    setUserProfile(blankProfile(user));
  }, [user]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(allEvents));
  }, [allEvents]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(allRegistrations));
  }, [allRegistrations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CERTIFICATES, JSON.stringify(allCertificates));
  }, [allCertificates]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(allNotifications));
  }, [allNotifications]);

  useEffect(() => {
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
          id: `cert-${Date.now()}-${registration.userId}`,
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
  }, [allCertificates, allEvents, allRegistrations, managerEvents, managerRegistrations]);

  useEffect(() => {
    const availableEvents = [...allEvents, ...managerEvents];
    const eventIds = new Set(availableEvents.map((event) => event.id));
    const eventTitles = availableEvents.map((event) => event.title).filter(Boolean);
    setNotifications((current) => {
      const filtered = current.filter((notification) => {
        if (notification.eventId) return eventIds.has(notification.eventId);
        const eventSpecific = ["registration", "attendance", "certificate", "feedback"].includes(notification.type) ||
          /^(Registration Confirmed|Registration Cancelled|Checked In:|Feedback Received:)/.test(notification.title || "");
        if (!eventSpecific) return true;
        const content = `${notification.title || ""} ${notification.message || ""}`;
        return eventTitles.some((title) => content.includes(title));
      });
      return filtered.length === current.length ? current : filtered;
    });
  }, [allEvents, managerEvents]);

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

      const confirmedCount = [
        ...allRegistrations,
        ...managerRegistrations,
      ].filter((r) => r.eventId === eventId && r.status === "Confirmed").length;
      if (confirmedCount >= targetEvent.capacity) {
        return { success: false, message: "Sorry, this event has reached maximum capacity." };
      }

      const now = new Date();
      const randomCode = `TKT-${Math.floor(1000 + Math.random() * 9000)}-${now.getFullYear()}`;
      const randomSeat = `Section ${String.fromCharCode(65 + Math.floor(Math.random() * 3))} · Row ${
        Math.floor(Math.random() * 8) + 1
      } · Seat ${Math.floor(Math.random() * 30) + 1}`;

      const newRegistration = {
        id: `reg-${Date.now()}`,
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

      // Increment event registration count
      if (!managerEvents.some((event) => event.id === eventId)) {
        setEvents((prev) => prev.map((ev) => (ev.id === eventId ? { ...ev, registered: ev.registered + 1 } : ev)));
      }

      // Add notification
      const newNotif = {
        id: `notif-${Date.now()}`,
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
    [allRegistrations, addAttendeeRegistration, events, managerEvents, managerRegistrations, registrations, userProfile, user]
  );

  // Cancel an existing registration
  const cancelRegistration = useCallback(
    (registrationId) => {
      const reg = registrations.find((r) => r.id === registrationId);
      if (!reg) return false;

      const patch = { status: "Cancelled", cancelledAt: new Date().toISOString().slice(0, 10) };
      if (managerRegistrations.some((item) => item.id === registrationId)) updateManagerRegistration(registrationId, patch);
      else setRegistrations((prev) => prev.map((item) => item.id === registrationId ? { ...item, ...patch } : item));

      // Decrement event registered count if it was confirmed
      if (reg.status === "Confirmed") {
        setEvents((prev) =>
          prev.map((ev) =>
            ev.id === reg.eventId ? { ...ev, registered: Math.max(0, ev.registered - 1) } : ev
          )
        );
      }

      // Add cancellation notification
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
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
    [managerRegistrations, registrations, updateManagerRegistration, user]
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
          id: `notif-${Date.now()}-1`,
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
    [managerRegistrations, registrations, updateManagerRegistration]
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
    [allEvents, managerEvents, managerRegistrations, registrations, updateManagerRegistration]
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
            id: `notif-${Date.now()}`,
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
    [managerRegistrations, registrations, submitAttendeeFeedback]
  );

  // Notification actions
  const markNotificationRead = useCallback((notifId) => {
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Profile update
  const updateProfile = useCallback((patch) => {
    setUserProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetToDefaultSeed = useCallback(() => {
    setEvents([]);
    setRegistrations([]);
    setCertificates([]);
    setNotifications([]);
    setUserProfile(blankProfile(user));
  }, [user]);

  const updateEvent = useCallback((eventId, patch) => {
    setEvents((current) => current.map((event) => event.id === eventId ? { ...event, ...patch } : event));
  }, []);

  const addEvent = useCallback((event) => {
    setEvents((current) => [event, ...current]);
  }, []);

  const deleteEvent = useCallback((eventId) => {
    setEvents((current) => current.filter((event) => event.id !== eventId));
    setRegistrations((current) => current.filter((registration) => registration.eventId !== eventId));
    setCertificates((current) => current.filter((certificate) => certificate.eventId !== eventId));
    setNotifications((current) => current.filter((notification) => notification.eventId !== eventId));
  }, []);

  const deleteCertificate = useCallback((certificateId) => {
    setCertificates((current) => current.filter((certificate) => certificate.id !== certificateId));
  }, []);

  const updateRegistration = useCallback((registrationId, patch) => {
    setRegistrations((current) => current.map((registration) => registration.id === registrationId
      ? { ...registration, ...patch }
      : registration));
  }, []);

  const addRegistration = useCallback((registration) => {
    setRegistrations((current) => [registration, ...current]);
  }, []);

  const deleteRegistration = useCallback((registrationId) => {
    setRegistrations((current) => current.filter((registration) => registration.id !== registrationId));
  }, []);

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
