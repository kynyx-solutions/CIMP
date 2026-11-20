// "Launchpad" hero background (dark): neon aurora, a 3D runway grid moving
// toward the viewer, light streaks launching from the horizon, and twinkling
// stars. Pure CSS, decorative; static under prefers-reduced-motion.

// [left %, delay s, duration s, height px]. Kept clear of the headline column for readability.
const STREAKS: [number, number, number, number][] = [
  [2, 0, 3.2, 140], [48, 1.6, 2.6, 110], [52.5, 0.7, 3.6, 170], [58, 2.4, 2.9, 120],
  [66, 0.3, 3.4, 160], [76, 1.9, 2.7, 130], [86, 1.1, 3.8, 180], [97, 2.8, 3.1, 120],
];

// Deterministic star field: [left %, top %, size px, delay s]
const STARS: [number, number, number, number][] = Array.from({ length: 34 }, (_, i) => [
  (i * 37) % 100, (i * 53) % 48, 1 + (i % 3), (i * 0.37) % 4,
]);

export default function HeroBackground({ compact = false }: { compact?: boolean }) {
  // Compact (page banners): streaks only on the right, away from the left-aligned title.
  const streaks = compact ? STREAKS.filter(([left]) => left >= 60) : STREAKS;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[radial-gradient(ellipse_at_top,#1e3a8a_0%,#0f2144_45%,#081127_100%)]" aria-hidden="true">
      {/* 1. Neon aurora */}
      <div className="hero-aurora absolute -top-40 left-[5%] w-[38rem] h-[24rem] rounded-full bg-blue-500/50 blur-[90px]" />
      <div className="hero-aurora absolute -top-24 left-[40%] w-[34rem] h-[22rem] rounded-full bg-cyan-400/40 blur-[90px]" style={{ animationDelay: "-5s", animationDuration: "14s" }} />
      <div className="hero-aurora absolute -top-32 right-[-5%] w-[30rem] h-[22rem] rounded-full bg-violet-500/45 blur-[90px]" style={{ animationDelay: "-9s", animationDuration: "18s" }} />

      {/* 4. Twinkling stars (upper half) */}
      {STARS.map(([left, top, size, delay], i) => (
        <span key={i} className="hero-star absolute rounded-full bg-white"
          style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${delay}s` }} />
      ))}

      {/* 2. 3D runway grid moving toward the viewer */}
      <div className="absolute inset-x-0 bottom-0 h-[52%] overflow-hidden [perspective:320px] [perspective-origin:50%_0%] [mask-image:linear-gradient(to_top,black_40%,transparent_100%)]">
        <div className="hero-floor absolute left-[-50%] right-[-50%] bottom-0 h-[220%] origin-bottom" />
      </div>
      {/* Horizon glow */}
      <div className="absolute inset-x-0 bottom-[52%] h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
      <div className="absolute inset-x-[10%] bottom-[46%] h-24 bg-cyan-400/20 blur-3xl" />

      {/* 3. Launch streaks rising from the horizon */}
      {streaks.map(([left, delay, dur, h], i) => (
        // On narrow screens the text spans the full width, so only edge streaks show there.
        <span key={i} className={`hero-streak absolute bottom-[52%] w-[2px] rounded-full bg-gradient-to-t from-transparent via-cyan-300 to-white ${left > 10 && left < 90 ? "hidden md:block" : ""}`}
          style={{ left: `${left}%`, height: h, animationDelay: `${delay}s`, animationDuration: `${dur}s` }}>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_12px_4px_rgba(103,232,249,0.9)]" />
        </span>
      ))}
    </div>
  );
}
