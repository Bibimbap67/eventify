# Eventify: Neo-Brutalist Redesign (Master Prompt)

> Paste everything below into Claude Code, opened at the root of the `eventify` repo.
> Work in phases. Stop at every **CHECKPOINT** and wait for me to reply "continue".

---

## 0. Role and context

You are a senior product designer and front-end engineer. You are polishing **Eventify**, a school event management system for **National University MOA, School of Information Technology**. It is a finals project that will be shown to a panel, so it has to look intentional and finished, and it must keep working exactly as it does now.

Stack: React 19, react-router 7, create-react-app, one large `src/index.css` (about 2,700 lines), no UI library. Backend: Express + MongoDB in `server/`. All app data (events, registrations, certificates, notifications and the rest) now loads from the API through `src/context/useServerStore.js`. It no longer comes from localStorage, so loading waits are real.

**The visual identity stays neo-brutalist.** That means the current cream background, thick black borders, hard offset shadows, yellow/pink/violet/sky accents, Archivo Black headings, Space Mono labels and Inter body text. You are refining and unifying that identity across every page. Do not replace it.

Reference mockups I approved (private to my claude.ai account; open them with the Artifact tool if you can, otherwise follow the spec in this prompt):
- Redesign preview, "Neo-brutalist" look: https://claude.ai/artifact/JRvM4T9yQtLrmfwbwzfauk
- Scroll effects lab (effects A–G): https://claude.ai/artifact/HNpEar13dMnDgpRk6w4Q46

---

## 1. Decisions already made (do not re-ask)

| Topic | Decision |
|---|---|
| Visual direction | Neo-brutalist, refined. Light mode is the default and the main showcase. |
| Dark mode | A **brutalist dark** variant (same borders and hard shadows, dark ground). It is **off by default**. Users can choose Off / On / Match my device. |
| Preferences | A user Preferences panel with: sound (on/off + volume), reduce motion (Match device / On / Off), dark mode, text size (S/M/L), high contrast, underline all links, density (Comfortable/Compact), default events view (Grid/List), start page after login. |
| Where preferences live | In the **user account** (MongoDB), with localStorage as the instant cache and the guest fallback. Backend change stays **minimal** (see Phase 3). |
| Status colors | Green = positive, red = rejected/cancelled/full/error, yellow = pending/warning, sky = in-progress info, gray = neutral. **Published / Registration Open is green.** Color is never the only signal: every status also has an icon and a text label. |
| Scroll effects on the landing page | All seven: **A** reveal on scroll, **B** scroll progress bar + back-to-top, **C** category marquee, **D** stats count-up, **E** sticky "How it works", **F** parallax hero shapes, **G** swipeable event row on phones. |
| Login page | Show/hide password, caps-lock warning, inline field errors, password strength meter on Sign up, live upcoming events on the hero panel, demo-account quick-fill buttons in development builds only. |
| Process | Phased, with a checkpoint and screenshots after every phase. |

---

## 2. Hard rules

**Scope of edits**
- Presentation first: CSS, JS markup, small UI components and hooks.
- **Allowed exceptions (preferences only):** `server/models/User.js` (add a `preferences` field), `server/controllers/authController.js` (accept and validate `preferences` in `updateMe`), `src/index.js` (wrap the app in the new `PreferencesProvider`), `public/index.html` (a tiny inline script that applies saved preferences before React mounts, so there is no flash).
- `src/pages/LoginPage.js` may change where the user lands after login, but **only** by reading the "start page" preference, and only to a page that role can already open. Otherwise keep the current role-based redirect.
- Do **not** change anything else in `src/context/*`, `server/*`, routing in `src/App.js`, or auth logic. If you think one of those needs a change, stop and ask me.
- Keep every existing class name working. Add new classes; never rename old ones. Add aliases instead of renaming tokens.

**Dependencies**
- At most 2 new dependencies in total. Allowed: `lucide-react`. Anything else needs my approval first.
- No framer-motion, no toast library, no component library. Animation is plain CSS, WAAPI, or small hooks.

**Motion**
- Every UI animation runs 150–400ms and animates only `transform` and `opacity`.
- Exceptions I have already approved: the skeleton shimmer (1.2s loop while loading only), the category marquee (C) as the **only** element that loops forever, and the dashboard and landing count-ups (up to 700ms, once).
- Animation never blocks interaction. Nothing animates on elements that update frequently (live counters, typing, filters, search results).
- Hover motion only under `@media (hover: hover) and (pointer: fine)`.
- **Reduced motion turns animation and sound fully off.** Use the OS setting or the user's "Reduce motion" preference, whichever is stricter. Extend the existing `@media (prefers-reduced-motion: reduce)` block near line 2136 of `index.css`, and mirror it with an `html.rm` class driven by the preference.

**Accessibility (WCAG 2.2 AA)**
- Text contrast at least 4.5:1 (3:1 for large text and for UI parts such as borders and icons). Re-check every color pair you introduce.
- Visible keyboard focus everywhere: a 3px solid outline with a 3px offset, plus a yellow halo on light and a cream halo on dark.
- Touch targets at least 44×44px.
- Status is never shown by color alone (WCAG 1.4.1): always color + icon + text.
- Anything that moves for more than 5 seconds has a pause control (WCAG 2.2.2). This applies to the marquee.
- Icon-only buttons have an `aria-label`. Decorative icons have `aria-hidden="true"`.

**Responsive**
- Must work at **375px, 768px and 1280px**, with no horizontal page scroll at any width.
- Also test text size L at 375px.

**Neo-brutalist rules (from research; keep them consistent)**
- Borders are solid and flat, 2–5px. Use 3px for surfaces and buttons, and 2px for chips, tags and table rules.
- Shadows have **zero blur**: a solid offset block (`5px 5px 0 var(--ink)`), never a soft gradient shadow.
- Flat color fills. No gradients on surfaces and no glassmorphism.
- Corner radius 0 for surfaces and buttons. Pills (chips, badges) and avatars may be fully round. Use one radius rule and apply it everywhere.
- Big, confident type: uppercase Archivo Black for headings, Space Mono for labels and metadata, Inter for body text.
- Bright accents sit on a calm cream ground. Use one loud thing per section, not five.

---

## 3. Skills to use

First run `ListSkills`/`SearchSkills` and list in the chat which of these exist, in one line each. If a skill is missing, say so once and continue without it. Do not invent its rules.

| Skill | Where | Use it for |
|---|---|---|
| `animate` | `.agents/skills/animate` (+ `RECIPES.md`) | Every animation: the should-it-animate gate, easing, durations, enter/exit, press/hover. |
| `review-animations` | `.agents/skills/review-animations` (+ `STANDARDS.md`) | Review your motion at the end of Phase 7. Fix anything it blocks. |
| `improve-animations` | `.agents/skills/improve-animations` | The motion audit part of Phase 1. |
| `find-animation-opportunities` | `.agents/skills/find-animation-opportunities` | Phase 7 planning: where motion helps and where it should be rejected. |
| `emil-design-eng` | `.agents/skills/emil-design-eng` | General polish: component states, invisible details. |
| `mobile-native` | `.agents/skills/mobile-native` | Phase 6/11: tap highlight, 100vh, input zoom, sticky hover on phones. |
| `break-ui` | `.agents/skills/break-ui` | Phase 11: worst-case data (long names, long emails, 0 events, huge counts). |
| `run` | built-in | Launching the app and taking screenshots. |
| `simplify` | built-in | Phase 10 cleanup. It replaces `ponytail`, which is not installed. |
| `code-review` | built-in | Final correctness pass over the diff. |
| `frontend-design`, `design:design-critique`, `design:design-system`, `design:accessibility-review` | only if installed | Use them where named in the phases. If missing, follow the checklists in this prompt instead. |

**Do not** use `pick-ui-library`, `ask-sonner` or `apple-design` to add libraries or glass effects. Those conflict with the hard rules.

**Conflict rule:** when a skill's advice conflicts with a hard rule, the hard rule wins. Tell me about the conflict in one line. Known conflicts:
- `animate` keeps gentle fades under reduced motion; my rule turns motion fully off.
- `animate` suggests a component library for toasts and modals; use plain CSS.
- Its scroll-reveal recipe runs 600ms with `clip-path`; use a 400ms fade-up instead.

---

## 4. Design system spec (Phase 2 builds this)

### 4.1 Color tokens

Keep the old tokens and alias them; do not delete them. `--color-blue` is actually `#0a0a0a`, so add `--ink` and point new code at it.

```css
:root {
  /* ground + ink */
  --bg: #fffdf5;           /* cream page */
  --bg-2: #fff6d8;         /* alt section band */
  --surface: #ffffff;
  --ink: #0a0a0a;          /* = old --color-blue / --color-black */
  --ink-2: #45413a;        /* muted text, 9.96:1 on --bg */
  --line: #0a0a0a;         /* borders */
  --shadow-ink: #0a0a0a;   /* hard shadow color */

  /* brand accents (decoration, categories, highlights; never status) */
  --yellow: #ffd93d; --pink: #ff6b6b; --violet: #c4b5fd; --sky: #4fc4ee; --mint: #86efac;

  /* semantic status: fill + text on fill + strong ink for text/icons on cream */
  --success-bg: #86efac; --success-fg: #0a0a0a; --success-ink: #15803d;   /* 14.1:1 / 4.92:1 */
  --danger-bg:  #ff6b6b; --danger-fg:  #0a0a0a; --danger-ink:  #b91c1c;   /* 7.13:1 / 6.35:1 */
  --warning-bg: #ffd93d; --warning-fg: #0a0a0a; --warning-ink: #a16207;   /* 14.37:1 / 4.83:1 */
  --info-bg:    #4fc4ee; --info-fg:    #0a0a0a; --info-ink:    #0369a1;   /* 9.86:1 / 5.83:1 */
  --neutral-bg: #e7e2d3; --neutral-fg: #0a0a0a; --neutral-ink: #45413a;   /* 15.29:1 */

  --focus: #0a0a0a; --focus-halo: #ffd93d;
}
:root[data-theme="dark"] {           /* brutalist dark: same structure, dark ground */
  --bg: #121110; --bg-2: #1c1a17; --surface: #1c1a17;
  --ink: #fffdf5; --ink-2: #c9c2b0;    /* 18.52:1 / 10.62:1 on --bg */
  --line: #fffdf5; --shadow-ink: #fffdf5;
  --success-ink: #4ade80; --danger-ink: #f87171; --warning-ink: #ffd93d; --info-ink: #7dd3fc;
  --focus: #fffdf5; --focus-halo: #121110;
  /* status fills keep their saturated colors with #0a0a0a text, so the ratios above still hold */
}
```

Dark mode is applied with `data-theme="dark"` on `<html>`, only when the preference says On, or says "Match my device" and the OS is dark. The default is **Off**. Check every page in dark mode. The surfaces that currently hardcode `#000` or `#fff` must move to tokens.

High contrast (`data-contrast="high"`): borders 4px, `--ink-2` becomes `--ink`, links underlined, focus outline 4px.

### 4.2 Status map

Create one `StatusBadge` component and one `statusStyle(status)` helper, and use them everywhere. Remove the ad-hoc badge colors per page.

| Tone | Statuses found in the code | Icon (lucide) |
|---|---|---|
| success (green) | Approved, Published, REGISTRATION OPEN, Registration Open, Confirmed, Attended, Issued, Active | `circle-check` |
| warning (yellow) | Pending, PENDING, OPENS SOON, Filling fast, Almost full | `clock` |
| danger (red) | Rejected, Cancelled, Full, errors | `circle-x` |
| info (sky) | Checked in, Eligible, Ongoing | `scan-line` (Checked in) / `info` |
| neutral (gray) | Draft, Not Checked In, Completed, COMPLETED, Registration Closed, Inactive | `circle-dashed` |

Run `grep -rhoE '"[A-Z][A-Za-z ]+"' src` to catch statuses I missed, and map each one. Display labels in Title Case even if the stored value is uppercase. **Never change stored values.**

Badge: pill shape, 2px border in `--line`, fill `--{tone}-bg`, text `--{tone}-fg`, 16px icon followed by the label, Space Mono 12px uppercase. On change, the new badge fades in (opacity 0.2→1, scale 0.92→1, 240ms).

### 4.3 Spacing, type, shape, motion tokens

```css
:root {
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  /* 6-step type scale in rem so the Text size preference can scale the root */
  --fs-xs: 0.75rem; --fs-sm: 0.875rem; --fs-base: 1rem; --fs-lg: 1.25rem;
  --fs-xl: clamp(1.5rem, 3.2vw, 2rem); --fs-2xl: clamp(2.375rem, 7vw, 4.5rem);

  --border-w: 3px; --border-w-sm: 2px; --radius: 0; --radius-pill: 999px;
  --shadow: 5px 5px 0 var(--shadow-ink); --shadow-sm: 3px 3px 0 var(--shadow-ink);

  --duration-press: 140ms; --duration-fast: 180ms; --duration-base: 240ms;
  --duration-slow: 320ms; --duration-reveal: 400ms;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);       /* all enters/exits */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* on-screen movement */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* drawers/sheets */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* success check pop only */
}
html[data-text="sm"] { font-size: 93.75%; }  /* 15px */
html[data-text="lg"] { font-size: 112.5%; }  /* 18px */
```

Replace hardcoded padding, margin, gap and font-size values with tokens **as you touch each component**. Don't do a blind find-and-replace across 2,700 lines.

### 4.4 Icons

- Install `lucide-react`. Keep `src/components/Icon.js` and its `name` API working: map the existing names (`menu`, `calendar`, `pin`, `ticket`, …) to Lucide components inside it, so no call site breaks.
- Use one size scale (16/20/24) and stroke width 2.
- Replace emoji and ad-hoc glyphs (`✓`, `→`, `↓`, `★`, …) with icons.
- Every icon sits next to text, or its button has an `aria-label`.

### 4.5 Shared pieces to create (small, in `src/components/ui/`)

- `Button`: variants primary (yellow), secondary (white), danger (pink), ghost; states hover, active, focus-visible, disabled, loading (spinner + "…ing" label, `aria-busy`), success. Minimum height 48px (44px for the small size).
- `StatusBadge`, `Skeleton` (line, block, card, table-row), `Reveal` (IntersectionObserver, runs once), `Toast` + `useToast` (CSS only), `Drawer`, `CountUp`, `ScrollProgress`, `BackToTop`, `Marquee`.
- Hooks: `useReducedMotion()` (OS **or** preference), `usePrefersDark()`, `useInViewOnce()`.
- `sound.js`: see Phase 9.

### 4.6 The hard-shadow press technique (keeps the "transform/opacity only" rule)

Animating `box-shadow` breaks the rule. Draw the shadow on a pseudo-element instead and move only transforms:

```css
.lift { position: relative; isolation: isolate; background: none; border: 0;
        transition: transform var(--duration-fast) var(--ease-out); }
.lift::before, .lift::after { content: ""; position: absolute; inset: 0; pointer-events: none; }
.lift::before { z-index: -2; background: var(--shadow-ink); transform: translate(5px, 5px);
                transition: transform var(--duration-fast) var(--ease-out); }
.lift::after  { z-index: -1; background: var(--face, var(--surface)); border: var(--border-w) solid var(--line); }
@media (hover: hover) and (pointer: fine) {
  .lift:not(.is-static):hover { transform: translate(-3px, -3px); }
  .lift:not(.is-static):hover::before { transform: translate(8px, 8px); }
}
.lift:not(.is-static):active { transform: translate(5px, 5px); transition-duration: var(--duration-press); }
.lift:not(.is-static):active::before { transform: translate(0, 0); transition-duration: var(--duration-press); }
```

Content inside `.lift` needs `padding: var(--border-w)` wherever a child touches the edge (for example a card's color band), so it doesn't cover the border. Never put `overflow: hidden` on a `.lift` element.

---

## 5. Phases

At every **CHECKPOINT**:
1. Run the app and take screenshots of the pages you changed at 375, 768 and 1280 into `docs/redesign/after/phase-N/`.
2. Run `npm run build` and confirm no new warnings.
3. List the files you changed and give a 3–5 line summary.
4. Note any skill conflict.
5. Commit on the current branch with a clear message. **Do not push and do not open a PR unless I ask.**
6. Stop and wait for "continue".

### Phase 0: Setup and baseline
1. Install deps (`npm install`, `npm --prefix server install`). If `server/.env` is missing, tell me which variables are needed (`MONGODB_URI`, `JWT_SECRET`, optional `CLIENT_URL`, `PORT`) and stop. **Never print secret values.**
2. `npm --prefix server run seed`, then run backend (`npm run server`) and frontend (`npm start`).
3. Log in as each role (admin@eventify.com / Admin@12345, manager@eventify.com / Manager@12345, student@eventify.com / Student@12345). Screenshot every page at 375/768/1280 into `docs/redesign/before/`. Pages: landing, login, sign up, events, event detail, my events (+ ticket modal), schedule, attendance, certificates (+ modal), notifications, profile, every admin page, every manager page and tab.
4. Note console errors that already exist so you don't take the blame for them later.

**CHECKPOINT 0**

### Phase 1: Audit (no code changes)
Use `design:design-critique` and `design:design-system` if installed, plus `improve-animations` for motion. Write `docs/redesign/AUDIT.md` (keep it short) covering:
- How consistent the neo-brutalist style is today, page by page.
- Token problems (for example, `--color-blue` is near-black) and the alias plan.
- Every distinct padding/margin/gap and font-size value found, mapped to the scales in 4.3.
- Status colors in use today vs. the map in 4.2.
- Layout problems per page (alignment, density, awkward wrapping, overflow at 375).
- Pages that look inconsistent with each other.
- **Top 10 fixes ranked by visual impact.**

**CHECKPOINT 1**

### Phase 2: Foundation
Use `frontend-design` if installed. Build section 4: tokens (light + dark + high contrast), the status map, `lucide-react` + the `Icon` adapter, the shared pieces in 4.5 and the `.lift` technique. Don't restyle pages yet, except that swapping emoji for icons is fine.

**CHECKPOINT 2**

### Phase 3: Preferences
**Backend (minimal):**
- `server/models/User.js`: add `preferences: { type: Object, default: {} }`.
- `authController.updateMe`: if `req.body.preferences` is present, **whitelist and validate** each key against the allowed values below, drop anything else, merge into the existing `user.preferences`, call `user.markModified("preferences")` and save. Invalid values → 400 with a clear message.
- No new routes. `AuthContext.updateProfile(patch)` already sends a PATCH to `/api/auth/me` and stores the returned user, so `src/context/*` stays untouched.

| Key | Values | Default |
|---|---|---|
| `theme` | `"light"`, `"dark"`, `"system"` | `"light"` |
| `motion` | `"system"`, `"reduce"`, `"full"` | `"system"` |
| `sound` | `true`, `false` | `true` |
| `volume` | 0–100 (integer) | 40 |
| `textSize` | `"sm"`, `"md"`, `"lg"` | `"md"` |
| `contrast` | `"normal"`, `"high"` | `"normal"` |
| `underlineLinks` | `true`, `false` | `false` |
| `density` | `"comfortable"`, `"compact"` | `"comfortable"` |
| `eventsView` | `"grid"`, `"list"` | `"grid"` |
| `startPage` | role-dependent route key | role default |

**Frontend:**
- `src/preferences/PreferencesProvider.js` + `usePreferences()`. Sources, in order: signed-in `user.preferences` → localStorage `eventify_prefs` → defaults.
- Apply preferences as attributes on `<html>`: `data-theme`, `data-text`, `data-contrast`, `data-density`, `data-links`, and the class `rm`.
- Write to localStorage immediately. When signed in, debounce saves to the server through `updateProfile({ preferences })` (500ms). On save failure, show a toast and keep the local value.
- On first login, if the server has no preferences but localStorage does, push the local ones up once.
- `public/index.html`: a small inline script that reads `eventify_prefs` and sets the same `<html>` attributes before React renders, so there is no theme flash. Wrap it in try/catch.
- **UI:** a `PreferencesDrawer`, sliding from the right with `--ease-drawer` at 320ms.
  - Open it from a gear button in `Navbar`, `AdminLayout` and `ManagerLayout` (this avoids a new route), and from a "Preferences" link on `ProfilePage`.
  - Sections: Appearance (Theme, Text size, High contrast, Underline links), Motion & sound (Reduce motion, Sound + volume slider + a "Play test sound" button), Layout (Density, Default events view, Start page).
  - Use real radio groups and switches with labels, and preview each change live.
  - Add a "Reset to defaults" button with an inline confirm. (`confirm()` is not allowed.)
- Wire the "Default events view" into `EventsPage` (add a list layout) and density into tables and cards.

**CHECKPOINT 3** (include screenshots of light, dark, high contrast and text size L)

### Phase 4: Landing page (`src/pages/HomePage.js`)
Keep all existing data logic (`upcomingEvents`, recommendations, the signed-in status banner, search). Sections in order:
1. **Hero:** eyebrow "NU MOA · Campus events · AY 2026–2027", headline (for example "Campus events, from sign-up to certificate."), one-line promise, primary "Browse events", secondary "Sign in" (or "My events" when signed in), plus the existing search bar. Brutalist shapes (yellow disc, pink tile, sky square) with **F parallax**: transform-only, speeds 0.12–0.45, at most about 60px of travel, only while the hero is in view, through one rAF-throttled passive scroll listener.
2. **C category marquee:** category pills (thick border, small hard shadow, alternating accent fills) linking to `/events?category=…`. 40s linear loop. Pauses on hover, on focus-within, and with a visible **Pause/Play** button. Duplicate items get `aria-hidden` and `tabindex="-1"`. Under reduced motion it becomes a static, horizontally scrollable row. This is the only infinite loop on the site.
3. **Upcoming events:** 3 `EventCard`s from real data. **G:** below 900px they become a scroll-snap row (`grid-auto-flow: column`, `scroll-snap-type: x mandatory`) with a "1 / 3" position label. Above that width, a grid.
4. **D stats band:** 4 big numbers from real context data (published events, registrations, check-ins, certificates). Count up once when 50% visible, 700ms ease-out. Show final values immediately under reduced motion.
5. **E How it works:** Register → Get your ticket → Check in → Get your certificate, with lucide icons `user-plus`, `ticket`, `scan-line`, `award`. Desktop: a sticky panel shows the active step while the four step cards scroll past. An IntersectionObserver with `rootMargin: "-45% 0px -45% 0px"` marks the active card (yellow fill + lift), and the panel text crossfades in 200ms. Phones: a compact sticky strip. Reduced motion: a plain 4-column grid (2 columns at 768, 1 at 375).
6. **Roles strip:** Students, Event managers, Admins, one line each, with an icon.
7. **Footer:** "National University MOA · School of Information Technology", plus links.
- **A reveal:** section heads and cards fade up 12px, 400ms, 60ms stagger per batch, **once**. Above-the-fold content must never start hidden, so a screenshot or a slow device still shows a complete page.
- **B:** a 6px yellow scroll-progress bar with a 2px ink bottom border, pinned under the sticky navbar and driven by `scaleX`. A back-to-top button (yellow, hard shadow, `aria-label`) appears after one viewport and moves focus to the hero heading when used. Add B to long pages too (event detail, admin lists).

**CHECKPOINT 4**

### Phase 5: Login and sign-up (`src/pages/LoginPage.js`, `AuthTabs.js`, `TextField.js`)
Keep the split layout, the validation rules and the auth calls exactly as they are.
- **Show/hide password:** an eye toggle button inside the field (`aria-pressed`, `aria-label` "Show password"/"Hide password"), keeping cursor position.
- **Caps-lock warning** under password fields (`getModifierState("CapsLock")`), announced politely.
- **Inline errors** under each field (`aria-describedby`, `aria-invalid`), plus the existing form-level error. On submit, focus the first invalid field.
- **Strength meter** (Sign up only): 4 chunky segments + a label (Too short / Weak / Okay / Strong). Red → yellow → green using the semantic tokens, always with the text label. It is advisory only; the existing minimum-6 rule stays the only blocker.
- **Live events on the hero:** the left panel shows the next 2–3 upcoming events from `useEventContext()` (title, date, venue) as small brutalist cards. While loading, show skeletons; if there are none, show a friendly line.
- **Demo account buttons:** Student / Manager / Admin, which fill the email and password fields. They do **not** auto-submit. Render them **only** when `process.env.NODE_ENV === "development"`. Confirm with a production build that they are absent.
- The submit button uses the Button loading state. On success, play the success sound; on failure, play the error sound. Do not add a shake animation.

**CHECKPOINT 5**

### Phase 6: Every other page, made consistent
Apply the system to: Events (grid + list view, filters, search), Event detail, My events (+ ticket pass modal), Schedule, Attendance, Certificates (+ certificate modal), Notifications (+ dropdown), Profile, Feedback modal, Cancel modal, Sync error toast, Admin (layout, dashboard, events, list pages, settings), Manager (layout and every section/tab).
- **Consistency checklist** for every page:
  - Same page header pattern (Space Mono eyebrow + Archivo Black title + optional action on the right).
  - Same container width (1180px) and gutters (16px on phones, 24px from 768px).
  - Same card, table, form-field, empty-state and badge components.
  - Same section spacing (`--space-7`/`--space-8`).
- **Tables:** sticky header, 2px row rules, 56px rows (48px compact), right-aligned numbers with `tabular-nums`, horizontal scroll inside their own container on phones. Phone-friendly card layout for tables with more than 5 columns.
- **Empty states:** icon + one sentence on what will appear + the action that fills it.
- **Forms:** labels above fields, 3px borders, hard-shadow focus, inline errors as on the login page.
- Use `mobile-native` for phone details (tap highlight, `100dvh`, 16px inputs so iOS doesn't zoom).

**CHECKPOINT 6** (screenshots of every page)

### Phase 7: Motion pass
Load `animate` + `RECIPES.md` before writing any motion. Use `find-animation-opportunities` to plan, then review with `review-animations` and fix what it flags. For each animation, write one line in `docs/redesign/MOTION.md`: element, purpose, frequency tier, curve, duration, and the principle applied.
- **Page transitions:** fade + 8px rise, 240ms `--ease-out`, on route change only. Don't replay on re-render, and don't delay focus or interaction.
- **Hover/press:** the `.lift` technique on cards, buttons, stat tiles and nav pills; `scale(0.97)` press on chips and icon buttons.
- **Modals:** scale 0.96→1 + opacity, backdrop fade, 250ms. The exit plays in reverse; keep the node mounted until the exit finishes. Trap focus, close on Escape, and return focus to the trigger.
- **Drawers** (mobile nav, preferences): slide in and out with `--ease-drawer`, 320ms.
- **Toasts:** slide up from the bottom + fade, 300ms, using transitions (not keyframes) so rapid toasts retarget. They exit the same way. Keep at most 3.
- **Lists and tables:** 40ms stagger capped at 8 items, on **first load only**, never on filter, search or re-render.
- **Status badges:** the 240ms fade-in from 4.2 when a status changes.
- **Dashboard counters:** count up once per session per page, then show static numbers.
- **Mobile nav dropdown:** opacity + scale 0.98 from the top-right origin, 180ms.
- **Success check** in the ticket modal: a pop with `--ease-spring`, 320ms. This is the only use of the spring curve.

**CHECKPOINT 7**

### Phase 8: Skeleton loading
Real waits only:
- **App shell** while `initializing === true` (`ProtectedRoute` and the first paint): a navbar + page-header skeleton.
- **Events grid/list, home upcoming events, login hero events** while the server store loads.
- **Admin Users table** while accounts load. Manager tables while their data loads.

Every skeleton:
- Matches the final layout's size, so nothing jumps.
- Has `aria-busy` on the container and visually hidden "Loading…" text.
- Shows for at least 300ms once it appears, to avoid flicker. It does not show at all if data arrives within 150ms.
- Shimmers with `transform: translateX`. Under reduced motion it is a static block.

**CHECKPOINT 8**

### Phase 9: Click sounds (`src/ui/sound.js`)
- Generate sounds with the Web Audio API; no audio files. Use one shared `AudioContext`, created **only after the first user gesture** (pointerdown/keydown).
  - **Tick** (buttons): triangle wave, 1250Hz, 35ms, gain about 0.03 × volume.
  - **Success:** sine 659Hz then 988Hz (90ms apart), about 0.05 × volume.
  - **Error:** sine 196Hz, 240ms, about 0.07 × volume.
- Exponential gain envelopes (no clicks).
- Never play on hover, focus, page load, or programmatic events. Play the tick on deliberate clicks of buttons, chips and nav items, and not on text links inside paragraphs.
- Play success on register / approve / publish / save preferences, and error on failed actions and validation failures.
- A mute toggle in the navbar (`volume-2`/`volume-x`, `aria-pressed`, `aria-label`) that is synced with the preference. It is off and disabled automatically when reduced motion is active, with a tooltip saying why.

**CHECKPOINT 9**

### Phase 10: Simplify
Run the built-in `simplify` skill (`ponytail` is not installed) over every file you created or changed, plus `src/index.css`, `ListPage.js`, `ManagerScreen.js`, `EventsAdmin.js`, `MyEventsPage.js`.
- Look for duplicated CSS rules, unused classes and keyframes (prove a class is unused with a grep before deleting it), repeated inline styles, copy-pasted components that could share one, dead code, and over-complicated JSX.
- Apply **only safe presentation changes**. For `src/context/*` and `server/*`, report suggestions only.
- Re-take screenshots and compare them with the Phase 6 ones: no visual or behavior change.
- Report what was simplified, what was left alone and why, and the net lines removed (`git diff --stat`).

**CHECKPOINT 10**

### Phase 11: Verify and deliver
Use `design:accessibility-review` if installed, otherwise the checklist below. Use `break-ui` for worst-case data and `code-review` on the full diff.
- Re-take every Phase 0 screenshot at 375/768/1280 into `docs/redesign/after/final/`. Also capture dark mode, high contrast and text size L at 375 for landing, login, events, event detail and one admin and one manager table.
- **Check:**
  - No layout shift when skeletons resolve.
  - No new console errors.
  - Full keyboard pass (tab order, focus visible, Escape closes layers, focus returns).
  - Contrast table for every token pair.
  - The status map used everywhere (grep for leftover hardcoded status colors).
  - Reduced motion (OS and preference) disables animation and sound.
  - Preferences persist across reload and across log out / log in.
  - Demo buttons absent from the production build.
  - No horizontal scroll at 375.
- Run `npm run build` and fix every warning you introduced.
- **Deliverables:**
  1. A short before/after summary with paired screenshots (`docs/redesign/SUMMARY.md`).
  2. The list of files changed.
  3. Anything skipped and anything that needs my decision.

Keep chat updates short. Never paste whole files into the chat.

---

## 6. Extras you may add if they stay inside the rules (ask before starting any of them)
- A "Skip to content" link on every page.
- A visible "Last synced" note near admin and manager tables, using the existing sync state.
- A `/` keyboard shortcut that focuses event search (no animation on it, per the `animate` frequency rule).
- A print-friendly stylesheet for certificates and ticket passes (`@media print`).

---

### Research references used for this prompt
- Neo-brutalism styling rules (border widths, zero-blur shadows, flat fills, radius debate): [Plus Addons: neo-brutalism web design](https://theplusaddons.com/blog/neo-brutalism-web-design/), [Onething Design: neo-brutalism UI trend](https://www.onething.design/blogs/neo-brutalism-ui-design-trend), [Medium: Neo Brutalism Web Design](https://medium.com/@designstudiouiux/neo-brutalism-web-design-what-it-is-why-it-works-and-when-to-use-it-f5d7932fa8ec)
- Neo-brutalist badge patterns: [RetroUI badge on 21st.dev](https://21st.dev/@retroui/components/badge.md)
- Status color + label + icon (never color alone): [W3C Understanding SC 1.4.1 Use of Color](https://w3.org/WAI/WCAG21/Understanding/use-of-color)
- Motion values: Emil Kowalski's `animate` skill in `.agents/skills/animate`.
