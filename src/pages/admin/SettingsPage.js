import React, { useEffect, useState } from "react";
import { useAdmin } from "../../context/AdminContext.js";
import { useAuth } from "../../context/AuthContext.js";
import { FormField, ConfirmModal, StatusBadge } from "../../components/admin/ui.js";
import Spinner from "../../components/Spinner.js";

const TIMEZONES = [
  "Asia/Manila (GMT+8)",
  "Asia/Tokyo (GMT+9)",
  "Asia/Singapore (GMT+8)",
  "UTC (GMT+0)",
  "America/New_York (EST)",
  "Europe/London (BST)",
];

export default function SettingsPage() {
  const { db, settings, updateSettings, clearAuditLogs, logAction, toast } = useAdmin();
  const { user, changePassword } = useAuth();

  const [activeTab, setActiveTab] = useState("general");
  const [form, setForm] = useState({ ...settings });

  // Security tab state
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirmPass: "" });
  const [passError, setPassError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Confirmation modals
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);

  // Field change helper
  const setField = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [k]: val }));
  };

  // Save settings handler
  // Show the saved settings once they load from the server.
  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const handleSave = (e) => {
    e.preventDefault();
    updateSettings({
      ...form,
      defaultCapacity: Number(form.defaultCapacity) || 100,
    });
    logAction("Updated platform settings", `Section: ${activeTab}`);
    toast("Settings updated successfully.");
  };

  // Change password handler
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassError("");

    if (!passwords.current) {
      setPassError("Current password is required.");
      return;
    }
    if (passwords.newPass.length < 6) {
      setPassError("New password must be at least 6 characters.");
      return;
    }
    if (passwords.newPass !== passwords.confirmPass) {
      setPassError("New passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(passwords.current, passwords.newPass);
    } catch (err) {
      setPassError(err.message);
      return;
    } finally {
      setChangingPassword(false);
    }
    logAction("Changed admin password", user?.email || "Admin");
    toast("Password updated successfully.");
    setPasswords({ current: "", newPass: "", confirmPass: "" });
  };

  // Export full JSON backup
  const exportBackup = () => {
    const backupData = {
      exportDate: new Date().toISOString(),
      settings,
      database: db,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eventify-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    logAction("Exported system backup", "Full JSON database");
    toast("Database backup downloaded.");
  };

  return (
    <div className="settings-page">
      {/* Settings Navigation Tabs */}
      <div className="settings-nav">
        {[
          { id: "general", label: "General Platform" },
          { id: "policies", label: "Event & Booking Policies" },
          { id: "notifications", label: "Email & Alerts" },
          { id: "profile", label: "Admin Profile & Security" },
          { id: "system", label: "Database & System Data" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`settings-tab ${activeTab === tab.id ? "settings-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: General Platform */}
      {activeTab === "general" && (
        <form className="panel settings" onSubmit={handleSave}>
          <h2>Platform Information</h2>
          <FormField label="INSTITUTION / ORGANIZATION NAME">
            <input
              className="input"
              value={form.orgName || ""}
              onChange={setField("orgName")}
              placeholder="e.g. School of Information Technology"
            />
          </FormField>
          <FormField label="PORTAL / APPLICATION TITLE">
            <input
              className="input"
              value={form.portalTitle || ""}
              onChange={setField("portalTitle")}
              placeholder="e.g. Eventify Portal"
            />
          </FormField>
          <FormField label="ADMIN / SUPPORT CONTACT EMAIL">
            <input
              type="email"
              className="input"
              value={form.contactEmail || ""}
              onChange={setField("contactEmail")}
              placeholder="e.g. events@nu-moa.edu.ph"
            />
          </FormField>
          <div className="two">
            <FormField label="DEFAULT TIMEZONE">
              <select
                className="input"
                value={form.timezone || TIMEZONES[0]}
                onChange={setField("timezone")}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="ACADEMIC TERM / PERIOD">
              <input
                className="input"
                value={form.academicTerm || ""}
                onChange={setField("academicTerm")}
                placeholder="e.g. 1st Term AY 2026-2027"
              />
            </FormField>
          </div>
          <button className="btn-sm btn-sm--yellow" type="submit">
            Save General Settings
          </button>
        </form>
      )}

      {/* Tab 2: Event & Booking Policies */}
      {activeTab === "policies" && (
        <form className="panel settings" onSubmit={handleSave}>
          <h2>Event & Booking Rules</h2>
          <FormField label="DEFAULT EVENT CAPACITY">
            <input
              type="number"
              className="input"
              value={form.defaultCapacity || ""}
              onChange={setField("defaultCapacity")}
            />
          </FormField>

          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(form.autoConfirmRegistrations)}
              onChange={setField("autoConfirmRegistrations")}
            />
            <strong>Auto-confirm Registrations:</strong> Automatically accept student
            registrations without requiring manual admin approval.
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(form.allowWaitlist)}
              onChange={setField("allowWaitlist")}
            />
            <strong>Enable Waitlist:</strong> Permit users to join a standby queue when an event
            reaches maximum room capacity.
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(form.requireApproval)}
              onChange={setField("requireApproval")}
            />
            <strong>Mandatory Admin Approval:</strong> Require admin sign-off before student
            council/faculty events become visible to the public.
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(form.strictDoubleBooking)}
              onChange={setField("strictDoubleBooking")}
            />
            <strong>Strict Venue Conflict Guard:</strong> Reject event scheduling when another
            active event overlaps at the exact same venue.
          </label>

          <button className="btn-sm btn-sm--yellow" type="submit">
            Save Event Policies
          </button>
        </form>
      )}

      {/* Tab 3: Notifications & Alerts */}
      {activeTab === "notifications" && (
        <form className="panel settings" onSubmit={handleSave}>
          <h2>Email & Notification Preferences</h2>

          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(form.notifyOnPendingApproval)}
              onChange={setField("notifyOnPendingApproval")}
            />
            <strong>Pending Event Submissions:</strong> Display in-app banner and send alert
            whenever an organizer submits a new proposal.
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(form.emailReminders)}
              onChange={setField("emailReminders")}
            />
            <strong>Automatic 24h Attendee Reminders:</strong> Send email digests to registered
            participants 1 day before the event date.
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(form.autoIssueCertificates)}
              onChange={setField("autoIssueCertificates")}
            />
            <strong>Instant Certificate Generation:</strong> Automatically mark participants as
            "Issued" for completion certificates upon on-site check-in.
          </label>

          <button className="btn-sm btn-sm--yellow" type="submit">
            Save Notification Preferences
          </button>
        </form>
      )}

      {/* Tab 4: Admin Profile & Security */}
      {activeTab === "profile" && (
        <div className="grid-2">
          <section className="panel">
            <h2>Current Administrator Profile</h2>
            <FormField label="DISPLAY NAME">
              <input
                className="input"
                readOnly
                disabled
                value={user?.name || ""}
              />
            </FormField>
            <FormField label="EMAIL ACCOUNT">
              <input
                className="input"
                readOnly
                disabled
                value={user?.email || ""}
              />
            </FormField>
            <div style={{ marginTop: "12px" }}>
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}>
                ASSIGNED ROLE:
              </span>{" "}
              <StatusBadge value="Admin" />
            </div>
            <p className="notice" style={{ marginTop: "16px" }}>
              Profile details are linked to your session. Role permissions are enforced by
              role-based access guards.
            </p>
          </section>

          <section className="panel">
            <h2>Change Password</h2>
            <form onSubmit={handlePasswordChange}>
              <FormField label="CURRENT PASSWORD" error={passError && !passwords.current ? passError : null}>
                <input
                  type="password"
                  className="input"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="••••••••"
                />
              </FormField>
              <FormField label="NEW PASSWORD">
                <input
                  type="password"
                  className="input"
                  value={passwords.newPass}
                  onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                  placeholder="At least 6 characters"
                />
              </FormField>
              <FormField label="CONFIRM NEW PASSWORD">
                <input
                  type="password"
                  className="input"
                  value={passwords.confirmPass}
                  onChange={(e) => setPasswords({ ...passwords, confirmPass: e.target.value })}
                  placeholder="Repeat new password"
                />
              </FormField>
              {passError && (
                <p className="form-error" role="alert">
                  {passError}
                </p>
              )}
              <button className="btn-sm btn-sm--yellow" type="submit" disabled={changingPassword} aria-busy={changingPassword || undefined}>
                {changingPassword ? <><Spinner /> Updating…</> : "Update Password"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Tab 5: Database & Mock System Management */}
      {activeTab === "system" && (
        <div className="grid-2">
          <section className="panel">
            <h2>System Data Records</h2>
            <div className="row">
              <span>Events</span>
              <b>{db.events?.length || 0}</b>
            </div>
            <div className="row">
              <span>Registrations</span>
              <b>{db.registrations?.length || 0}</b>
            </div>
            <div className="row">
              <span>Venues</span>
              <b>{db.venues?.length || 0}</b>
            </div>
            <div className="row">
              <span>Users</span>
              <b>{db.users?.length || 0}</b>
            </div>
            <div className="row">
              <span>Sessions</span>
              <b>{db.sessions?.length || 0}</b>
            </div>
            <div className="row">
              <span>Announcements</span>
              <b>{db.announcements?.length || 0}</b>
            </div>
            <div className="row">
              <span>Audit Records</span>
              <b>{db.auditLogs?.length || 0}</b>
            </div>

            <div style={{ marginTop: "18px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button className="btn-sm btn-sm--yellow" onClick={exportBackup}>
                Download JSON Backup
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>Maintenance</h2>
            <p className="panel__text">
              Review system activity and manage audit history.
            </p>
            <button type="button" className="btn-sm" onClick={() => setShowClearLogsConfirm(true)}>
              Clear System Audit Logs
            </button>
          </section>
        </div>
      )}

      {/* Confirm Clear Logs Modal */}
      {showClearLogsConfirm && (
        <ConfirmModal
          title="Clear Audit History"
          message="Are you sure you want to clear all audit records? This action cannot be reversed."
          confirmText="Clear Logs"
          confirmVariant="danger"
          onConfirm={() => {
            clearAuditLogs();
            toast("Audit history cleared.");
            setShowClearLogsConfirm(false);
          }}
          onCancel={() => setShowClearLogsConfirm(false)}
        />
      )}
    </div>
  );
}
