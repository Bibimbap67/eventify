import React from "react";

export default function Logo({ dark = false }) {
  let logoClass = "logo";
  if (dark) {
    logoClass = "logo logo--dark";
  }

  return (
    <div className={logoClass}>
      <span className="logo__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <rect x="3" y="4" width="18" height="17" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="2" />
          <line x1="7" y1="2" x2="7" y2="6" stroke="currentColor" strokeWidth="2" />
          <line x1="17" y1="2" x2="17" y2="6" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      <span className="logo__text">Eventify</span>
    </div>
  );
}
