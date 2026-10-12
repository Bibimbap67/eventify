import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, clearToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
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

  const value = { user, initializing, login, signup, logout, updateProfile, changePassword };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
