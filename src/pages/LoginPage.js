import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import Logo from "../components/Logo.js";
import AuthTabs from "../components/AuthTabs.js";
import TextField from "../components/TextField.js";
import Button from "../components/Button.js";
import Shape from "../components/landing/Shapes.js";
import { prefersReducedMotion } from "../components/Motion.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAMP_MS = 700; // time to show the "Admitted" stamp before leaving the page
const QR_SIZE = 15;

// The pass preview's QR: three corner squares like a real code, and the rest drawn
// from the holder text, so the pattern changes as the person types. Decoration only.
function passCells(text) {
  let seed = 2166136261;
  for (const ch of text) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  seed = seed >>> 0 || 1;
  const cells = [];
  for (let y = 0; y < QR_SIZE; y += 1) {
    for (let x = 0; x < QR_SIZE; x += 1) {
      const fx = x < 6 ? x : x > QR_SIZE - 7 ? QR_SIZE - 1 - x : -1;
      const fy = y < 6 ? y : y > QR_SIZE - 7 ? QR_SIZE - 1 - y : -1;
      let on;
      if (fx >= 0 && fy >= 0 && !(x > QR_SIZE - 7 && y > QR_SIZE - 7)) {
        on = fx < 5 && fy < 5 && Math.min(fx, fy, 4 - fx, 4 - fy) !== 1;
      } else {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        on = (seed >>> 0) % 100 < 48;
      }
      if (on) cells.push([x, y]);
    }
  }
  return cells;
}

function shake(node) {
  if (!node || prefersReducedMotion()) return;
  node.animate?.(
    ["none", "translateX(-8px)", "translateX(7px)", "translateX(-4px)", "none"].map((transform) => ({ transform })),
    { duration: 320, easing: "ease-out" }
  );
}

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
  const [admitted, setAdmitted] = useState(false);
  const cardRef = useRef(null);
  const passRef = useRef(null);
  const leaveTimer = useRef(0);

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const holder = (mode === "signup" ? form.name : form.email).trim();
  const qrCells = useMemo(() => passCells(holder || "eventify"), [holder]);

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
    if (!validate()) {
      shake(cardRef.current);
      return;
    }

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
        : signedInUser.role === "staff"
        ? "/staff"
        : (redirectTo.startsWith("/admin") || redirectTo.startsWith("/manager") ? "/events" : redirectTo);
      // The pass is hidden on small screens; only wait for the stamp when someone can see it.
      if (passRef.current?.offsetParent && !prefersReducedMotion()) {
        setAdmitted(true);
        leaveTimer.current = setTimeout(() => navigate(target, { replace: true }), STAMP_MS);
      } else {
        navigate(target, { replace: true });
      }
    } catch (err) {
      setFormError(err.message || "Something went wrong. Try again.");
      setLoading(false);
      shake(cardRef.current);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-hero">
        <Logo />
        <div className="auth-hero__body">
          <div className="auth-hero__copy">
            <h1 className="auth-hero__title">Your pass to every campus event.</h1>
            <p className="auth-hero__lead">
              Join talks, workshops, and career fairs. Show your QR ticket at the door. Get your certificate after.
            </p>
          </div>

          {/* A live preview of the attendee's pass: it fills in as they type. */}
          <div className="auth-pass-stage" aria-hidden="true">
            <Shape kind="starburst" className="auth-pass-stage__burst" />
            <Shape kind="sparkle" className="auth-pass-stage__sparkle" />
            <div className="auth-pass" ref={passRef} data-admitted={admitted ? "" : undefined}>
              <div className="auth-pass__top">
                <span className="auth-pass__brand">Eventify pass</span>
                <span key={mode} className="auth-pass__tag">{mode === "signin" ? "Welcome back" : "New member"}</span>
              </div>
              <div className="auth-pass__holder">
                <span className="auth-pass__label">Holder</span>
                <span className={`auth-pass__name${holder ? "" : " auth-pass__name--empty"}`}>
                  {holder || (mode === "signin" ? "your@email" : "Your name")}
                  <span className="auth-pass__caret" />
                </span>
              </div>
              <span className="auth-pass__perf" />
              <div className="auth-pass__foot">
                <svg className="auth-pass__qr" viewBox={`-1 -1 ${QR_SIZE + 2} ${QR_SIZE + 2}`} shapeRendering="crispEdges" focusable="false">
                  <rect className="auth-pass__qr-ground" x="-1" y="-1" width={QR_SIZE + 2} height={QR_SIZE + 2} />
                  {qrCells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)}
                </svg>
                <dl className="auth-pass__facts">
                  <div><dt>Good for</dt><dd>Talks, workshops, fairs</dd></div>
                  <div><dt>Show it at</dt><dd>The check-in desk</dd></div>
                </dl>
              </div>
              {admitted && <span className="auth-pass__stamp">Admitted</span>}
            </div>
          </div>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card" ref={cardRef}>
          <AuthTabs mode={mode} onChange={switchMode} />

          <div className="auth-card__body">
            <div key={mode} className="auth-card__head">
              <h2 className="auth-card__title">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="auth-card__lead">
                {mode === "signin"
                  ? "Sign in to see your tickets, schedule, and certificates."
                  : "Sign up to join events and get your QR ticket."}
              </p>
            </div>

            {formError && <p className="auth-card__error" role="alert">{formError}</p>}

            <form onSubmit={handleSubmit} noValidate>
              {mode === "signup" && (
                <TextField
                  id="name"
                  label="Full name"
                  value={form.name}
                  onChange={updateField("name")}
                  error={errors.name}
                  autoComplete="name"
                  placeholder="Juan Dela Cruz"
                />
              )}

              <TextField
                id="email"
                label="Email address"
                type="email"
                value={form.email}
                onChange={updateField("email")}
                error={errors.email}
                autoComplete="email"
                placeholder="you@school.edu"
              />

              <TextField
                id="password"
                label="Password"
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
                  label="Confirm password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={updateField("confirmPassword")}
                  error={errors.confirmPassword}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              )}

              <Button
                type="submit"
                loading={loading}
                loadingText={admitted ? "SIGNED IN" : mode === "signin" ? "SIGNING IN…" : "CREATING ACCOUNT…"}
                showArrow
              >
                {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
              </Button>
            </form>

            {mode === "signup" && (
              <p className="auth-card__note">
                Event managers and staff don't sign up here. Ask your admin for an account.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
