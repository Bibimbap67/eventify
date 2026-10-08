import React, { useEffect, useRef, useState } from "react";
import { useInViewOnce, useReducedMotion } from "./motion.js";

const COUNT_MS = 700;

// Counts from 0 to `value` once, when `start` first becomes true. Later value changes
// (live registration counts) show directly without replaying the count.
function CountUp({ value, start }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const target = useRef(value);
  target.current = value;

  useEffect(() => {
    if (!start || done) return undefined;
    if (reduced) {
      setDone(true);
      return undefined;
    }
    let frame = 0;
    let startedAt = null;
    const tick = (now) => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / COUNT_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(target.current * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, done, reduced]);

  return (done ? value : shown).toLocaleString();
}

// A bordered band of big numbers that count up the first time it scrolls into view.
export default function StatsBand({ stats }) {
  const ref = useRef(null);
  const inView = useInViewOnce(ref, { threshold: 0.5, rootMargin: "0px" });

  return (
    <dl className="landing-stats" ref={ref}>
      {stats.map((stat) => (
        <div className="landing-stat" key={stat.label}>
          <dt className="landing-label">{stat.label}</dt>
          <dd className="landing-stat__num">
            <CountUp value={stat.value} start={inView} />
          </dd>
          <dd className="landing-stat__hint">{stat.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
