import React from "react";

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
      <input
        id={id}
        name={id}
        type={type}
        className={inputClass}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}