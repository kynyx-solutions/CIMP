// Animated "startup growth journey" for the homepage hero.
// Pure SVG + CSS (no client JS). Decorative: the hero copy carries the message,
// so the whole visual is aria-hidden. Honors prefers-reduced-motion (see globals.css).
import { STATS, IS_SAMPLE } from "@/content/site";

// Milestones sit exactly on the curve's segment endpoints (viewBox 0 0 400 240).
const MILESTONES = [
  { x: 20, y: 215, label: "Idea", dx: 6, dy: -12 },
  { x: 110, y: 180, label: "Prototype", dx: -20, dy: -14 },
  { x: 200, y: 130, label: "MVP", dx: -10, dy: -14 },
  { x: 290, y: 75, label: "Revenue", dx: -24, dy: -14 },
  { x: 380, y: 25, label: "Scale", dx: -34, dy: 22 },
];
const CURVE = "M20,215 C50,205 80,192 110,180 C140,168 170,150 200,130 C230,110 260,92 290,75 C320,58 350,40 380,25";

const icon = (d: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const SUPPORT = [
  { label: "Mentorship", icon: icon("M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.2 5.8-2.1 6.3-6.3 2.1 2.1-6.3z"), pos: "left-0 top-0", delay: "1.2s", float: "0s" },
  { label: "Seed funding", icon: icon("M6 4h12M6 9h12M6 4h3a5 5 0 0 1 0 10H6l8 6"), pos: "right-0 top-[56%]", delay: "1.6s", float: "1.5s" },
  { label: "Labs & workspace", icon: icon("M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"), pos: "left-0 top-[34%] hidden sm:flex", delay: "2s", float: "0.8s" },
  { label: "Investor network", icon: icon("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"), pos: "right-2 bottom-0", delay: "2.4s", float: "2.2s" },
  { label: "Govt schemes", icon: icon("M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M2 10l10-7 10 7z"), pos: "left-4 bottom-0 hidden sm:flex", delay: "2.8s", float: "3s" },
];

export default function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] py-12 px-2 sm:px-10" aria-hidden="true">
      {/* Soft glow behind the card */}
      <div className="absolute inset-8 rounded-[2rem] bg-blue-400/20 blur-3xl" />

      <div className="relative bg-white/95 backdrop-blur border border-border rounded-3xl shadow-card-lg p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-muted font-semibold">Startup growth journey</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
            <span className="relative flex w-1.5 h-1.5">
              <span className="hero-ping absolute inline-flex w-full h-full rounded-full bg-green-500" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-green-500" />
            </span>
            End-to-end support
          </span>
        </div>

        <svg viewBox="0 0 400 240" className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[60, 120, 180].map((y) => (
            <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="#D1DDF0" strokeDasharray="3 5" />
          ))}

          {/* Area + curve */}
          <path className="hero-area" d={`${CURVE} L380,240 L20,240 Z`} fill="url(#heroArea)" />
          <path className="hero-draw" d={CURVE} pathLength={1} fill="none" stroke="url(#heroLine)" strokeWidth="4" strokeLinecap="round" />

          {/* Milestones pop in one by one */}
          {MILESTONES.map((m, i) => (
            <g key={m.label} className="hero-ms" style={{ animationDelay: `${0.5 + i * 0.4}s` }}>
              {i === MILESTONES.length - 1 && <circle className="hero-pulse" cx={m.x} cy={m.y} r="9" fill="#1D4ED8" />}
              <circle cx={m.x} cy={m.y} r="7" fill="#fff" stroke="#1D4ED8" strokeWidth="3" />
              <text x={m.x + m.dx} y={m.y + m.dy} fontSize="11" fontWeight="600" fill="#0F2144" fontFamily="Plus Jakarta Sans, sans-serif">
                {m.label}
              </text>
            </g>
          ))}

          {/* Glowing marker travelling along the curve */}
          <g className="hero-mover">
            <circle r="11" fill="#3B82F6" opacity="0.2" />
            <circle r="5" fill="#1D4ED8" />
            <animateMotion dur="6s" repeatCount="indefinite" path={CURVE} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
          </g>
        </svg>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {STATS.items.slice(0, 3).map((s, i) => (
            <div key={s.label} className="hero-ms rounded-xl bg-bg border border-border px-2 py-2 text-center" style={{ animationDelay: `${2.4 + i * 0.2}s` }}>
              <p className="font-display text-lg font-bold text-navy leading-none">{s.value}</p>
              <p className="text-[10px] font-mono text-muted mt-1 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
        {IS_SAMPLE && <p className="text-[10px] font-mono text-amber-700 mt-2 text-right">Sample figures</p>}
      </div>

      {/* Floating support chips */}
      {SUPPORT.map((s) => (
        <div key={s.label} className={`hero-chip-in absolute ${s.pos} flex`} style={{ animationDelay: s.delay }}>
          <div className="hero-float flex items-center gap-2 bg-white border border-border rounded-xl shadow-card-md px-3 py-2 text-xs font-body font-semibold text-navy whitespace-nowrap" style={{ animationDelay: s.float }}>
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-brand flex items-center justify-center">{s.icon}</span>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
