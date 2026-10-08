import React from "react";
import Icon from "./Icon.js";
import { Modal } from "./admin/ui.js";

export default function CertificateModal({ certificate, onClose }) {
  if (!certificate) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal title="CERTIFICATE OF PARTICIPATION" onClose={onClose} className="certificate-modal-wrap">
      {(close) => (
        <>
          {/* Formal Certificate Document */}
          <div className="formal-certificate-doc">
            <div className="cert-border-inner">
              <div className="cert-header">
                <span className="cert-inst-name">NATIONAL UNIVERSITY · MOA</span>
                <span className="cert-dept">SCHOOL OF INFORMATION TECHNOLOGY</span>
              </div>

              <div className="cert-title-block">
                <span className="cert-present-text">THIS IS TO CERTIFY THAT</span>
                <h1 className="cert-recipient-name">{certificate.recipientName}</h1>
                <p className="cert-body-text">
                  has actively participated in and successfully completed the technical conference session on
                </p>
                <h2 className="cert-event-title">{certificate.eventTitle}</h2>
                <p className="cert-hours-text">
                  Conducted by <b>{certificate.organizer}</b> on <u>{certificate.issueDate}</u>.
                </p>
                {certificate.hoursEarned && (
                  <span className="cert-hours-tag">CREDIT ALLOCATED: {certificate.hoursEarned}</span>
                )}
              </div>

              <div className="cert-footer-row">
                <div className="cert-signature-block">
                  <div className="sig-line" />
                  <strong>{certificate.signatoryName || "Dr. Ronald Reyes"}</strong>
                  <small>{certificate.signatoryRole || "Dean, School of IT"}</small>
                </div>

                <div className="cert-seal-badge">
                  <div className="gold-seal-circle">
                    <span>OFFICIAL</span>
                    <b>NU MOA</b>
                    <small>SEAL</small>
                  </div>
                </div>

                <div className="cert-signature-block">
                  <div className="sig-line" />
                  <strong>Prof. Grace Uy</strong>
                  <small>Academic Director & Program Head</small>
                </div>
              </div>

              <div className="cert-credential-strip">
                <span>CREDENTIAL ID: <b>{certificate.credentialId}</b></span>
                <small>Issued via Eventify Campus Verification</small>
              </div>
            </div>
          </div>

          <div className="action-row">
            <button type="button" className="btn-sm btn-sm--yellow" onClick={handlePrint}>
              <Icon name="print" size={16} /> Print / Save as PDF
            </button>
            <button type="button" className="btn-sm" onClick={close}>
              Close Preview
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
