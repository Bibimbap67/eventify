import React from "react";

export default function Button({
  children,
  type = "button",
  variant = "primary",
  loading = false,
  disabled = false,
  onClick,
  showArrow = false,
}) {
  const buttonClass = "btn btn--" + variant;
  const isDisabled = disabled || loading;

  // Show the loading text while waiting
  let buttonText = children;
  if (loading) {
    buttonText = "PLEASE WAIT…";
  }

  return (
    <button type={type} className={buttonClass} onClick={onClick} disabled={isDisabled}>
      {buttonText}
      {!loading && showArrow && <span className="btn__arrow">→</span>}
    </button>
  );
}