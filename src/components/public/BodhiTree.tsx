// Animated bodhi tree inspired by the CIMP-BIIF logo, with roots.
// The motto "सर्व सिद्धि मूलम् उद्यमिता" says entrepreneurship is the ROOT of all
// accomplishment, so light flows like nourishment: from the root tips into the
// trunk, up the trunk, out along the branches, and the canopy glows. Golden
// fireflies (ideas) burst out across the hero: see FireflyField.tsx.
//
// Sequence: trunk grows, roots and branches draw out, leaves sprout from the
// centre; then a 4.5 s nourishment cycle repeats. The canopy sways gently and some
// leaves flutter; the dashed ring turns slowly.
// Pure SVG + CSS (server component), decorative. Static under reduced motion.

const GREENS = ["#8CC63F", "#6FAE2E", "#4E8A1F", "#A6D45A", "#3F7A16"];

// Deterministic pseudo-random numbers so server and client render the same tree.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Peepal (heart-shaped) leaf with a long drip tip, base at the origin, pointing up.
const LEAF = "M0,0 C-7,-3 -9,-11 -5,-16 C-3,-19 -1,-20 0,-25 C1,-20 3,-19 5,-16 C9,-11 7,-3 0,0 Z";

const TRUNK_TOP = { x: 200, y: 236 };
const TRUNK_LINE = "M200,372 L200,238";

const BRANCHES = [
  "M188,240 C170,215 140,200 100,190",
  "M192,238 C175,200 160,165 135,125",
  "M200,236 C198,195 202,150 200,95",
  "M208,238 C225,200 240,165 265,125",
  "M212,240 C230,215 260,200 300,190",
  // drooping side branches, as in the logo
  "M104,190 C80,200 70,232 72,272",
  "M296,190 C320,200 330,232 328,272",
  "M140,202 C120,218 112,246 115,282",
  "M260,202 C280,218 288,246 285,282",
];

// Roots, drawn from the trunk base outwards (7 main roots, then side roots).
const ROOTS: { d: string; w: number }[] = [
  { d: "M196,372 C180,392 150,402 110,410 C80,416 55,428 30,446", w: 5 },
  { d: "M204,372 C220,392 250,402 290,410 C320,416 345,428 370,446", w: 5 },
  { d: "M192,374 C176,404 150,428 118,452 C100,466 88,480 80,496", w: 4.5 },
  { d: "M208,374 C224,404 250,428 282,452 C300,466 312,480 320,496", w: 4.5 },
  { d: "M198,376 C192,410 182,440 170,470 C165,482 162,490 160,500", w: 4 },
  { d: "M202,376 C208,410 218,440 230,470 C235,482 238,490 240,500", w: 4 },
  { d: "M200,378 C200,420 201,460 200,500", w: 4 },
  { d: "M110,410 C100,425 98,440 102,458", w: 2.5 },
  { d: "M290,410 C300,425 302,440 298,458", w: 2.5 },
  { d: "M118,452 C135,462 145,476 150,494", w: 2.5 },
  { d: "M282,452 C265,462 255,476 250,494", w: 2.5 },
  { d: "M55,428 C48,440 45,452 46,466", w: 2 },
  { d: "M345,428 C352,440 355,452 354,466", w: 2 },
];

// All animation timings are divided by SPEED (1.1 = 10% faster than the first version).
const SPEED = 1.1;
const sec = (s: number) => `${(s / SPEED).toFixed(2)}s`;

type Leaf = { x: number; y: number; rot: number; scale: number; color: string; delay: number; flutter: boolean };

function buildLeaves(): Leaf[] {
  const r = rng(2017);
  const leaves: Leaf[] = [];
  // Canopy: points inside an ellipse above the trunk
  while (leaves.length < 165) {
    const x = 200 + (r() * 2 - 1) * 150;
    const y = 160 + (r() * 2 - 1) * 100;
    const inside = ((x - 200) / 150) ** 2 + ((y - 160) / 100) ** 2 <= 1;
    if (!inside || y > 245) continue;
    const dist = Math.hypot(x - TRUNK_TOP.x, y - TRUNK_TOP.y);
    leaves.push({
      x, y,
      rot: (r() * 2 - 1) * 70 + (x < 200 ? -15 : 15),
      scale: 0.65 + r() * 0.5,
      color: GREENS[Math.floor(r() * GREENS.length)],
      delay: 1.3 + (dist / 190) * 1.4 + r() * 0.3,
      flutter: leaves.length % 3 === 0,
    });
  }
  // Hanging leaves along the drooping branches
  const droops = [[104, 190, 72, 272], [296, 190, 328, 272], [140, 202, 115, 282], [260, 202, 285, 282]];
  for (const [x1, y1, x2, y2] of droops) {
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      leaves.push({
        x: x1 + (x2 - x1) * t + (r() * 2 - 1) * 6,
        y: y1 + (y2 - y1) * t + (r() * 2 - 1) * 4,
        rot: 180 + (r() * 2 - 1) * 25,
        scale: 0.5 + r() * 0.35,
        color: GREENS[Math.floor(r() * GREENS.length)],
        delay: 2.2 + t * 1.2 + r() * 0.2,
        flutter: i % 2 === 0,
      });
    }
  }
  return leaves;
}

const LEAVES = buildLeaves();

export default function BodhiTree({
  className = "w-full h-auto max-w-[520px] mx-auto",
  treeOpacity = 1,
}: {
  className?: string;
  /** fade the tree itself (e.g. as a background) while keeping the light and fireflies bright */
  treeOpacity?: number;
} = {}) {
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet" className={`${className} overflow-visible`} aria-hidden="true">
      <defs>
        <linearGradient id="bodhiTrunk" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3F7A16" />
          <stop offset="100%" stopColor="#6FAE2E" />
        </linearGradient>
        <radialGradient id="bodhiGlow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#C8E2A6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#C8E2A6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="canopyGold" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F6C453" stopOpacity="0.75" />
          <stop offset="60%" stopColor="#F2A93B" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#F2A93B" stopOpacity="0" />
        </radialGradient>
        {/* soft glow around the travelling light and fireflies */}
        <filter id="pulseGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── The tree itself (can be faded) ── */}
      <g opacity={treeOpacity}>
        <circle cx="200" cy="205" r="200" fill="url(#bodhiGlow)" />

        {/* Ring from the logo: dashed, slowly turning, with a solid lower arc */}
        <circle className="tree-ring" cx="200" cy="205" r="188" fill="none" stroke="#6FAE2E" strokeWidth="6" strokeDasharray="16 11" strokeLinecap="round" />
        <path d="M38,300 A188,188 0 0 0 362,300" fill="none" stroke="#4E8A1F" strokeWidth="7" strokeLinecap="round" />

        {/* Roots spread out from the trunk base */}
        {ROOTS.map((r, i) => (
          <path key={i} className="tree-branch" d={r.d} pathLength={1} fill="none" stroke="#4E8A1F"
            strokeWidth={r.w} strokeLinecap="round" style={{ animationDelay: sec(0.5 + (i < 7 ? i * 0.08 : 0.7 + (i - 7) * 0.08)) }} />
        ))}

        {/* Trunk grows up from the roots */}
        <g className="tree-trunk">
          <path d="M168,374 C182,362 186,332 186,302 C186,272 182,252 176,236 L224,236 C218,252 214,272 214,302 C214,332 218,362 232,374 Z" fill="url(#bodhiTrunk)" />
        </g>

        {/* Canopy (branches + leaves) sways gently around the trunk top */}
        <g className="tree-sway">
          {BRANCHES.map((d, i) => (
            <path key={i} className="tree-branch" d={d} pathLength={1} fill="none" stroke="#4E8A1F"
              strokeWidth={i < 5 ? 5 : 3} strokeLinecap="round" style={{ animationDelay: sec(0.9 + (i % 5) * 0.12 + (i >= 5 ? 0.5 : 0)) }} />
          ))}
          {LEAVES.map((l, i) => (
            <g key={i} transform={`translate(${l.x.toFixed(1)},${l.y.toFixed(1)}) rotate(${l.rot.toFixed(0)}) scale(${l.scale.toFixed(2)})`}>
              <path className={l.flutter ? "tree-leaf tree-flutter" : "tree-leaf"} d={LEAF} fill={l.color}
                style={{ animationDelay: l.flutter ? `${sec(l.delay)}, ${sec(l.delay + 0.6)}` : sec(l.delay) }} />
            </g>
          ))}
        </g>
      </g>

      {/* ── Nourishment: light flows roots → trunk → branches → canopy (full brightness) ── */}
      <g filter="url(#pulseGlow)" strokeLinecap="round" fill="none">
        {ROOTS.map((r, i) => (
          <path key={i} className="root-pulse" d={r.d} pathLength={1}
            stroke="#F2A93B" strokeWidth={Math.max(2, r.w - 1.5)} />
        ))}
        <path className="trunk-pulse" d={TRUNK_LINE} pathLength={1} stroke="#F6C453" strokeWidth="5" />
        <g className="tree-sway">
          {BRANCHES.map((d, i) => (
            <path key={i} className="branch-pulse" d={d} pathLength={1}
              stroke="#F6C453" strokeWidth={i < 5 ? 3.5 : 2.5} />
          ))}
          <ellipse className="canopy-glow" cx="200" cy="165" rx="150" ry="105" fill="url(#canopyGold)" stroke="none" />
        </g>

      </g>
    </svg>
  );
}
