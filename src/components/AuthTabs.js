import React from "react";

export default function AuthTabs({ mode, onChange }) {
  // Class names for each tab
  let signInClass = "auth-tabs__tab";
  if (mode === "signin") {
    signInClass = "auth-tabs__tab auth-tabs__tab--active";
  }

  let signUpClass = "auth-tabs__tab";
  if (mode === "signup") {
    signUpClass = "auth-tabs__tab auth-tabs__tab--active";
  }

  // Event handlers
  const handleSignInClick = () => {
    onChange("signin");
  };

  const handleSignUpClick = () => {
    onChange("signup");
  };

  return (
    <div className="auth-tabs" role="tablist" aria-label="Authentication mode" data-mode={mode}>
      <button
        role="tab"
        aria-selected={mode === "signin"}
        className={signInClass}
        onClick={handleSignInClick}
        type="button"
      >
        SIGN IN
      </button>
      <button
        role="tab"
        aria-selected={mode === "signup"}
        className={signUpClass}
        onClick={handleSignUpClick}
        type="button"
      >
        CREATE ACCOUNT
      </button>
    </div>
  );
}