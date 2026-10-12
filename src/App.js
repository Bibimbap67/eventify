import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/public/LoginPage.js";
import HomePage from "./pages/public/HomePage.js";
import EventsPage from "./pages/public/EventsPage.js";
import EventDetail from "./pages/public/EventDetail.js";
import MyEventsPage from "./pages/attendee/MyEventsPage.js";
import SchedulePage from "./pages/attendee/SchedulePage.js";
import AttendancePage from "./pages/attendee/AttendancePage.js";
import CertificatesPage from "./pages/attendee/CertificatesPage.js";
import NotificationsPage from "./pages/attendee/NotificationsPage.js";
import ProfilePage from "./pages/ProfilePage.js";
import Dashboard from "./pages/attendee/Dashboard.js";
import VerifyPage from "./pages/public/VerifyPage.js";
import CalendarPage from "./pages/public/CalendarPage.js";
import AdminLayout from "./components/admin/AdminLayout.js";
import AdminDashboard from "./pages/admin/AdminDashboard.js";
import UsersAdmin from "./pages/admin/UsersAdmin.js";
import EventsAdmin from "./pages/admin/EventsAdmin.js";
import VenuesAdmin from "./pages/admin/VenuesAdmin.js";
import ReportsAdmin from "./pages/admin/ReportsAdmin.js";
import RegistrationsAdmin from "./pages/admin/RegistrationsAdmin.js";
import CertificatesAdmin from "./pages/admin/CertificatesAdmin.js";
import AuditLog from "./pages/admin/AuditLog.js";
import SettingsPage from "./pages/admin/SettingsPage.js";
import ManagerLayout from "./components/manager/ManagerLayout.js";
import ManagerOverview from "./pages/manager/ManagerOverview.js";
import ManagerEvents from "./pages/manager/ManagerEvents.js";
import EventWorkspace from "./pages/manager/EventWorkspace.js";
import ManagerRegistrations from "./pages/manager/ManagerRegistrations.js";
import ManagerAttendance from "./pages/manager/ManagerAttendance.js";
import ManagerSchedule from "./pages/manager/ManagerSchedule.js";
import ManagerParticipants from "./pages/manager/ManagerParticipants.js";
import ManagerAnnouncements from "./pages/manager/ManagerAnnouncements.js";
import ManagerFeedback from "./pages/manager/ManagerFeedback.js";
import ManagerReports from "./pages/manager/ManagerReports.js";
import { AdminProvider } from "./context/AdminContext.js";
import ProtectedRoute from "./components/ProtectedRoute.js";
import ToastHost from "./components/Toast.js";
import { PageTransition } from "./components/Motion.js";
import { ShellSkeleton } from "./components/Skeleton.js";

// Only staff need the QR reader, so its code loads when the desk is opened.
const StaffPage = lazy(() => import("./pages/staff/StaffPage.js"));

// Attendee pages carry their own navbar; admin and manager layouts animate their own outlet.
const PAGE_TARGETS = ":scope > :not(.admin, .manager-shell) > :not(.navbar)";

export default function App() {
  return (
    <>
      <PageTransition targets={PAGE_TARGETS}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password/:token" element={<LoginPage />} />

        {/* Attendee experience */}
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/verify/:credentialId" element={<VerifyPage />} />
        <Route path="/my-events" element={<ProtectedRoute requiredRole="user"><MyEventsPage /></ProtectedRoute>} />
        <Route path="/schedule" element={<ProtectedRoute requiredRole="user"><SchedulePage /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute requiredRole="user"><AttendancePage /></ProtectedRoute>} />
        <Route path="/certificates" element={<ProtectedRoute requiredRole="user"><CertificatesPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute requiredRole="user"><NotificationsPage /></ProtectedRoute>} />
        {/* Every role keeps its own name, email and password here. */}
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

        {/* Internal / authenticated area, reached via the "Workspace" nav button */}
        <Route
          path="/workspace"
          element={
            <ProtectedRoute requiredRole="user">
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Event staff: the check-in desk */}
        <Route path="/staff" element={<ProtectedRoute requiredRole="staff"><Suspense fallback={<ShellSkeleton />}><StaffPage /></Suspense></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminProvider><AdminLayout /></AdminProvider></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UsersAdmin />} />
          <Route path="events" element={<EventsAdmin />} />
          <Route path="venues" element={<VenuesAdmin />} />
          <Route path="reports" element={<ReportsAdmin />} />
          <Route path="registrations" element={<RegistrationsAdmin />} />
          <Route path="certificates" element={<CertificatesAdmin />} />
          <Route path="audit-logs" element={<AuditLog />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* Older admin links. Attendance is a filter on Registrations; sessions, speakers and
              announcements are read-only in each event's details; feedback is in Reports. */}
          <Route path="attendance" element={<Navigate to="/admin/registrations?attendance=checked-in" replace />} />
          <Route path="sessions" element={<Navigate to="/admin/events" replace />} />
          <Route path="announcements" element={<Navigate to="/admin/events" replace />} />
          <Route path="feedback" element={<Navigate to="/admin/reports" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        <Route path="/manager" element={<ProtectedRoute requiredRole="manager"><ManagerLayout /></ProtectedRoute>}>
          <Route index element={<ManagerOverview />} />
          <Route path="events" element={<ManagerEvents />} />
          <Route path="events/:eventId" element={<EventWorkspace />} />
          <Route path="events/:eventId/:tab" element={<EventWorkspace />} />
          <Route path="registrations" element={<ManagerRegistrations />} />
          <Route path="attendance" element={<ManagerAttendance />} />
          <Route path="schedule" element={<ManagerSchedule />} />
          <Route path="participants" element={<ManagerParticipants />} />
          <Route path="announcements" element={<ManagerAnnouncements />} />
          <Route path="feedback" element={<ManagerFeedback />} />
          <Route path="reports" element={<ManagerReports />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </PageTransition>
      <ToastHost />
    </>
  );
}
