import React, { useEffect, useRef, useState } from "react";
import Icon from "../Icon.js";
import HowScene from "./HowScenes.js";

// Each step has its own color; the sticky panel and the list use the same one.
const STEPS = [
  { icon: "user-plus", color: "var(--blue)", title: "Register", text: "Pick an event and confirm your seat in one step." },
  { icon: "ticket", color: "var(--violet)", title: "Get your ticket", text: "Your ticket pass and its own QR code appear under My Events." },
  { icon: "scan", color: "var(--mint)", title: "Check in", text: "Show the QR on your pass at the door. Event staff scan it and you are checked in." },
  { icon: "certificate", color: "var(--yellow)", title: "Get your certificate", text: "After you attend and leave feedback, your certificate is ready to view." },
];

// Four steps that light up one by one as they cross the middle of the screen. On wide
// screens a sticky panel beside them acts out the active step as a small animated scene;
// on phones each step card carries its own scene, and only the active one plays.
// `children` (the page's call-to-action buttons) closes the section.
export default function HowItWorks({ children }) {
  const [active, setActive] = useState(0);
  const [onScreen, setOnScreen] = useState(false);
  const sectionRef = useRef(null);
  const stepRefs = useRef([]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(Number(entry.target.dataset.step));
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    stepRefs.current.forEach((step) => step && observer.observe(step));
    return () => observer.disconnect();
  }, []);

  // The scene loops pause while the section is off screen.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !("IntersectionObserver" in window)) {
      setOnScreen(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const current = STEPS[active];

  return (
    <section
      ref={sectionRef}
      className={`home-section landing-how${onScreen ? " is-onscreen" : ""}`}
      aria-labelledby="how-it-works-title"
    >
      <div className="home-section__inner">
        <div className="section-head">
          <div>
            <h2 className="section-head__title" id="how-it-works-title">How it works</h2>
            <p className="section-head__note">Four steps, one account.</p>
          </div>
        </div>

        <div className="landing-how__layout">
          {/* Visual repeat of the active step; the list below carries the real content. */}
          <div className="landing-how__stage" aria-hidden="true" style={{ "--step-color": current.color }}>
            <div className="landing-how__swap" key={active}>
              <HowScene step={active} />
              <span className="landing-label">Step {active + 1} of {STEPS.length}</span>
              <span className="landing-how__title">{current.title}</span>
              <span className="landing-how__text">{current.text}</span>
            </div>
            <span className="landing-how__dots">
              {STEPS.map((step, index) => (
                <i key={step.title} className={index <= active ? "is-on" : ""} />
              ))}
            </span>
          </div>

          <ol className="landing-how__steps">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                ref={(node) => { stepRefs.current[index] = node; }}
                data-step={index}
                className={`landing-step${index === active ? " is-active" : ""}`}
                style={{ "--step-color": step.color }}
              >
                <HowScene step={index} playing={index === active} className="landing-step__scene" />
                <span className="landing-step__icon"><Icon name={step.icon} size={24} /></span>
                <span className="landing-step__num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="landing-label">Step {index + 1} of {STEPS.length}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>

        {children && <div className="landing-how__end">{children}</div>}
      </div>
    </section>
  );
}
