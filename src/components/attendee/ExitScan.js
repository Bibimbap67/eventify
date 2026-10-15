import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon.js";
import { Modal } from "../Modal.js";
import Spinner from "../Spinner.js";
import { api } from "../../api.js";
import { useEventContext } from "../../context/EventContext.js";
import { exitOpensAt, exitPhase, opensLabel, parseExitLink } from "../../data/checkIn.js";

// The staff desk's camera reader, loaded only when an attendee opens the exit scanner.
const QrScanner = lazy(() => import("../staff/QrScanner.js"));

// How each server answer looks (the check-in desk's result styles).
const RESULTS = {
  exited: { tone: "ok", icon: "check-circle", title: "Exit verified" },
  duplicate: { tone: "warn", icon: "alert", title: "Already verified" },
  expired: { tone: "warn", icon: "clock", title: "Code expired" },
  closed: { tone: "warn", icon: "alert", title: "Exit not running" },
};

// Sends a scanned code to the server. A verified exit reloads tickets and certificates.
export function useExitVerify() {
  const { refresh } = useEventContext();
  const [state, setState] = useState({ busy: false, result: null });
  const verify = useCallback(async ({ eventId, code }) => {
    setState({ busy: true, result: null });
    let result;
    try {
      result = await api("/exit", { method: "POST", body: { eventId, code } });
    } catch (err) {
      result = { result: "invalid", message: err.message };
    }
    setState({ busy: false, result });
    if (result.result === "exited") refresh();
  }, [refresh]);
  return [state, verify];
}

export function ExitResult({ result }) {
  const shown = RESULTS[result.result] || { tone: "bad", icon: "close", title: "Not verified" };
  return (
    <div className={`staff-result staff-result--${shown.tone}`} role="status">
      <div className="staff-result__head">
        <Icon name={shown.icon} size={24} />
        <strong>{shown.title}</strong>
      </div>
      <p className="staff-result__message">{result.message}</p>
      {result.result === "exited" && (
        <Link to={result.certificate ? "/certificates" : "/my-events"} className="btn-sm btn-sm--yellow exit-result__link">
          <Icon name={result.certificate ? "certificate" : "ticket"} size={16} /> {result.certificate ? "View certificate" : "My Events"}
        </Link>
      )}
    </div>
  );
}

export function ExitScanModal({ onClose }) {
  const [{ busy, result }, verify] = useExitVerify();
  const [error, setError] = useState("");

  const handleScan = (text) => {
    const scanned = parseExitLink(text);
    if (!scanned) {
      setError("That's not an exit QR code. Scan the code on the event staff's exit screen.");
      return;
    }
    setError("");
    verify(scanned);
  };

  return (
    <Modal title="Scan the exit QR" onClose={onClose}>
      {result?.result === "exited" ? (
        <ExitResult result={result} />
      ) : (
        <div className="exit-scan">
          <p className="modal-text">
            Point your camera at the exit QR on the staff screen. Each code works once and changes every 30 seconds.
          </p>
          <Suspense fallback={<Spinner />}>
            <QrScanner onScan={handleScan} paused={busy} />
          </Suspense>
          {busy && <p className="staff-result__hint"><Spinner /> Verifying your exit…</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {result && <ExitResult result={result} />}
        </div>
      )}
    </Modal>
  );
}

// The exit step on a checked-in ticket (`event` as EventContext lists it): scan while exit
// verification is open, otherwise say when it opens or that it has closed.
export function ExitScanButton({ event }) {
  const [open, setOpen] = useState(false);
  const times = event && { date: event.isoDate, endTime: event.endTime };
  const phase = exitPhase(times);
  const opensAt = phase === "before" ? exitOpensAt(times) : null;
  const [, rerender] = useState(0);
  // Unlock the button the moment exit opens, without a page refresh.
  useEffect(() => {
    if (!opensAt) return undefined;
    const timer = setTimeout(() => rerender((n) => n + 1), Math.min(opensAt - Date.now() + 50, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [opensAt?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (opensAt) {
    return <button type="button" className="btn-sm" disabled><Icon name="clock" size={16} /> Exit scan opens {opensLabel(opensAt)}</button>;
  }
  if (phase === "closed") {
    return <button type="button" className="btn-sm" disabled title="Ask the event's organizer to record your exit.">Exit scan closed</button>;
  }
  return (
    <>
      <button type="button" className="btn-sm btn-sm--blue" onClick={() => setOpen(true)}>
        <Icon name="scan" size={16} /> Scan exit QR
      </button>
      {open && <ExitScanModal onClose={() => setOpen(false)} />}
    </>
  );
}
