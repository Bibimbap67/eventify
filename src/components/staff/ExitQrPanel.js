import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../Icon.js";
import Spinner from "../Spinner.js";
import { useQrCode } from "../DocExport.js";
import { api } from "../../api.js";
import { exitLink, opensLabel } from "../../data/checkIn.js";

const POLL_MS = 2000;

// Exit verification for one event (`event` from GET /api/staff/events). Staff start it as the
// event ends and turn the screen to the door; attendees scan the code with their own account.
// The server replaces a code once it's used or 30 seconds old, so this only asks every 2 seconds.
export default function ExitQrPanel({ event, onExit }) {
  const [state, setState] = useState(null); // GET /api/staff/events/:id/exit
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0); // answers that arrive after Start / Stop are stale
  const base = `/staff/events/${encodeURIComponent(event.id)}/exit`;
  const qr = useQrCode(state?.active && state.code ? exitLink(event.id, state.code) : "");

  const load = useCallback(() => {
    const asked = generation.current;
    api(base)
      .then((next) => asked === generation.current && setState(next))
      .catch((err) => setError(err.message));
  }, [base]);

  useEffect(() => {
    setState(null);
    setError("");
    load();
  }, [load]);

  useEffect(() => {
    if (!state?.active) return undefined;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [state?.active, load]);

  // Before exit opens: look again the moment it does, so the Start button appears by itself.
  const opensAt = event.exitOpensAt ? new Date(event.exitOpensAt) : null;
  const waiting = state && !state.open && opensAt && opensAt > Date.now();
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setTimeout(load, Math.min(opensAt - Date.now() + 500, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [waiting, opensAt?.getTime(), load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Someone just exited: let the desk refresh its attendee list.
  const exited = state?.exited;
  const seen = useRef(exited);
  useEffect(() => {
    if (seen.current !== undefined && exited !== seen.current) onExit?.();
    seen.current = exited;
  }, [exited, onExit]);

  const run = async (method) => {
    generation.current += 1;
    setBusy(true);
    setError("");
    try {
      setState(await api(base, { method }));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <section className="staff-panel exit-panel" aria-labelledby="exit-title">
      <h2 className="staff-panel__title" id="exit-title"><Icon name="logout" size={20} /> Exit verification</h2>

      {!state ? (
        <p className="staff-result__hint">{error ? "" : "Loading…"}</p>
      ) : state.active ? (
        <div className="exit-qr">
          <div className="exit-qr__code">
            {qr ? <img src={qr} alt="Exit QR code. Attendees scan it with their Eventify account." /> : <Spinner />}
            <span
              key={state.code}
              className="exit-qr__timer"
              style={{ "--exit-ms": `${state.expiresIn}ms`, "--exit-start": Math.min(1, state.expiresIn / state.codeMs) }}
              aria-hidden="true"
            />
          </div>
          <div className="exit-qr__side">
            <p className="exit-qr__count"><b>{state.exited}</b> of {state.checkedIn} checked-in attendees have exited</p>
            <p className="staff-result__hint">
              Attendees scan this with their phone camera or in Eventify (My Events → Scan exit QR). Each code works
              once and changes every 30 seconds. Check each person's name below as they leave.
            </p>
            {state.recent.length > 0 && (
              <ol className="staff-log">
                {state.recent.map((entry) => (
                  <li key={entry.id} className="staff-log__item staff-log__item--ok">
                    <span className="staff-log__time">{entry.exitedAt}</span>
                    <span className="staff-log__name">{entry.name}</span>
                    <span className="staff-log__result">{entry.method === "manual" ? "Marked by manager" : "Exited"}</span>
                  </li>
                ))}
              </ol>
            )}
            <button type="button" className="btn-sm btn-sm--danger" onClick={() => run("DELETE")} disabled={busy}>
              <Icon name="pause" size={16} /> Stop exit verification
            </button>
          </div>
        </div>
      ) : state.open ? (
        <>
          <p className="staff-result__hint">
            {event.title} is ending. Show the exit QR at the door so attendees can scan out and get their certificates.
            {" "}{state.exited} of {state.checkedIn} checked-in attendees have exited.
          </p>
          <button type="button" className="btn-sm btn-sm--yellow exit-panel__start" onClick={() => run("POST")} disabled={busy}>
            {busy ? <Spinner /> : <Icon name="qr" size={16} />} Start Exit Verification
          </button>
        </>
      ) : (
        <p className="staff-result__hint">
          {waiting
            ? `Exit verification opens ${opensLabel(opensAt)}, 15 minutes before ${event.title} ends.`
            : opensAt
            ? "Exit verification has closed for this event. The event's manager can still mark someone as exited."
            : "This event has no end time, so exit verification can't run."}
        </p>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
