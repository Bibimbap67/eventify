import React from "react";
import { useAuth } from "../context/AuthContext.js";
import Navbar from "../components/Navbar.js";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="events-page">
      <Navbar />
      <main className="dashboard__body">
        <p className="events-hero__eyebrow">SIGNED IN AS</p>
        <h1 className="dashboard__title">{user?.name || user?.email}</h1>
        <p className="dashboard__subtitle">
          This is a placeholder workspace. Event creation, registration
          management, QR check-in and reporting modules plug in here once the
          backend is connected.
        </p>
      </main>
    </div>
  );
}
