import React, { useState } from "react";
import Icon from "./Icon.js";

export default function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  // Add the error class only when there is an error
  let inputClass = "field__input";
  if (error) {
    inputClass = "field__input field__input--error";
  }

  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <div className={isPassword ? "field__control field__control--toggle" : "field__control"}>
        <input
          id={id}
          name={id}
          type={isPassword && showPassword ? "text" : type}
          className={inputClass}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        {isPassword && (
          <button
            type="button"
            className="field__toggle"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-controls={id}
            aria-label={`${showPassword ? "Hide" : "Show"} ${label.toLowerCase()}`}
          >
            {/* The eye gets a slash while the password is showing */}
            <Icon name={showPassword ? "eye-off" : "eye"} size={20} />
          </button>
        )}
      </div>
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}
