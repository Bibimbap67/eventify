import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, clearToken } from "../api.js";

const AuthContext = createContext(null);
const EMPTY_ACCOUNTS = [];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState(EMPTY_ACCOUNTS);
  // Start in "initializing" only if there is a saved token to verify.
  const [initializing, setInitializing] = useState(() => Boolean(getToken()));

  // Restore the session on page load.
  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => clearToken())
      .finally(() => setInitializing(false));
  }, []);

  // Admins get the real user list for the Users page.
  const isAdmin = user?.role === "admin";
  const reloadAccounts = useCallback(() => {
    if (!isAdmin) {
      setAccounts(EMPTY_ACCOUNTS);
      return Promise.resolve();
    }
    return api("/users")
      .then((data) => setAccounts(data.users))
      .catch(() => setAccounts(EMPTY_ACCOUNTS));
  }, [isAdmin]);

  useEffect(() => {
    reloadAccounts();
  }, [reloadAccounts]);

  async function login(email, password) {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function signup(name, email, password) {
    const data = await api("/auth/signup", { method: "POST", body: { name, email, password } });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  // Saves the signed-in user's own profile fields to MongoDB.
  async function updateProfile(patch) {
    const data = await api("/auth/me", { method: "PATCH", body: patch });
    setUser(data.user);
    return data.user;
  }

  async function changePassword(currentPassword, newPassword) {
    await api("/auth/password", { method: "POST", body: { currentPassword, newPassword } });
  }

  // Admin > Users page. Each call refreshes the list afterwards.
  async function createAccount(fields) {
    const data = await api("/users", { method: "POST", body: fields });
    await reloadAccounts();
    return data.user;
  }

  async function updateAccount(id, patch) {
    const data = await api(`/users/${id}`, { method: "PATCH", body: patch });
    if (data.user.id === user?.id) setUser(data.user);
    await reloadAccounts();
    return data.user;
  }

  async function deleteAccount(id) {
    await api(`/users/${id}`, { method: "DELETE" });
    await reloadAccounts();
  }

  const value = {
    user, accounts, initializing, login, signup, logout, updateProfile, changePassword,
    reloadAccounts, createAccount, updateAccount, deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
