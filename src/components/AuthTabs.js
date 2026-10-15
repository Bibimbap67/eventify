import React from "react";

const TABS = [["signin", "SIGN IN"], ["signup", "CREATE ACCOUNT"]];

export default function AuthTabs({ mode, onChange }) {
  return (
    <div className="auth-tabs" role="tablist" aria-label="Authentication mode" data-mode={mode}>
      {TABS.map(([value, label]) => (
        <button
          key={value}
          role="tab"
          aria-selected={mode === value}
          className={`auth-tabs__tab${mode === value ? " auth-tabs__tab--active" : ""}`}
          onClick={() => onChange(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
