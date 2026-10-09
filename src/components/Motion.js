import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// Same values as --ease-out / --duration-* in index.css (WAAPI needs them as JS values).
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const DURATION_BASE = 240;
const DURATION_EXIT = 150;
const DURATION_COUNT = 400;

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Children fade up in a short stagger the first time the block scrolls into view.
// The observer disconnects after the first hit, so it never replays.
export function Reveal({ as: Tag = "div", className = "", children, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || prefersReducedMotion()) {
      setShown(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShown(true);
        observer.disconnect();
      }
    }, { rootMargin: "0px 0px -10% 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`reveal${className ? ` ${className}` : ""}`} data-revealed={shown ? "" : undefined} {...rest}>
      {children}
    </Tag>
  );
}

// Fade + 8px rise for the routed content on every path change. Enter only, nothing is
// remounted, so page state, focus and scroll behave exactly as before.
export function PageTransition({ targets = ":scope > *", children }) {
  const ref = useRef(null);
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    ref.current.querySelectorAll(targets).forEach((el) => {
      el.animate?.(
        [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
        { duration: DURATION_BASE, easing: EASE_OUT }
      );
    });
  }, [pathname, targets]);

  return <div ref={ref} className="page-transition">{children}</div>;
}

// True only for the first moment after mount: lets a list stagger its first load
// without replaying for rows that appear later (search, filters, live updates).
export function useEntering(ms = 600) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return entering;
}

// A short "working" beat for actions that finish instantly here but still save to the server
// in the background (register, cancel, feedback): the button shows its spinner for PENDING_MS,
// then the action runs. Instant under reduced motion. If the component unmounts first
// (the dialog was closed), the action is dropped.
const PENDING_MS = 550;

export function usePending() {
  const [pending, setPending] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = useCallback((action) => {
    if (prefersReducedMotion()) {
      action();
      return;
    }
    setPending(true);
    timer.current = setTimeout(() => {
      setPending(false);
      action();
    }, PENDING_MS);
  }, []);

  return [pending, run];
}

// Counts up from 0 once, the first time a non-zero value shows. Later changes are instant.
export function CountUp({ value }) {
  const ref = useRef(null);
  const done = useRef(false);

  // Layout effect: the final number never paints before the count starts.
  useLayoutEffect(() => {
    const el = ref.current;
    const target = Number(value) || 0;
    if (done.current || target === 0 || prefersReducedMotion()) {
      if (target !== 0) done.current = true;
      return undefined;
    }
    done.current = true;
    let frame;
    let finished = false;
    const start = performance.now();
    const tick = (now) => {
      // The first frame's timestamp can be slightly before `start`; clamp so it never shows a negative number.
      const t = Math.min(1, Math.max(0, (now - start) / DURATION_COUNT));
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
      else finished = true;
    };
    el.textContent = "0";
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (!finished) done.current = false; // interrupted (e.g. StrictMode re-run): allow one more try
      el.textContent = String(value);
    };
  }, [value]);

  return <span ref={ref} className="count-up">{value}</span>;
}

// Dialog behaviour shared by the modals: focus moves in, Escape closes, focus returns to
// the trigger, and closing plays a short exit before the parent unmounts it.
export function useDialog(onClose) {
  const ref = useRef(null);
  const closing = useRef(false);

  const close = useCallback(() => {
    const dialog = ref.current;
    if (!dialog || closing.current || prefersReducedMotion() || !dialog.animate) {
      onClose?.();
      return;
    }
    closing.current = true;
    const overlay = dialog.parentElement;
    overlay.style.pointerEvents = "none";
    overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURATION_EXIT, easing: EASE_OUT, fill: "forwards" });
    const exit = dialog.animate(
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.96)" }],
      { duration: DURATION_EXIT, easing: EASE_OUT, fill: "forwards" }
    );
    const finish = () => onClose?.();
    exit.finished.then(finish, finish);
  }, [onClose]);

  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const trigger = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    };
  }, []);

  return [ref, close];
}
