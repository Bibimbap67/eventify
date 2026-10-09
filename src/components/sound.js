// Tiny UI sounds made with the Web Audio API (no audio files).
// Off when the user prefers reduced motion; never on hover or page load.
import { prefersReducedMotion } from "./Motion.js";

const STORAGE_KEY = "eventify_sound";
const CHANGE_EVENT = "eventify:sound";
const VOLUME = 0.05; // low by default

let context = null;
let noiseBuffer = null;
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

// A pitched blip. `glideTo` slides the pitch during the note (pops, thuds).
function tone(ac, frequency, start, duration, { type = "sine", level = 1, glideTo } = {}) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t = ac.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(VOLUME * level, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

// A filtered burst of white noise: the "physical" part of a click (key, latch, paper).
// `sweepTo` moves the filter during the burst (whoosh).
function noise(ac, start, duration, { filter = "bandpass", frequency = 2000, q = 1, level = 1, sweepTo } = {}) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const source = ac.createBufferSource();
  const biquad = ac.createBiquadFilter();
  const gain = ac.createGain();
  const t = ac.currentTime + start;
  source.buffer = noiseBuffer;
  biquad.type = filter;
  biquad.frequency.setValueAtTime(frequency, t);
  if (sweepTo) biquad.frequency.exponentialRampToValueAtTime(sweepTo, t + duration);
  biquad.Q.value = q;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(VOLUME * level, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  source.connect(biquad).connect(gain).connect(ac.destination);
  source.start(t);
  source.stop(t + duration + 0.02);
}

// Each kind of control has its own voice, so the page sounds like it is made of different parts.
const SOUNDS = {
  // Plain buttons: a short, bright tick.
  tick: (ac) => tone(ac, 1200, 0, 0.035, { type: "triangle", level: 0.6 }),
  // Main actions (submit, primary, yellow): a deep keyboard "thock".
  thock: (ac) => {
    noise(ac, 0, 0.05, { filter: "lowpass", frequency: 1100, level: 1.6 });
    tone(ac, 170, 0, 0.09, { level: 1.2, glideTo: 90 });
  },
  // Chips, tabs, filters, stars: a rising bubble pop.
  pop: (ac) => tone(ac, 420, 0, 0.075, { level: 0.9, glideTo: 1150 }),
  // Links and cards that navigate: a dry paper snap.
  snap: (ac) => {
    noise(ac, 0, 0.022, { filter: "highpass", frequency: 3200, level: 1.4 });
    tone(ac, 2300, 0, 0.018, { type: "triangle", level: 0.35 });
  },
  // On/off controls: a two-step latch, rising for on and falling for off.
  "switch-on": (ac) => {
    tone(ac, 820, 0, 0.022, { type: "square", level: 0.3 });
    tone(ac, 1240, 0.05, 0.026, { type: "square", level: 0.3 });
  },
  "switch-off": (ac) => {
    tone(ac, 1240, 0, 0.022, { type: "square", level: 0.3 });
    tone(ac, 820, 0.05, 0.026, { type: "square", level: 0.3 });
  },
  // Destructive buttons: a low, dull thud.
  thud: (ac) => {
    tone(ac, 150, 0, 0.13, { level: 1.4, glideTo: 65 });
    noise(ac, 0, 0.06, { filter: "lowpass", frequency: 500, level: 1.2 });
  },
  // Back to top: an airy rising whoosh.
  whoosh: (ac) => noise(ac, 0, 0.24, { filter: "bandpass", frequency: 380, sweepTo: 2600, q: 1.4, level: 1.6 }),
  // Toasts.
  success: (ac) => {
    tone(ac, 660, 0, 0.12);
    tone(ac, 880, 0.09, 0.16);
  },
  error: (ac) => tone(ac, 196, 0, 0.22, { type: "triangle", level: 1.2 }),
};

export function playSound(kind) {
  if (!isSoundOn()) return;
  const ac = audio();
  if (!ac || !SOUNDS[kind]) return;
  SOUNDS[kind](ac);
}

// Which sound a clicked control makes. First match wins; `data-sound` overrides everything.
const CLICKABLE = 'a[href], button, [role="button"], [role="tab"], [role="switch"], [role="link"], .btn, .event-card, summary, input[type="checkbox"], input[type="radio"]';
const CLICK_SOUNDS = [
  [".landing-to-top", "whoosh"],
  [".btn-sm--danger, .manager-button--danger, .btn--danger", "thud"],
  ['.star-btn, .category-pill, .tab-btn, .filter-btn, .day-tab-btn, .settings-tab, [role="tab"], .auth-tabs__tab', "pop"],
  ['[aria-pressed], [role="switch"], input[type="checkbox"], input[type="radio"]', "switch"],
  ['button[type="submit"], .btn--primary, .btn-sm--yellow, .manager-button--primary, .landing-btn--primary, .landing-btn--blue, .btn-ticket-register, .home-search-bar__btn', "thock"],
  ['a[href], [role="link"], .event-card, .landing-ticket', "snap"],
];

function soundFor(el) {
  if (el.dataset.sound) return el.dataset.sound;
  const match = CLICK_SOUNDS.find(([selector]) => el.matches(selector));
  const kind = match ? match[1] : "tick";
  if (kind !== "switch") return kind;
  // Inputs have already flipped when the click arrives; aria-pressed still shows the old state.
  const turningOn = el.matches("input") ? el.checked : el.getAttribute("aria-pressed") !== "true";
  return turningOn ? "switch-on" : "switch-off";
}

// The AudioContext may only start after a user gesture, so nothing is created before one.
// Installed once, when this module is first imported.
if (typeof window !== "undefined") {
  const unlock = () => {
    unlocked = true;
  };
  window.addEventListener("pointerdown", unlock, { capture: true, once: true });
  window.addEventListener("keydown", unlock, { capture: true, once: true });
  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target.closest(CLICKABLE) : null;
    if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") return;
    if (target.classList.contains("sound-toggle")) return; // it plays its own switch sound
    playSound(soundFor(target));
  }, { capture: true });
}
