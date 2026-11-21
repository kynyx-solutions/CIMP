"use client";
// Mentor hub (PRD MEN-1, MEN-2, MEN-3): profile and its review status, investor
// application, and connection requests routed to this mentor.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { INDUSTRIES } from "@/lib/application-fields";
import { PROFILE_STATUS_LABELS, CONN_STAGES } from "@/lib/network";
import FieldInput, { toFieldValue, type FieldValue } from "@/components/FieldInput";
import { customFields, type FieldDef } from "@/lib/forms";

type Profile = {
  _id: string; headline: string; organisation?: string | null; expertise: string; sectors: string[]; bio?: string | null;
  linkedin?: string | null; yearsExperience?: number | null; isPublic: boolean; status: string; reviewNote?: string | null;
  investorStatus: string; investorThesis?: string | null; ticketSize?: string | null; investorNote?: string | null;
  answers?: Record<string, unknown> | null;
};
type Conn = {
  _id: string; status: string; type: string; message: string; createdAt: string;
  incubatee: { name: string }; startup?: { startupName: string; industry: string } | null;
};

const EMPTY = { headline: "", organisation: "", expertise: "", sectors: [] as string[], bio: "", linkedin: "", yearsExperience: "", isPublic: true };
const inputCls = "w-full bg-white border border-border rounded-xl px-4 py-2.5 text-navy font-body text-sm focus:outline-none focus:border-brand-2 focus:ring-4 focus:ring-leaf-100 placeholder:text-faint";

const statusChip = (s: string) =>
  s === "approved" ? "bg-leaf-50 text-leaf-800 border-leaf-200"
  : s === "submitted" ? "bg-amber-50 text-amber-800 border-amber-200"
  : s === "rejected" ? "bg-red-50 text-red-700 border-red-200"
  : "bg-bg text-secondary border-border";

export default function MentorHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [inv, setInv] = useState({ investorThesis: "", ticketSize: "" });
  const [conns, setConns] = useState<Conn[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // Extra fields Admin IT added to the mentor form (PRD FORM-1)
  const [extraFields, setExtraFields] = useState<FieldDef[]>([]);
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d.user?.role !== "mentor") { router.push("/dashboard"); return; }
      setUser(d.user);
    });
  }, [router]);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    const [p, c, fm] = await Promise.all([
      fetch("/api/mentor/profile").then((r) => r.json()),
      fetch("/api/connections").then((r) => r.json()),
      fetch("/api/forms/mentor").then((r) => r.json()),
    ]);
    setProfile(p.profile);
    const extra: FieldDef[] = fm.form ? customFields(fm.form) : [];
    setExtraFields(extra);
    setAnswers(Object.fromEntries(extra.map((f) => [f.key, toFieldValue(f, p.profile?.answers?.[f.key])])));
    if (p.profile) {
      setForm({
        headline: p.profile.headline ?? "", organisation: p.profile.organisation ?? "", expertise: p.profile.expertise ?? "",
        sectors: p.profile.sectors ?? [], bio: p.profile.bio ?? "", linkedin: p.profile.linkedin ?? "",
        yearsExperience: p.profile.yearsExperience == null ? "" : String(p.profile.yearsExperience), isPublic: p.profile.isPublic,
      });
    }
    setConns(c.connections ?? []);
  }

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); }

  async function saveProfile(submit: boolean) {
    setBusy(true);
    const res = await fetch("/api/mentor/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, answers, submit }) });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return flash(d.error, false);
    flash(submit ? "Submitted for review. You'll be notified of the decision." : "Profile saved.");
    load();
  }

  async function applyInvestor() {
    setBusy(true);
    const res = await fetch("/api/mentor/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inv) });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return flash(d.error, false);
    flash("Investor application submitted.");
    load();
  }

  async function respond(connectionId: string, action: "accept" | "decline") {
    const remark = action === "decline" ? prompt("Optional note for the founder (why you can't take this on):") ?? "" : "";
    const res = await fetch("/api/connections", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId, action, remark }) });
    const d = await res.json();
    if (!res.ok) return flash(d.error, false);
    flash(action === "accept" ? "Connected! The founder has been notified." : "Declined. The founder has been notified.");
    load();
  }

  if (!user) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const status = profile?.status ?? "draft";
  const canSubmit = !profile || status === "draft" || status === "rejected";
  const pending = conns.filter((c) => c.status === "routed");
  const active = conns.filter((c) => c.status === "active");
  const declined = conns.filter((c) => c.status === "declined");

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      {msg && <div role="status" className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">Mentor hub</h1>
        <p className="text-secondary font-body text-sm mt-1">
          Welcome, {user.name}. Manage your profile and the startups routed to you.{" "}
          <Link href={`/messages?type=mentor_office&id=${user.userId}`} className="text-brand font-semibold underline">Message the office</Link>
        </p>

        {/* Requests waiting on this mentor */}
        <section className="mt-8 bg-white border border-border rounded-2xl p-6 shadow-card">
          <h2 className="font-body font-bold text-navy">Requests waiting for you <span className="text-muted font-mono text-xs">({pending.length})</span></h2>
          {pending.length === 0 ? (
            <p className="text-sm text-muted font-body mt-3">No requests right now. The office routes suitable startups to you after review.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pending.map((c) => (
                <li key={c._id} className="border border-border rounded-xl p-4 bg-surface-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body font-bold text-navy">{c.startup?.startupName ?? c.incubatee.name}</p>
                    {c.startup && <span className="text-[11px] font-mono text-brand bg-leaf-50 border border-leaf-200 px-2 py-0.5 rounded-full">{c.startup.industry}</span>}
                    <span className="text-[11px] font-mono text-secondary bg-bg border border-border px-2 py-0.5 rounded-full">{c.type === "investment" ? "Investment discussion" : "Mentorship"}</span>
                  </div>
                  <p className="text-xs text-muted font-body mt-1">Founder: {c.incubatee.name}</p>
                  <p className="text-sm text-secondary font-body mt-2 whitespace-pre-line">“{c.message}”</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => respond(c._id, "accept")} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold font-body hover:opacity-90">Accept</button>
                    <button onClick={() => respond(c._id, "decline")} className="px-4 py-2 rounded-lg border border-border text-secondary text-sm font-body hover:text-navy">Decline</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {active.length > 0 && (
            <>
              <h3 className="font-body font-bold text-navy mt-6 text-sm">Your startups ({active.length})</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {active.map((c) => (
                  <li key={c._id}>
                    <Link href={`/messages?type=connection&id=${c._id}`} className="inline-flex items-center gap-2 text-sm font-body px-3 py-1.5 rounded-lg bg-leaf-50 border border-leaf-200 text-leaf-800 hover:border-brand">
                      {c.startup?.startupName ?? c.incubatee.name} · {c.type === "investment" ? "Investment" : "Mentorship"}
                      <span className="text-brand font-semibold">💬 Message</span>
                    </Link>
                    <Link href={`/mentorship/${c._id}`} className="ml-2 inline-flex items-center text-sm font-body font-semibold text-brand hover:underline">📅 Sessions &amp; documents</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {declined.length > 0 && <p className="text-xs text-muted font-body mt-4">Declined: {declined.length}</p>}
        </section>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 mt-6 items-start">
          {/* Profile */}
          <section className="bg-white border border-border rounded-2xl p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-body font-bold text-navy">Mentor profile</h2>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${statusChip(status)}`}>{PROFILE_STATUS_LABELS[status]}</span>
            </div>
            {status === "rejected" && profile?.reviewNote && <p className="mt-3 text-sm font-body text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">Reviewer note: {profile.reviewNote}. Update your profile and submit again.</p>}
            {status === "submitted" && <p className="mt-3 text-sm font-body text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">Your profile is with the incubation team for review.</p>}

            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              <label className="sm:col-span-2 block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Headline *</span>
                <input className={inputCls} maxLength={120} value={form.headline} onChange={(e) => setForm((p) => ({ ...p, headline: e.target.value }))} placeholder="e.g. Former CXO, FinTech" /></label>
              <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Organisation</span>
                <input className={inputCls} maxLength={120} value={form.organisation} onChange={(e) => setForm((p) => ({ ...p, organisation: e.target.value }))} /></label>
              <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Years of experience</span>
                <input className={inputCls} type="number" min={0} max={60} value={form.yearsExperience} onChange={(e) => setForm((p) => ({ ...p, yearsExperience: e.target.value }))} /></label>
              <label className="sm:col-span-2 block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Expertise *</span>
                <textarea className={`${inputCls} resize-y`} rows={3} maxLength={600} value={form.expertise} onChange={(e) => setForm((p) => ({ ...p, expertise: e.target.value }))} placeholder="What can you help founders with? e.g. go-to-market, fundraising, regulatory" /></label>
              <fieldset className="sm:col-span-2">
                <legend className="block text-sm font-body font-medium text-navy mb-2">Sectors *</legend>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((s) => {
                    const on = form.sectors.includes(s);
                    return (
                      <button type="button" key={s} aria-pressed={on}
                        onClick={() => setForm((p) => ({ ...p, sectors: on ? p.sectors.filter((x) => x !== s) : [...p.sectors, s] }))}
                        className={`px-3 py-1.5 rounded-full text-sm font-body border ${on ? "bg-brand text-white border-brand" : "bg-white text-secondary border-border hover:border-brand"}`}>{s}</button>
                    );
                  })}
                </div>
              </fieldset>
              <label className="sm:col-span-2 block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Short bio</span>
                <textarea className={`${inputCls} resize-y`} rows={3} maxLength={2000} value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} /></label>
              <label className="sm:col-span-2 block"><span className="block text-sm font-body font-medium text-navy mb-1.5">LinkedIn</span>
                <input className={inputCls} type="url" value={form.linkedin} onChange={(e) => setForm((p) => ({ ...p, linkedin: e.target.value }))} placeholder="https://" /></label>
              {extraFields.map((f) => (
                <div key={f.key} className={f.type === "textarea" || f.type === "multiselect" ? "sm:col-span-2" : ""}>
                  <label id={`x-${f.key}-label`} htmlFor={`x-${f.key}`} className="block text-sm font-body font-medium text-navy mb-1.5">
                    {f.label}{f.required && <span className="text-red-500"> *</span>}
                  </label>
                  <FieldInput f={f} idPrefix="x-" value={answers[f.key]} onChange={(v) => setAnswers((p) => ({ ...p, [f.key]: v }))} />
                  {f.help && <p className="text-xs text-muted font-body mt-1">{f.help}</p>}
                </div>
              ))}
              <label className="sm:col-span-2 flex items-center gap-2 text-sm font-body text-secondary">
                <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm((p) => ({ ...p, isPublic: e.target.checked }))} className="w-4 h-4 accent-[#3F7A16]" />
                List me in the public mentors directory once approved
              </label>
              <p className="sm:col-span-2 text-xs text-muted font-body -mt-2">
                The public profile shows your name, headline, organisation, experience, expertise, sectors, bio and LinkedIn, plus your investment focus if you are an approved investor. Never your email.
                {status === "approved" && profile?.isPublic && (
                  <> <Link href={`/mentors/${profile._id}`} target="_blank" className="text-brand font-semibold underline">View your public profile ↗</Link></>
                )}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button disabled={busy} onClick={() => saveProfile(false)} className="px-5 py-2.5 rounded-xl border border-border text-navy text-sm font-body hover:border-brand disabled:opacity-50">Save</button>
              {canSubmit && <button disabled={busy} onClick={() => saveProfile(true)} className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body hover:opacity-90 disabled:opacity-50">Save &amp; submit for review</button>}
            </div>
          </section>

          {/* Investor */}
          <section className="bg-white border border-border rounded-2xl p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-body font-bold text-navy">Also an investor?</h2>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${statusChip(profile?.investorStatus ?? "none")}`}>{PROFILE_STATUS_LABELS[profile?.investorStatus ?? "none"]}</span>
            </div>
            {status !== "approved" ? (
              <p className="text-sm text-muted font-body mt-3">Once your mentor profile is approved, you can apply to be listed as an investor too. Investor listings need a separate approval.</p>
            ) : profile?.investorStatus === "approved" ? (
              <p className="text-sm text-leaf-800 font-body mt-3">You are listed as an investor. Startups can request investment discussions with you.</p>
            ) : profile?.investorStatus === "submitted" ? (
              <p className="text-sm text-amber-800 font-body mt-3">Your investor application is with the Senior Manager / CEO for review.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {profile?.investorStatus === "rejected" && profile.investorNote && <p className="text-sm font-body text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">Reviewer note: {profile.investorNote}</p>}
                <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Investment focus *</span>
                  <textarea className={`${inputCls} resize-y`} rows={4} maxLength={1500} value={inv.investorThesis} onChange={(e) => setInv((p) => ({ ...p, investorThesis: e.target.value }))} placeholder="Stages, sectors and what you look for in founders" /></label>
                <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Typical ticket size *</span>
                  <input className={inputCls} maxLength={80} value={inv.ticketSize} onChange={(e) => setInv((p) => ({ ...p, ticketSize: e.target.value }))} placeholder="e.g. ₹10–25 lakh" /></label>
                <button disabled={busy} onClick={applyInvestor} className="w-full px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body hover:opacity-90 disabled:opacity-50">Apply as investor</button>
              </div>
            )}
            <p className="text-xs text-muted font-body mt-6 border-t border-border pt-4">
              How connections work: a founder requests you, the Incubation Manager reviews it, the Senior Manager routes it to you, and you accept or decline. Current stage labels: {Object.values(CONN_STAGES).slice(0, 3).map((s) => s.label).join(" → ")}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

