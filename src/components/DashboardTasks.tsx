// Phase 2 work on the dashboard: what each person should do next.
// Server component: queries the database directly for the signed-in user.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { APPROVAL_RANK, isOfficeRole } from "@/lib/workflow";
import { CONN_STAGES } from "@/lib/network";
import { canHandleProposals } from "@/lib/invest";
import { dueDate, fileablePeriods, periodLabel, previousPeriod, periodOf } from "@/lib/qpr";
import { eligibleHolders } from "@/lib/idcard";

type User = { userId: string; role: string; name: string };
type Card = { title: string; value: string | number; note?: string; href: string; cta: string; urgent?: boolean };

const when = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function founderCards(user: User): Promise<{ cards: Card[]; sessions: { id: string; at: Date; mode: string; mentor: string; connectionId: string }[] }> {
  const app = await prisma.application.findFirst({ where: { userId: user.userId, status: "approved" }, select: { id: true } });
  if (!app) return { cards: [], sessions: [] };
  const [reports, conns, pitches] = await Promise.all([
    prisma.qprReport.findMany({ where: { applicationId: app.id, period: { in: fileablePeriods() } }, select: { period: true, status: true } }),
    prisma.connection.findMany({ where: { incubateeId: user.userId, status: "active" }, select: { id: true, mentor: { select: { name: true } } } }),
    prisma.investmentProposal.findMany({ where: { applicationId: app.id, status: "pitch_scheduled", pitchAt: { gte: new Date() } }, include: { investor: { select: { name: true } } }, orderBy: { pitchAt: "asc" } }),
  ]);
  const cards: Card[] = [];
  // The last completed quarter's report is the one that is due
  const lastQ = previousPeriod(periodOf());
  const r = reports.find((x) => x.period === lastQ);
  if (!r || ["draft", "returned"].includes(r.status)) {
    const due = dueDate(lastQ), late = due < new Date();
    cards.push({ title: `Progress report · ${periodLabel(lastQ)}`, value: r?.status === "returned" ? "Changes requested" : r?.status === "draft" ? "Draft saved" : "Not started",
      note: `${late ? "Was due" : "Due"} ${due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`, href: "/qpr", cta: "Fill in the report", urgent: late || r?.status === "returned" });
  }
  const connIds = conns.map((c) => c.id);
  const [sessions, docReqs] = await Promise.all([
    prisma.mentorSession.findMany({ where: { connectionId: { in: connIds }, status: "scheduled", scheduledAt: { gte: new Date(Date.now() - 2 * 3600_000) } }, orderBy: { scheduledAt: "asc" }, take: 3 }),
    prisma.docRequest.findMany({ where: { connectionId: { in: connIds }, status: "requested" }, select: { id: true, connectionId: true } }),
  ]);
  if (docReqs.length) cards.push({ title: "Documents your mentor asked for", value: docReqs.length, href: `/mentorship/${docReqs[0].connectionId}`, cta: "Upload", urgent: true });
  if (pitches[0]) cards.push({ title: "Investor pitch", value: when(pitches[0].pitchAt!), note: `To ${pitches[0].investor.name}`, href: "/invest", cta: "View pitches" });
  const mentorOf = new Map(conns.map((c) => [c.id, c.mentor.name]));
  return { cards, sessions: sessions.map((s) => ({ id: s.id, at: s.scheduledAt, mode: s.mode, mentor: mentorOf.get(s.connectionId) ?? "Mentor", connectionId: s.connectionId })) };
}

async function officeCards(user: User): Promise<Card[]> {
  const rank = APPROVAL_RANK[user.role] ?? 0;
  const cards: Card[] = [];
  const tasks: Promise<void>[] = [];
  if (rank >= 1) tasks.push(prisma.qprReport.count({ where: { status: "submitted" } }).then((n) => { cards.push({ title: "Progress reports to review", value: n, href: "/qpr", cta: "Review", urgent: n > 0 }); }));
  if (rank >= 2) {
    // connection requests waiting on my stage
    const myStatuses = Object.entries(CONN_STAGES).filter(([, d]) => d.requiredRank === rank || (rank > 3 && d.requiredRank)).map(([k]) => k);
    tasks.push(prisma.connection.count({ where: { status: { in: myStatuses } } }).then((n) => { cards.push({ title: "Mentor requests waiting on you", value: n, href: "/network", cta: "Open network", urgent: n > 0 }); }));
    tasks.push(prisma.mentorProfile.count({ where: rank >= 3 ? { OR: [{ status: "submitted" }, { investorStatus: "submitted" }] } : { status: "submitted" } }).then((n) => { cards.push({ title: "Mentor / investor profiles to review", value: n, href: "/network", cta: "Review profiles", urgent: n > 0 }); }));
  }
  if (canHandleProposals(user.role)) tasks.push(prisma.investmentProposal.count({ where: { status: "submitted" } }).then((n) => { cards.push({ title: "Investment proposals to arrange", value: n, href: "/invest", cta: "Open proposals", urgent: n > 0 }); }));
  if (user.role === "admin_it") {
    tasks.push(prisma.blogPost.count({ where: { status: "submitted" } }).then((n) => { cards.push({ title: "Blog posts to approve", value: n, href: "/posts", cta: "Review posts", urgent: n > 0 }); }));
    tasks.push(Promise.all([eligibleHolders(), prisma.idCard.findMany({ where: { status: "active", expiresAt: { gt: new Date() } }, select: { userId: true } })]).then(([h, c]) => {
      const have = new Set(c.map((x) => x.userId)); const n = h.filter((x) => !have.has(x.userId)).length;
      cards.push({ title: "Members without a valid ID card", value: n, href: "/admin?tab=idcards", cta: "Issue cards" });
    }));
  }
  if (user.role === "staff") tasks.push(prisma.blogPost.count({ where: { authorId: user.userId, status: "rejected" } }).then((n) => { if (n) cards.push({ title: "Your posts with changes requested", value: n, href: "/posts", cta: "Edit", urgent: true }); }));
  await Promise.all(tasks);
  return cards.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || Number(b.value) - Number(a.value));
}

export default async function DashboardTasks({ user }: { user: User }) {
  const office = isOfficeRole(user.role);
  if (!office && user.role !== "incubatee") return null;
  const { cards, sessions } = office ? { cards: await officeCards(user), sessions: [] } : await founderCards(user);
  if (!cards.length && !sessions.length) return null;
  return (
    <section aria-label="To do" className="mb-6">
      {cards.length > 0 && (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <li key={c.title} className={`bg-white border rounded-2xl p-5 shadow-card flex flex-col ${c.urgent ? "border-amber-300" : "border-border"}`}>
              <p className="text-[11px] font-mono text-muted uppercase tracking-wider">{c.title}</p>
              <p className="font-display text-2xl font-bold text-navy mt-1 tabular-nums">{c.value}</p>
              {c.note && <p className={`text-xs font-body mt-0.5 ${c.urgent ? "text-amber-800" : "text-muted"}`}>{c.note}</p>}
              <Link href={c.href} className="mt-auto pt-3 text-sm font-body font-semibold text-brand hover:underline">{c.cta} →</Link>
            </li>
          ))}
        </ul>
      )}
      {sessions.length > 0 && (
        <div className="mt-4 bg-white border border-border rounded-2xl p-5 shadow-card">
          <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2">Upcoming mentor sessions</p>
          <ul className="divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="py-2 flex flex-wrap items-center gap-3 text-sm font-body">
                <span className="font-semibold text-navy">{when(s.at)}</span>
                <span className="text-secondary">{s.mentor} · {s.mode === "virtual" ? "Video call" : "In person"}</span>
                <Link href={`/mentorship/${s.connectionId}`} className="ml-auto text-brand font-semibold hover:underline">Details →</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
