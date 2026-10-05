# Eventify-Finals — Functional Workflow Specification

## 🏗️ Tech Stack Overview

| Layer | Technology |
|---|---|
| Framework | React 19 (Create React App / `react-scripts 5`) |
| Routing | `react-router-dom` v7 (nested routes) |
| State | React Context API (4 providers) |
| Persistence | `localStorage` for event/admin data; account/profile persistence pending |
| Auth | Login/signup pending backend authentication endpoints |

> **Note:** `AuthContext` no longer stores demo accounts or sessions. Login, signup, and profile saving are unavailable until secure backend endpoints are implemented.

---

## 🚀 1. App Boot Sequence (`src/index.js`)

```
BrowserRouter
  └─ AuthProvider        → starts signed out; does not persist a login session or load an unprotected user list
      └─ ManagerProvider → loads manager events/registrations/sessions (key: eventify_manager_data_v4)
          └─ EventProvider → loads public events, registrations, certificates, notifications,
                             and DERIVES public events from manager events
              └─ App      → <Routes>
```

**Order matters:** `EventContext` consumes both `AuthContext` (current user) and `ManagerContext` (manager's events), so it must be nested inside them.

---

## 🔀 2. Routing & Role Guard Workflow (`src/App.js` + `ProtectedRoute.js`)

```
Request URL
   │
   ▼
ProtectedRoute check
   ├─ initializing? ────────► render nothing (wait for session restore)
   ├─ no user? ─────────────► redirect → /login
   ├─ wrong role? ──────────► admin → /admin, others → /events
   └─ OK ───────────────────► render page
```

### Route map by audience:

| Zone | Routes | Guard |
|---|---|---|
| **Public** | `/` (Home), `/login`, `/events`, `/events/:id` | None |
| **Attendee** (`role: user`) | `/my-events`, `/schedule`, `/attendance`, `/certificates`, `/notifications`, `/profile`, `/workspace` | `requiredRole="user"` |
| **Admin** (`role: admin`) | `/admin` → Dashboard, `events`, `settings`, `:page` (ListPage for all other sidebar entries) | `requiredRole="admin"` + `AdminProvider` + `AdminLayout` (sidebar + `<Outlet/>`) |
| **Manager** (`role: manager`) | `/manager` → Overview, `events`, `events/:eventId[/:tab]`, `registrations`, `attendance`, `schedule`, `participants`, `announcements`, `feedback`, `reports` | `requiredRole="manager"` + `ManagerLayout` → all render sections of `ManagerScreen` |
| **Fallback** | `*` | Redirect → `/` |

---

## 🔐 3. Authentication Workflow

```
LoginPage (AuthTabs: Sign In / Sign Up)
   │  client-side form validation
   ▼
AuthContext.login/signup
   │  backend endpoints are not implemented yet; both actions show an explicit error
   └─ no login session is created yet; the app remains signed out

The existing GET /api/getUsers route is not consumed by the frontend because it currently returns the user list without authentication. Replace it with a protected admin-only endpoint before loading accounts in the UI.
```

**Backend work required:** add a password hash and server-controlled role to the user model, then implement signup/login endpoints before enabling authentication. Never store plaintext passwords or let public signup choose an admin/manager role.

---

## 👤 4. Attendee Workflow

```
HomePage (search / categories / featured events)
   │
   ▼
EventsPage ──► EventDetail ──► registerForEvent()
                                  │  writes registration to EventContext
                                  │  → syncs into ManagerContext (addAttendeeRegistration)
                                  │  → creates notification ("New registration")
                                  ▼
MyEventsPage ──► TicketPassModal (QR pass) ──► AttendancePage (check-in)
                                                   │
                                   completeAttendance() / checkInAttendee()
                                                   ▼
CertificatesPage ◄── certificate issued on completion
   │
   ▼
FeedbackModal ──► submitFeedback() → routed to manager's feedback list
   │
   ▼
NotificationsPage / ProfilePage (mark read, update profile)
```

---

## 🎤 5. Manager Workflow (`ManagerContext`, scoped by `managerId`)

```
ManagerLayout sidebar
   │
   ├─ Overview      → stats across assigned events
   ├─ My Events ──► createEvent() → status "Pending"
   │                    │
   │                    ▼  (waits for Admin approval)
   │                 Approved / Published → becomes publicly visible
   │                    │
   ├─ Event Workspace (/manager/events/:eventId/:tab)
   │     ├─ Sessions (saveSession / deleteSession)
   │     ├─ Announcements (addAnnouncement → auto-generates notification when Published)
   │     ├─ Registrations (updateRegistration: confirm/cancel)
   │     ├─ Attendance (check-in management)
   │     ├─ Participants / Feedback (attendee submissions)
   │     └─ Reports
   │
   └─ completeEvent() → status "Completed"
         └─ checked-in "Confirmed" registrations auto-become "Attended"
```

**Key behavior:** All manager data auto-persists to `localStorage` (`eventify_manager_data_v4`) via a `useEffect` on every state change, and orphaned child records (registrations/sessions/etc. for deleted events) are filtered out on load.

---

## 🛡️ 6. Admin Workflow (`AdminContext` — orchestrates the other contexts)

```
AdminLayout sidebar (13 sections)
   │
   ├─ Dashboard / Reports / Audit Logs  ← read-only views of aggregated data
   ├─ Events, Registrations, Users, Venues, Sessions,
   │  Announcements, Feedback, Certificates  → generic ListPage (/:page)
   │        │
   │        ▼
   │   AdminContext.update() / add() / remove()
   │        │  • Status translation layer between 3 vocabularies:
   │        │     Admin:   Pending → Approved → Published → Completed
   │        │     Public:  PENDING → OPENS SOON → REGISTRATION OPEN → COMPLETED
   │        │     Manager: Pending → Approved → Published → Completed
   │        │  • Writes flow through to EventContext AND ManagerContext
   │        ▼
   │   logAction() → auditLogs (who did what, when)
   │
   └─ Settings → updateSettings() / resetDb() / clearAuditLogs()
```

---

## 💾 7. Data / Persistence Layer

| localStorage Key | Owner | Contents |
|---|---|---|
| `eventify_manager_data_v4` | ManagerContext | events, registrations, venues, sessions, announcements, feedback, notifications |
| `eventify_events_v3` | EventContext | Public-facing attendee events |
| `eventify_registrations_v3` | EventContext | Attendee registrations |
| `eventify_certificates_v3` | EventContext | Issued certificates |
| `eventify_notifications_v3` | EventContext | Attendee notifications |
| `eventify_admin_data_v3` | AdminContext | venues, sessions, announcements, feedback, **auditLogs** |
| `eventify_admin_settings_v3` | AdminContext | Platform settings |

Authentication sessions and attendee profiles are not persisted; profile edits are temporary until profile API support is added. The existing public `GET /api/getUsers` endpoint should be protected before the frontend consumes it.

**Cross-context sync:** The public event list is *derived* — `EventContext.events` is a `useMemo` that maps `ManagerContext` events through a status filter (`Registration Open`/`Published`/`Approved`/`Completed` only), so manager-created events automatically appear publicly once approved.

---

## 🔄 End-to-End Lifecycle (one event)

```
Manager creates event (Pending)
        │
        ▼
Admin reviews → approves/publishes
        │                    └─► audit log entry written
        ▼
Appears on public HomePage / EventsPage
        │
        ▼
Attendee registers → notification to manager → registration confirmed
        │
        ▼
Event day: QR check-in → attendance marked
        │
        ▼
Manager completes event → checked-in attendees become "Attended"
        │
        ▼
Certificates issued → attendee submits feedback → reports generated
```

---

## 🏁 How to Run

```bash
cd eventify-finals
npm install
npm start    # → http://localhost:3000
```

---

## 📌 Key Architectural Takeaway

This is a classic **3-role SPA** (Admin → Manager → Attendee) where event and admin state still lives in nested React Contexts persisted to `localStorage`, with `AdminContext` acting as the coordination layer that translates data between the manager, public, and admin views. Account listing, login/signup, and profile persistence still require secure backend endpoints.
