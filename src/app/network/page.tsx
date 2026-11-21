"use client";
// Office "Network" (PRD MEN-1..3, workflows 6.2/6.3): review mentor & investor
// profiles, move connection requests along, and see the whole mentor pool.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { isOfficeRole, ROLE_LABELS } from "@/lib/workflow";
import { customFields, displayValue, type FieldDef, type AnswerValue } from "@/lib/forms";
import { CONN_STAGES, PROFILE_STATUS_LABELS, canReviewMentor, canReviewInvestor, canActOnConnection, type ConnStatus } from "@/lib/network";

type Profile = {
  _id: string; userId: string; headline: string; organisation?: string | null; expertise: string; sectors: string[];
  bio?: string | null; linkedin?: string | null; yearsExperience?: number | null; status: string; reviewNote?: string | null;
  investorStatus: string; investorThesis?: string | null; ticketSize?: string | null; user: { name: string; email?: string };
  answers?: Record<string, unknown> | null;
};
type Step = { _id: string; action: string; actorName: string; actorRole: string; remark?: string | null; at: string };
type Conn = {
  _id: string; status: string; type: string; message: string; createdAt: string; mentorId: string;
  incubatee: { name: string }; mentor: { name: string; mentorProfile?: { headline: string } | null };
  startup?: { startupName: string; industry: string } | null; steps: Step[];
};

const TABS = [
  { key: "profiles", label: "Profiles to review" },
  { key: "connections", label: "Connection requests" },
  { key: "all", label: "All mentors" },
] as const;

export default function NetworkPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("profiles");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [busy, setBusy] = useState(false);
  const [extraFields, setExtraFields] = useState<FieldDef[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!isOfficeRole(d.user?.role)) { router.push("/dashboard"); return; }
      setUser(d.user);
    });
  }, [router]);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    const [m, c, fm] = await Promise.all([fetch("/api/mentors").then((r) => r.json()), fetch("/api/connections").then((r) => r.json()), fetch("/api/forms/mentor").then((r) => r.json())]);
    setExtraFields(fm.form ? customFields(fm.form) : []);
    setProfiles(m.profiles ?? []);
    setConns(c.connections ?? []);
  }

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); }

  async function review(p: Profile, kind: "mentor" | "investor", decision: "approve" | "reject") {
    let note = "";
    if (decision === "reject") {
      note = window.prompt("Reason for not approving (shared with the applicant):")?.trim() ?? "";
      if (!note) return;
    }
    setBusy(true);
    const res = await fetch("/api/mentors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: p._id, kind, decision, note }) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) return flash(d.error, false);
    flash(decision === "approve" ? `${p.user.name} approved` : `${p.user.name} not approved`);
    load();
  }

  async function act(c: Conn, action: "approve" | "reject") {
    let remark = "";
    if (action === "reject") {
      remark = window.prompt("Reason (internal remark):")?.trim() ?? "";
      if (!remark) return;
    } else {
      remark = window.prompt("Optional remark (internal):")?.trim() ?? "";
    }
    setBusy(true);
    const res = await fetch("/api/connections", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: c._id, action, remark }) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) return flash(d.error, false);
    flash(action === "approve" ? "Moved forward" : "Request not approved");
    load();
  }

  if (!user) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const pendingMentor = profiles.filter((p) => p.status === "submitted");
  const pendingInvestor = profiles.filter((p) => p.investorStatus === "submitted");
  const openConns = conns.filter((c) => ["requested", "manager_approved", "routed"].includes(c.status));
  const closedConns = conns.filter((c) => !["requested", "manager_approved", "routed"].includes(c.status));
  const counts = { profiles: pendingMentor.length + pendingInvestor.length, connections: openConns.length, all: profiles.length };

  const badge = (s: string) =>
    s === "approved" || s === "active" ? "bg-leaf-50 text-leaf-800 border-leaf-200"
    : s === "rejected" || s === "declined" ? "bg-red-50 text-red-700 border-red-200"
    : s === "submitted" || s === "requested" || s === "manager_approved" || s === "routed" ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-slate-50 text-slate-600 border-slate-200";

  const ProfileCard = ({ p, kind }: { p: Profile; kind: "mentor" | "investor" }) => {
    const allowed = kind === "mentor" ? canReviewMentor(user.role) : canReviewInvestor(user.role);
    return (
      <li className="bg-white border border-border rounded-2xl p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-body font-bold text-navy">{p.user.name} <span className="text-xs font-mono text-muted">{p.user.email}</span></p>
            <p className="text-xs text-muted font-mono">{p.headline}{p.organisation ? ` · ${p.organisation}` : ""}{p.yearsExperience != null ? ` · ${p.yearsExperience} yrs` : ""}</p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border bg-saffron-50 text-saffron-600 border-saffron-100">{kind === "mentor" ? "Mentor profile" : "Investor application"}</span>
        </div>
        {kind === "mentor" ? (
          <>
            <p className="text-sm text-secondary font-body mt-3">{p.expertise}</p>
            {p.bio && <p className="text-sm text-muted font-body mt-2">{p.bio}</p>}
            <ul className="flex flex-wrap gap-1.5 mt-3">{p.sectors.map((s) => <li key={s} className="text-[11px] font-mono text-secondary bg-bg border border-border px-2 py-0.5 rounded-full">{s}</li>)}</ul>
            {extraFields.map((f) => {
              const v = displayValue((p.answers ?? {})[f.key] as AnswerValue);
              return v ? <p key={f.key} className="text-sm font-body text-secondary mt-1"><span className="font-semibold text-navy">{f.label}:</span> {v}</p> : null;
            })}
            {p.linkedin && <a href={p.linkedin} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-brand underline font-body mt-2">LinkedIn profile ↗</a>}
          </>
        ) : (
          <div className="mt-3 text-sm font-body text-secondary space-y-1">
            <p><span className="font-semibold text-navy">Thesis:</span> {p.investorThesis}</p>
            {p.ticketSize && <p><span className="font-semibold text-navy">Ticket size:</span> {p.ticketSize}</p>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {allowed ? (
            <>
              <button disabled={busy} onClick={() => review(p, kind, "approve")} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Approve</button>
              <button disabled={busy} onClick={() => review(p, kind, "reject")} className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-semibold font-body disabled:opacity-50">Not approve</button>
            </>
          ) : (
            <p className="text-xs text-muted font-body">Reviewed by {kind === "mentor" ? "Incubation Manager" : "Senior Manager"} or above.</p>
          )}
        </div>
      </li>
    );
  };

  const ConnCard = ({ c }: { c: Conn }) => {
    const st = c.status as ConnStatus;
    const stage = CONN_STAGES[st];
    const allowed = canActOnConnection({ role: user.role, userId: user.userId }, c, "approve");
    return (
      <li className="bg-white border border-border rounded-2xl p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-body font-bold text-navy">{c.startup?.startupName ?? c.incubatee.name} → {c.mentor.name}</p>
            <p className="text-xs text-muted font-mono">{c.incubatee.name}{c.startup ? ` · ${c.startup.industry}` : ""} · {c.type === "investment" ? "Investment discussion" : "Mentorship"} · {new Date(c.createdAt).toLocaleDateString("en-IN")}</p>
          </div>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${badge(st)}`}>{stage?.label}</span>
        </div>
        <p className="text-sm text-secondary font-body mt-3 whitespace-pre-line">{c.message}</p>
        {stage?.waitingOn && <p className="text-xs text-muted font-mono mt-2">Waiting on: {stage.waitingOn}</p>}
        {st === "active" && <Link href={`/messages?type=connection&id=${c._id}`} className="inline-block mt-2 text-brand text-xs font-semibold hover:underline">View conversation (read-only) →</Link>}
        {c.steps.length > 0 && (
          <ol className="mt-3 border-l-2 border-border pl-4 space-y-1.5">
            {c.steps.map((s) => (
              <li key={s._id} className="text-xs font-body text-secondary">
                <span className="font-semibold text-navy">{s.actorName}</span> ({ROLE_LABELS[s.actorRole as keyof typeof ROLE_LABELS] ?? s.actorRole}) {s.action}
                <span className="text-muted font-mono"> · {new Date(s.at).toLocaleDateString("en-IN")}</span>
                {s.remark && <span className="block text-muted italic">“{s.remark}”</span>}
              </li>
            ))}
          </ol>
        )}
        {stage?.requiredRank && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {allowed ? (
              <>
                <button disabled={busy} onClick={() => act(c, "approve")} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">{stage.actionLabel}</button>
                <button disabled={busy} onClick={() => act(c, "reject")} className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-semibold font-body disabled:opacity-50">Not approve</button>
              </>
            ) : (
              <p className="text-xs text-muted font-body">Waiting for the {stage.waitingOn}.</p>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      {msg && <div role="status" className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">Mentor & investor network</h1>
        <p className="text-secondary font-body text-sm mt-1">Approve mentors and investors, and route incubatee connection requests.</p>

        <div role="tablist" className="mt-6 flex flex-wrap gap-2 border-b border-border">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-body font-semibold -mb-px border-b-2 ${tab === t.key ? "border-brand text-brand" : "border-transparent text-muted hover:text-navy"}`}>
              {t.label} <span className="ml-1 text-[11px] font-mono bg-bg border border-border rounded-full px-1.5">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "profiles" && (
            counts.profiles === 0 ? <p className="bg-white border border-border rounded-2xl p-10 text-center text-muted font-body">Nothing waiting for review.</p> : (
              <ul className="space-y-4">
                {pendingMentor.map((p) => <ProfileCard key={p._id + "m"} p={p} kind="mentor" />)}
                {pendingInvestor.map((p) => <ProfileCard key={p._id + "i"} p={p} kind="investor" />)}
              </ul>
            )
          )}

          {tab === "connections" && (
            <>
              {openConns.length === 0 ? <p className="bg-white border border-border rounded-2xl p-10 text-center text-muted font-body">No open connection requests.</p>
                : <ul className="space-y-4">{openConns.map((c) => <ConnCard key={c._id} c={c} />)}</ul>}
              {closedConns.length > 0 && (
                <>
                  <h2 className="font-body font-bold text-navy mt-8 mb-3">Closed</h2>
                  <ul className="space-y-4">{closedConns.map((c) => <ConnCard key={c._id} c={c} />)}</ul>
                </>
              )}
            </>
          )}

          {tab === "all" && (
            <div className="bg-white border border-border rounded-2xl shadow-card overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead className="bg-surface-2 text-left text-xs font-mono text-muted uppercase">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Headline</th><th className="px-4 py-3">Mentor</th><th className="px-4 py-3">Investor</th><th className="px-4 py-3">Sectors</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p._id} className="border-t border-border">
                      <td className="px-4 py-3"><span className="font-semibold text-navy">{p.user.name}</span><span className="block text-xs text-muted font-mono">{p.user.email}</span></td>
                      <td className="px-4 py-3 text-secondary">{p.headline}</td>
                      <td className="px-4 py-3"><span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${badge(p.status)}`}>{PROFILE_STATUS_LABELS[p.status]}</span></td>
                      <td className="px-4 py-3"><span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${badge(p.investorStatus)}`}>{PROFILE_STATUS_LABELS[p.investorStatus]}</span></td>
                      <td className="px-4 py-3 text-xs text-muted">{p.sectors.join(", ")}</td>
                      <td className="px-4 py-3 text-right">{canReviewMentor(user.role) && p.status !== "draft" && p.status !== "rejected" && <Link href={`/messages?type=mentor_office&id=${p.userId}`} className="text-brand text-xs font-semibold whitespace-nowrap hover:underline">💬 Message</Link>}</td>
                    </tr>
                  ))}
                  {profiles.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">No mentors yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
