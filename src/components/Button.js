import React from "react";
import Icon from "./Icon.js";
import Spinner from "./Spinner.js";

export default function Button({
  children,
  type = "button",
  variant = "primary",
  loading = false,
  loadingText = "Please wait…",
  disabled = false,
  onClick,
  showArrow = false,
}) {
  let buttonClass = "btn btn--" + variant;
  if (loading) {
    buttonClass += " btn--loading";
  }
  const isDisabled = disabled || loading;

  return (
    <button type={type} className={buttonClass} onClick={onClick} disabled={isDisabled} aria-busy={loading || undefined}>
      {loading ? <><Spinner /> {loadingText}</> : children}
      {!loading && showArrow && <span className="btn__arrow"><Icon name="arrow-right" size={20} /></span>}
    </button>
  );
}
