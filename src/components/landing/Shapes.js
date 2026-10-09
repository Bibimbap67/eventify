import React from "react";

// Neo-brutalist sticker shapes drawn as inline SVG: a flat fill, a 3px ink outline
// and a hard ink shadow (the same geometry drawn again, offset down-right).
// The fill comes from the CSS variable --shape-fill, so one shape works in any color.

function polarPoints(count, radiusAt, cx = 50, cy = 50) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const r = radiusAt(i, angle);
    points.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(" ");
}

const STARBURST = polarPoints(32, (i) => (i % 2 ? 37 : 47));
const SCALLOP = polarPoints(144, (i, angle) => 42 + 5 * Math.cos(angle * 12));
const SPARKLE = "M50 3 C54 38 62 46 97 50 C62 54 54 62 50 97 C46 62 38 54 3 50 C38 46 46 38 50 3 Z";
const ZIGZAG = "8,34 24,12 40,34 56,12 72,34 88,12 104,34";

const GEOMETRY = {
  starburst: { viewBox: "0 0 106 106", draw: () => <polygon points={STARBURST} /> },
  scallop: { viewBox: "0 0 106 106", draw: () => <polygon points={SCALLOP} /> },
  sparkle: { viewBox: "0 0 106 106", draw: () => <path d={SPARKLE} /> },
  zigzag: { viewBox: "0 0 116 48", draw: () => <polyline points={ZIGZAG} /> },
};

export default function Shape({ kind, className = "", children }) {
  const { viewBox, draw } = GEOMETRY[kind];
  return (
    <span className={`brutal-shape brutal-shape--${kind}${className ? ` ${className}` : ""}`} aria-hidden="true">
      <svg viewBox={viewBox} focusable="false">
        <g className="brutal-shape__shadow" transform="translate(5 5)">{draw()}</g>
        {kind === "zigzag" && <g className="brutal-shape__outline">{draw()}</g>}
        <g className="brutal-shape__face">{draw()}</g>
      </svg>
      {children && <span className="brutal-shape__label">{children}</span>}
    </span>
  );
}
