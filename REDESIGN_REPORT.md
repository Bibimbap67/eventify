# Eventify UI Redesign Report

Unattended one-shot run. Neo-brutalist identity kept and refined (Default Decision 1).
No screenshots were taken. Checks used the production build, the dev server, code reading and a
headless browser that only read console errors and DOM measurements.

---

## Phase 1: Design audit

Skills used: `design:design-critique` (critique framework: first impression, usability, hierarchy,
consistency, accessibility) and `design:design-system` (token coverage, naming, component states).

### Overall impression

The style is clear: neo-brutalist. Cream ground (`#fffdf5`), 2–3px black borders, hard offset shadows,
Archivo Black display type, Space Mono labels, and yellow/pink/violet/sky fills. When a screen uses the
system, like the event card, admin tables or the manager overview, it looks deliberate. The biggest problem
is coverage: **about 95 class names in the JSX have no CSS rule at all**, so whole surfaces fall back
to browser defaults inside a heavily styled shell. The second problem is drift: the same idea
(button, label, gray text, shadow) is written 5–30 different ways.

### Style consistency

| Area | Finding | Severity |
|---|---|---|
| Unstyled surfaces | Certificates page cards (`certificate-card`, `cert-card__*`), the certificate document in `CertificateModal` (`formal-certificate-doc`, `cert-*`, `gold-seal-circle`), the ticket in `TicketPassModal` (`printable-ticket__*`), the Profile identity card and stat cards (`profile-*`, `p-stat-*`), Notification page cards (`notif-card__*`), the Feedback star picker (`star-*`, `rating-*`), the schedule conflict banner details, the event-card "registered" tag. All render as unstyled HTML. | 🔴 Critical |
| Buttons | Seven button families: `.btn`, `.btn-sm`, `.manager-button`, `.tab-btn`/`.filter-btn`, `.settings-tab`, `.category-pill`, `.btn-ticket-register`. Hover goes up-left on `.btn-sm` but **down-right** on `.manager-button`. Press depth differs (0.04s to 0.14s, 1–5px). | 🟡 Moderate |
| Shadows | 8 offsets in use (2, 3, 4, 5, 6, 7, 8, 9px) for the same "card" idea. | 🟡 Moderate |
| Gray text | 25+ near-identical grays (`#555`, `#59605c`, `#626a64`, `#5d655f`, `#697069`, …), mostly in the manager section. | 🟢 Minor |
| Icons | Hand-drawn SVG set, plus ~30 text glyphs (`→ ← ✓ ▾ × ↓`) used as icons. Glyph sizes and baselines depend on the font. | 🟡 Moderate |

### Token problems

* `--color-blue` is `#0a0a0a` (near-black), and the name is misleading. The last commit added `--ink`; this run
  adds the alias **`--color-ink`** and keeps `--color-blue` working.
* The design tokens added in the last commit (`--space-*`, `--fs-*`, `--duration-*`, `--ease-*`, `--shadow`)
  were **defined but used 0 times** in CSS or JS.
* Literal values in `src/index.css`: 445 padding/margin/gap declarations with **40 distinct px values**
  (including 9, 11, 13, 15, 17 and 19px). There are **30 distinct font sizes** from 9px to 68px, **60+ hex colors**
  and **31 distinct durations** from 40ms to 500ms.

### Spacing scale (proposed and adopted)

`--space-1: 4px · --space-2: 8px · --space-3: 12px · --space-4: 16px · --space-5: 24px · --space-6: 32px · --space-7: 48px · --space-8: 64px`

The most common odd values snap to this scale: 9/10 → 8 or 12, 13/14/15 → 12 or 16, 18/20/22 → 16 or 24, 28/30/36/38 → 32.

### Type scale (proposed and adopted, 6 sizes)

| Token | Size | Use |
|---|---|---|
| `--text-xs` | 11px | Mono labels, eyebrows, table heads, badges |
| `--text-sm` | 13px | Secondary body, meta lines, buttons |
| `--text-base` | 15px | Body copy |
| `--text-lg` | 20px | Card and panel titles |
| `--text-xl` | clamp(26px, 3.6vw, 40px) | Section and inner-page titles |
| `--text-2xl` | clamp(34px, 6vw, 64px) | Page/hero titles |

The unused `--fs-*` set was replaced by `--text-*` (no callers, so this is safe).

### Layout problems per page

| Page | Problem |
|---|---|
| All signed-in attendee pages @768px | Horizontal scroll (797px). Between 721 and 960px the navbar moves its links to a full-width row (`order: 3; width: 100%`), but the bar only gets `flex-wrap` below 720px. |
| Admin Registrations / Attendance / Announcements / Certificates / Settings @375px | Horizontal scroll (401–463px). The toolbar `.input { min-width: 180px }` and two-column `.two` forms don't collapse. |
| Profile | The avatar `<img src="">` makes React warn and re-request the page. The identity card and stats are unstyled. One stat number is yellow text on white (1.4:1). |
| Certificates | Card grid unstyled, so certificates stack as plain text. |
| Notifications | Cards have a border but icon, title and footer have no layout. The "View details" link sits inline. |
| Event detail | `event-detail-sidebar`, `event-reqs-box` and agenda speaker/room rows have no layout. Error text is pink on white. |
| Home | Strong hero, but no explanation of the flow (register → ticket → check-in → certificate) and no role context for the panel. The footer has no school name. |
| Manager | Body text at 10–11px and table heads at 9px. Dense and below comfortable reading size. |

### Attendee vs manager vs admin consistency

* **Shell:** attendee pages use a top navbar. Admin and manager use a left sidebar, but they differ: admin links are plain rows, manager links have arrows and an assignment card. The admin topbar has no eyebrow and the manager topbar does.
* **Buttons:** admin uses `.btn-sm` (lifts on hover). Manager uses `.manager-button` (sinks on hover). Attendee pages use both plus `.tab-btn`.
* **Tables:** admin table heads are 12px mono, manager table heads are 9px mono, with different row padding.
* **Toasts:** admin `.toast` is black with a yellow border and slides from the right. Manager `.manager-toast` is yellow with a black border and pops.

### Accessibility findings

* **Contrast fails (AA needs 4.5:1 for small text):** pink `#ff6b6b` eyebrow and error text on cream/white is **≈2.6:1** (`.events-hero__eyebrow`, `.section-head__eyebrow`, `.auth-card__error`, `.field__error`, inline errors in EventDetail and FeedbackModal). Yellow numbers on white in Profile are **1.4:1**.
* **Touch targets:** `.btn-sm` is about 31px tall, `.icon-btn` and `.manager-close` are 34px, navbar icon buttons are 38px, `.manager-button--small` is 31px. All are under 44px on touch screens.
* **Focus:** `.btn`, `.btn-sm` and inputs have a visible ring. Tabs, filter buttons, category pills, sidebar links, manager buttons and the star picker rely on the browser default.
* **Motion:** a single global `prefers-reduced-motion` kill switch exists (good).

### Top 10 fixes ranked by visual impact (all implemented in Phases 2–4)

1. **Style the ~95 unstyled classes:** certificate cards and document, ticket pass, profile card and stats, notification cards, star picker, schedule conflict, event-detail sidebar.
2. **Landing page rebuild:** hero with two clear CTAs, a "how it works" strip, a roles strip, and a footer with the school name.
3. **One press/hover language** for every pressable surface (lift on hover only when the pointer can hover, sink into the shadow on press), driven by `--duration-*` / `--ease-out`.
4. **Consistent icons:** lucide icons behind the existing `<Icon>` API, with text glyphs replaced.
5. **Contrast fixes:** pink text → `--danger-ink` (#b91c1c, 6.4:1 on cream). Yellow/near-black inline numbers → ink.
6. **Fix the 768px and 375px horizontal overflow** (navbar wrap; admin toolbar and forms collapse).
7. **Modal / dropdown / toast motion:** scale 0.96 + fade for modals, origin-aware dropdowns, toasts that slide in with a transition instead of keyframes.
8. **Type and spacing tokens** applied to the repeated page headers, eyebrows, panels and cards (the worst offenders).
9. **Shadow scale:** `--shadow-sm` 3px, `--shadow` 5px, `--shadow-lg` 8px.
10. **Touch targets ≥44px** on coarse pointers, plus a visible focus ring on every interactive element.

All ten were implemented (see below).

---

## Phase 2: Foundation

Skill used: `frontend-design`. The brief fixes the style, so the skill's rule "the brief's own words always win" applied, and its other
guidance went into restraint: one bold element (the landing ticket), everything else quiet; new copy in
plain sentence case that says what an action does ("Browse events", "Search events").

* **Tokens** (`:root` in `src/index.css`): `--color-ink` (correct name for the near-black; `--color-blue` still works),
  `--text-xs … --text-2xl` (6 sizes, replacing the unused `--fs-*`), `--shadow-sm/--shadow/--shadow-lg`, and
  `--duration-press 150 / fast 180 / base 240 / slow 320 / reveal 400ms` with `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--ease-spring`.
  The spacing scale `--space-1…8` (4–64px) already existed and is now used.
* **Migration of the worst offenders:** 39 card/panel shadows → shadow tokens, 56 ad-hoc grays → `--ink-2`, all 9–10px text → `--text-xs` (11px),
  and every new rule written with `--space-*` / `--text-*`.
* **Icons:** `lucide-react` installed. `Icon.js` keeps its `name/size/label` API and maps all 20 old names plus 14 new ones.
  Sizes snap to 16/20/24 with one stroke width (2.25). It is `aria-hidden` when decorative and `role="img"` + `aria-label` when given a label.
  About 31 text glyphs (→ ← ✓ ▾ × ↓↑) plus one inline SVG were replaced with `<Icon>`, always next to text or with a label.
* **Unstyled surfaces styled:** certificates page and document, ticket pass, profile card and stats, notification cards,
  feedback star picker, schedule conflict banner, event-detail sidebar, and the event card "registered" tag.
* **Components:** `Skeleton` (+ `EventCardSkeleton`, `TableSkeleton`, `ShellSkeleton`, `EventDetailSkeleton`, `useSkeleton`),
  `Reveal`, and `Button` loading (`aria-busy`, progress cursor) and disabled states. The arrow is now an icon.
* **Fixes:** a global `:focus-visible` ring; pink/yellow text that failed AA; the profile avatar `src=""` warning (initials fallback);
  navbar wrapping at 681–960px; the admin topbar, toolbar and two-column forms collapsing at ≤560px.

## Phase 3: Landing page (`src/pages/HomePage.js`)

1. **Hero:** headline "Campus events, from sign-up to certificate.", a one-line promise, **Browse events** (primary) and
   **Sign in** / **Go to dashboard** (secondary, by role: admin → /admin, manager → /manager, student → /my-events).
   The bold element is an admission-ticket graphic built from the next real event (title, date, venue, perforated stub).
   Behind it, a dashed ring turns slowly (60s, linear). This is the only infinite loop on the site, and it stops under reduced motion.
2. **Upcoming events:** 3 `EventCard`s from `useEventContext`, a skeleton while the list loads, and the existing empty state.
   The existing search form and category chips are kept (moved under the hero) so no behavior was lost.
3. **How it works:** Register → Get your ticket → Check in → Get your certificate, with numbered steps
   (the content really is a sequence) and connectors on wide screens.
4. **Roles strip:** Students, Event managers, Admins, one line each.
5. **Footer:** "National University MOA - School of Information Technology".

The staggered fade-up uses `Reveal` (IntersectionObserver, fires once, then disconnects; 60ms steps capped at 240ms).

## Phase 4: Motion

Skill used: the vendored **emilkowalski/skills** (`.agents/skills/animate`, `emil-design-eng`, `RECIPES.md`).
All values come from the tokens, so every animation shares two curves and four durations.

| Animation | Implementation | Principle applied |
|---|---|---|
| Page transition | `PageTransition` (WAAPI) replays fade + 8px rise, 240ms `--ease-out`, on every path change. Attendee pages animate their content, not the sticky navbar. Admin/manager animate only the outlet. Nothing remounts, so page state, focus and scroll are unchanged. | Enter with ease-out; UI ≤ 300ms; "preventing a jarring change" |
| Buttons and pressables | One shared rule for 20 pressable classes: lift 2px on hover, sink into the shadow on press, 150ms. The manager buttons that used to *sink* on hover now behave like the rest. | Press feedback 100–160ms; hover gated by `(hover: hover) and (pointer: fine)` |
| Cards | Only clickable cards (event, notification) lift or press. Stats and panels no longer pretend to be clickable. | Purpose test: no motion without a reason |
| Modals | Overlay fades; the dialog scales 0.96 → 1 over 240ms, centered. Close plays a 150ms exit first (`useDialog`). | Never from `scale(0)`; modals stay centered; exit faster than enter |
| Menus | Notification, profile and admin dropdowns grow from their top-right corner (top-center on mobile), 180ms. The mobile nav slides down. | Origin-aware popovers |
| Drawers | Admin and manager mobile sidebars use `--ease-drawer` at 320ms. | iOS-like drawer curve |
| Toasts | Always mounted; they come up from the bottom edge and leave the same way via **transitions** (320ms `ease`). A new message retargets instead of restarting. | Transitions over keyframes for retriggerable UI; Sonner's slightly slower `ease` |
| Lists and tables | `.stagger` is on only for 600ms after mount (`useEntering`), so rows that appear later (search, filters) don't replay. Steps are 40ms, and the last row starts by 280ms. | 30–80ms stagger; never block interaction |
| Status badges | Background and text color fade 240ms when the status changes in place. | Color change → `ease` |
| Counters | Admin dashboard and manager metrics count from 0 once (400ms ease-out cubic, `tabular-nums`). Non-numeric values like "3 / 50" show as-is. Under reduced motion the final number shows immediately. | Rare/first-view tier |
| Removed | `padding-left` hover on sidebar links and `width` transitions on progress bars (layout properties). Old per-page mount animations were replaced by the page transition. Keyframes went from 11 to 7. | Transform and opacity only |

Reduced motion: the existing single `@media (prefers-reduced-motion: reduce)` block was extended (no new scattered blocks).
It also forces revealed content visible and hides the skeleton shimmer. `PageTransition`, `CountUp`, `useDialog` and `Reveal` check the same media query in JS.

## Phase 5: Skeleton loading

| Where | Rule | Measured |
|---|---|---|
| `ProtectedRoute` while `initializing` | `return null` → `<ShellSkeleton role={requiredRole} />` (navbar or sidebar frame). Guard logic is unchanged. | shell visible ~200–360ms on a direct load, then the page |
| Admin Users | `useSkeleton(page === "users" && no rows, page)`: skeleton only if the list is empty when the page opens, for at most 1.5s, then the normal empty state | shell → table skeleton (360ms) → table |
| Events grid, home events | Skeleton only when the event list hasn't arrived; once shown, it stays ≥ 300ms; never shown when data is already there | skeleton card 408px vs real 404–408px: no layout jump |
| Event detail (direct link) | Added because the page used to flash "Event not found" while events loaded. Only shown while the *list* is empty, so a truly missing event still says "not found". | skeleton → event, no "not found" flash |

Skeleton regions carry `aria-busy="true"`. Blocks are `aria-hidden`. The shimmer is a `transform` on `::after`, static under reduced motion.

## Phase 6: Click sound

`src/components/sound.js` (Web Audio only): a soft 35ms triangle tick on any button click; a rising 660 → 880Hz two-note on success toasts;
a low 196Hz note on error toasts (the sync error toast always counts as an error). Gain is 0.05.
The AudioContext is created only after the first pointer/key gesture. Nothing plays on hover or page load,
and sound is off under reduced motion. `SoundToggle` (icon button, `aria-label="Click sounds"`, `aria-pressed`) sits in the navbar and
both workspace topbars. Its state is saved in `localStorage` with try/catch.
Verified headlessly: 0 contexts after load and hover, 1 note per click, 0 notes while muted, the setting survives a reload,
and under reduced motion the toggle is disabled with no sound.

## Phase 6.5: Simplify

Ponytail mode was active for the whole session (loaded by the SessionStart hook). Its rules were applied directly:
- the smallest complete change
- reuse before adding
- delete before adding
- grep before deleting

| Simplified | Lines |
|---|---|
| Removed CSS for 14 classes nothing renders (`events-hero*`, `events-search`, `events-empty`, `dashboard`, `dashboard__header`, `featured-events-grid`, `featured-card-wrapper`, `home-cta-strip__inner`, `navbar__cta`, `auth-card__divider`, `checkin-confirmed-badge`). Each was checked with a grep over `src/`, including template-built names (`sbadge--${…}`, `event-badge--${…}` etc.). | −114 |
| Removed declarations always overridden by a later identical selector (`.navbar` padding, `.navbar__links` gap, `.icon-btn` background, `.btn--primary/secondary` shadows) | −7 |
| Four attendee modals (cancel, certificate, ticket, feedback) reuse the shared `Modal` instead of copying the overlay/head/close markup. `Modal` gained `className`, `tone` and a render-prop for the animated close. | −40 |
| 15 repeated inline styles → classes (`.action-row`, `.modal-text`, `.panel__text`, `.day-event-*`, …). The remaining inline styles are dynamic values (widths, `--accent`, `--hero-bg`). | ±0 |
| Motion: 11 keyframes → 7 (`slide-in`, `stamp`, `pop`, `manager-arrive`, `manager-pop`, `fade-in` merged into `fade`/`rise`/`scale-in`); per-component transitions folded into one press rule | (in Phase 4) |

Phase 6.5 net: **96 insertions, 218 deletions (−122 lines)**. After it, a rescan finds 0 CSS classes without a JS reference.

**Left alone, on purpose:**
* `ManagerScreen.js` has two near-identical session-form modals (lines ~334 and ~416) with different state shapes. Merging them touches form logic, so they stay.
* `ListPage.js`'s `PAGES` config and `EventsAdmin.js` are dense, but their complexity is data/behavior, not presentation.
* `Logo`'s unused `dark` prop and the `.logo--dark` rule are tiny and part of a component API.
* The empty-state `marginTop` inline styles (3) differ per page and moving them would change spacing.

**Suggestions for `src/context/*` / `server/*` (not edited):**
1. `EventContext`: expose `ready` from `useServerStore` (one line in the provider value). The event skeletons could then use the real flag instead of "empty for ≤1.5s".
2. `AuthContext`: add `accountsLoading` (set true before the accounts request, false in `finally`) so the Users skeleton stops guessing.
3. Admin/manager `toast()`: accept a tone (`toast(msg, "error")`) so the toast sound doesn't have to guess from wording.
4. `useServerStore` sends one request per collection on load (8–10 requests per page). A combined `/api/data?resources=…` endpoint would make every skeleton shorter.

## Phase 7: Verify

Skill used: `design:accessibility-review` (WCAG 2.1 AA checklist), checked with code and a headless browser (DOM and console only).

* **Console:** 0 errors and 0 React warnings across 44 page/state combinations at 375, 768 and 1280px, plus touch emulation at 375px.
* **Overflow:** no horizontal scroll anywhere (baseline had 13 overflowing page/width combinations).
* **Contrast:** an automated scan of every visible text node against its real background on 15 pages found **0 failures**. Key pairs:

| Pair | Ratio | Needed |
|---|---|---|
| `--ink-2` #45413a on cream / white | 10.0 / 10.1 | 4.5 ✅ |
| `--danger-ink` #b91c1c (errors, eyebrows) on cream / white | 6.4 / 6.5 | 4.5 ✅ |
| *Before:* pink #ff6b6b text on cream | 2.7 | 4.5 ❌ (fixed) |
| *Before:* yellow #ffd93d number on white | 1.4 | 3 ❌ (fixed) |
| Ink on yellow / sky / violet / mint / pink fills | 14.4 / 9.9 / 10.7 / 14.1 / 7.1 | 4.5 ✅ |
| Cream step number on ink | 19.4 | 4.5 ✅ |
| Inactive star outline on white (non-text) | 10.1 | 3 ✅ |
| Focus ring ink on cream (non-text) | 19.4 | 3 ✅ |

* **Keyboard:** all 22 Tab stops on the landing page show a ring, in reading order. Modals take focus on open; **Esc closes**
  (all five modals via `useDialog`); **focus returns to the trigger** (verified with the ticket modal).
* **Names:** 0 unnamed buttons/links/inputs, 0 images without `alt`. Star buttons now have labels and `aria-pressed`.
* **Touch targets:** with a phone emulated (coarse pointer), every button, link-button, input and select on 15 pages is ≥ 44px.
* **Reduced motion:** 0 running animations, no page transition, counters show final values, revealed content visible, no shimmer, no sound.
* **Skeletons:** no layout shift (card 408px vs 404–408px).
* **Build:** `npm run build` compiles with no warnings (135 kB JS / 17.7 kB CSS gzipped).

---

## Files changed

`package.json` (build script + lucide-react), `package-lock.json`, `REDESIGN_REPORT.md`, `src/index.css`, `src/App.js` (wrapper only),
`src/components/`: `Button.js`, `CancelModal.js`, `CertificateModal.js`, `EventCard.js`, `FeedbackModal.js`, `Icon.js`, `Navbar.js`,
`NotificationDropdown.js`, `ProtectedRoute.js` (fallback only), `SyncErrorToast.js`, `TicketPassModal.js`, `admin/AdminLayout.js`,
`admin/ui.js`, `manager/ManagerLayout.js`, **new:** `Motion.js`, `Skeleton.js`, `SoundToggle.js`, `Toast.js`, `sound.js`.
`src/pages/`: `HomePage.js`, `EventsPage.js`, `EventDetail.js`, `MyEventsPage.js`, `AttendancePage.js`, `CertificatesPage.js`,
`NotificationsPage.js`, `ProfilePage.js`, `SchedulePage.js`, `admin/AdminDashboard.js`, `admin/EventsAdmin.js`, `admin/ListPage.js`,
`admin/SettingsPage.js`, `manager/ManagerScreen.js`.
**Not touched:** `src/context/*`, `server/*`, `src/api.js`, routes, guards, redirects, auth logic.

## Decisions I made for you

1. **Branch, not `main`.** The session runs in an isolated git worktree, so all commits are on **`worktree-ui-redesign`**,
   pushed to `origin`. Nothing was pushed to `main`, and no PR was opened. The branch starts from your local `main` (b621077), which includes
   your two unpushed commits.
2. **No Co-Authored-By line** on commits, per your saved preference.
3. **Visual identity** kept (Default 1). Footer school name per Default 2. Admin Users skeleton uses the UI heuristic (Default 3).
4. **Backend:** it ran. I copied `server/.env` from your main checkout into the worktree (gitignored), used your local MongoDB, and ran
   `npm --prefix server run seed`, which **reset the passwords** of the three seed accounts to the documented ones.
   The frontend ran on port 3100 because your own dev server was on 3000. The backend was started with `CLIENT_URL=http://localhost:3100`
   set in the environment (no file changed) so CORS allowed it.
5. **Page transition without a keyed remount.** A `key={pathname}` wrapper would remount pages and reset their local state
   (filters, half-filled forms, open tabs). WAAPI replays the enter animation on path change instead: same look, no behavior change.
6. **Event data is not from localStorage anymore.** It comes from the API via `useServerStore`, which has a `ready` flag that the context
   doesn't expose. So event skeletons use the same "empty for ≤1.5s, ≥300ms once shown" heuristic as Users.
7. **Event-detail skeleton added** (not in the list) because a direct link flashed "Event not found" while loading.
8. **Landing kept the existing search box, category chips and "More to explore"** so no landing behavior was lost.
   "Go to dashboard" targets: admin → /admin, manager → /manager, student → /my-events (`/workspace` is a placeholder page).
9. **44px targets on touch screens only** (`pointer: coarse`). Desktop keeps the dense admin/manager tables. New controls
   (landing CTAs 52–54px, sound toggle) meet 44px on touch.
10. **Shimmer runs 1.2s per sweep.** The 150–400ms rule is for UI transitions; a 400ms loading sweep looks frantic. It only runs while
    something is loading (≤1.5s) and is off under reduced motion.
11. **Counters** count up once per dashboard visit (not once per session).
12. **Toast sound tone** for admin/manager toasts is picked from the wording (cannot/failed/not available → error). See suggestion 3.
13. **Sound toggle also in the admin and manager topbars**, not only the attendee navbar, so every role can mute.
14. **Non-clickable cards** (stats, panels) no longer lift on hover. Lifting suggests they are clickable.
15. **Emil's rule vs a hard rule:** Emil says reduced motion should mean "gentler, not zero". Your rule says reduced motion disables
    animation and sound. The hard rule won (Default 6): reduced motion keeps the existing global kill switch.

## Skipped, not verified, or for you to decide

* **Skills:** all requested skills were available (emilkowalski/skills is vendored in `.agents/skills`). None were missing.
* **Manager inline modals** (session forms in `ManagerScreen.js`) got the new enter animation but not Esc/focus-return/exit,
  because they are inline JSX inside long lines of form logic. They can be moved to the shared `Modal` later.
* **Not verified by eye:** colors, the landing composition and motion feel were checked by code and DOM measurement only (no screenshots, as asked).
  Emil's advice is to watch the transitions at 2–5× slow speed in DevTools before the panel.
* **Printing:** "Print / Save as PDF" still prints the whole page, as before. A print stylesheet that prints only the certificate/ticket
  would be a good follow-up.
* **Screen readers:** checked by DOM rules (names, roles, `aria-*`), not with NVDA/VoiceOver.
* **Seeded data:** pages were checked with the data already in your local database (including the demo events from `tools/redesign`).

