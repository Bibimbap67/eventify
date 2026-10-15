import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../../components/Navbar.js";
import Icon from "../../components/Icon.js";
import Spinner from "../../components/Spinner.js";
import { ExitResult, ExitScanModal, useExitVerify } from "../../components/attendee/ExitScan.js";

// Where a phone's camera lands after scanning the exit QR (/exit/<eventId>?code=<code>):
// verifies the signed-in attendee's exit straight away.
export default function ExitPage() {
  const { eventId } = useParams();
  const [params] = useSearchParams();
  const [{ busy, result }, verify] = useExitVerify();
  const [scanning, setScanning] = useState(false);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return; // a code works once, so never send it twice
    sent.current = true;
    verify({ eventId, code: params.get("code") || "" });
  }, [eventId, params, verify]);

  return (
    <div className="attendance-page">
      <Navbar />
      <main className="exit-page">
        <span className="events-hero__eyebrow">LEAVING THE EVENT</span>
        <h1 className="attendance-title">EXIT VERIFICATION</h1>
        {busy || !result ? (
          <p className="staff-result__hint"><Spinner /> Verifying your exit…</p>
        ) : (
          <ExitResult result={result} />
        )}
        {result && result.result !== "exited" && (
          <div className="exit-page__actions">
            <button type="button" className="btn-sm btn-sm--blue" onClick={() => setScanning(true)}>
              <Icon name="scan" size={16} /> Scan the code again
            </button>
            <Link to="/my-events" className="btn-sm">My Events</Link>
          </div>
        )}
      </main>
      {scanning && <ExitScanModal onClose={() => setScanning(false)} />}
    </div>
  );
}
