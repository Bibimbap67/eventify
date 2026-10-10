import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";
import { useAuth } from "../../context/AuthContext.js";
import { useAdmin } from "../../context/AdminContext.js";
import Icon from "../../components/Icon.js";
import Spinner from "../../components/Spinner.js";
import { ConfirmModal, Modal } from "../../components/admin/ui.js";
import { TableSkeleton } from "../../components/Skeleton.js";
import { Avatar, SectionHeading, StatusBadge, Table, plural } from "../../components/manager/parts.js";
import {
  LoadError, Pagination, ROLES, SearchFilter, formatDate, formatDateTime, roleLabel, toQuery, useApi, useFilters,
} from "../../components/admin/parts.js";

const PAGE_SIZE = 20;
const DEFAULTS = { role: "", status: "", q: "", sort: "-createdAt", page: "1" };
const SORTS = [
  ["-createdAt", "Newest first"],
  ["createdAt", "Oldest first"],
  ["name", "Name A–Z"],
  ["-name", "Name Z–A"],
  ["email", "Email A–Z"],
  ["role", "Role"],
];
const COLUMNS = ["User", "Role", "Status", "Joined", "Actions"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFILE_FIELDS = [["studentId", "Student ID"], ["department", "Department"], ["program", "Program"], ["yearLevel", "Year level"], ["phone", "Phone"]];

export default function UsersAdmin() {
  const { user: me } = useAuth();
  const { toast } = useAdmin();
  const [filters, setFilters] = useFilters(DEFAULTS);
  const page = Math.max(1, Number(filters.page) || 1);
  const { data, error, loading, reload } = useApi(`/users?${toQuery({ ...filters, page, limit: PAGE_SIZE })}`);
  const [dialog, setDialog] = useState(null); // { type, user }
  const onPage = useCallback((value) => setFilters({ page: value }), [setFilters]);
  const close = () => setDialog(null);

  const roleCounts = data?.counts.roles || {};
  const statusCounts = data?.counts.statuses || {};
  const allCount = Object.values(roleCounts).reduce((sum, n) => sum + n, 0);
  const filtered = filters.role || filters.status || filters.q;

  // Sends one change, then refreshes the page of users. Errors come back as the server's message.
  async function run(request, success) {
    try {
      await request();
      toast(success);
      reload();
    } catch (err) {
      toast(err.message);
    }
  }

  const columns = [
    {
      label: "User",
      render: (row) => (
        <span className="manager-person">
          <Avatar name={row.name} />
          <span>
            <strong>{row.name}{row.id === me?.id && <span className="admin-you">You</span>}</strong>
            <small>{row.email}</small>
          </span>
        </span>
      ),
    },
    { label: "Role", render: (row) => <b>{roleLabel(row.role)}</b> },
    { label: "Status", render: (row) => <StatusBadge value={row.status === "inactive" ? "Inactive" : "Active"} /> },
    { label: "Joined", render: (row) => <span className="manager-mono">{formatDate(row.createdAt)}</span> },
    {
      label: "Actions",
      render: (row) => {
        const self = row.id === me?.id;
        const lock = self ? "You can't change your own role or access." : undefined;
        return (
          <span className="manager-row-buttons">
            <button type="button" className="manager-text-button" onClick={() => setDialog({ type: "view", user: row })}>Details</button>
            <button type="button" className="manager-text-button" disabled={self} title={lock} onClick={() => setDialog({ type: "role", user: row })}>
              Change role
            </button>
            <button type="button" className="manager-text-button" disabled={self} title={lock} onClick={() => setDialog({ type: "status", user: row })}>
              {row.status === "inactive" ? "Activate" : "Deactivate"}
            </button>
            <button type="button" className="manager-text-button manager-text-button--danger" disabled={self} title={self ? "You can't delete your own account." : undefined} onClick={() => setDialog({ type: "delete", user: row })}>
              Delete
            </button>
          </span>
        );
      },
    },
  ];

  const target = dialog?.user;

  return (
    <div className="manager-page">
      <SectionHeading
        eyebrow="Platform"
        title="Users & roles"
        detail="Every account on Eventify, grouped by role. Role and status changes apply from the user's next request and are recorded in the audit log."
        action={(
          <button type="button" className="manager-button manager-button--primary" onClick={() => setDialog({ type: "create" })}>
            <Icon name="user-plus" size={16} /> Add user
          </button>
        )}
      />

      <div className="manager-tabs" role="group" aria-label="Show users by role">
        {[{ value: "", many: "All users" }, ...ROLES].map((role) => (
          <button
            key={role.value || "all"}
            type="button"
            className={`manager-tab${filters.role === role.value ? " manager-tab--active" : ""}`}
            aria-pressed={filters.role === role.value}
            onClick={() => setFilters({ role: role.value })}
          >
            {role.many}
            <span className="manager-tab__count">{data ? (role.value ? roleCounts[role.value] || 0 : allCount) : "…"}</span>
          </button>
        ))}
      </div>

      <div className="manager-toolbar">
        <SearchFilter label="Search users" placeholder="Search by name or email" value={filters.q} onSearch={(q) => setFilters({ q })} />
        <label className="manager-toolbar__field">
          Status
          <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}>
            <option value="">All ({data ? (statusCounts.active || 0) + (statusCounts.inactive || 0) : "…"})</option>
            <option value="active">Active ({statusCounts.active || 0})</option>
            <option value="inactive">Inactive ({statusCounts.inactive || 0})</option>
          </select>
        </label>
        <label className="manager-toolbar__field">
          Sort
          <select value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {filtered && (
          <button type="button" className="manager-text-button" onClick={() => setFilters({ role: "", status: "", q: "" })}>
            Clear filters
          </button>
        )}
      </div>

      {error && <LoadError message={error} onRetry={reload} />}
      {!data && loading && <TableSkeleton columns={COLUMNS} rows={8} />}
      {data && (
        <div className={loading ? "admin-busy" : undefined} aria-busy={loading || undefined}>
          <Table
            columns={columns}
            rows={data.users}
            empty={filtered ? "No users match these filters." : "No accounts yet."}
            emptyIcon="users"
          />
        </div>
      )}
      {data && <Pagination page={page} limit={PAGE_SIZE} total={data.total} noun="user" onPage={onPage} busy={loading} />}

      {dialog?.type === "view" && (
        <UserDetails user={target} self={target.id === me?.id} onClose={close} onEdit={() => setDialog({ type: "edit", user: target })} />
      )}
      {(dialog?.type === "create" || dialog?.type === "edit") && (
        <UserForm
          user={dialog.type === "edit" ? target : null}
          onClose={close}
          onSaved={(message) => {
            close();
            toast(message);
            reload();
          }}
        />
      )}
      {dialog?.type === "role" && (
        <RoleDialog
          user={target}
          onClose={close}
          onConfirm={(role) => {
            close();
            run(() => api(`/users/${target.id}`, { method: "PATCH", body: { role } }), `${target.name} is now ${roleLabel(role)}.`);
          }}
        />
      )}
      {dialog?.type === "status" && (target.status === "inactive" ? (
        <ConfirmModal
          title="Activate account?"
          message={`${target.name} will be able to sign in again with their existing password.`}
          confirmText="Activate"
          confirmVariant="primary"
          onCancel={close}
          onConfirm={() => {
            close();
            run(() => api(`/users/${target.id}`, { method: "PATCH", body: { status: "active" } }), `${target.name} is active.`);
          }}
        />
      ) : (
        <ConfirmModal
          title="Deactivate account?"
          message={`${target.name} won't be able to sign in, and any open session stops at its next request. Their registrations, certificates and history are kept, and you can activate the account again at any time.`}
          confirmText="Deactivate"
          onCancel={close}
          onConfirm={() => {
            close();
            run(() => api(`/users/${target.id}`, { method: "PATCH", body: { status: "inactive" } }), `${target.name} is deactivated.`);
          }}
        />
      ))}
      {dialog?.type === "delete" && (
        <DeleteDialog
          user={target}
          onClose={close}
          onConfirm={() => {
            close();
            run(() => api(`/users/${target.id}`, { method: "DELETE" }), `${target.name}'s account was deleted.`);
          }}
        />
      )}
    </div>
  );
}

// Events a manager account owns (manager events point at managerId, or the user id for newer accounts).
function useOwnedEvents(user) {
  const { db } = useAdmin();
  if (user?.role !== "manager") return [];
  return db.events.filter((event) => event.managerId && event.managerId === (user.managerId || user.id));
}

function UserDetails({ user, self, onClose, onEdit }) {
  const { db } = useAdmin();
  const owned = useOwnedEvents(user);
  const registrations = db.registrations.filter((item) => item.userId === user.id && item.status !== "Cancelled").length;
  const facts = [
    ["Email", user.email],
    ["Role", roleLabel(user.role)],
    ["Status", <StatusBadge key="status" value={user.status === "inactive" ? "Inactive" : "Active"} />],
    ["Joined", formatDateTime(user.createdAt)],
    ["Last updated", formatDateTime(user.updatedAt)],
    ...PROFILE_FIELDS.filter(([key]) => user[key]).map(([key, label]) => [label, user[key]]),
    ...(user.role === "manager" ? [["Events managed", plural(owned.length, "event")]] : []),
    ...(user.role === "user" ? [["Active registrations", registrations]] : []),
  ];
  return (
    <Modal title={user.name} onClose={onClose} className="admin-dialog">
      {(closeAnimated) => (
        <div className="admin-detail">
          <dl className="manager-definition-list">
            {facts.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          <div className="admin-dialog-actions">
            <button type="button" className="manager-button" onClick={closeAnimated}>Close</button>
            {self ? (
              <Link className="manager-button manager-button--primary" to="/admin/settings?tab=profile">
                <Icon name="edit" size={16} /> Edit in Settings
              </Link>
            ) : (
              <button type="button" className="manager-button manager-button--primary" onClick={onEdit}>
                <Icon name="edit" size={16} /> Edit details
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// Add a user, or edit a user's name, email and password. Role and status have their own
// confirmed actions, so they never change by accident while fixing a typo.
function UserForm({ user, onClose, onSaved }) {
  const editing = Boolean(user);
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", password: "", role: "user", status: "active" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => {
    setForm((current) => ({ ...current, [key]: e.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Enter the full name.";
    if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email address.";
    if ((!editing || form.password) && form.password.length < 6) next.password = "Use at least 6 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = editing
      ? Object.fromEntries(Object.entries({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password })
        .filter(([key, value]) => value && value !== user[key]))
      : { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() };
    if (editing && !Object.keys(body).length) {
      onClose();
      return;
    }
    setSaving(true);
    setServerError("");
    try {
      await api(editing ? `/users/${user.id}` : "/users", { method: editing ? "PATCH" : "POST", body });
      onSaved(editing ? `${form.name.trim()} was updated.` : `${form.name.trim()} was added as ${roleLabel(form.role)}.`);
    } catch (err) {
      setServerError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? `Edit ${user.name}` : "Add user"} onClose={onClose} className="admin-dialog">
      {(closeAnimated) => (
        <form className="manager-form" onSubmit={submit} noValidate>
          <label className="manager-field manager-field--wide">
            Full name
            <input value={form.name} onChange={set("name")} autoComplete="off" aria-invalid={Boolean(errors.name)} />
            {errors.name && <small>{errors.name}</small>}
          </label>
          <label className="manager-field manager-field--wide">
            Email
            <input type="email" value={form.email} onChange={set("email")} autoComplete="off" aria-invalid={Boolean(errors.email)} />
            {errors.email && <small>{errors.email}</small>}
          </label>
          <label className="manager-field manager-field--wide">
            {editing ? "New password (optional)" : "Temporary password"}
            <input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" aria-invalid={Boolean(errors.password)} />
            {errors.password
              ? <small>{errors.password}</small>
              : <span className="admin-hint">{editing ? "Leave empty to keep the current password." : "At least 6 characters. Share it with the user privately."}</span>}
          </label>
          {!editing && (
            <>
              <label className="manager-field">
                Role
                <select value={form.role} onChange={set("role")}>
                  {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
                <span className="admin-hint">{ROLES.find((role) => role.value === form.role)?.text}</span>
              </label>
              <label className="manager-field">
                Status
                <select value={form.status} onChange={set("status")}>
                  <option value="active">Active: can sign in</option>
                  <option value="inactive">Inactive: can't sign in yet</option>
                </select>
              </label>
            </>
          )}
          {editing && (
            <p className="admin-note manager-field--wide">
              <Icon name="info" size={16} />To change the role or turn the account off, use Change role or Deactivate in the user list.
            </p>
          )}
          {serverError && <p className="manager-form-error manager-field--wide" role="alert">{serverError}</p>}
          <div className="manager-form-actions">
            <button type="button" className="manager-button" onClick={closeAnimated}>Cancel</button>
            <button type="submit" className="manager-button manager-button--primary" disabled={saving} aria-busy={saving || undefined}>
              {saving ? <><Spinner /> Saving…</> : editing ? "Save changes" : "Add user"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function RoleDialog({ user, onClose, onConfirm }) {
  const [role, setRole] = useState(user.role);
  const owned = useOwnedEvents(user);
  const changed = role !== user.role;
  let consequence = "";
  if (user.role === "admin") consequence = "They lose access to the admin area at their next request.";
  else if (role === "admin") consequence = "They get full control of Eventify, including every account, event and setting.";
  if (user.role === "manager" && changed && owned.length) {
    consequence += ` They manage ${plural(owned.length, "event")}; those events keep running but no manager can edit them until this role is given back.`;
  }

  return (
    <Modal title={`Change role: ${user.name}`} onClose={onClose} className="admin-dialog">
      {(closeAnimated) => (
        <form onSubmit={(e) => { e.preventDefault(); if (changed) onConfirm(role); }}>
          <fieldset className="admin-choices">
            <legend>Role</legend>
            {ROLES.map((option) => (
              <label key={option.value} className="admin-choice">
                <input type="radio" name="role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)} />
                <strong>{option.label}{option.value === user.role ? " (current)" : ""}</strong>
                <small>{option.text}</small>
              </label>
            ))}
          </fieldset>
          {changed && consequence && <p className="admin-note admin-note--spaced"><Icon name="alert" size={16} />{consequence.trim()}</p>}
          <div className="admin-dialog-actions">
            <button type="button" className="manager-button" onClick={closeAnimated}>Cancel</button>
            <button type="submit" className="manager-button manager-button--primary" disabled={!changed}>
              {changed ? `Make ${roleLabel(role)}` : "Choose a new role"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function DeleteDialog({ user, onClose, onConfirm }) {
  const owned = useOwnedEvents(user);
  const managerNote = owned.length ? ` They manage ${plural(owned.length, "event")}, which will be left without a manager.` : "";
  return (
    <ConfirmModal
      title="Delete account permanently?"
      message={`This removes ${user.name}'s account (${user.email}). Their past registrations, certificates and feedback stay in the records, but nobody can sign in to this account again.${managerNote} Deactivating keeps everything and can be undone.`}
      confirmText="Delete account"
      onCancel={onClose}
      onConfirm={onConfirm}
    />
  );
}
