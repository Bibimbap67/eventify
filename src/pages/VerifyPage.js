import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import Icon from "../components/Icon.js";
import { api } from "../api.js";

// Where a certificate's QR code leads: anyone can confirm the credential ID is real.
export default function VerifyPage() {
  const { credentialId } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    setState({ loading: true });
    api(`/certificates/verify/${encodeURIComponent(credentialId)}`)
      .then((data) => setState({ certificate: data.certificate }))
      .catch((err) => setState({ error: err.message }));
  }, [credentialId]);

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
        <Link to="/events" className="btn-sm">Explore events <Icon name="arrow-right" size={16} /></Link>
      </main>
    </div>
  );
}
