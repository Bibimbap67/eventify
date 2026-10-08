import React from "react";
import Icon from "./Icon.js";

export default function Button({
  children,
  type = "button",
  variant = "primary",
  loading = false,
  disabled = false,
  onClick,
  showArrow = false,
}) {
  let buttonClass = "btn btn--" + variant;
  if (loading) {
    buttonClass += " btn--loading";
  }
  const isDisabled = disabled || loading;

  // Show the loading text while waiting
  let buttonText = children;
  if (loading) {
    buttonText = "PLEASE WAIT…";
  }

  return (
    <button type={type} className={buttonClass} onClick={onClick} disabled={isDisabled} aria-busy={loading || undefined}>
      {buttonText}
      {!loading && showArrow && <span className="btn__arrow"><Icon name="arrow-right" size={20} /></span>}
    </button>
  );
}
