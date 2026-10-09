import React, { useCallback, useRef } from "react";
import Shape from "./Shapes.js";
import { useReducedMotion, useScrollFrame } from "./motion.js";

// Brutalist stickers behind the hero ticket. Each drifts at its own speed while the hero is in
// view (transform only, at most ~110px). Static when reduced motion is on.
const SHAPES = [
  { kind: "starburst", className: "landing-shape landing-shape--burst", speed: 0.25 },
  { kind: "scallop", className: "landing-shape landing-shape--scallop", speed: 0.4 },
  { kind: "sparkle", className: "landing-shape landing-shape--sparkle", speed: 0.12 },
  { kind: "zigzag", className: "landing-shape landing-shape--zigzag", speed: 0.3 },
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
        <span key={shape.kind} className={shape.className} ref={(node) => { refs.current[index] = node; }}>
          <Shape kind={shape.kind} />
        </span>
      ))}
    </div>
  );
}
