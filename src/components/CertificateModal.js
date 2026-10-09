import React, { useRef, useState } from "react";
import Icon from "./Icon.js";
import { Modal } from "./admin/ui.js";
import { DocPreview, fileSafe, printNode, savePng, useQrCode } from "./DocExport.js";

const CERT_WIDTH = 1100;

export default function CertificateModal({ certificate, onClose }) {
  const docRef = useRef(null);
  const [error, setError] = useState("");
  const qr = useQrCode(certificate ? `${window.location.origin}/verify/${encodeURIComponent(certificate.credentialId)}` : "");
  if (!certificate) return null;

  const organizerLines = String(certificate.organizer || "School of Information Technology · National University MOA").split("·");
  const name = `certificate-${fileSafe(certificate.eventTitle)}`;

  const run = (action) => async () => {
    setError("");
    try {
      await action();
    } catch {
      setError("Could not export the certificate. Try again.");
    }
  };

  return (
    <Modal title="CERTIFICATE OF PARTICIPATION" onClose={onClose} className="certificate-modal-wrap">
      {(close) => (
        <>
          <DocPreview width={CERT_WIDTH}>
            <div className="ecert" ref={docRef}>
              <div className="ecert__header">
                <div className="ecert__brand">
                  <div className="ecert__brand-box">E</div>
                  <div>
                    <div className="ecert__brand-name">EVENTIFY</div>
                    <div className="ecert__brand-sub">EVENT MANAGEMENT SYSTEM</div>
                  </div>
                </div>
                <div className="ecert__label">OFFICIAL CREDENTIAL</div>
              </div>

              <div className="ecert__title">
                <h1>CERTIFICATE</h1>
                <p>OF PARTICIPATION</p>
              </div>

              <div className="ecert__recipient">
                <div className="ecert__presented">THIS CERTIFICATE IS PROUDLY PRESENTED TO</div>
                <div className="ecert__name">{certificate.recipientName}</div>
              </div>

              <p className="ecert__desc">
                This is to certify that the above-named participant has actively participated in and
                successfully completed the technical conference session on
              </p>

              <div className="ecert__event">
                <div className="ecert__event-label">EVENT COMPLETED</div>
                <div className="ecert__event-name">{certificate.eventTitle}</div>
              </div>

              <div className="ecert__info">
                <div className="ecert__info-item">
                  <div className="ecert__info-label">CONDUCTED BY</div>
                  <div className="ecert__info-value">
                    {organizerLines.map((line, index) => <div key={index}>{line.trim()}</div>)}
                  </div>
                </div>
                <div className="ecert__info-item">
                  <div className="ecert__info-label">DATE ISSUED</div>
                  <div className="ecert__info-value">{certificate.issueDate}</div>
                </div>
                <div className="ecert__info-item">
                  <div className="ecert__info-label">CREDENTIAL</div>
                  <div className="ecert__info-value">{certificate.hoursEarned || "Certificate of Participation"}</div>
                </div>
              </div>

              <div className="ecert__verify">
                <div>
                  <div className="ecert__verify-title">CERTIFICATE VERIFICATION</div>
                  <div className="ecert__verify-desc">
                    Scan the QR code or use the credential ID to verify the authenticity of this certificate through Eventify.
                  </div>
                  <div className="ecert__id">{certificate.credentialId}</div>
                  <div className="ecert__valid"><span className="ecert__valid-dot" /> DIGITALLY VERIFIABLE</div>
                </div>

                <div className="ecert__qr">
                  <div className="ecert__qr-box">
                    {qr && <img src={qr} alt={`Verification QR code for ${certificate.credentialId}`} />}
                  </div>
                  <div className="ecert__scan">SCAN TO VERIFY</div>
                </div>

                <div className="ecert__sign">
                  <div className="ecert__sign-line" />
                  <div className="ecert__sign-name">{certificate.signatoryName || "Dr. Ronald Reyes"}</div>
                  <div className="ecert__sign-role">{certificate.signatoryRole || "Dean, School of Information Technology"}</div>
                </div>
              </div>
            </div>
          </DocPreview>

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="action-row">
            <button type="button" className="btn-sm" onClick={close}>
              Close
            </button>
            <button type="button" className="btn-sm" onClick={run(() => savePng(docRef.current, `${name}.png`))}>
              <Icon name="download" size={16} /> Save as PNG
            </button>
            <button type="button" className="btn-sm btn-sm--yellow" onClick={run(() => printNode(docRef.current, { size: "A4 landscape", title: name }))}>
              <Icon name="print" size={16} /> Print / Save as PDF
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
