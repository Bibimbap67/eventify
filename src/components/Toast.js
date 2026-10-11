import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./Icon.js";
import { playSound } from "./sound.js";

const TOAST_EVENT = "eventify:toast";

// Each tone has its own color (index.css), icon and sound. Errors stay up the longest.
const TONES = {
  success: { label: "Success", icon: "check-circle", ms: 4500 },
  info: { label: "Update", icon: "info", ms: 5000 },
  warning: { label: "Heads up", icon: "alert", ms: 6000 },
  error: { label: "Error", icon: "alert-circle", ms: 8000 },
};

// ponytail: messages passed on from the server don't say whether they report a failure,
// so a missing tone is guessed from the wording. Callers that know the tone pass it.
const FAILURE_WORDS = /\b(cannot|can't|could not|couldn't|failed|error|not available|invalid|unable)\b/i;

// Shows a toast from anywhere, e.g. notify("Session removed.", "warning").
export function notify(message, tone, title) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, tone, title } }));
}

// The one toast on screen, mounted once in App. It stays mounted so it can slide out as well
// as in, and so screen readers already know the live region before the first message.
export default function ToastHost() {
  const [toast, setToast] = useState(null); // kept while it slides out
  const [open, setOpen] = useState(false);
  const timer = useRef({ id: 0, ends: 0, left: 0 });
  const last = useRef({ key: "", at: 0 });

  const run = useCallback((ms) => {
    window.clearTimeout(timer.current.id);
    timer.current = { id: window.setTimeout(() => setOpen(false), ms), ends: Date.now() + ms, left: ms };
  }, []);

  useEffect(() => {
    const show = (event) => {
      const { message, title } = event.detail;
      if (!message) return;
      const tone = TONES[event.detail.tone] ? event.detail.tone : FAILURE_WORDS.test(message) ? "error" : "success";
      setToast({ id: Date.now(), message, title, tone });
      setOpen(true);
      // The same message twice in a row (e.g. three stores failing to load) sounds once.
      const key = `${tone}|${message}`;
      if (last.current.key !== key || Date.now() - last.current.at > 1500) playSound(tone);
      last.current = { key, at: Date.now() };
      run(TONES[tone].ms);
    };
    window.addEventListener(TOAST_EVENT, show);
    return () => {
      window.removeEventListener(TOAST_EVENT, show);
      window.clearTimeout(timer.current.id);
    };
  }, [run]);

  // Pointing at or focusing the toast holds it; the timer bar pauses in CSS at the same time.
  const hold = () => {
    window.clearTimeout(timer.current.id);
    timer.current.left = Math.max(0, timer.current.ends - Date.now());
  };
  const release = () => {
    if (open) run(Math.max(timer.current.left, 1500));
  };

  const tone = toast?.tone || "success";
  const { label, icon, ms } = TONES[tone];
  return (
    <div
      className="toast"
      data-tone={tone}
      data-open={open ? "" : undefined}
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocus={hold}
      onBlur={release}
    >
      <span className="toast__icon" aria-hidden="true"><Icon name={icon} size={24} /></span>
      <div className="toast__body" role={tone === "error" ? "alert" : "status"} aria-atomic="true">
        {toast && (
          <>
            <strong className="toast__title">{toast.title || label}</strong>
            <span className="toast__message">{toast.message}</span>
          </>
        )}
      </div>
      <button type="button" className="toast__close" onClick={() => setOpen(false)} aria-label="Dismiss notification">
        <Icon name="close" size={18} />
      </button>
      {toast && <span key={toast.id} className="toast__timer" style={{ "--toast-ms": `${ms}ms` }} aria-hidden="true" />}
    </div>
  );
}
