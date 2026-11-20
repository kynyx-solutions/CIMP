"use client";
// "Incubation hive" hero background: a light honeycomb grid where cells
// "hatch" (fill with colour, then fade), a slow light wave sweeps across, and
// cells near the cursor light up. Canvas-based, decorative (aria-hidden).
// - Pauses when off-screen or the tab is hidden
// - Static frame (a few lit cells) under prefers-reduced-motion
import { useEffect, useRef } from "react";

// Logo palette: bodhi greens + saffron accent (last entry)
const PALETTE = ["63,122,22", "111,174,46", "140,198,63", "78,138,31", "232,115,26"];

type Cell = { x: number; y: number; a: number; target: number; c: string };

export default function HexHive({ focus = "centre" }: {
  /** where the text sits; cells there are dimmed for readability */
  focus?: "centre" | "left";
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: -9999, y: -9999 };
    let cells: Cell[] = [];
    let w = 0, h = 0, R = 30, raf = 0, visible = true, last = 0, hatchTimer = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = w < 640 ? 22 : 30; // hexagon radius (pointy-top)
      const hw = Math.sqrt(3) * R, vh = 1.5 * R;
      cells = [];
      for (let row = -1, y = 0; y < h + R * 2; row++, y = row * vh) {
        for (let x = (row % 2 ? hw / 2 : 0) - hw; x < w + hw; x += hw) {
          cells.push({ x, y, a: 0, target: 0, c: PALETTE[Math.floor(Math.random() * 4)] });
        }
      }
      if (reduced) {
        // a few lit cells for the static frame
        for (let i = 0; i < cells.length; i += 11) { cells[i].a = 0.6; cells[i].target = 0.6; }
      }
    }

    function hexPath(x: number, y: number, r: number) {
      ctx!.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(ang), py = y + r * Math.sin(ang);
        if (i === 0) ctx!.moveTo(px, py); else ctx!.lineTo(px, py);
      }
      ctx!.closePath();
    }

    // Dim cells behind the centred headline so the text stays readable
    function centreFade(x: number, y: number) {
      const cx = focus === "left" ? w * 0.22 : w / 2;
      const dx = (x - cx) / (w * 0.32), dy = (y - h * 0.45) / (h * 0.38);
      const d = Math.sqrt(dx * dx + dy * dy);
      return Math.min(1, Math.max(0.15, d));
    }

    function frame(t: number) {
      const dt = Math.min(64, t - (last || t));
      last = t;

      if (!reduced) {
        // hatch a few random cells every ~300ms
        hatchTimer += dt;
        if (hatchTimer > 300) {
          hatchTimer = 0;
          for (let k = 0; k < 3; k++) {
            const cell = cells[Math.floor(Math.random() * cells.length)];
            cell.target = 1;
            cell.c = Math.random() < 0.15 ? PALETTE[4] : PALETTE[Math.floor(Math.random() * 4)];
          }
        }
        for (const cell of cells) {
          // cursor proximity lights cells up
          const md = Math.hypot(cell.x - mouse.x, cell.y - mouse.y);
          if (md < 110) cell.target = Math.max(cell.target, 0.9 * (1 - md / 110));
          // frame-rate independent easing (same speed on 60 Hz and 120 Hz screens)
          cell.a += (cell.target - cell.a) * (1 - Math.pow(0.94, dt / 16.7));
          cell.target *= Math.pow(0.99, dt / 16.7); // slow fade-out after hatching
        }
      }

      ctx!.clearRect(0, 0, w, h);
      const wavePhase = t / 2600;
      for (const cell of cells) {
        const fade = centreFade(cell.x, cell.y);
        // diagonal light wave sweeping across the hive
        const wave = reduced ? 0 : Math.max(0, Math.cos((cell.x + cell.y * 0.6) / 260 - wavePhase)) ** 6;

        hexPath(cell.x, cell.y, R - 2);
        if (cell.a > 0.02) {
          ctx!.fillStyle = `rgba(${cell.c},${0.4 * cell.a * fade})`;
          ctx!.fill();
        }
        ctx!.strokeStyle = `rgba(63,122,22,${(0.07 + 0.22 * wave + 0.5 * cell.a) * fade})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();

        // a small "seed" dot in strongly lit cells
        if (cell.a > 0.4) {
          ctx!.fillStyle = `rgba(${cell.c},${0.8 * cell.a * fade})`;
          ctx!.beginPath(); ctx!.arc(cell.x, cell.y, 2.2, 0, Math.PI * 2); ctx!.fill();
        }
      }
      if (!reduced && visible) raf = requestAnimationFrame(frame);
    }

    function start() { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(frame); }

    resize();
    start();

    const section = canvas.parentElement!;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(() => { resize(); if (reduced) start(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible && !reduced) start();
    });
    io.observe(canvas);
    const onVis = () => { visible = !document.hidden; if (visible && !reduced) start(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [focus]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />;
}
