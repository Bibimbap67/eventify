// Tiny UI sounds made with the Web Audio API (no audio files).
// Off when the user prefers reduced motion; never on hover or page load.
import { prefersReducedMotion } from "./Motion.js";

const STORAGE_KEY = "eventify_sound";
const CHANGE_EVENT = "eventify:sound";
const VOLUME = 0.05; // low by default

let context = null;
let unlocked = false;

function readSetting() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

let soundOn = readSetting();

export function isSoundOn() {
  return soundOn && !prefersReducedMotion();
}

export function setSoundOn(on) {
  soundOn = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // storage blocked: the setting just lasts for this visit
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeSound(callback) {
  const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  window.addEventListener(CHANGE_EVENT, callback);
  media?.addEventListener?.("change", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    media?.removeEventListener?.("change", callback);
  };
}

function audio() {
  if (!unlocked) return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!context) context = new AudioCtor();
  if (context.state === "suspended") context.resume();
  return context;
}

function tone(ac, frequency, start, duration, type = "sine", level = 1) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t = ac.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(VOLUME * level, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function playSound(kind) {
  if (!isSoundOn()) return;
  const ac = audio();
  if (!ac) return;
  if (kind === "tick") {
    tone(ac, 1200, 0, 0.035, "triangle", 0.6);
  } else if (kind === "success") {
    tone(ac, 660, 0, 0.12, "sine");
    tone(ac, 880, 0.09, 0.16, "sine");
  } else if (kind === "error") {
    tone(ac, 196, 0, 0.22, "triangle", 1.2);
  }
}

// The AudioContext may only start after a user gesture, so nothing is created before one.
// Clicks on buttons get a soft tick. Installed once, when this module is first imported.
if (typeof window !== "undefined") {
  const unlock = () => {
    unlocked = true;
  };
  window.addEventListener("pointerdown", unlock, { capture: true, once: true });
  window.addEventListener("keydown", unlock, { capture: true, once: true });
  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target.closest('button, [role="button"], .btn') : null;
    if (target && !target.disabled && !target.classList.contains("sound-toggle")) playSound("tick");
  }, { capture: true });
}
