import React, { createContext, useContext, useEffect, useState } from "react";

/**
 * AuthContext
 * ------------------------------------------------------------------
 * Frontend-only authentication for now. Users are persisted in
 * localStorage so sign up + sign in feel real across page reloads.
 *
 * When the Express/MongoDB backend is ready, replace the bodies of
 * `login` and `signup` below with real calls, e.g.:
 *
 *   const res = await fetch("/api/auth/login", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ email, password }),
 *   });
 *   const data = await res.json();
 *
 * Everything else in the app (LoginPage, ProtectedRoute, Dashboard)
 * talks to this context, not to localStorage directly, so swapping
 * the implementation later won't require touching those files.
 * ------------------------------------------------------------------
 */

const USERS_KEY = "eventops_users";
const SESSION_KEY = "eventops_session";
const DEFAULT_ACCOUNTS = [
  { id: "account-admin", name: "Administrator", email: "admin@eventify.local", password: "Admin123!", role: "admin" },
  { id: "account-manager", name: "Event Manager", email: "manager@eventify.local", password: "Manager123!", role: "manager", managerId: "manager-1" },
  { id: "account-user", name: "Attendee", email: "user@eventify.local", password: "User123!", role: "user" },
];
const SEEDED_NAMES = { "account-admin": "Eventify Admin", "account-manager": "Maya Santos", "account-user": "Eventify User" };

const AuthContext = createContext(null);

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function ensureDefaultAccounts() {
  const users = readUsers();
  let changed = false;
  const accounts = DEFAULT_ACCOUNTS.map((account) => {
    const existing = users.find((user) => user.email.toLowerCase() === account.email);
    if (existing) {
      if (existing.name === SEEDED_NAMES[account.id]) {
        existing.name = account.name;
        changed = true;
      }
      if (!existing.role) {
        existing.role = account.role;
        changed = true;
      }
      return existing;
    }
    changed = true;
    return account;
  });
  if (changed) writeUsers([...users.filter((user) => !DEFAULT_ACCOUNTS.some((account) => account.email === user.email.toLowerCase())), ...accounts]);
  return readUsers().map(({ password, ...account }) => account);
}

// Simulates network latency so loading states are visible/testable.
function delay(ms = 600) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [initializing, setInitializing] = useState(true);

  // Restore session on first load
  useEffect(() => {
    const savedAccounts = ensureDefaultAccounts();
    setAccounts(savedAccounts);
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (saved) {
        const account = savedAccounts.find((item) => item.id === saved.id);
        if (account) setUser(account);
      }
    } catch {
      // ignore corrupt session data
    }
    setInitializing(false);
  }, []);

  async function login(email, password) {
    await delay();
    const users = readUsers();
    const match = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );

    if (!match) {
      throw new Error("No account found with that email.");
    }
    if (match.password !== password) {
      throw new Error("Incorrect password.");
    }

    const { password: ignoredPassword, ...session } = match;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }

  async function signup(name, email, password) {
    await delay();
    const users = readUsers();
    const exists = users.some(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (exists) {
      throw new Error("An account with that email already exists.");
    }

    const newUser = {
      id: crypto.randomUUID(),
      name,
      email,
      password, // NOTE: plaintext only because there is no backend yet.
      role: "user",
    };
    writeUsers([...users, newUser]);
    setAccounts((current) => [...current, { id: newUser.id, name, email, role: "user" }]);

    const { password: ignoredPassword, ...session } = newUser;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  const value = { user, accounts, initializing, login, signup, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
