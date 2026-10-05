import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import Logo from "../components/Logo.js";
import AuthTabs from "../components/AuthTabs.js";
import TextField from "../components/TextField.js";
import Button from "../components/Button.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/events";

  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(field) {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: null }));
      if (formError) setFormError("");
    };
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setErrors({});
    setFormError("");
  }

  function validate() {
    const next = {};
    if (mode === "signup" && !form.name.trim()) {
      next.name = "Enter your full name.";
    }
    if (!form.email.trim()) {
      next.email = "Email is required.";
    } else if (!EMAIL_RE.test(form.email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!form.password) {
      next.password = "Password is required.";
    } else if (mode === "signup" && form.password.length < 6) {
      next.password = "Use at least 6 characters.";
    }
    if (mode === "signup" && form.confirmPassword !== form.password) {
      next.confirmPassword = "Passwords do not match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setFormError("");
    try {
      let signedInUser;
      if (mode === "signin") {
        signedInUser = await login(form.email.trim(), form.password);
      } else {
        signedInUser = await signup(form.name.trim(), form.email.trim(), form.password);
      }
      const target = signedInUser.role === "admin"
        ? (redirectTo.startsWith("/admin") ? redirectTo : "/admin")
        : signedInUser.role === "manager"
        ? (redirectTo.startsWith("/manager") ? redirectTo : "/manager")
        : (redirectTo.startsWith("/admin") || redirectTo.startsWith("/manager") ? "/events" : redirectTo);
      navigate(target, { replace: true });
    } catch (err) {
      setFormError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-hero">
        <Logo />
        <div className="auth-hero__body">
          <p className="auth-hero__eyebrow">PLAN. FILL. SCAN. REPORT.</p>
          <h1 className="auth-hero__title">
            YOUR EVENT
            <br />
            COMMAND
            <br />
            CENTRE.
          </h1>
        </div>
        <p className="auth-hero__footer">
          SECURE ROLES &middot; LIVE CAPACITY &middot; QR CHECK-IN
        </p>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <AuthTabs mode={mode} onChange={switchMode} />

          <div className="auth-card__body">
            <h2 className="auth-card__title">
              {mode === "signin" ? "WELCOME BACK" : "CREATE YOUR ACCOUNT"}
            </h2>

            <p className="auth-card__error" role="status">
              Sign-in and account creation are temporarily unavailable while backend authentication is being configured.
            </p>
            {formError && <p className="auth-card__error">{formError}</p>}

            <form onSubmit={handleSubmit} noValidate>
              {mode === "signup" && (
                <TextField
                  id="name"
                  label="FULL NAME"
                  value={form.name}
                  onChange={updateField("name")}
                  error={errors.name}
                  autoComplete="name"
                  placeholder="Juan Dela Cruz"
                />
              )}

              <TextField
                id="email"
                label="EMAIL ADDRESS"
                type="email"
                value={form.email}
                onChange={updateField("email")}
                error={errors.email}
                autoComplete="email"
                placeholder="you@organisation.com"
              />

              <TextField
                id="password"
                label="PASSWORD"
                type="password"
                value={form.password}
                onChange={updateField("password")}
                error={errors.password}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
              />

              {mode === "signup" && (
                <TextField
                  id="confirmPassword"
                  label="CONFIRM PASSWORD"
                  type="password"
                  value={form.confirmPassword}
                  onChange={updateField("confirmPassword")}
                  error={errors.confirmPassword}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              )}

              <Button type="submit" loading={loading} showArrow>
                {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
              </Button>
            </form>

          </div>
        </div>
      </main>
    </div>
  );
}
