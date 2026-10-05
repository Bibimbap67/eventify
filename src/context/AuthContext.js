import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);
const EMPTY_ACCOUNTS = [];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  async function login() {
    throw new Error("Sign-in is not available until a backend login endpoint is implemented.");
  }

  async function signup() {
    throw new Error("Account creation is not available until a backend signup endpoint is implemented.");
  }

  function logout() {
    setUser(null);
  }

  const value = { user, accounts: EMPTY_ACCOUNTS, initializing: false, login, signup, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
