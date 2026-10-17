# Code Style Guide

How code in Eventify should be written, so it reads like my own class projects
(crud-library, crud-review, midterm, browser-router, react-practice, nostradamus, my-react-app).
If you're Claude or anyone else editing this repo, write code this way.

Eventify is bigger than those projects, so some of its patterns go beyond them. Those patterns
are listed under **Keep (Eventify-specific)**. Don't "simplify" them away: removing them
changes how the app behaves.

## Components

- Plain function components written in JSX. No React `createElement` / `h()`.
  (`document.createElement` for a download link or canvas is fine: that's the browser, not React.)
- Write components as `export default function Name()`. That's what Eventify already uses everywhere.
- **One main component per file.** A small helper component used only in that file can stay
  (like `VenueForm` inside `VenuesAdmin.js`). A component that other files import gets its own file.
- Props are destructured in the parameter.

```js
export default function BookDetails({ book, onDelete, onEdit }) {
  const { title, pages, genre } = book;

  return (
    <div className="book-card">
      <h2>BOOK NAME: {title}</h2>
      <h2>BOOK PAGES: {pages}</h2>
      <h2>BOOK GENRE: {genre}</h2>
      <button onClick={onDelete}>DELETE</button>
      <button onClick={onEdit}>EDIT</button>
    </div>
  );
}
```

## State

- Use `useState` for page and form state.
- Keep a form in **one object** with **one change handler** (from `crud-library/BookForm.js`):

```js
const BLANK = { name: "", location: "", capacity: "" };

const [form, setForm] = useState(BLANK);

const handleChange = (key) => (e) => {
  setForm((current) => ({ ...current, [key]: e.target.value }));
};
```

- Track editable items by **`id`, not array index**. New records get their id from `newId()` in `src/api.js`.
- `key={index}` is OK only for lists that never get edited, removed or reordered
  (lines of text, star icons, skeleton placeholders).

## Naming

- Handlers are plain verbs: `createEvent`, `updateEvent`, `deleteEvent`, `handleSubmit`,
  `handleChange`, `resetForm`, `goToPage`.
- No one-word names like `set`, `go` or `run` for handlers. Use a name that says what it does.

## CRUD pattern

- Use short CAPS section comments (`// CREATE`, `// UPDATE`, `// DELETE`, `// VALIDATION`). Taglish is fine.
- Update state without changing the old array: spread to add, `.map` to update, `.filter` to delete.
- Validate first and `return` early. Show the errors under the fields (`errors` object + `noValidate` on the form).
- Show the Edit or Add button with a ternary:

```js
<button type="submit">{venue ? "Save changes" : "Add venue"}</button>
```

## Readability

- Keep lines under about **120 characters**. Break up long lines:
  - long JSX tags: put one prop per line
  - long conditions: give each part a name first (`const overCapacity = ...`)
  - long object literals: one field per line
- Use `if / else` with braces when a ternary has more than one `? :` or doesn't fit on one line.
- Comments: keep the existing full-sentence comments that explain **why**. Add CAPS section comments for
  the **what**. Don't add comments that just repeat the code.

## Fetching data

- All requests go through `api()` in `src/api.js`. It adds the token, handles 401 and turns errors into
  `Error(message)`. Don't call `fetch` or axios directly, and don't write the server URL anywhere else.
- Use `async/await` with `try/catch`, plus a loading or saving state:

```js
const saveVenue = async () => {
  setSaving(true);
  try {
    await api("/data/venues/batch", { method: "POST", body: changes });
    toast("Venue saved.");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    setSaving(false);
  }
};
```

## Server (Express)

- CommonJS (`require` / `module.exports`). That's what the server uses. Don't switch it to `import`.
- `routes/` files only connect a URL to a controller. The work goes in `controllers/`, and shared rules go in `utils/`.
- Check `req.body` first and return early with a status code: `res.status(400).json({ message: "..." })`.
- Error replies always use the key **`message`** (the frontend's `api()` reads `data.message`). Never `error`.
- No `try/catch` in every route: Express 5 sends errors from async routes to the one error handler in
  `server.js`. Only use `try/catch` when that route has to do something special on failure.

```js
const createVenue = async (req, res) => {
  const name = String(req.body.name || "").trim();

  // VALIDATION
  if (!name) return res.status(400).json({ message: "Enter the venue name." });

  const venue = await Venue.create({ name });
  res.status(201).json(venue);
};
```

## Keep (Eventify-specific)

These look "advanced" next to my class projects, but the app needs them. Keep them as they are:

- **Shared custom hooks** (`useApi`, `useFilters`, `usePaged`, `useConfirm`, `useServerStore`, `useAuth`, ...).
  A hook that 2 or more files use stays a hook. Copying its code into every page would be the copy-paste habit.
- **`useCallback` / `useMemo` in contexts and in effect dependencies.** Removing them makes effects re-run
  on every render (extra requests, loops).
- **`ConfirmModal` / `useConfirm` and `toast()`** instead of `window.confirm` and `alert`. Only
  `SettingsPage`'s "leave with unsaved changes" check uses `window.confirm`.
- **The context files** (`AuthContext`, `EventContext`, `ManagerContext`, `AdminContext`). They hold the shared data.
- **`ponytail:` comments.** They mark a known limit on purpose.

## Styling

- Plain CSS classes (`className`, never `class`). Inline `style={{ }}` only for values worked out in code
  (widths, colours from data).

## Before and after a refactor

- A style refactor changes how the code **looks**, never what it **does**: same inputs, same outputs, same screens.
- Run both test suites before and after: `npm test` (frontend) and `npm --prefix server test` (server).
- Tests only cover `src/data/` and the server rules, so also open the pages you touched and click through them.

## Don't

- No React `createElement` / `h()`, no TypeScript, no extra libraries for a few lines.
- No long JSDoc banners.
- No clever one-liners I'd have to decode.
- No commented-out old code or unused state. Delete it.
- No copy-pasted components. Import the one that already exists.
