"use client";
// Light, interactive particle network for the homepage hero ("ecosystem" of
// founders, mentors and partners). Canvas-based, decorative (aria-hidden).
// - Fewer particles on small screens; pauses when off-screen or tab hidden
// - Draws a single static frame under prefers-reduced-motion
import { useEffect, useRef } from "react";

// Brand blues/teal with a little saffron, so it reads as ours, not a template.
const COLORS = ["29,78,216", "14,165,233", "8,145,178", "99,102,241", "245,158,11"];
const LINK_DIST = 130;
const MOUSE_DIST = 170;

type P = { x: number; y: number; vx: number; vy: number; r: number; c: string };

export default function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: -9999, y: -9999 };
    let particles: P[] = [];
    let w = 0, h = 0, raf = 0, visible = true;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(150, Math.max(36, Math.round((w * h) / 8000)));
      particles = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.2 + Math.random() * 2,
        // ~1 in 9 particles saffron, rest blues/teal
        c: i % 9 === 0 ? COLORS[4] : COLORS[i % 4],
      }));
    }

    function frame() {
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        if (!reduced) {
          // gentle push away from the cursor
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 90 * 90 && d2 > 0) { const f = 0.6 / Math.sqrt(d2); p.x += dx * f; p.y += dy * f; }
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
      }
      // links between nearby particles
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            ctx!.strokeStyle = `rgba(${a.c},${0.36 * (1 - d / LINK_DIST)})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(b.x, b.y); ctx!.stroke();
          }
        }
        // links to the cursor
        const mx = a.x - mouse.x, my = a.y - mouse.y;
        const md = Math.sqrt(mx * mx + my * my);
        if (md < MOUSE_DIST) {
          ctx!.strokeStyle = `rgba(${a.c},${0.5 * (1 - md / MOUSE_DIST)})`;
          ctx!.lineWidth = 1.2;
          ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(mouse.x, mouse.y); ctx!.stroke();
        }
      }
      for (const p of particles) {
        ctx!.fillStyle = `rgba(${p.c},0.85)`;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx!.fill();
      }
      if (!reduced && visible) raf = requestAnimationFrame(frame);
    }

    function start() { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }

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

    // Pause when the hero is off-screen or the tab is hidden
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
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />;
}
