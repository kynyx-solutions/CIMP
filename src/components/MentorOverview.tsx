"use client";
// Mentor hub: what needs the mentor's attention across all startups (PRD MEN-4, INV-1).
import { useEffect, useState } from "react";
import Link from "next/link";

type Data = {
  sessions: { id: string; connectionId: string; startup: string; scheduledAt: string; mode: string; overdue: boolean }[];
  uploads: { id: string; connectionId: string; startup: string; title: string }[];
  toRate: { id: string; connectionId: string; startup: string; scheduledAt: string }[];
  pitches: { id: string; startup: string; pitchAt: string }[];
};
const when = (d: string) => new Date(d).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function MentorOverview() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { fetch("/api/mentorship/overview").then((r) => (r.ok ? r.json() : null)).then(setD); }, []);
  if (!d || (!d.sessions.length && !d.uploads.length && !d.toRate.length && !d.pitches.length)) return null;
  return (
    <section aria-label="Needs your attention" className="mt-6 grid md:grid-cols-2 gap-4">
      {d.sessions.length > 0 && (
        <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
          <h2 className="font-body font-bold text-navy text-sm">Your sessions</h2>
          <ul className="mt-2 divide-y divide-border">
            {d.sessions.map((s) => (
              <li key={s.id} className="py-2 flex items-center gap-2 text-sm font-body">
                <span className={`font-semibold ${s.overdue ? "text-amber-800" : "text-navy"}`}>{when(s.scheduledAt)}</span>
                <span className="text-secondary truncate">{s.startup} · {s.mode === "virtual" ? "Video" : "In person"}</span>
                <Link href={`/mentorship/${s.connectionId}`} className="ml-auto text-brand font-semibold hover:underline whitespace-nowrap">{s.overdue ? "Mark done" : "Open"}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(d.uploads.length > 0 || d.toRate.length > 0 || d.pitches.length > 0) && (
        <div className="bg-white border border-amber-300 rounded-2xl p-5 shadow-card">
          <h2 className="font-body font-bold text-navy text-sm">Needs your attention</h2>
          <ul className="mt-2 space-y-2 text-sm font-body">
            {d.uploads.map((u) => <li key={u.id}>📎 <strong className="text-navy">{u.startup}</strong> uploaded &quot;{u.title}&quot; · <Link href={`/mentorship/${u.connectionId}`} className="text-brand font-semibold hover:underline">Review</Link></li>)}
            {d.toRate.map((s) => <li key={s.id}>★ Rate your session with <strong className="text-navy">{s.startup}</strong> ({when(s.scheduledAt)}) · <Link href={`/mentorship/${s.connectionId}`} className="text-brand font-semibold hover:underline">Give feedback</Link></li>)}
            {d.pitches.map((p) => <li key={p.id}>🎯 <strong className="text-navy">{p.startup}</strong> pitches to you on {when(p.pitchAt)} · <Link href="/invest" className="text-brand font-semibold hover:underline">Details</Link></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
