import React, { useEffect, useState } from "react";
import { SYNC_ERROR_EVENT } from "../context/useServerStore.js";

// Shows a message when saving to or loading from the server fails.
export default function SyncErrorToast() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    let timer;
    const show = (event) => {
      setMessage(event.detail || "Could not save your changes. Try again.");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(""), 4000);
    };
    window.addEventListener(SYNC_ERROR_EVENT, show);
    return () => {
      window.removeEventListener(SYNC_ERROR_EVENT, show);
      window.clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return <div className="toast" role="alert" style={{ zIndex: 70 }}>{message}</div>;
}
