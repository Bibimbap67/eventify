import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar.js";
import Spinner from "../components/Spinner.js";
import Icon from "../components/Icon.js";
import { notify } from "../components/Toast.js";
import { avatarUri } from "../components/avatar.js";
import { useEventContext } from "../context/EventContext.js";
import { useAuth } from "../context/AuthContext.js";
import { ACADEMIC_PROGRAMS, STUDENT_ID_EXAMPLE, departmentOf, formatStudentId, validStudentId } from "../data/student.js";

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const BLANK_PASSWORDS = { current: "", next: "", confirm: "" };

// Every role edits its name, email and password here; the student details and stats are for students only.
export default function ProfilePage() {
  const { userProfile, updateProfile, registrations, certificates } = useEventContext();
  const { user, changePassword } = useAuth();
  const isStudent = user?.role === "user";
  const [passwords, setPasswords] = useState(BLANK_PASSWORDS);
  const [passwordError, setPasswordError] = useState("");
  const [changing, setChanging] = useState(false);

  const [form, setForm] = useState({ ...userProfile });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [idError, setIdError] = useState("");

  // Show the saved profile once it loads (or after saving).
  useEffect(() => {
    if (!isEditing) setForm({ ...userProfile });
  }, [isEditing, userProfile]);

  const stopEditing = () => {
    setForm({ ...userProfile });
    setIdError("");
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // Only an ID typed here is checked, so an older one never blocks saving (the server agrees).
    if (form.studentId && form.studentId !== userProfile.studentId && !validStudentId(form.studentId)) {
      setIdError(`Enter your student ID like ${STUDENT_ID_EXAMPLE}: the year you entered NU, a dash, then 7 digits.`);
      return;
    }
    setSaving(true);
    try {
      await updateProfile(form);
      setIsEditing(false);
      notify("Your profile is up to date.", "success", "Profile saved");
    } catch (err) {
      notify(err.message, "error", "Profile not saved");
    } finally {
      setSaving(false);
    }
  };

  const setPassword = (key) => (e) => {
    setPasswords({ ...passwords, [key]: e.target.value });
    setPasswordError("");
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    if (passwords.next.length < 6) return setPasswordError("Use at least 6 characters for the new password.");
    if (passwords.next !== passwords.confirm) return setPasswordError("The new passwords don't match.");
    setChanging(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords(BLANK_PASSWORDS);
      notify("Use your new password the next time you sign in.", "success", "Password changed");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChanging(false);
    }
  };

  const confirmedCount = registrations.filter((r) => r.status === "Confirmed").length;
  const attendedCount = registrations.filter((r) => r.attendanceStatus === "Attended").length;
  const feedbackCount = registrations.filter((r) => Boolean(r.feedback)).length;

  return (
    <div className="profile-page">
      <Navbar />

      <main className="profile-container">
        {/* Header */}
        <div className="profile-header">
          <div>
            <span className="events-hero__eyebrow">{isStudent ? "ATTENDEE IDENTITY" : "YOUR ACCOUNT"}</span>
            <h1 className="profile-title">MY PROFILE & CREDENTIALS</h1>
          </div>

          {!isEditing ? (
            <button
              type="button"
              className="btn-sm btn-sm--yellow"
              onClick={() => setIsEditing(true)}
            >
              <Icon name="edit" size={16} /> Edit Profile
            </button>
          ) : (
            <button type="button" className="btn-sm" onClick={stopEditing}>
              Cancel Editing
            </button>
          )}
        </div>

        {/* Top Profile Card */}
        <section className="profile-identity-card">
          <div className="profile-avatar-wrap">
            <img src={avatarUri(userProfile.id)} alt="" className="profile-large-avatar" />
            <span className="profile-badge-pill">{userProfile.role}</span>
          </div>

          <div className="profile-info-wrap">
            <div className="profile-name-row">
              <h2 className="profile-name">{userProfile.name}</h2>
              {isStudent && <span className="sbadge sbadge--active">{userProfile.yearLevel}</span>}
            </div>
            {isStudent && (
              <>
                <p className="profile-program">{userProfile.program}</p>
                <p className="profile-department">Department: {userProfile.department}</p>
              </>
            )}

            <div className="profile-contact-chips">
              <span>Email: {userProfile.email}</span>
              {isStudent && <span>Student ID: {userProfile.studentId}</span>}
              <span>Phone: {userProfile.phone || "Not added"}</span>
            </div>
          </div>
        </section>

        {/* Engagement Stats Grid */}
        {isStudent && (
          <section className="profile-stats-grid">
            <div className="p-stat-card">
              <span className="p-stat-icon"><Icon name="ticket" size={20} /></span>
              <strong>{confirmedCount}</strong>
              <small>Active Registered Events</small>
            </div>

            <div className="p-stat-card">
              <span className="p-stat-icon"><Icon name="check" size={20} /></span>
              <strong>{attendedCount}</strong>
              <small>Events Attended & Verified</small>
            </div>

            <div className="p-stat-card">
              <span className="p-stat-icon"><Icon name="certificate" size={20} /></span>
              <strong>{certificates.length}</strong>
              <small>Official Certificates Earned</small>
            </div>

            <div className="p-stat-card">
              <span className="p-stat-icon"><Icon name="message" size={20} /></span>
              <strong>{feedbackCount}</strong>
              <small>Feedback Reviews Provided</small>
            </div>
          </section>
        )}

        {/* Edit Form */}
        {isEditing && (
          <form className="panel profile-edit-form" onSubmit={handleSave}>
            <h2>EDIT {isStudent ? "ATTENDEE" : "ACCOUNT"} INFORMATION</h2>

            <div className="two">
              <label className="field">
                <span className="field__label">FULL NAME</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>

              {isStudent && (
                <label className="field">
                  <span className="field__label">STUDENT ID NUMBER</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={`e.g. ${STUDENT_ID_EXAMPLE}`}
                    value={form.studentId}
                    onChange={(e) => {
                      setForm({ ...form, studentId: formatStudentId(e.target.value) });
                      setIdError("");
                    }}
                    aria-invalid={idError ? true : undefined}
                    aria-describedby={idError ? "student-id-error" : undefined}
                    required
                  />
                  {idError && <span className="field__error" id="student-id-error" role="alert">{idError}</span>}
                </label>
              )}
            </div>

            <div className="two">
              <label className="field">
                <span className="field__label">EMAIL ADDRESS</span>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </label>

              <label className="field">
                <span className="field__label">MOBILE PHONE NUMBER</span>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
            </div>

            {isStudent && (
              <div className="two">
                <label className="field">
                  <span className="field__label">ACADEMIC PROGRAM</span>
                  {/* Picking a program fills in its college; an old typed-in program stays until changed. */}
                  <select
                    className="input"
                    value={form.program}
                    onChange={(e) => setForm({ ...form, program: e.target.value, department: departmentOf(e.target.value) })}
                  >
                    {!form.program && <option value="" disabled>Choose your program</option>}
                    {form.program && !departmentOf(form.program) && <option value={form.program}>{form.program}</option>}
                    {ACADEMIC_PROGRAMS.map((group) => (
                      <optgroup key={group.department} label={group.department}>
                        {group.programs.map((program) => <option key={program}>{program}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {form.department && <span className="field__note">{form.department}</span>}
                </label>

                <label className="field">
                  <span className="field__label">YEAR LEVEL</span>
                  <select
                    className="input"
                    value={form.yearLevel}
                    onChange={(e) => setForm({ ...form, yearLevel: e.target.value })}
                  >
                    {!form.yearLevel && <option value="" disabled>Choose your year</option>}
                    {form.yearLevel && !YEAR_LEVELS.includes(form.yearLevel) && <option value={form.yearLevel}>{form.yearLevel}</option>}
                    {YEAR_LEVELS.map((level) => <option key={level}>{level}</option>)}
                  </select>
                </label>
              </div>
            )}

            <div className="action-row">
              <button type="button" className="btn-sm" onClick={stopEditing}>
                Cancel
              </button>
              <button type="submit" className="btn-sm btn-sm--yellow" disabled={saving} aria-busy={saving || undefined}>
                {saving ? <><Spinner /> Saving…</> : "Save Profile Changes"}
              </button>
            </div>
          </form>
        )}

        <form className="panel profile-edit-form" onSubmit={handlePassword} noValidate>
          <h2>CHANGE PASSWORD</h2>
          <label className="field">
            <span className="field__label">CURRENT PASSWORD</span>
            <input type="password" className="input" autoComplete="current-password" value={passwords.current} onChange={setPassword("current")} required />
          </label>
          <div className="two">
            <label className="field">
              <span className="field__label">NEW PASSWORD</span>
              <input type="password" className="input" autoComplete="new-password" value={passwords.next} onChange={setPassword("next")} required />
            </label>
            <label className="field">
              <span className="field__label">CONFIRM NEW PASSWORD</span>
              <input type="password" className="input" autoComplete="new-password" value={passwords.confirm} onChange={setPassword("confirm")} required />
            </label>
          </div>
          {passwordError && <p className="field__error" role="alert">{passwordError}</p>}
          <div className="action-row">
            <button type="submit" className="btn-sm btn-sm--yellow" disabled={changing || !passwords.current} aria-busy={changing || undefined}>
              {changing ? <><Spinner /> Changing…</> : "Change Password"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
