import React from "react";

// The mark: a calendar page with a solid header band, binder rings and a bold check
// (an event you're confirmed for). The same drawing is public/favicon.svg.
export default function Logo({ dark = false }) {
  let logoClass = "logo";
  if (dark) {
    logoClass = "logo logo--dark";
  }

  return (
    <div className={logoClass}>
      <span className="logo__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" focusable="false">
          <rect className="logo__paper" x="3" y="5" width="18" height="16" stroke="currentColor" strokeWidth="2" />
          <rect x="3" y="5" width="18" height="5" fill="currentColor" />
          <path d="M7.5 2.5v4.5M16.5 2.5v4.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
          <path d="M8 15.2l2.7 2.6 5.5-5.2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
        </svg>
      </span>
      <span className="logo__text">Eventify</span>
    </div>
  );
}
