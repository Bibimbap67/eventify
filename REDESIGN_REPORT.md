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
| `--text-xl` | clamp(24px, 3vw, 36px) | Section titles |
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
5. **Contrast fixes:** pink text → `--danger-ink` (#b91c1c, 6.2:1 on cream). Yellow/near-black inline numbers → ink.
6. **Fix the 768px and 375px horizontal overflow** (navbar wrap; admin toolbar and forms collapse).
7. **Modal / dropdown / toast motion:** scale 0.96 + fade for modals, origin-aware dropdowns, toasts that slide in with a transition instead of keyframes.
8. **Type and spacing tokens** applied to the repeated page headers, eyebrows, panels and cards (the worst offenders).
9. **Shadow scale:** `--shadow-sm` 3px, `--shadow` 5px, `--shadow-lg` 8px.
10. **Touch targets ≥44px** on coarse pointers, plus a visible focus ring on every interactive element.

