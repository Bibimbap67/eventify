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
   └─ AuthProvider        → restores the session from the saved token (GET /api/auth/me)
         └─ ManagerProvider → loads every event (manager- or admin-made) and its registrations/sessions/announcements/feedback/notifications from /api/data/manager-*
            └─ EventProvider → loads the attendee's certificates and notifications,
                              and DERIVES the public event list from those events
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
      ├─ wrong role? ──────────► admin → /admin, staff → /staff, others → /events
      └─ OK ───────────────────► render page
   ```

   ### Route map by audience:

   | Zone | Routes | Guard |
   |---|---|---|
   | **Public** | `/` (Home), `/login`, `/events`, `/events/:id`, `/calendar`, `/verify`, `/verify/:credentialId` | None |
   | **Attendee** (`role: user`) | `/my-events`, `/schedule`, `/attendance`, `/certificates`, `/notifications`, `/profile`, `/workspace`, `/exit/:eventId` (where the exit QR leads) | `requiredRole="user"` |
   | **Staff** (`role: staff`) | `/staff` (check-in desk + exit QR) | `requiredRole="staff"` |
   | **Admin** (`role: admin`) | `/admin` → Dashboard, `users`, `events`, `venues`, `reports`, `registrations`, `certificates`, `audit-logs`, `settings` (old `attendance`, `sessions`, `announcements`, `feedback` links redirect) | `requiredRole="admin"` + `AdminProvider` + `AdminLayout` (sidebar + `<Outlet/>`) |
   | **Manager** (`role: manager`) | `/manager` → Overview, `events`, `events/:eventId[/:tab]`, `registrations`, `attendance`, `schedule`, `participants`, `announcements`, `feedback`, `reports` | `requiredRole="manager"` + `ManagerLayout` → one page file each in `src/pages/manager/` |
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
   EventsPage (upcoming first, by date then start time; 20 a page)
      │
      ▼
   EventDetail ──► clashingRegistrations() ── a ticket overlaps this event's time? ──► blocked,
      │                                         with a "Cancel that registration" button
      ▼
   registerForEvent()
      │  → saves the registration through ManagerContext (addAttendeeRegistration)
      │  → server re-checks the clash (checkAttendeeSchedule) and capacity
      │  → creates notification ("New registration")
      ▼
   MyEventsPage (10 per tab) ──► TicketPassModal (QR pass) ── staff scan it at the door ──► "Checked in"
      │
      ▼
   ExitScanButton ("Scan exit QR", or the phone camera opens /exit/:eventId?code=…)
      │  POST /api/exit → ticket becomes "Attended" (exit verified)
      ▼
   CertificatesPage (search, 10 a page) ◄── the server issues the certificate for an Attended ticket on a completed event
      │
      ▼
   FeedbackModal ──► submitFeedback() → routed to manager's feedback list
      │
      ▼
   NotificationsPage / ProfilePage (mark read, update profile)
   ```

   Attendees can no longer mark themselves Attended: the server keeps attendance as it was on any attendee save. Only the exit scan (or a manager's Mark exited) sets it.

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
      │     ├─ Attendance (check-in management; "Mark exited" → POST /api/registrations/:id/exit, audited)
      │     ├─ Participants / Feedback (attendee submissions)
      │     └─ Reports
      │
      └─ completeEvent() → status "Completed"
            └─ attendance is not changed: only exit-verified ("Attended") tickets get certificates
   ```

   Lists: Registrations and Participants show 25 a page, past and archived events 12, feedback comments and announcements 10. The event-day check-in roster is never paged.

   ---

   ## 🚪 6. Staff Workflow (`/staff`, `StaffPage` + `ExitQrPanel`)

   ```
   Check-in desk
      ├─ Scan ticket QR ──► POST /api/staff/checkin → "Checked in" (from the event's start time)
      │
      └─ Exit verification (15 min before the end → 2 h after; ExitPass collection, one row per event)
            ├─ Start Exit Verification ──► POST   /api/staff/events/:id/exit
            ├─ screen polls every 2 s ───► GET    /api/staff/events/:id/exit  (replaces a code older than 30 s)
            └─ Stop ─────────────────────► DELETE /api/staff/events/:id/exit

   Attendee scan ──► POST /api/exit { eventId, code }
      checks, in order: exit running · has a Confirmed ticket · not already exited · checked in · code current
      ├─ any check fails → refused with a reason, the code on screen is NOT used up
      └─ all pass → code consumed and replaced in one atomic update (one winner per code)
                    → ticket "Attended" + exitedAt / exitVerifiedAt / exitMethod "scan"
                    → notification + issueCertificates() (issued now if the event is Completed, else on completion)
   ```

   The QR holds a link (`/exit/:eventId?code=…`), so a phone camera opens `ExitPage`; the in-app scanner reads the same link. Exit fields on a registration are written only by the server.

   **Key behavior:** All manager data is saved to MongoDB automatically after every state change (see the Data / Persistence Layer section). Deleting an event also deletes its registrations, sessions, announcements, feedback, notifications and certificates on the server.

   ---

   ## 🛡️ 7. Admin Workflow (platform-wide jobs only)

   Running a single event (registrations, check-in, sessions, announcements) belongs to its Event Manager; the admin oversees it read-only.

   ```
   AdminLayout sidebar (grouped, collapsible)
      │
      ├─ Overview   Dashboard ─────────► GET /api/admin/overview (counts by role/status, recent activity)
      ├─ Platform   Users & roles ─────► GET /api/users?page&role&status&q&sort (server paging + tab counts)
      │             │                    POST / PATCH / DELETE /api/users (role, status, details, delete)
      │             Events & approvals ─► AdminContext.update() / add() / remove()
      │             │  • Every event is saved one way; the words are translated in src/data/eventStatus.js:
      │             │     Saved:   Pending → Registration Open → Completed
      │             │     Admin:   Pending → Published → Completed
      │             │     Public:  REGISTRATION OPEN → COMPLETED
      │             │  • An admin's new event saves through ManagerContext, owned by that admin
      │             │  • Reject has an Undo (toast button, and "Undo rejection" on rejected rows):
      │             │    Rejected → Pending, and the server notifies the event's manager
      │             │  • 25 events a page (Reports too; its totals and CSV cover every event)
      │             │  • Details (read-only sessions, speakers, announcements): GET /api/admin/events/:id
      │             Venues ────────────► AdminContext (venues collection)
      ├─ Oversight  Reports ───────────► GET /api/admin/reports/events (per-event totals, CSV export)
      │             Registrations ─────► GET /api/admin/registrations (read-only, filtered, paged)
      │             Certificates ──────► read-only list with links to the public check
      └─ System     Audit log ─────────► GET /api/admin/audit-logs (filtered, paged)
                    Settings ──────────► PUT /api/settings (validated), PATCH /api/auth/me,
                                         POST /api/auth/password, GET /api/admin/export
   ```

   **Audit log:** written only by the server (`server/utils/audit.js`). The actor comes from the signed-in user's token, the time is the document's `createdAt`, and each entry records its outcome (`success`, `failed` or `denied`). Users, settings, the admin's own profile and password, and every admin write through `/api/data/:resource/batch` are recorded, as are non-admins refused on admin APIs or admin-only records. There is no API to edit or delete entries. `npm run selftest:admin` (in `/server`) checks these rules.

   ---

   ## 💾 8. Data / Persistence Layer

   Each context uses `useServerStore` (`src/context/useServerStore.js`): it loads its collections from `GET /api/data/:resource`, and after every state change sends only the added/edited/removed records to `POST /api/data/:resource/batch`. The server (`server/controllers/dataController.js`) checks who may read and write each record.

   | MongoDB collection | API resource(s) | Owner | Contents |
   |---|---|---|---|
   | `users` | `/api/auth/*`, `/api/users` | AuthContext (own account), Admin > Users page (`/api/users`) | accounts, roles, status, profile fields |
   | `events` | `manager-events` | ManagerContext | every event, whether a manager or an admin made it |
   | `registrations` | `manager-registrations` | ManagerContext | attendee registrations, attendance, exit (`exitedAt`, `exitVerifiedAt`, `exitMethod`, `exitedBy`; server-only), feedback answers |
   | `exitpasses` | `/api/staff/events/:id/exit` (staff only) | server | the current exit QR code of each event, its expiry, and whether exit is running |
   | `certificates` | `certificates` (read-only; the server issues them); public check `GET /api/certificates/verify/:credentialId` | EventContext | issued certificates |
   | `notifications` | `notifications` (scope `attendee`), `manager-notifications` (scope `manager`) | EventContext / ManagerContext | attendee and manager notifications |
   | `sessions` | `manager-sessions` (the admin-scope `sessions` resource is no longer used by any screen) | ManagerContext | sessions & speakers |
   | `announcements` | `manager-announcements` (admin-scope `announcements` likewise unused) | ManagerContext | announcements |
   | `feedback` | `manager-feedback` (admin-scope `feedback` likewise unused) | ManagerContext | feedback ratings and comments |
   | `venues` | `venues` | AdminContext (managers read the names) | venues |
   | `auditlogs` | read: `GET /api/admin/audit-logs`; written only by the server | server | admin activity log |
   | `settings` | `/api/settings` | AdminContext | one document (`_id: "global"`): organization name, academic term, default capacity |

   Profile fields (student ID, program, phone, ...) are stored on the user document via `PATCH /api/auth/me`.

   **Paging:** lists already in memory use `usePaged` + `Pagination` (`src/components/admin/parts.js`); the bar only shows when a list is longer than one page, and a new search, filter or tab goes back to page 1. Users, Registrations and the Audit log are paged by the server.

   **Cross-context sync:** The public event list is *derived* — `EventContext.events` is a `useMemo` that maps `ManagerContext` events through a status filter (`Registration Open`/`Published`/`Approved`/`Completed` only), so every event appears publicly once approved, whoever made it.

   ---

   ## 🔄 End-to-End Lifecycle (one event)

   ```
   Manager creates event (Pending)
         │
         ▼
   Admin reviews → approves/publishes (or rejects; a rejection can be undone → Pending, manager notified)
         │                    └─► audit log entry written
         ▼
   Appears on public HomePage / EventsPage
         │
         ▼
   Attendee registers (no time clash with their other tickets) → notification to manager
         │
         ▼
   Event day: QR check-in at the door → "Checked in"
         │
         ▼
   Event ends: staff show the rotating exit QR → attendee scans → "Attended"
         │                                       (or the manager marks them exited)
         ▼
   End time passes → event "Completed" → certificates issued to Attended tickets only
         │
         ▼
   Attendee submits feedback → reports generated → anyone verifies the certificate at /verify
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

   This is a **4-role SPA** (Admin → Manager → Staff → Attendee) where event and admin state lives in nested React Contexts backed by MongoDB through the Express API, with `AdminContext` acting as the coordination layer that translates data between the manager, public, and admin views.
