import { useEffect, useState } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function readReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_QUERY).matches
    : false;
}

// True when the visitor asked the OS for less motion. Landing effects turn off entirely then.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(readReducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia(REDUCED_QUERY);
    const onChange = () => setReduced(query.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

// Becomes true the first time the element scrolls into view, then stays true.
export function useInViewOnce(ref, { threshold = 0.12, rootMargin = "0px 0px -40px 0px" } = {}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return undefined;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold, rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, inView, threshold, rootMargin]);

  return inView;
}

// Runs `onFrame(scrollY)` at most once per animation frame while the page scrolls.
export function useScrollFrame(onFrame, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        onFrame(window.scrollY);
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [onFrame, enabled]);
}
