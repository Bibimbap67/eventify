import React from "react";

// Three ink blocks that hop in turn. Decorative only: the button around it sets aria-busy
// and keeps a text label, so screen readers hear "Saving…" rather than the animation.
export default function Spinner({ className = "" }) {
  return (
    <span className={`spinner${className ? ` ${className}` : ""}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
