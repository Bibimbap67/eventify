import React, { Suspense, lazy, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../../components/Navbar.js";
import Icon from "../../components/Icon.js";
import Spinner from "../../components/Spinner.js";
import { api } from "../../api.js";
import { cleanCredentialId, credentialFromQr } from "../../data/credential.js";

// The staff desk's camera reader, loaded only when someone opens the scanner.
const QrScanner = lazy(() => import("../../components/staff/QrScanner.js"));

// Anyone, signed in or not, can check a certificate is real: type its credential ID or scan the
// QR printed on it. A certificate's QR leads straight to /verify/<credential ID>.
export default function VerifyPage() {
  const { credentialId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true });
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  useEffect(() => {
    if (!credentialId) return;
    setState({ loading: true });
    api(`/certificates/verify/${encodeURIComponent(credentialId)}`)
      .then((data) => setState({ certificate: data.certificate }))
      .catch((err) => setState({ error: err.message }));
  }, [credentialId]);

  const check = (id) => navigate(`/verify/${encodeURIComponent(id)}`);

  const handleScan = (text) => {
    const id = credentialFromQr(text);
    if (!id) {
      setScanError("This isn't an Eventify certificate QR. Scan the QR printed on the certificate.");
      return;
    }
    setScanning(false);
    setScanError("");
    check(id);
  };

  if (!credentialId) {
    const id = cleanCredentialId(code);
    return (
      <div className="verify-page">
        <Navbar />
        <main className="verify-container">
          <span className="events-hero__eyebrow">CERTIFICATE VERIFICATION</span>
          <h1 className="verify-title">VERIFY A CERTIFICATE</h1>
          <section className="verify-card">
            <p>Enter the credential ID printed on the certificate, or scan its QR code. No sign-in needed.</p>
            <form className="verify-form" onSubmit={(e) => { e.preventDefault(); if (id) check(id); }}>
              <label className="verify-form__label" htmlFor="credential-id">CREDENTIAL ID</label>
              <input
                id="credential-id"
                className="input"
                placeholder="e.g. CERT-NU-2026-AB12CD34"
                autoComplete="off"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <div className="verify-form__actions">
                <button type="submit" className="btn-sm btn-sm--yellow" disabled={!id}>
                  <Icon name="shield" size={16} /> Verify
                </button>
                <button type="button" className="btn-sm" onClick={() => { setScanning((open) => !open); setScanError(""); }} aria-expanded={scanning}>
                  <Icon name="scan" size={16} /> {scanning ? "Close scanner" : "Scan QR"}
                </button>
              </div>
            </form>
            {scanning && (
              <Suspense fallback={<Spinner />}>
                <QrScanner onScan={handleScan} />
              </Suspense>
            )}
            {scanError && <p className="form-error" role="alert">{scanError}</p>}
          </section>
        </main>
      </div>
    );
  }

  const { loading, certificate, error } = state;

  return (
    <div className="verify-page">
      <Navbar />
      <main className="verify-container">
        <span className="events-hero__eyebrow">CERTIFICATE VERIFICATION</span>
        <h1 className="verify-title">{credentialId}</h1>
        <section className={`verify-card${certificate ? " verify-card--ok" : error ? " verify-card--bad" : ""}`} aria-live="polite">
          {loading ? (
            <p>Checking this credential…</p>
          ) : certificate ? (
            <>
              <div className="verify-card__head"><Icon name="check-circle" size={24} /> <strong>Valid certificate</strong></div>
              <dl className="verify-card__facts">
                <div><dt>Awarded to</dt><dd>{certificate.recipientName}</dd></div>
                <div><dt>Event</dt><dd>{certificate.eventTitle}</dd></div>
                <div><dt>Date issued</dt><dd>{certificate.issueDate}</dd></div>
                {certificate.hoursEarned && <div><dt>Credential</dt><dd>{certificate.hoursEarned}</dd></div>}
              </dl>
            </>
          ) : (
            <>
              <div className="verify-card__head"><Icon name="alert" size={24} /> <strong>Not verified</strong></div>
              <p>{error}</p>
            </>
          )}
        </section>
        <div className="verify-form__actions">
          <button type="button" className="btn-sm btn-sm--yellow" onClick={() => { setCode(""); navigate("/verify"); }}>
            <Icon name="refresh" size={16} /> Verify another certificate
          </button>
          <Link to="/events" className="btn-sm">Explore events <Icon name="arrow-right" size={16} /></Link>
        </div>
      </main>
    </div>
  );
}
