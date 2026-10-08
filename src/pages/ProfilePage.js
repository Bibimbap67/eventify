import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar.js";
import Icon from "../components/Icon.js";
import { useEventContext } from "../context/EventContext.js";

export default function ProfilePage() {
  const { userProfile, updateProfile, registrations, certificates } = useEventContext();

  const [form, setForm] = useState({ ...userProfile });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Show the saved profile once it loads (or after saving).
  useEffect(() => {
    if (!isEditing) setForm({ ...userProfile });
  }, [isEditing, userProfile]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
      setIsEditing(false);
      showToast("Profile saved.");
    } catch (err) {
      showToast(err.message);
    } finally {
      setSaving(false);
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
            <span className="events-hero__eyebrow">ATTENDEE IDENTITY</span>
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
            <button
              type="button"
              className="btn-sm"
              onClick={() => {
                setForm({ ...userProfile });
                setIsEditing(false);
              }}
            >
              Cancel Editing
            </button>
          )}
        </div>

        {/* Top Profile Card */}
        <section className="profile-identity-card">
          <div className="profile-avatar-wrap">
            <img src={userProfile.avatar} alt={userProfile.name} className="profile-large-avatar" />
            <span className="profile-badge-pill">{userProfile.role}</span>
          </div>

          <div className="profile-info-wrap">
            <div className="profile-name-row">
              <h2 className="profile-name">{userProfile.name}</h2>
              <span className="sbadge sbadge--active">{userProfile.yearLevel}</span>
            </div>
            <p className="profile-program">{userProfile.program}</p>
            <p className="profile-department">Department: {userProfile.department}</p>

            <div className="profile-contact-chips">
              <span>Email: {userProfile.email}</span>
              <span>Student ID: {userProfile.studentId}</span>
              <span>Phone: {userProfile.phone}</span>
            </div>
          </div>
        </section>

        {/* Engagement Stats Grid */}
        <section className="profile-stats-grid">
          <div className="p-stat-card">
            <span className="p-stat-icon"><Icon name="ticket" size={20} /></span>
            <strong>{confirmedCount}</strong>
            <small>Active Registered Events</small>
          </div>

          <div className="p-stat-card">
            <span className="p-stat-icon"><Icon name="check" size={20} /></span>
            <strong style={{ color: "var(--color-blue)" }}>{attendedCount}</strong>
            <small>Events Attended & Verified</small>
          </div>

          <div className="p-stat-card">
            <span className="p-stat-icon"><Icon name="certificate" size={20} /></span>
            <strong style={{ color: "var(--color-yellow)" }}>{certificates.length}</strong>
            <small>Official Certificates Earned</small>
          </div>

          <div className="p-stat-card">
            <span className="p-stat-icon"><Icon name="message" size={20} /></span>
            <strong>{feedbackCount}</strong>
            <small>Feedback Reviews Provided</small>
          </div>
        </section>

        {/* Edit Form */}
        {isEditing && (
          <form className="panel profile-edit-form" onSubmit={handleSave}>
            <h2>EDIT ATTENDEE INFORMATION</h2>

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

              <label className="field">
                <span className="field__label">STUDENT ID NUMBER</span>
                <input
                  className="input"
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  required
                />
              </label>
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

            <div className="two">
              <label className="field">
                <span className="field__label">ACADEMIC PROGRAM</span>
                <input
                  className="input"
                  value={form.program}
                  onChange={(e) => setForm({ ...form, program: e.target.value })}
                />
              </label>

              <label className="field">
                <span className="field__label">YEAR LEVEL</span>
                <select
                  className="input"
                  value={form.yearLevel}
                  onChange={(e) => setForm({ ...form, yearLevel: e.target.value })}
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Graduate / Alumni">Graduate / Alumni</option>
                  <option value="Faculty / Staff">Faculty / Staff</option>
                </select>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                className="btn-sm"
                onClick={() => {
                  setForm({ ...userProfile });
                  setIsEditing(false);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-sm btn-sm--yellow" disabled={saving}>
                {saving ? "Saving..." : "Save Profile Changes"}
              </button>
            </div>
          </form>
        )}

      </main>

      {/* Toast */}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
