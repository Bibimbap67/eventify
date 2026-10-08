import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export const SYNC_ERROR_EVENT = "eventify:sync-error";

function snapshot(data, keys) {
  return Object.fromEntries(keys.map((key) => [
    key,
    new Map((data[key] || []).map((record) => [record.id, JSON.stringify(record)])),
  ]));
}

function emptyData(keys) {
  return Object.fromEntries(keys.map((key) => [key, []]));
}

// Keeps a group of MongoDB collections in React state, replacing the old localStorage effects.
//
//   resources:  { stateKey: "api-resource" }, e.g. { events: "manager-events" } (keep it a constant)
//   sessionKey: reload everything when this changes (the signed-in user's id)
//
// Contexts update `data` with setData exactly like normal state. After every change the hook
// compares it to the last known server copy and POSTs only the added, edited or removed
// records to /api/data/:resource/batch. If the server rejects a change, the store reloads so
// the screen matches the database again.
export function useServerStore(resources, sessionKey) {
  const keys = Object.keys(resources);
  const [data, setData] = useState(() => emptyData(keys));
  // The data exactly as the server last returned it (used for live registration counts).
  const [loaded, setLoaded] = useState(() => emptyData(keys));
  const [ready, setReady] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const baseline = useRef(null);
  const queue = useRef(Promise.resolve());
  const loadedSession = useRef(undefined);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (loadedSession.current !== sessionKey) {
      // Different user: drop the previous user's records before loading new ones.
      loadedSession.current = sessionKey;
      baseline.current = null;
      setData(emptyData(keys));
      setLoaded(emptyData(keys));
      setReady(false);
    }

    (async () => {
      await queue.current; // let pending saves finish before reading back
      const lists = await Promise.all(keys.map((key) => api(`/data/${resources[key]}`).then((res) => res.items)));
      if (cancelled) return;
      const next = Object.fromEntries(keys.map((key, index) => [key, lists[index]]));
      baseline.current = snapshot(next, keys);
      setData(next);
      setLoaded(next);
      setReady(true);
    })().catch((err) => {
      if (!cancelled) window.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, { detail: err.message }));
    });

    return () => {
      cancelled = true;
    };
    // `resources` is a module-level constant, so keys never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, reloadCount]);

  useEffect(() => {
    const previous = baseline.current;
    if (!previous) return; // nothing loaded yet, or switching users
    const current = snapshot(data, keys);
    baseline.current = current;

    const batches = keys.map((key) => {
      const save = [];
      const remove = [];
      current[key].forEach((json, id) => {
        if (previous[key].get(id) !== json) save.push(JSON.parse(json));
      });
      previous[key].forEach((json, id) => {
        if (!current[key].has(id)) remove.push(id);
      });
      return { resource: resources[key], save, remove };
    }).filter((batch) => batch.save.length || batch.remove.length);
    if (!batches.length) return;

    // Send in order so two quick edits to one record cannot arrive out of order.
    queue.current = queue.current
      .then(() => Promise.all(batches.map(({ resource, save, remove }) =>
        api(`/data/${resource}/batch`, { method: "POST", body: { save, remove } })
      )))
      .catch((err) => {
        window.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, { detail: err.message }));
        reload();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return { data, setData, loaded, ready, reload };
}

// Confirmed registrations for an event. The server count covers everyone; `loaded` and
// `current` are the registrations this user can see, so local changes show up instantly.
export function liveRegisteredCount(event, loadedRegistrations, currentRegistrations) {
  const confirmed = (list) => list.filter((item) => item.eventId === event.id && item.status === "Confirmed").length;
  return Math.max(0, (event.registeredCount || 0) - confirmed(loadedRegistrations) + confirmed(currentRegistrations));
}
