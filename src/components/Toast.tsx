"use client";
// Short confirmation or error message in the top-right corner, shared by the work pages.
import { useCallback, useEffect, useRef, useState } from "react";

export type ToastMsg = { text: string; ok: boolean } | null;

/** `flash("Saved")` shows a message for `ms` milliseconds; `flash("Failed", false)` shows an error. */
export function useFlash(ms = 5000) {
  const [msg, setMsg] = useState<ToastMsg>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const flash = useCallback((text: string, ok = true) => {
    setMsg({ text, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  }, [ms]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { msg, flash, setMsg };
}

export default function Toast({ msg }: { msg: ToastMsg }) {
  if (!msg) return null;
  return (
    <div role="status" className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>
      {msg.text}
    </div>
  );
}
