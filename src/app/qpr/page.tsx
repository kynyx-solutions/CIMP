"use client";
// Quarterly progress reports (PRD QPR-1): incubatees fill and submit; the office reviews.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import FieldInput, { toFieldValue, isFilled, type FieldValue } from "@/components/FieldInput";
import { displayValue, type FormDef, type AnswerValue } from "@/lib/forms";
import { isOfficeRole } from "@/lib/workflow";
import { dueDate, periodLabel, periodOf, previousPeriod, QPR_STATUS, QPR_TONE_CLS } from "@/lib/qpr";

type Report = { _id: string; period: string; answers: Record<string, AnswerValue>; status: string; submittedAt?: string; reviewNote?: string | null; reviewedBy?: string | null };

const fmt = (d: Date | string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const Chip = ({ status }: { status: string }) => {
  const s = QPR_STATUS[status] ?? QPR_STATUS.missing;
  return <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${QPR_TONE_CLS[s.tone]}`}>{s.label}</span>;
};

export default function QprPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState<FormDef | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user || (d.user.role !== "incubatee" && !isOfficeRole(d.user.role))) { router.push("/dashboard"); return; }
      setUser(d.user);
    });
    fetch("/api/forms/qpr").then((r) => r.json()).then((d) => setForm(d.form ?? null));
  }, [router]);

  if (!user || !form) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">Progress reports</h1>
        {user.role === "incubatee" ? <Founder form={form} /> : <Office form={form} />}
      </div>
    </div>
  );
}

// ── Incubatee ────────────────────────────────────────────────────────────────
function Founder({ form }: { form: FormDef }) {
  const [data, setData] = useState<{ application: any; eligible: boolean; fileable: string[]; reports: Report[] } | null>(null);
  const [period, setPeriod] = useState(periodOf());
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/qpr").then((r) => r.json());
    setData(d);
  }, []);
  useEffect(() => { load(); }, [load]);

  const report = data?.reports.find((r) => r.period === period);
  useEffect(() => {
    setAnswers(Object.fromEntries(form.fields.map((f) => [f.key, toFieldValue(f, report?.answers?.[f.key])])));
  }, [report, form]);

  async function save(submit: boolean) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/qpr", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period, answers, submit }) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) { setMsg({ text: d.error, ok: false }); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setMsg({ text: submit ? "Submitted. The incubation team will review it." : "Draft saved.", ok: true });
    load();
  }

  if (!data) return <p className="mt-6 text-sm text-muted font-body">Loading…</p>;
  if (!data.eligible) return (
    <p className="mt-6 bg-white border border-border rounded-2xl p-8 text-center text-secondary font-body">
      Progress reports start once your incubation application is approved. <Link href="/dashboard" className="text-brand font-semibold underline">Check your application</Link>
    </p>
  );

  const locked = report && ["submitted", "accepted"].includes(report.status);
  const required = form.fields.filter((f) => f.required);
  const filled = required.filter((f) => isFilled(answers[f.key])).length;
  const sections = form.sections.map((s) => ({ ...s, fields: form.fields.filter((f) => f.section === s.title) })).filter((s) => s.fields.length);

  return (
    <div className="mt-2">
      <p className="text-secondary font-body text-sm">Every quarter, tell the incubation team how {data.application.startupName} is doing. Due within 15 days after each quarter ends.</p>
      <div className="mt-6 grid lg:grid-cols-[260px_1fr] gap-6 items-start">
        <aside className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
          <p className="px-4 py-3 text-[11px] font-mono text-muted uppercase tracking-wider border-b border-border">Quarters</p>
          {Array.from(new Set([...data.fileable, ...data.reports.map((r) => r.period)])).sort().reverse().map((p) => {
            const r = data.reports.find((x) => x.period === p);
            return (
              <button key={p} onClick={() => { setPeriod(p); setMsg(null); }} aria-current={p === period}
                className={`w-full text-left px-4 py-3 border-b border-border last:border-0 ${p === period ? "bg-leaf-50 border-l-2 border-l-brand" : "hover:bg-bg"}`}>
                <span className="block text-sm font-body font-semibold text-navy">{periodLabel(p)}</span>
                <span className="mt-1 inline-block"><Chip status={r?.status ?? "missing"} /></span>
              </button>
            );
          })}
        </aside>

        <section>
          {msg && <p role={msg.ok ? "status" : "alert"} className={`mb-4 text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="font-display text-xl font-bold text-navy">{periodLabel(period)}</h2>
            <Chip status={report?.status ?? "missing"} />
            <span className="text-xs font-mono text-muted">Due {fmt(dueDate(period))}</span>
            {report && report.status !== "draft" && <a href={`/api/qpr/${report._id}/pdf`} className="ml-auto text-sm font-body font-semibold text-brand hover:underline">⬇ PDF</a>}
          </div>
          {report?.status === "returned" && (
            <div role="status" className="mb-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm font-body text-orange-800">
              <strong>{report.reviewedBy} asked for changes:</strong> {report.reviewNote}
            </div>
          )}
          {report?.status === "accepted" && report.reviewNote && (
            <p className="mb-4 px-4 py-3 bg-leaf-50 border border-leaf-200 rounded-xl text-sm font-body text-leaf-800">Accepted by {report.reviewedBy}: {report.reviewNote}</p>
          )}
          {!data.fileable.includes(period) && !report && <p className="text-sm text-muted font-body">This quarter is closed for filing.</p>}
          <div className="space-y-5">
            {sections.map((s) => (
              <fieldset key={s.title} className="bg-white border border-border rounded-2xl p-6 shadow-card">
                <legend className="sr-only">{s.title}</legend>
                <h3 className="font-body font-bold text-navy">{s.title}</h3>
                {s.desc && <p className="text-xs text-muted font-body">{s.desc}</p>}
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  {s.fields.map((f) => (
                    <div key={f.key} className={f.type === "textarea" || f.type === "multiselect" ? "sm:col-span-2" : ""}>
                      <label id={`${f.key}-label`} htmlFor={f.key} className="block text-sm font-body font-medium text-navy mb-1.5">{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
                      <FieldInput f={f} value={answers[f.key]} disabled={!!locked || !data.fileable.includes(period)} onChange={(v) => setAnswers((p) => ({ ...p, [f.key]: v }))} />
                      {f.help && <p id={`${f.key}-help`} className="text-xs text-muted font-body mt-1">{f.help}</p>}
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {!locked && data.fileable.includes(period) && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button onClick={() => save(false)} disabled={busy} className="px-5 py-2.5 rounded-xl border border-border bg-white text-sm font-semibold font-body text-navy disabled:opacity-50">Save draft</button>
              <button onClick={() => save(true)} disabled={busy || filled < required.length} className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">
                {busy ? "Saving…" : report?.status === "returned" ? "Resubmit" : "Submit report"}
              </button>
              <span className="text-xs font-mono text-muted">{filled}/{required.length} required answered</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Office ───────────────────────────────────────────────────────────────────
type Row = { applicationId: string; startupName: string; applicantName: string; industry: string; report: Report | null };

function Office({ form }: { form: FormDef }) {
  const [period, setPeriod] = useState(previousPeriod(periodOf()));
  const [data, setData] = useState<{ rows: Row[]; canReview: boolean } | null>(null);
  const [open, setOpen] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async (p: string) => {
    const d = await fetch(`/api/qpr?period=${p}`).then((r) => r.json());
    setData(d);
  }, []);
  useEffect(() => { load(period); }, [period, load]);

  async function review(decision: "accept" | "return") {
    if (!open?.report) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/qpr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: open.report._id, decision, note }) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) { setMsg({ text: d.error, ok: false }); return; }
    setMsg({ text: decision === "accept" ? "Report accepted." : "Sent back to the startup.", ok: true });
    setOpen(null); setNote(""); load(period);
  }

  const periods = [periodOf(), previousPeriod(periodOf()), previousPeriod(previousPeriod(periodOf())), previousPeriod(previousPeriod(previousPeriod(periodOf())))];
  const counts = (data?.rows ?? []).reduce<Record<string, number>>((a, r) => { const s = r.report?.status ?? "missing"; a[s] = (a[s] ?? 0) + 1; return a; }, {});

  return (
    <div className="mt-2">
      <p className="text-secondary font-body text-sm">Quarterly reports from every incubated startup. Missing reports get automatic reminders near the quarter end.</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-body text-secondary">Quarter{" "}
          <select value={period} onChange={(e) => { setPeriod(e.target.value); setOpen(null); }} className="ml-2 bg-white border border-border rounded-lg px-3 py-2 text-sm font-body">
            {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </label>
        {Object.entries(QPR_STATUS).map(([k, s]) => counts[k] ? <span key={k} className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${QPR_TONE_CLS[s.tone]}`}>{s.label}: {counts[k]}</span> : null)}
      </div>
      {msg && <p role="status" className={`mt-4 text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}

      <div className="mt-5 grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
        <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
          {data?.rows.length === 0 && <p className="p-8 text-center text-muted font-body text-sm">No incubated startups yet.</p>}
          <ul className="divide-y divide-border">
            {data?.rows.map((r) => (
              <li key={r.applicationId}>
                <button onClick={() => { setOpen(r); setNote(""); }} disabled={!r.report || r.report.status === "draft"}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 ${open?.applicationId === r.applicationId ? "bg-leaf-50" : "hover:bg-bg"} disabled:cursor-default`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-body font-semibold text-navy truncate">{r.startupName}</span>
                    <span className="block text-xs font-body text-muted">{r.applicantName} · {r.industry}</span>
                  </span>
                  <Chip status={r.report?.status ?? "missing"} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {open?.report && (
          <section className="bg-white border border-border rounded-2xl shadow-card p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-body font-bold text-navy">{open.startupName}</h2>
              <Chip status={open.report.status} />
              <a href={`/api/qpr/${open.report._id}/pdf`} className="ml-auto text-sm font-body font-semibold text-brand hover:underline">⬇ PDF</a>
            </div>
            {open.report.submittedAt && <p className="text-xs font-mono text-muted mt-1">Submitted {fmt(open.report.submittedAt)}</p>}
            <dl className="mt-4 space-y-3">
              {form.fields.map((f) => (
                <div key={f.key}>
                  <dt className="text-[11px] text-muted font-body">{f.label}</dt>
                  <dd className="text-sm text-navy font-body whitespace-pre-line break-words">{displayValue(open.report!.answers?.[f.key]) || <span className="text-faint">Not answered</span>}</dd>
                </div>
              ))}
            </dl>
            {open.report.status === "submitted" && data?.canReview && (
              <div className="mt-5 pt-5 border-t border-border">
                <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Note to the startup <span className="text-muted font-normal">(required to send back)</span></span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm font-body resize-none" /></label>
                <div className="mt-3 flex gap-3">
                  <button onClick={() => review("accept")} disabled={busy} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Accept</button>
                  <button onClick={() => review("return")} disabled={busy || !note.trim()} className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-semibold font-body disabled:opacity-50">Send back</button>
                </div>
              </div>
            )}
            {open.report.reviewedBy && <p className="mt-4 text-xs font-body text-muted">Reviewed by {open.report.reviewedBy}{open.report.reviewNote ? `: ${open.report.reviewNote}` : ""}</p>}
          </section>
        )}
      </div>
    </div>
  );
}
