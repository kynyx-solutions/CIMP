// Animated hero background: drifting colour fields, a circuit-style grid with
// travelling signal pulses, and sparks rising (growth). Pure CSS, decorative.
// Grid cell = 48px; pulses are placed on grid lines so they ride along them.

const CELL = 48;

// [grid line index, duration s, delay s]
const H_PULSES: [number, number, number][] = [[2, 7, 0], [5, 9, 2.5], [8, 6.5, 4], [11, 10, 1.2]];
const V_PULSES: [number, number, number][] = [[4, 8, 1], [11, 6, 3.5], [18, 9.5, 0.4], [25, 7.5, 5], [30, 8.5, 2]];

// [left %, size px, duration s, delay s]
const SPARKS: [number, number, number, number][] = [
  [6, 4, 9, 0], [14, 3, 11, 3], [23, 5, 10, 6], [35, 3, 12, 1.5], [47, 4, 9.5, 4.5],
  [58, 3, 11.5, 0.8], [66, 5, 10.5, 5.5], [74, 3, 9, 2.2], [83, 4, 12, 7], [92, 3, 10, 3.8],
];

export default function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* 1. Drifting colour fields */}
      <div className="hero-blob absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-blue-300/40 blur-3xl" />
      <div className="hero-blob absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full bg-cyan-200/50 blur-3xl" style={{ animationDelay: "-7s", animationDuration: "26s" }} />
      <div className="hero-blob absolute -bottom-40 left-1/3 w-[26rem] h-[26rem] rounded-full bg-indigo-200/50 blur-3xl" style={{ animationDelay: "-14s", animationDuration: "30s" }} />

      {/* 2. Grid + signal pulses, faded towards the edges */}
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_75%_70%_at_50%_45%,black_35%,transparent_100%)]">
        <div className="hero-grid absolute inset-0" />
        {H_PULSES.map(([row, dur, delay]) => (
          <span key={`h${row}`} className="hero-pulse-h absolute left-0 h-px w-32 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            style={{ top: row * CELL, animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />
        ))}
        {V_PULSES.map(([col, dur, delay]) => (
          <span key={`v${col}`} className="hero-pulse-v absolute top-0 w-px h-32 bg-gradient-to-b from-transparent via-cyan-500 to-transparent"
            style={{ left: col * CELL, animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />
        ))}
        {/* Junction glows where signals cross */}
        {[[4, 2], [11, 5], [18, 8], [25, 5], [30, 11]].map(([c, r], i) => (
          <span key={i} className="hero-node absolute w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-blue-500"
            style={{ left: c * CELL, top: r * CELL, animationDelay: `${i * 0.9}s` }} />
        ))}
      </div>

      {/* Soft fade into the page background so the hero has no hard bottom edge */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />

      {/* 3. Rising sparks */}
      {SPARKS.map(([left, size, dur, delay], i) => (
        <span key={i} className="hero-spark absolute bottom-0 rounded-full bg-gradient-to-t from-blue-500 to-cyan-300"
          style={{ left: `${left}%`, width: size, height: size, animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />
      ))}
    </div>
  );
}
