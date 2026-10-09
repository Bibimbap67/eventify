import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.js";
import { Modal } from "./admin/ui.js";
import { api } from "../api.js";
import { useEventContext } from "../context/EventContext.js";
import { eventBanner } from "../data/options.js";
import { seatOf } from "../data/seating.js";
import { DocPreview, fileSafe, printNode, savePng, useQrCode } from "./DocExport.js";

const TICKET_WIDTH = 440;
const POLL_MS = 4000;
const isCheckedIn = (status) => ["checked in", "attended"].includes(String(status || "").toLowerCase());

export default function TicketPassModal({ registration, onClose }) {
  const { events, refresh } = useEventContext();
  const docRef = useRef(null);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const qr = useQrCode(ticket?.qr);
  const registrationId = registration?.id;

  // The QR secret comes from the server. While the pass is open it checks back every few
  // seconds, so it flips to "checked in" the moment staff scan it at the door.
  useEffect(() => {
    if (!registrationId) return undefined;
    let stopped = false;
    let timer = 0;
    let wasIn = null;
    const load = () => api(`/tickets/${registrationId}`)
      .then((data) => {
        if (stopped) return;
        setTicket(data);
        const nowIn = isCheckedIn(data.attendanceStatus);
        if (wasIn === false && nowIn) refresh();
        wasIn = nowIn;
        if (!nowIn) timer = setTimeout(load, POLL_MS);
      })
      .catch(() => {
        // A brand-new registration may still be saving; try again shortly.
        if (!stopped) timer = setTimeout(load, POLL_MS);
      });
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [registrationId, refresh]);

  if (!registration) return null;

  const event = events.find((item) => item.id === registration.eventId) || { id: registration.eventId };
  const status = ticket?.attendanceStatus || registration.attendanceStatus || "Not Checked In";
  const checkedInAt = ticket?.checkedInAt || registration.checkedInAt;
  const checkedIn = isCheckedIn(status);
  const name = `ticket-${fileSafe(registration.eventTitle)}-${fileSafe(registration.ticketCode)}`;

  const run = (action) => async () => {
    setError("");
    try {
      await action();
    } catch {
      setError("Could not export the pass. Try again.");
    }
  };

  return (
    <Modal title="EVENT ADMISSION PASS" onClose={onClose} className="ticket-modal">
      {(close) => (
        <>
          <DocPreview width={TICKET_WIDTH}>
            <div className="eticket" ref={docRef} style={{ "--banner": eventBanner(event) }}>
              <div className="eticket__top">
                <span>NATIONAL UNIVERSITY · EVENTIFY</span>
                <span className="eticket__code">#{registration.ticketCode}</span>
              </div>

              <div className="eticket__body">
                <h3 className="eticket__title">{registration.eventTitle}</h3>
                <dl className="eticket__grid">
                  <div>
                    <dt>ATTENDEE</dt>
                    <dd>{registration.name}</dd>
                  </div>
                  <div>
                    <dt>TICKET TYPE</dt>
                    <dd>{registration.ticketType || "General Admission"}</dd>
                  </div>
                  <div>
                    <dt>DATE & TIME</dt>
                    <dd>{registration.fullDate || registration.date} · {registration.time}</dd>
                  </div>
                  <div>
                    <dt>VENUE</dt>
                    <dd>{registration.location}</dd>
                  </div>
                </dl>
                <div className="eticket__seat">
                  <span>{seatOf(registration) ? "RESERVED SEAT" : "FREE SEATING"}</span>
                  <b>{seatOf(registration) ? `SEAT ${seatOf(registration)}` : "FIRST COME, FIRST SERVED"}</b>
                </div>
              </div>

              <div className="eticket__perf" aria-hidden="true" />

              <div className="eticket__qr">
                <div className="eticket__qr-box">
                  {qr
                    ? <img src={qr} alt={`Check-in QR code for ticket ${registration.ticketCode}`} />
                    : <span className="eticket__qr-wait">Preparing your QR code…</span>}
                </div>
                <p>Show this code at the entrance. Event staff scan it to check you in.</p>
              </div>

              <div className={`eticket__status${checkedIn ? " is-in" : ""}`} role="status">
                {checkedIn && <Icon name="check" size={16} />}
                <span>ATTENDANCE: <b>{status.toUpperCase()}</b>{checkedInAt && ` · ${checkedInAt}`}</span>
              </div>
            </div>
          </DocPreview>

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="action-row">
            <button type="button" className="btn-sm" onClick={close}>
              Close
            </button>
            <button type="button" className="btn-sm" disabled={!qr} onClick={run(() => savePng(docRef.current, `${name}.png`))}>
              <Icon name="download" size={16} /> Save as PNG
            </button>
            <button type="button" className="btn-sm btn-sm--yellow" disabled={!qr} onClick={run(() => printNode(docRef.current, { size: "A4 portrait", title: name }))}>
              <Icon name="print" size={16} /> Print / Save as PDF
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
