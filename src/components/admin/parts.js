import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api.js";
import Icon from "../Icon.js";
import { SearchField, plural } from "../ui.js";
import { prefersReducedMotion } from "../Motion.js";

// Shared pieces of the admin area (pages live in pages/admin/). The visual parts come from
// components/ui.js, like the Event Manager workspace, so both internal areas look the same.
// Lists that grow without limit (users, registrations, the audit log) are read one page at a
// time from the server instead of being loaded whole. Pagination and usePaged are also used by
// the manager and attendee pages for lists already in memory.

export const ROLES = [
  { value: "admin", label: "Admin", many: "Admins", text: "Full access: users, events, venues, settings and the audit log." },
  { value: "manager", label: "Event Manager", many: "Event managers", text: "Creates events and runs their registrations, schedule, attendance and feedback." },
  { value: "staff", label: "Staff", many: "Staff", text: "Scans attendees' QR tickets at the check-in desk." },
  { value: "user", label: "Attendee", many: "Attendees", text: "Registers for events and gets tickets and certificates." },
];
export const roleLabel = (value) => ROLES.find((role) => role.value === value)?.label || value || "—";

// GET `path` (re-runs when it changes). The previous answer stays on screen while the next
// one loads, so tables dim instead of flashing empty. A null path fetches nothing.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: "", loading: Boolean(path) });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return undefined;
    let live = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    api(path)
      .then((data) => live && setState({ data, error: "", loading: false }))
      .catch((err) => live && setState((current) => ({ ...current, error: err.message, loading: false })));
    return () => {
      live = false;
    };
  }, [path, version]);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}

// Filters live in the address bar, so a filtered list can be linked to and survives a reload.
// `defaults` must be a constant. Changing any filter other than the page goes back to page 1.
export function useFilters(defaults) {
  const [params, setParams] = useSearchParams();
  const values = { ...defaults };
  Object.keys(defaults).forEach((key) => {
    if (params.has(key)) values[key] = params.get(key);
  });
  const setFilters = useCallback((patch) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || String(value) === String(defaults[key])) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      if (!("page" in patch)) next.delete("page");
      return next;
    }, { replace: true });
  }, [defaults, setParams]);
  return [values, setFilters];
}

// Query string from filter values, leaving out the empty ones ("" means "all").
export const toQuery = (values) => new URLSearchParams(
  Object.entries(values).filter(([, value]) => value !== "" && value !== undefined && value !== null)
).toString();

// A search box that sends its text on 300ms after typing stops (one request, not one per key).
export function SearchFilter({ label, placeholder, value, onSearch }) {
  const [text, setText] = useState(value);
  const latest = useRef({ value, onSearch });
  latest.current = { value, onSearch };
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text !== latest.current.value) latest.current.onSearch(text);
    }, 300);
    return () => clearTimeout(timer);
  }, [text]);
  // "Clear filters" and links change the value from outside.
  useEffect(() => setText(value), [value]);
  return <SearchField label={label} placeholder={placeholder} value={text} onChange={setText} />;
}

// Page bar under a list. Hidden while everything fits on one page. Changing page brings the
// top of the list (the element just before the bar) back into view. Attendee pages pass
// buttonClass="btn-sm" to match their buttons.
export function Pagination({ page, limit, total, noun, onPage, busy = false, buttonClass = "manager-button manager-button--small" }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const navRef = useRef(null);
  // Deleting the last row of the last page leaves the page empty: step back one.
  useEffect(() => {
    if (total > 0 && page > pages) onPage(pages);
  }, [onPage, page, pages, total]);
  if (pages <= 1) return null;
  const first = (page - 1) * limit + 1;
  const last = Math.min(total, page * limit);
  const goToPage = (next) => {
    onPage(next);
    navRef.current?.previousElementSibling?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };
  return (
    <nav className="admin-pager" aria-label="Pages" ref={navRef}>
      <span className="admin-pager__count">{first}–{last} of {plural(total, noun)}</span>
      <span className="admin-pager__buttons">
        <button type="button" className={buttonClass} disabled={busy || page <= 1} onClick={() => goToPage(page - 1)}>
          <Icon name="chevron-left" size={16} /> Previous
        </button>
        <span className="admin-pager__page">Page {page} of {pages}</span>
        <button type="button" className={buttonClass} disabled={busy || page >= pages} onClick={() => goToPage(page + 1)}>
          Next <Icon name="chevron-right" size={16} />
        </button>
      </span>
    </nav>
  );
}

// One page of a list that is already in memory, for <Pagination>. A new `resetKey` (the
// search, filters or tab) starts again at page 1. With `param`, the page is also written to
// the URL (?page=2) and read back when the list opens, so going back returns to the same page.
// ponytail: after a filter change the URL keeps the old page until the next page change; it
// is only read when the list opens, and Pagination steps back if that page no longer exists.
export function usePaged(items, size, resetKey = "", param = null) {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState(() => ({ key: resetKey, page: Math.max(1, Number(param && params.get(param)) || 1) }));
  const page = state.key === resetKey ? state.page : 1;
  const setPage = useCallback((value) => {
    setState({ key: resetKey, page: value });
    if (!param) return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value > 1) {
        next.set(param, value);
      } else {
        next.delete(param);
      }
      return next;
    }, { replace: true });
  }, [param, resetKey, setParams]);
  return { page, setPage, shown: items.slice((page - 1) * size, page * size) };
}

// A failed request, with a way to try again. Never shown as an empty list.
export function LoadError({ message, onRetry }) {
  return (
    <div className="admin-error" role="alert">
      <Icon name="alert" size={20} />
      <span>
        <strong>Couldn't load this list.</strong>
        <small>{message}</small>
      </span>
      {onRetry && (
        <button type="button" className="manager-button manager-button--small" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Try again
        </button>
      )}
    </div>
  );
}

// Closes a menu on Escape or on a click outside `ref`.
export function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, open, ref]);
}

// Server times are UTC; these show them in the viewer's own time zone.
const DATE_TIME = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const RELATIVE = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export const formatDateTime = (value) => (value ? DATE_TIME.format(new Date(value)) : "—");
export const formatDate = (value) => (value ? DATE.format(new Date(value)) : "—");
// Event and registration days are stored as "YYYY-MM-DD"; noon keeps them on the right day everywhere.
export const formatDay = (day) => (/^\d{4}-\d{2}-\d{2}$/.test(day || "") ? DATE.format(new Date(`${day}T12:00:00`)) : day || "—");

export function timeAgo(value) {
  if (!value) return "—";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const steps = [[60, "second"], [3600, "minute"], [86400, "hour"], [604800, "day"]];
  if (Math.abs(seconds) < 45) return "just now";
  for (let i = 1; i < steps.length; i += 1) {
    if (Math.abs(seconds) < steps[i][0]) return RELATIVE.format(Math.round(seconds / steps[i - 1][0]), steps[i][1]);
  }
  return formatDate(value);
}

// Downloads `rows` (arrays of cells) as a CSV file.
export function downloadCsv(filename, header, rows) {
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const text = [header, ...rows].map((row) => row.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}
