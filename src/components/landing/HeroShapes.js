import React, { useCallback, useRef } from "react";
import { useReducedMotion, useScrollFrame } from "./motion.js";

// Brutalist shapes behind the hero ticket. Each drifts at its own speed while the hero is in
// view (transform only, at most ~110px). Static when reduced motion is on.
const SHAPES = [
  { className: "landing-shape landing-shape--disc", speed: 0.25 },
  { className: "landing-shape landing-shape--tile", speed: 0.4 },
  { className: "landing-shape landing-shape--square", speed: 0.12 },
];
const MAX_SCROLL = 280;

export default function HeroShapes() {
  const reduced = useReducedMotion();
  const refs = useRef([]);

  const update = useCallback((scrollY) => {
    const y = Math.min(scrollY, MAX_SCROLL);
    refs.current.forEach((node, index) => {
      if (node) node.style.transform = `translate3d(0, ${Math.round(y * SHAPES[index].speed)}px, 0)`;
    });
  }, []);
  useScrollFrame(update, !reduced);

  return (
    <div className="landing-shapes" aria-hidden="true">
      {SHAPES.map((shape, index) => (
        <span key={shape.className} className={shape.className} ref={(node) => { refs.current[index] = node; }} />
      ))}
    </div>
  );
}
