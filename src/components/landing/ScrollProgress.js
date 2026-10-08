import React, { useCallback, useRef, useState } from "react";
import Icon from "../Icon.js";
import { useReducedMotion, useScrollFrame } from "./motion.js";

// A thin progress bar pinned to the top of the window plus a back-to-top button that
// appears after the first screen. `focusTargetId` receives focus after jumping back up.
export default function ScrollProgress({ focusTargetId }) {
  const barRef = useRef(null);
  const [showTop, setShowTop] = useState(false);
  const reduced = useReducedMotion();

  const update = useCallback((scrollY) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, scrollY / max) : 0;
    if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
    setShowTop(scrollY > window.innerHeight * 0.8);
  }, []);
  useScrollFrame(update);

  const backToTop = () => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    const target = focusTargetId && document.getElementById(focusTargetId);
    if (target) target.focus({ preventScroll: true });
  };

  return (
    <>
      <div className="landing-progress" aria-hidden="true">
        <div className="landing-progress__bar" ref={barRef} />
      </div>
      <button
        type="button"
        className={`landing-to-top${showTop ? " is-shown" : ""}`}
        onClick={backToTop}
        aria-label="Back to top"
        tabIndex={showTop ? 0 : -1}
        aria-hidden={showTop ? undefined : "true"}
      >
        <Icon name="arrow-up" size={24} />
      </button>
    </>
  );
}
