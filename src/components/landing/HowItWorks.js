import React, { useEffect, useRef, useState } from "react";
import Icon from "../Icon.js";
import Reveal from "./Reveal.js";

const STEPS = [
  { icon: "user-plus", title: "Register", text: "Pick an event and confirm your seat in one step." },
  { icon: "ticket", title: "Get your ticket", text: "Your ticket pass and its check-in code appear under My Events." },
  { icon: "scan", title: "Check in", text: "Show the code at the door and the organizer checks you in." },
  { icon: "certificate", title: "Get your certificate", text: "After you attend and leave feedback, your certificate is ready to view." },
];

// Four steps that light up one by one as they cross the middle of the screen. On wide
// screens a sticky panel beside them repeats the active step in large type.
export default function HowItWorks() {
  const [active, setActive] = useState(0);
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

  const current = STEPS[active];

  return (
    <section className="home-section landing-how" aria-labelledby="how-it-works-title">
      <div className="home-section__inner">
        <Reveal className="section-head">
          <div>
            <span className="section-head__eyebrow">FOUR STEPS, ONE ACCOUNT</span>
            <h2 className="section-head__title" id="how-it-works-title">HOW IT WORKS</h2>
          </div>
        </Reveal>

        <div className="landing-how__layout">
          {/* Visual repeat of the active step; the list below carries the real content. */}
          <div className="landing-how__stage" aria-hidden="true">
            <div className="landing-how__swap" key={active}>
              <span className="landing-how__icon"><Icon name={current.icon} size={40} /></span>
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
              >
                <span className="landing-step__icon"><Icon name={step.icon} size={24} /></span>
                <span className="landing-label">Step {index + 1} of {STEPS.length}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
