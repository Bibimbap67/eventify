import React, { useId } from "react";

// Small looping scenes for "How it works": a pencil filling in the sign-up form, a ticket
// printing, a phone being scanned at the door, and a certificate getting signed and sealed.
// Plain SVG animated by CSS (transform, opacity and stroke-dashoffset; see index.css, "E2").
// Decorative only: the step text says the same thing. Every part rests on the finished
// picture, so a scene that is not playing, or runs with reduced motion, shows its last frame.

// Points of a star or burst around cx,cy (alternating outer and inner radius).
function starPoints(cx, cy, tips, outer, inner) {
  const points = [];
  for (let i = 0; i < tips * 2; i += 1) {
    const radius = i % 2 ? inner : outer;
    const angle = (Math.PI * i) / tips - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return points.join(" ");
}

const SEAL = starPoints(216, 140, 16, 22, 18);
const SEAL_STAR = starPoints(216, 140, 5, 6.5, 2.8);

// A 7x7 code with the three corner squares a scanner looks for.
const QR_ROWS = ["1110111", "1010101", "1110111", "0101001", "1110110", "1011010", "1110101"];

function QrCode({ x, y, size }) {
  const cell = size / 7;
  return (
    <g className="hs-qr">
      {QR_ROWS.flatMap((row, r) => [...row].map((bit, c) => (bit === "1"
        ? <rect key={`${r}-${c}`} x={x + c * cell} y={y + r * cell} width={cell + 0.3} height={cell + 0.3} />
        : null)))}
    </g>
  );
}

// Four-point twinkle centred on x,y.
function Sparkle({ x, y, size, className }) {
  const k = size * 0.2;
  const d = `M${x} ${y - size} Q${x + k} ${y - k} ${x + size} ${y} Q${x + k} ${y + k} ${x} ${y + size} Q${x - k} ${y + k} ${x - size} ${y} Q${x - k} ${y - k} ${x} ${y - size}Z`;
  return <path className={`hs-fill-white hs-line-thin ${className}`} d={d} />;
}

function Backdrop() {
  return <circle className="how-scene__backdrop" cx="160" cy="112" r="92" />;
}

// 1. Register: the pencil writes a name and an email, ticks the box, then the button is pressed.
function RegisterScene() {
  return (
    <>
      <Backdrop />
      <rect className="hs-ink" x="86" y="34" width="148" height="168" />
      <rect className="hs-paper" x="80" y="28" width="148" height="168" />
      <rect className="hs-fill-yellow hs-line" x="128" y="18" width="52" height="18" />
      <rect className="hs-ink" x="96" y="46" width="64" height="8" />

      <rect className="hs-muted" x="96" y="64" width="36" height="5" />
      <rect className="hs-field" x="96" y="72" width="116" height="24" />
      <path className="how-scene__write how-scene__write--1" pathLength="1" d="M102 88 c3 -8 7 -8 10 0 s7 8 10 0 s7 -8 10 0 s7 8 10 0 s7 -8 10 0 s7 8 10 0 s7 -8 10 0" />

      <rect className="hs-muted" x="96" y="104" width="30" height="5" />
      <rect className="hs-field" x="96" y="112" width="116" height="24" />
      <path className="how-scene__write how-scene__write--2" pathLength="1" d="M102 128 c3 -8 7 -8 10 0 s7 8 10 0 s7 -8 10 0 s7 8 10 0 s7 -8 10 0" />

      <rect className="hs-field" x="96" y="146" width="14" height="14" />
      <path className="how-scene__tick" pathLength="1" d="M99 153 l4 4 l7 -9" />
      <rect className="hs-muted" x="116" y="151" width="56" height="5" />

      <rect className="hs-ink" x="99" y="171" width="112" height="20" />
      <g className="how-scene__press">
        <rect className="hs-fill-yellow hs-line" x="96" y="168" width="112" height="20" />
        <text className="how-scene__label" x="152" y="182" textAnchor="middle">REGISTER</text>
      </g>
      <Sparkle className="how-scene__spark" x={224} y={162} size={13} />
      <Sparkle className="how-scene__spark how-scene__spark--late" x={236} y={186} size={8} />

      {/* Pencil, drawn with its tip at 0,0 so the animation moves the tip */}
      <g className="how-scene__pencil">
        <g className="how-scene__pencil-bob">
          <polygon className="hs-fill-wood hs-line-thin" points="0,0 6,-14 14,-8" />
          <polygon className="hs-ink" points="0,0 2.4,-5.6 5.6,-3.2" />
          <polygon className="hs-fill-yellow hs-line-thin" points="6,-14 14,-8 54,-58 46,-64" />
          <polygon className="hs-fill-metal hs-line-thin" points="46,-64 54,-58 58,-63 50,-69" />
          <polygon className="hs-fill-coral hs-line-thin" points="50,-69 58,-63 64,-70 56,-76" />
        </g>
      </g>
    </>
  );
}

// 2. Get your ticket: the pass prints out of the slot line by line, then tips forward.
function TicketScene() {
  const clipId = `hs-slot-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <>
      <Backdrop />
      <defs>
        <clipPath id={clipId}><rect x="0" y="0" width="320" height="136" /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g className="how-scene__ticket">
          <g className="how-scene__ticket-tilt">
            <rect className="hs-paper" x="104" y="26" width="112" height="110" />
            <rect className="hs-fill-yellow hs-line" x="104" y="26" width="112" height="24" />
            <rect className="hs-ink" x="114" y="35" width="46" height="6" />
            <rect className="hs-fill-white hs-line-thin" x="176" y="33" width="30" height="10" />
            <rect className="hs-muted" x="114" y="58" width="80" height="5" />
            <rect className="hs-muted" x="114" y="68" width="56" height="5" />
            <line className="hs-perf" x1="104" x2="216" y1="82" y2="82" />
            <QrCode x={116} y={90} size={36} />
            <rect className="hs-ink" x="162" y="96" width="40" height="6" />
            <rect className="hs-muted" x="162" y="108" width="30" height="5" />
            <rect className="hs-muted" x="162" y="118" width="36" height="5" />
          </g>
        </g>
      </g>

      <rect className="hs-ink" x="76" y="142" width="180" height="58" />
      <rect className="hs-fill-blue hs-line" x="70" y="136" width="180" height="58" />
      <rect className="hs-ink" x="94" y="130" width="132" height="10" />
      <rect className="hs-fill-yellow hs-line-thin" x="86" y="156" width="26" height="8" />
      <rect className="hs-fill-white hs-line-thin" x="86" y="171" width="44" height="7" />
      <circle className="how-scene__led hs-fill-mint hs-line-thin" cx="228" cy="165" r="6" />
      <Sparkle className="how-scene__spark how-scene__spark--mid" x={230} y={34} size={14} />
    </>
  );
}

// 3. Check in: the scanner sweeps the code on the phone, then the check and the badge pop up.
function CheckInScene() {
  return (
    <>
      <Backdrop />
      <rect className="hs-ink" x="119" y="22" width="96" height="182" rx="16" />
      <rect className="hs-ink" x="112" y="16" width="96" height="182" rx="16" />
      <rect className="hs-fill-white" x="119" y="30" width="82" height="152" rx="6" />
      <rect className="hs-fill-metal" x="148" y="21" width="24" height="4" rx="2" />
      <rect className="hs-ink" x="128" y="42" width="40" height="6" />
      <rect className="hs-fill-yellow hs-line-thin" x="128" y="54" width="36" height="12" />
      <QrCode x={132} y={78} size={56} />
      <path className="how-scene__frame" d="M124 84 v-12 h12 M184 72 h12 v12 M196 132 v12 h-12 M136 144 h-12 v-12" />

      <g className="how-scene__beam">
        <rect className="hs-fill-coral hs-line-thin" x="122" y="74" width="76" height="5" />
      </g>

      <g className="how-scene__ok">
        <circle className="hs-fill-mint hs-line" cx="160" cy="106" r="30" />
        <path className="how-scene__ok-check" pathLength="1" d="M146 106 l9 9 l17 -19" />
      </g>

      <g className="how-scene__chip">
        <rect className="hs-ink" x="111" y="161" width="104" height="24" rx="12" />
        <rect className="hs-fill-yellow hs-line" x="108" y="158" width="104" height="24" rx="12" />
        <text className="how-scene__label how-scene__label--mono" x="160" y="174" textAnchor="middle">CHECKED IN</text>
      </g>
    </>
  );
}

// 4. Get your certificate: it unrolls, gets signed, and a seal stamps down with confetti.
const CONFETTI = [
  { x: 210, y: 136, w: 6, h: 10, tone: "coral", dx: -48, dy: -34, rot: 160 },
  { x: 214, y: 134, w: 8, h: 8, tone: "blue", dx: -20, dy: -58, rot: 90 },
  { x: 216, y: 136, w: 6, h: 10, tone: "mint", dx: 18, dy: -60, rot: -140 },
  { x: 218, y: 138, w: 8, h: 6, tone: "violet", dx: 46, dy: -38, rot: 120 },
  { x: 214, y: 140, w: 6, h: 6, tone: "yellow", dx: 54, dy: 4, rot: -90 },
  { x: 212, y: 140, w: 6, h: 10, tone: "blue", dx: -56, dy: 0, rot: 200 },
];

function CertificateScene() {
  return (
    <>
      <Backdrop />
      <g className="how-scene__paper">
        <rect className="hs-ink" x="62" y="46" width="200" height="136" />
        <rect className="hs-paper" x="56" y="40" width="200" height="136" />
        <rect className="hs-frame" x="65" y="49" width="182" height="118" />
        <text className="how-scene__title" x="156" y="76" textAnchor="middle">CERTIFICATE</text>
        <rect className="hs-muted" x="106" y="84" width="100" height="5" />
        <rect className="hs-ink" x="96" y="100" width="120" height="8" />
        <line className="hs-rule" x1="90" x2="222" y1="116" y2="116" />
        <path className="how-scene__sign" pathLength="1" d="M80 150 c5 -14 9 6 14 -4 s6 -12 10 -2 s8 8 12 -2 s6 -6 12 0" />
        <line className="hs-rule" x1="78" x2="144" y1="156" y2="156" />
      </g>

      <circle className="how-scene__ring" cx="216" cy="140" r="22" />
      <g className="how-scene__seal">
        <polygon className="hs-fill-coral hs-line-thin" points="204,148 196,182 206,175 213,186 215,150" />
        <polygon className="hs-fill-coral hs-line-thin" points="218,150 221,186 228,175 238,182 228,148" />
        <polygon className="hs-fill-yellow hs-line" points={SEAL} />
        <circle className="hs-fill-white hs-line-thin" cx="216" cy="140" r="10" />
        <polygon className="hs-ink" points={SEAL_STAR} />
      </g>

      {CONFETTI.map((bit) => (
        <rect
          key={`${bit.dx}-${bit.dy}`}
          className={`how-scene__confetti hs-fill-${bit.tone} hs-line-thin`}
          x={bit.x}
          y={bit.y}
          width={bit.w}
          height={bit.h}
          style={{ "--dx": `${bit.dx}px`, "--dy": `${bit.dy}px`, "--rot": `${bit.rot}deg` }}
        />
      ))}
    </>
  );
}

const SCENES = [RegisterScene, TicketScene, CheckInScene, CertificateScene];

export default function HowScene({ step, playing = true, className = "" }) {
  const Scene = SCENES[step] || SCENES[0];
  return (
    <svg
      className={`how-scene how-scene--${step}${playing ? " is-playing" : ""}${className ? ` ${className}` : ""}`}
      viewBox="0 0 320 220"
      aria-hidden="true"
      focusable="false"
    >
      <Scene />
    </svg>
  );
}
