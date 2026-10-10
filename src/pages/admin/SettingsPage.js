import React, { useEffect, useState } from "react";
import { api } from "../../api.js";
import { initialSettings, useAdmin } from "../../context/AdminContext.js";
import { useAuth } from "../../context/AuthContext.js";
import Icon from "../../components/Icon.js";
import Spinner from "../../components/Spinner.js";
import { PanelHeader, SectionHeading } from "../../components/manager/parts.js";
import { useFilters } from "../../components/admin/parts.js";

const TABS = [
  { id: "platform", label: "Platform", icon: "graduation" },
  { id: "profile", label: "Profile", icon: "user" },
  { id: "security", label: "Password", icon: "key" },
  { id: "data", label: "Data export", icon: "download" },
];
const DEFAULTS = { tab: "platform" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEYS = Object.keys(initialSettings);
const BLANK_PASSWORDS = { current: "", next: "", confirm: "" };

function checkPlatform(values) {
  const errors = {};
  if (!String(values.orgName).trim()) errors.orgName = "Enter the organization name.";
  else if (String(values.orgName).trim().length > 120) errors.orgName = "Keep it under 120 characters.";
  if (String(values.academicTerm).trim().length > 80) errors.academicTerm = "Keep it under 80 characters.";
  const capacity = Number(values.defaultCapacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000) errors.defaultCapacity = "Enter a whole number from 1 to 100000.";
  return errors;
}

// Only settings that change something are here, each saying where it is used. Drafts survive
// switching tabs; leaving the page with unsaved changes asks first.
export default function SettingsPage() {
  const { settings, saveSettings, toast } = useAdmin();
  const { user, updateProfile, changePassword } = useAuth();
  const [filters, setFilters] = useFilters(DEFAULTS);
  const tab = TABS.some((item) => item.id === filters.tab) ? filters.tab : "platform";

  // A draft is null until something is typed, so saved values that arrive later still show.
  const [platformDraft, setPlatformDraft] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [passwords, setPasswords] = useState(BLANK_PASSWORDS);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState("");
  const [serverError, setServerError] = useState({});

  const savedPlatform = Object.fromEntries(KEYS.map((key) => [key, settings[key] ?? initialSettings[key]]));
  const platform = platformDraft || savedPlatform;
  const profile = profileDraft || { name: user?.name || "", email: user?.email || "" };
  const platformDirty = Boolean(platformDraft) && KEYS.some((key) => String(platformDraft[key]) !== String(savedPlatform[key]));
  const profileDirty = Boolean(profileDraft) && (profileDraft.name !== user?.name || profileDraft.email !== user?.email);
  const passwordDirty = Object.values(passwords).some(Boolean);
  const dirty = platformDirty || profileDirty || passwordDirty;

  // Reloading, closing the tab or following a link would drop the drafts.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e) => {
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!link || link.target === "_blank" || new URL(link.href).pathname === window.location.pathname) return;
      if (!window.confirm("You have unsaved changes in Settings. Leave without saving them?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const field = (form, setDraft, key) => (e) => {
    setDraft({ ...form, [key]: e.target.value });
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function submit(section, check, save, done) {
    const next = check();
    setErrors(next);
    setServerError((current) => ({ ...current, [section]: "" }));
    if (Object.keys(next).length) return;
    setSaving(section);
    try {
      await save();
      done();
    } catch (err) {
      setServerError((current) => ({ ...current, [section]: err.message }));
    } finally {
      setSaving("");
    }
  }

  const savePlatform = (e) => {
    e.preventDefault();
    submit(
      "platform",
      () => checkPlatform(platform),
      () => saveSettings({ orgName: platform.orgName.trim(), academicTerm: platform.academicTerm.trim(), defaultCapacity: Number(platform.defaultCapacity) }),
      () => {
        setPlatformDraft(null);
        toast("Platform settings saved.");
      }
    );
  };

  const saveProfile = (e) => {
    e.preventDefault();
    submit(
      "profile",
      () => ({
        ...(!profile.name.trim() && { name: "Enter your full name." }),
        ...(!EMAIL_RE.test(profile.email.trim()) && { email: "Enter a valid email address." }),
      }),
      () => updateProfile({ name: profile.name.trim(), email: profile.email.trim().toLowerCase() }),
      () => {
        setProfileDraft(null);
        toast("Profile saved.");
      }
    );
  };

  const savePassword = (e) => {
    e.preventDefault();
    submit(
      "security",
      () => ({
        ...(!passwords.current && { current: "Enter your current password." }),
        ...(passwords.next.length < 6 && { next: "Use at least 6 characters." }),
        ...(passwords.next !== passwords.confirm && { confirm: "The new passwords don't match." }),
      }),
      () => changePassword(passwords.current, passwords.next),
      () => {
        setPasswords(BLANK_PASSWORDS);
        toast("Password changed.");
      }
    );
  };

  const actions = (section, isDirty, onCancel, label) => (
    <div className="manager-form-actions">
      {isDirty && <span className="admin-dirty">Unsaved changes</span>}
      {serverError[section] && <p className="manager-form-error" role="alert">{serverError[section]}</p>}
      <button type="button" className="manager-button" onClick={onCancel} disabled={!isDirty || saving === section}>Cancel</button>
      <button type="submit" className="manager-button manager-button--primary" disabled={!isDirty || saving === section} aria-busy={saving === section || undefined}>
        {saving === section ? <><Spinner /> Saving…</> : label}
      </button>
    </div>
  );

  const errorText = (key) => errors[key] && <small id={`${key}-error`}>{errors[key]}</small>;
  const invalid = (key) => ({ "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `${key}-error` : undefined });

  return (
    <div className="manager-page">
      <SectionHeading eyebrow="System" title="Settings" detail="Platform details, your own admin account, and a full data export. Every change is recorded in the audit log." />

      <div className="manager-tabs" role="group" aria-label="Settings sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`manager-tab${tab === item.id ? " manager-tab--active" : ""}`}
            aria-pressed={tab === item.id}
            onClick={() => setFilters({ tab: item.id })}
          >
            <Icon name={item.icon} size={16} /> {item.label}
            {((item.id === "platform" && platformDirty) || (item.id === "profile" && profileDirty) || (item.id === "security" && passwordDirty)) && (
              <><span className="manager-tab__count" aria-hidden="true">•</span><span className="visually-hidden"> (unsaved changes)</span></>
            )}
          </button>
        ))}
      </div>

      {tab === "platform" && (
        <section className="manager-panel admin-settings-panel" aria-labelledby="platform-title">
          <PanelHeader id="platform-title" eyebrow="Platform" title="Organization and defaults" />
          <form className="manager-form" onSubmit={savePlatform} noValidate>
            <label className="manager-field manager-field--wide">
              Organization name
              <input value={platform.orgName} onChange={field(platform, setPlatformDraft, "orgName")} maxLength={120} {...invalid("orgName")} />
              {errorText("orgName") || <span className="admin-hint">Shown at the top of the admin sidebar and on the dashboard.</span>}
            </label>
            <label className="manager-field">
              Academic term
              <input value={platform.academicTerm} onChange={field(platform, setPlatformDraft, "academicTerm")} maxLength={80} placeholder="e.g. 1st Term AY 2026-2027" {...invalid("academicTerm")} />
              {errorText("academicTerm") || <span className="admin-hint">Shown under the organization name.</span>}
            </label>
            <label className="manager-field">
              Default event capacity
              <input type="number" min="1" max="100000" step="1" value={platform.defaultCapacity} onChange={field(platform, setPlatformDraft, "defaultCapacity")} {...invalid("defaultCapacity")} />
              {errorText("defaultCapacity") || <span className="admin-hint">Pre-filled when you create an event. Managers set their own.</span>}
            </label>
            {actions("platform", platformDirty, () => { setPlatformDraft(null); setErrors({}); }, "Save platform settings")}
          </form>
        </section>
      )}

      {tab === "profile" && (
        <section className="manager-panel admin-settings-panel" aria-labelledby="profile-title">
          <PanelHeader id="profile-title" eyebrow="Your account" title="Profile" aside={<span className="manager-status manager-status--active">Administrator</span>} />
          <form className="manager-form" onSubmit={saveProfile} noValidate>
            <label className="manager-field">
              Full name
              <input value={profile.name} onChange={field(profile, setProfileDraft, "name")} autoComplete="name" {...invalid("name")} />
              {errorText("name")}
            </label>
            <label className="manager-field">
              Email
              <input type="email" value={profile.email} onChange={field(profile, setProfileDraft, "email")} autoComplete="email" {...invalid("email")} />
              {errorText("email") || <span className="admin-hint">You sign in with this address.</span>}
            </label>
            <p className="admin-note manager-field--wide">
              <Icon name="shield" size={16} />
              Your own role can't be changed from your account, so the platform always keeps an administrator.
            </p>
            {actions("profile", profileDirty, () => { setProfileDraft(null); setErrors({}); }, "Save profile")}
          </form>
        </section>
      )}

      {tab === "security" && (
        <section className="manager-panel admin-settings-panel" aria-labelledby="security-title">
          <PanelHeader id="security-title" eyebrow="Your account" title="Change password" />
          <form className="manager-form" onSubmit={savePassword} noValidate>
            <label className="manager-field manager-field--wide">
              Current password
              <input type="password" value={passwords.current} onChange={(e) => { setPasswords({ ...passwords, current: e.target.value }); setErrors({ ...errors, current: undefined }); }} autoComplete="current-password" {...invalid("current")} />
              {errorText("current")}
            </label>
            <label className="manager-field">
              New password
              <input type="password" value={passwords.next} onChange={(e) => { setPasswords({ ...passwords, next: e.target.value }); setErrors({ ...errors, next: undefined }); }} autoComplete="new-password" {...invalid("next")} />
              {errorText("next") || <span className="admin-hint">At least 6 characters.</span>}
            </label>
            <label className="manager-field">
              Confirm new password
              <input type="password" value={passwords.confirm} onChange={(e) => { setPasswords({ ...passwords, confirm: e.target.value }); setErrors({ ...errors, confirm: undefined }); }} autoComplete="new-password" {...invalid("confirm")} />
              {errorText("confirm")}
            </label>
            {actions("security", passwordDirty, () => { setPasswords(BLANK_PASSWORDS); setErrors({}); }, "Change password")}
          </form>
        </section>
      )}

      {tab === "data" && <DataExport toast={toast} />}
    </div>
  );
}

function DataExport({ toast }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const data = await api("/admin/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      Object.assign(document.createElement("a"), { href: url, download: `eventify-export-${data.exportedAt.slice(0, 10)}.json` }).click();
      URL.revokeObjectURL(url);
      toast("Export downloaded and recorded in the audit log.");
    } catch (err) {
      toast(`Export failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="manager-panel admin-settings-panel" aria-labelledby="data-title">
      <PanelHeader id="data-title" eyebrow="Data" title="Export platform data" />
      <p className="manager-muted">
        Downloads one JSON file with every account (without passwords), event, registration (without ticket QR secrets),
        certificate, session, announcement, feedback entry, venue, the platform settings and the audit log. It is a copy for
        records and reports; there is no import.
      </p>
      <p className="admin-note admin-note--spaced">
        <Icon name="shield" size={16} />
        The file contains personal details of every user. Each download is recorded in the audit log under your name.
      </p>
      <div className="manager-form-actions admin-note--spaced">
        <button type="button" className="manager-button manager-button--primary" onClick={download} disabled={busy} aria-busy={busy || undefined}>
          {busy ? <><Spinner /> Preparing…</> : <><Icon name="download" size={16} /> Download JSON export</>}
        </button>
      </div>
    </section>
  );
}
