import React from "react";
import { useSearchParams } from "react-router-dom";
import { useManager } from "../../context/ManagerContext.js";
import { SectionHeading } from "../../components/ui.js";
import { RegistrationDesk } from "../../components/manager/Desks.js";

export default function ManagerRegistrations() {
  const { registrations } = useManager();
  const [params] = useSearchParams();
  const initialStatus = params.get("status") || "All";
  return (
    <div className="manager-page">
      <SectionHeading eyebrow="Registration desk" title="Registrations" detail="Review sign-ups across your assigned events only." />
      <RegistrationDesk key={initialStatus} rows={registrations} showEvent initialStatus={initialStatus} />
    </div>
  );
}
