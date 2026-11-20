// "Fountain of ideas": golden fireflies burst out of the bodhi tree's canopy, rise,
// arc over and fall in curves across the whole hero, plus soft twinkling fireflies
// scattered over the screen. Pure CSS (server component), decorative.
//
// Each fountain firefly = outer span (horizontal motion, linear) + inner span
// (vertical motion: ease-out up, ease-in down) → a smooth parabolic arc.
// Distances use container query units (cqw / cqh) of this layer, so the fountain
// scales with the hero on every screen size. Hidden under prefers-reduced-motion.

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPEED = 1.1; // same 10%-faster timing as the tree

type Burst = { dx: number; up: number; down: number; dur: number; delay: number; size: number; startX: number; startY: number };
type Twinkle = { x: number; y: number; size: number; dur: number; delay: number; drift: number };

const BURSTS: Burst[] = (() => {
  const r = rng(2025);
  return Array.from({ length: 70 }, (_, i) => {
    const side = i % 2 === 0 ? 1 : -1;                 // alternate left / right
    return {
      dx: side * (6 + r() * 50),                        // horizontal travel, % of width (cqw): reaches the edges
      up: -(6 + r() * 24),                              // rise above the canopy, % of height (cqh)
      down: 28 + r() * 44,                              // where it lands below the start, % of height (down to the bottom)
      dur: (5.5 + r() * 3.5) / SPEED,
      delay: (2.4 + r() * 9) / SPEED,                  // start once the tree has grown
      size: 5 + r() * 4,
      startX: (r() * 2 - 1) * 12,                       // spread over the canopy, cqw
      startY: (r() * 2 - 1) * 5,                        // cqh
    };
  });
})();

// Ambient twinkles: 45 placed on a jittered 9×5 grid so every part of the hero
// (edges and bottom included) always has a few glowing fireflies.
const TWINKLES: Twinkle[] = (() => {
  const r = rng(808);
  const out: Twinkle[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 9; col++) {
      out.push({
        x: (col + 0.15 + r() * 0.7) * (100 / 9),
        y: 4 + (row + 0.15 + r() * 0.7) * (88 / 5),
        size: 3.5 + r() * 3,
        dur: (3 + r() * 3) / SPEED,
        delay: (r() * 6) / SPEED,
        drift: (r() * 2 - 1) * 2.5,
      });
    }
  }
  return out;
})();

export default function FireflyField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden [container-type:size]" aria-hidden="true">
      {/* Fountain: origin at the canopy centre (≈34% from the top of the hero) */}
      {BURSTS.map((b, i) => (
        <span key={`b${i}`} className="ff-x absolute"
          style={{
            left: `calc(50% + ${b.startX.toFixed(1)}cqw)`, top: `calc(34% + ${b.startY.toFixed(1)}cqh)`,
            ["--dx" as string]: `${b.dx.toFixed(1)}cqw`,
            animationDuration: `${b.dur.toFixed(2)}s`, animationDelay: `${b.delay.toFixed(2)}s`,
          }}>
          <span className="ff-y block"
            style={{
              ["--up" as string]: `${b.up.toFixed(1)}cqh`, ["--down" as string]: `${b.down.toFixed(1)}cqh`,
              animationDuration: `${b.dur.toFixed(2)}s`, animationDelay: `${b.delay.toFixed(2)}s`,
            }}>
            <span className="ff-dot block rounded-full" style={{ width: b.size, height: b.size, animationDuration: `${b.dur.toFixed(2)}s`, animationDelay: `${b.delay.toFixed(2)}s` }} />
          </span>
        </span>
      ))}

      {/* Ambient twinkles over the whole hero */}
      {TWINKLES.map((t, i) => (
        <span key={`t${i}`} className="ff-twinkle absolute rounded-full"
          style={{
            left: `${t.x.toFixed(1)}%`, top: `${t.y.toFixed(1)}%`, width: t.size, height: t.size,
            ["--drift" as string]: `${t.drift.toFixed(1)}cqw`,
            animationDuration: `${t.dur.toFixed(2)}s`, animationDelay: `${t.delay.toFixed(2)}s`,
          }} />
      ))}
    </div>
  );
}
