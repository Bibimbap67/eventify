import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { ShellSkeleton } from "./Skeleton.js";

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, initializing } = useAuth();

  // Wait while the session loads, so we don't redirect too early
  if (initializing) {
    return <ShellSkeleton role={requiredRole} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={{ admin: "/admin", staff: "/staff" }[user.role] || "/events"} replace />;
  }

  return children;
}