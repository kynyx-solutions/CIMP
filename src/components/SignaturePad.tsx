"use client";
// Drawn signature (mouse, touch or pen). Calls onChange with a PNG data URL, or "" when cleared.
import { useEffect, useRef, useState } from "react";

const W = 480, H = 150;

export default function SignaturePad({ onChange, label = "Sign here" }: { onChange: (dataUrl: string) => void; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!, ctx = c.getContext("2d")!;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * ratio; c.height = H * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1C3510";
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  function down(e: React.PointerEvent) {
    e.preventDefault();
    ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true; last.current = point(e);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    const p = point(e), ctx = ref.current!.getContext("2d")!;
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false; last.current = null;
    if (!empty) onChange(ref.current!.toDataURL("image/png"));
  }
  function clear() {
    const c = ref.current!, ctx = c.getContext("2d")!;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.restore();
    setEmpty(true); onChange("");
  }

  return (
    <div>
      <div className="relative border-2 border-dashed border-border rounded-xl bg-white">
        <canvas ref={ref} role="img" aria-label={empty ? `${label}: empty` : `${label}: signed`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
          className="w-full h-[120px] touch-none cursor-crosshair rounded-xl" style={{ aspectRatio: `${W} / ${H}` }} />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-faint font-body">{label}</span>}
        <span className="pointer-events-none absolute left-4 right-4 bottom-6 border-b border-slate-300" aria-hidden="true" />
      </div>
      <button type="button" onClick={clear} disabled={empty} className="mt-1 text-xs font-body text-muted hover:text-navy disabled:opacity-40">Clear</button>
    </div>
  );
}
