import React, { useEffect, useState } from "react";

// Stays mounted so it can slide out as well as in, and so screen readers already know
// the live region before the first message. Keeps the last text while sliding out.
export default function Toast({ message, className = "toast", alert = false }) {
  const [lastMessage, setLastMessage] = useState(message);

  useEffect(() => {
    if (message) setLastMessage(message);
  }, [message]);

  return (
    <div className={className} role={alert ? "alert" : "status"} data-open={message ? "" : undefined}>
      {message || lastMessage}
    </div>
  );
}
