import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.js";
import Icon from "../components/Icon.js";
import { useEntering } from "../components/Motion.js";
import { useEventContext } from "../context/EventContext.js";
import CertificateModal from "../components/CertificateModal.js";

export default function CertificatesPage() {
  const entering = useEntering();
  const { certificates, userProfile } = useEventContext();
  const [selectedCert, setSelectedCert] = useState(null);

  return (
    <div className="certificates-page">
      <Navbar />

      <main className="certificates-container">
        {/* Header */}
        <div className="certificates-header">
          <div>
            <span className="events-hero__eyebrow">ACCREDITED RECOGNITION</span>
            <h1 className="certificates-title">MY CERTIFICATES & CREDENTIALS</h1>
            <p className="certificates-subtitle">
              Official records of attendance and hours earned from verified National University technical events.
            </p>
          </div>

          <div className="certificates-meta-pill">
            <span>EARNED BY:</span> <b>{userProfile.name}</b>
          </div>
        </div>

        {/* Certificates Grid */}
        {certificates.length === 0 ? (
          <div className="empty-events-box" style={{ marginTop: "32px" }}>
            <span className="empty-box__icon"><Icon name="certificate" size={28} /></span>
            <h3>No certificates earned yet</h3>
            <p>
              Certificates of participation are automatically generated and issued once you attend and complete your registered campus events.
            </p>
            <Link to="/events" className="btn-sm btn-sm--yellow">
              Browse Upcoming Events <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        ) : (
          <div className={`certificates-grid${entering ? " stagger" : ""}`}>
            {certificates.map((cert) => (
              <article key={cert.id} className="certificate-card">
                <div className="cert-card__top">
                  <span className="sbadge sbadge--issued"><Icon name="check" size={16} /> VERIFIED PARTICIPATION</span>
                  <span className="cert-card__id">{cert.credentialId}</span>
                </div>

                <h3 className="cert-card__title">{cert.eventTitle}</h3>
                <p className="cert-card__organizer">{cert.organizer}</p>

                <div className="cert-card__details">
                  <div>
                    <small>RECIPIENT</small>
                    <strong>{cert.recipientName}</strong>
                  </div>
                  <div>
                    <small>DATE ISSUED</small>
                    <strong>{cert.issueDate}</strong>
                  </div>
                </div>

                {cert.hoursEarned && (
                  <div className="cert-card__hours">
                    <span><Icon name="clock" size={15} /> {cert.hoursEarned}</span>
                  </div>
                )}

                <div className="cert-card__footer">
                  <button
                    type="button"
                    className="btn-sm btn-sm--yellow btn-block"
                    onClick={() => setSelectedCert(cert)}
                  >
                    <Icon name="certificate" size={16} /> View & Print Certificate
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Certificate Modal */}
      {selectedCert && (
        <CertificateModal
          certificate={selectedCert}
          onClose={() => setSelectedCert(null)}
        />
      )}
    </div>
  );
}
