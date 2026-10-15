import React from "react";
import Icon from "./Icon.js";
import Spinner from "./Spinner.js";

export default function Button({
  children,
  type = "button",
  loading = false,
  loadingText = "Please wait…",
  disabled = false,
  onClick,
  showArrow = false,
}) {
  return (
    <button type={type} className={`btn btn--primary${loading ? " btn--loading" : ""}`} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? <><Spinner /> {loadingText}</> : children}
      {!loading && showArrow && <span className="btn__arrow"><Icon name="arrow-right" size={20} /></span>}
    </button>
  );
}
