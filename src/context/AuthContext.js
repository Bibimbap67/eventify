import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, getToken, setToken, clearToken } from "../api.js";
import { notify } from "../components/Toast.js";

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

  const userRef = useRef(user);
  userRef.current = user;

  // api.js reports a token the server refused; drop the user so protected pages send them to sign in.
  useEffect(() => {
    const signedOut = (e) => {
      if (userRef.current) notify(e.detail || "Please sign in again.", "warning", "Signed out");
      setUser(null);
    };
    window.addEventListener("eventify:signed-out", signedOut);
    return () => window.removeEventListener("eventify:signed-out", signedOut);
  }, []);

  // An admin may be signed in on one device only. Check now and then (and on returning to the
  // tab) so the older device is signed out even while nobody clicks anything there.
  const isAdmin = user?.role === "admin";
  useEffect(() => {
    if (!isAdmin) return undefined;
    const check = () => api("/auth/me").catch(() => {});
    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [isAdmin]);

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
