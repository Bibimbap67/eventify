   # Eventify-Finals — Functional Workflow Specification

   ## 🏗️ Tech Stack Overview

   | Layer | Technology |
   |---|---|
   | Framework | React 19 (Create React App / `react-scripts 5`) |
   | Routing | `react-router-dom` v7 (nested routes) |
   | State | React Context API (4 providers) |
   | Persistence | MongoDB via the Express API in `/server` (Mongoose models in `server/models`) |
   | Auth | JWT (`/api/auth/signup`, `/api/auth/login`, `/api/auth/me`); passwords hashed with bcrypt |

   > **Note:** The only thing kept in `localStorage` is the login token (`eventify_token`). All app data is loaded from and saved to MongoDB.

   ---

   ## 🚀 1. App Boot Sequence (`src/index.js`)

   ```
   BrowserRouter
   └─ AuthProvider        → restores the session from the saved token (GET /api/auth/me); admins also load GET /api/users
         └─ ManagerProvider → loads manager events/registrations/sessions/announcements/feedback/notifications from /api/data/manager-*
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
      │  POST /api/auth/login | /api/auth/signup → { token, user }
      └─ token saved in localStorage; every API call sends it as "Authorization: Bearer <token>"
   ```

   Public signup always creates a `user` (attendee). Admin and manager accounts come from `npm run seed` or the Admin > Users page. Inactive accounts cannot sign in.

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

   **Key behavior:** All manager data is saved to MongoDB automatically after every state change (see the Data / Persistence Layer section). Deleting an event also deletes its registrations, sessions, announcements, feedback, notifications and certificates on the server.

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

   Each context uses `useServerStore` (`src/context/useServerStore.js`): it loads its collections from `GET /api/data/:resource`, and after every state change sends only the added/edited/removed records to `POST /api/data/:resource/batch`. The server (`server/controllers/dataController.js`) checks who may read and write each record.

   | MongoDB collection | API resource(s) | Owner | Contents |
   |---|---|---|---|
   | `users` | `/api/auth/*`, `/api/users` | AuthContext | accounts, roles, status, profile fields |
   | `events` | `events` (scope `admin`), `manager-events` (scope `manager`) | EventContext / ManagerContext | admin-created and manager-created events |
   | `registrations` | `registrations`, `manager-registrations` | EventContext / ManagerContext | attendee registrations, attendance, feedback answers |
   | `certificates` | `certificates` | EventContext | issued certificates |
   | `notifications` | `notifications` (scope `attendee`), `manager-notifications` (scope `manager`) | EventContext / ManagerContext | attendee and manager notifications |
   | `sessions` | `sessions`, `manager-sessions` | AdminContext / ManagerContext | sessions & speakers |
   | `announcements` | `announcements`, `manager-announcements` | AdminContext / ManagerContext | announcements |
   | `feedback` | `feedback`, `manager-feedback` | AdminContext / ManagerContext | feedback ratings and comments |
   | `venues` | `venues` | AdminContext (managers read the names) | venues |
   | `auditlogs` | `audit-logs` | AdminContext | admin activity log |
   | `settings` | `/api/settings` | AdminContext | one document (`_id: "global"`) with platform settings |

   Profile fields (student ID, program, phone, ...) are stored on the user document via `PATCH /api/auth/me`.

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

   This is a classic **3-role SPA** (Admin → Manager → Attendee) where event and admin state lives in nested React Contexts backed by MongoDB through the Express API, with `AdminContext` acting as the coordination layer that translates data between the manager, public, and admin views.
