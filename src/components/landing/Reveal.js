import React, { useRef } from "react";
import { useInViewOnce, useReducedMotion } from "./motion.js";

// Fades its content up 12px the first time it scrolls into view (once per page visit).
// `delay` (ms) staggers siblings that enter together.
export default function Reveal({ as: Tag = "div", delay = 0, className = "", style, children, ...rest }) {
  const ref = useRef(null);
  const inView = useInViewOnce(ref);
  const reduced = useReducedMotion();
  const shown = inView || reduced;

  return (
    <Tag
      ref={ref}
      className={`reveal${shown ? " is-in" : ""}${className ? ` ${className}` : ""}`}
      style={delay && shown ? { ...style, transitionDelay: `${delay}ms` } : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
