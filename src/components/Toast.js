import React, { useEffect, useState } from "react";
import { playSound } from "./sound.js";

// ponytail: admin/manager toasts don't say whether they report a success or a failure,
// so the sound is picked from the wording. Pass `alert` where the caller knows it's an error.
const FAILURE_WORDS = /\b(cannot|can't|could not|couldn't|failed|error|not available|invalid|unable)\b/i;

// Stays mounted so it can slide out as well as in, and so screen readers already know
// the live region before the first message. Keeps the last text while sliding out.
export default function Toast({ message, className = "toast", alert = false }) {
  const [lastMessage, setLastMessage] = useState(message);

  useEffect(() => {
    if (!message) return;
    setLastMessage(message);
    playSound(alert || FAILURE_WORDS.test(message) ? "error" : "success");
  }, [message, alert]);

  return (
    <div className={className} role={alert ? "alert" : "status"} data-open={message ? "" : undefined}>
      {message || lastMessage}
    </div>
  );
}
