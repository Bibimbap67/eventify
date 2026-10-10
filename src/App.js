import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.js";
import HomePage from "./pages/HomePage.js";
import EventsPage from "./pages/EventsPage.js";
import EventDetail from "./pages/EventDetail.js";
import MyEventsPage from "./pages/MyEventsPage.js";
import SchedulePage from "./pages/SchedulePage.js";
import AttendancePage from "./pages/AttendancePage.js";
import CertificatesPage from "./pages/CertificatesPage.js";
import NotificationsPage from "./pages/NotificationsPage.js";
import ProfilePage from "./pages/ProfilePage.js";
import Dashboard from "./pages/Dashboard.js";
import VerifyPage from "./pages/VerifyPage.js";
import CalendarPage from "./pages/CalendarPage.js";
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
import ManagerScreen from "./pages/manager/ManagerScreen.js";
import { AdminProvider } from "./context/AdminContext.js";
import ProtectedRoute from "./components/ProtectedRoute.js";
import SyncErrorToast from "./components/SyncErrorToast.js";
import { PageTransition } from "./components/Motion.js";
import { ShellSkeleton } from "./components/Skeleton.js";

// Only staff need the QR reader, so its code loads when the desk is opened.
const StaffPage = lazy(() => import("./pages/StaffPage.js"));

// Attendee pages carry their own navbar; admin and manager layouts animate their own outlet.
const PAGE_TARGETS = ":scope > :not(.admin, .manager-shell) > :not(.navbar)";

export default function App() {
  return (
    <>
      <SyncErrorToast />
      <PageTransition targets={PAGE_TARGETS}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />

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
        <Route path="/profile" element={<ProtectedRoute requiredRole="user"><ProfilePage /></ProtectedRoute>} />

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
          <Route index element={<ManagerScreen section="overview" />} />
          <Route path="events" element={<ManagerScreen section="events" />} />
          <Route path="events/:eventId" element={<ManagerScreen section="event" />} />
          <Route path="events/:eventId/:tab" element={<ManagerScreen section="event" />} />
          <Route path="registrations" element={<ManagerScreen section="registrations" />} />
          <Route path="attendance" element={<ManagerScreen section="attendance" />} />
          <Route path="schedule" element={<ManagerScreen section="schedule" />} />
          <Route path="participants" element={<ManagerScreen section="participants" />} />
          <Route path="announcements" element={<ManagerScreen section="announcements" />} />
          <Route path="feedback" element={<ManagerScreen section="feedback" />} />
          <Route path="reports" element={<ManagerScreen section="reports" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </PageTransition>
    </>
  );
}
