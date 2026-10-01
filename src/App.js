import React from "react";
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
import AdminLayout from "./components/admin/AdminLayout.js";
import AdminDashboard from "./pages/admin/AdminDashboard.js";
import EventsAdmin from "./pages/admin/EventsAdmin.js";
import ListPage from "./pages/admin/ListPage.js";
import SettingsPage from "./pages/admin/SettingsPage.js";
import ManagerLayout from "./components/manager/ManagerLayout.js";
import ManagerScreen from "./pages/manager/ManagerScreen.js";
import { AdminProvider } from "./context/AdminContext.js";
import ProtectedRoute from "./components/ProtectedRoute.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Attendee experience */}
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/:id" element={<EventDetail />} />
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

      <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminProvider><AdminLayout /></AdminProvider></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="events" element={<EventsAdmin />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path=":page" element={<ListPage />} />
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
  );
}
