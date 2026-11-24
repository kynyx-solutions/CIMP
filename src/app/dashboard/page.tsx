import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Navbar from '@/components/Navbar';
import StageBadge from '@/components/StageBadge';
import DashboardTasks from '@/components/DashboardTasks';
import Link from 'next/link';
import {
  PIPELINE, STAGES, ROLE_ICONS, ROLE_LABELS, APPROVAL_RANK, isOfficeRole, canViewApplicants,
  stageEnteredAt, daysSince, daysLabel, progressStage, type Stage,
} from '@/lib/workflow';

async function getUser() {
  const cookieStore = cookies();
  const token = cookieStore.get('incubator_token')?.value;
  if (!token) return null;
  return verifySession(token);
}

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const user = await getUser();
  
  if (!user) redirect('/login');
  if (user.role === 'mentor') redirect('/mentor');

  const isCEO = user.role === 'ceo';
  // Any office role gets the office dashboard (stats, activity).
  const isManager = isOfficeRole(user.role);

  let applications: any[] = [];
  let stageCounts: Record<string, number> = {};
  let fastTracked = 0;
  let recentActivity: any[] = [];
  let industryBreakdown: Record<string, number> = {};

  // Office: applications waiting on *my* stage, oldest first (PRD RBAC-3)
  let myQueue: { id: string; startupName: string; stage: string; days: number }[] = [];
  const myRank = APPROVAL_RANK[user.role];

  if (user.role === 'incubatee') {
    applications = await prisma.application.findMany({
      where: { userId: user.userId }, orderBy: { createdAt: 'desc' },
      include: { steps: { orderBy: { at: 'asc' } } },
    });
  } else if (canViewApplicants(user.role)) {
    if (myRank) {
      const myStages = (Object.keys(STAGES) as Stage[]).filter(s => STAGES[s].requiredRank === myRank);
      const waiting = await prisma.application.findMany({
        where: { stage: { in: myStages } },
        include: { steps: { orderBy: { at: 'asc' } } },
      });
      myQueue = waiting
        .map(a => ({ id: a.id, startupName: a.startupName, stage: a.stage, days: daysSince(stageEnteredAt(a)) }))
        .sort((a, b) => b.days - a.days);
    }
    const [byStage, ft, allApps] = await Promise.all([
      prisma.application.groupBy({ by: ['stage'], _count: { _all: true } }),
      prisma.application.count({ where: { isFastTracked: true } }),
      prisma.application.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
    ]);
    for (const s of byStage) stageCounts[s.stage] = s._count._all;
    fastTracked = ft;
    applications = allApps;

    // Industry breakdown for CEO chart
    if (isCEO) {
      const byIndustry = await prisma.application.groupBy({ by: ['industry'], _count: { _all: true } });
      for (const g of byIndustry) industryBreakdown[g.industry] = g._count._all;
    }

    // Recent activity
    recentActivity = await prisma.activity.findMany({
      where: { applicationId: { in: applications.map((a: any) => a.id) } },
      orderBy: { createdAt: 'desc' }, take: 8,
    });
  }

  const serialized = applications.map((a: any) => ({
    ...a, _id: a.id, createdAt: a.createdAt?.toISOString(), updatedAt: a.updatedAt?.toISOString(),
  }));
  const serializedActivity = recentActivity.map((a: any) => ({
    ...a, _id: a.id, createdAt: a.createdAt?.toISOString(),
  }));
  const industryData = Object.entries(industryBreakdown).sort((a, b) => b[1] - a[1]);
  const maxCount = industryData.length > 0 ? Math.max(...industryData.map(([, v]) => v)) : 1;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-navy mb-1">
            {isCEO ? <><span className="shimmer-blue">CEO</span> Command Center</> : 'Dashboard'}
          </h1>
          <p className="text-secondary font-body text-sm">
            Welcome back, <span className="font-semibold text-navy">{user.name}</span>
            {isManager && ` · ${ROLE_LABELS[user.role]}`}
          </p>
        </div>

        {/* Phase 2 to-dos: progress reports, mentoring, proposals, blog, ID cards */}
        <DashboardTasks user={user} />

        {/* My queue (office roles with approval authority) */}
        {myRank && (
          <div className="bg-white border border-border rounded-2xl p-5 mb-6 shadow-card flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-shrink-0">
              <p className="text-xs font-mono text-muted uppercase tracking-wider">My queue</p>
              <p className="font-display text-3xl font-bold text-navy">
                {myQueue.length} <span className="text-base font-body text-secondary">waiting on you</span>
              </p>
              {myQueue[0] && (
                <p className={`text-xs font-mono mt-1 ${myQueue[0].days >= 7 ? 'text-red-600' : 'text-muted'}`}>
                  Oldest: {daysLabel(myQueue[0].days)} in {STAGES[myQueue[0].stage as Stage].label}
                </p>
              )}
            </div>
            <ul className="flex-1 flex flex-wrap gap-2">
              {myQueue.slice(0, 5).map(q => (
                <li key={q.id} className={`text-xs font-body px-3 py-1.5 rounded-lg border ${q.days >= 7 ? 'border-red-200 bg-red-50 text-red-700' : 'border-border bg-bg text-secondary'}`}>
                  {q.startupName} · {daysLabel(q.days)}
                </li>
              ))}
              {myQueue.length === 0 && <li className="text-sm text-muted font-body">Nothing waiting on you. 🎉</li>}
            </ul>
            {myQueue.length > 0 && (
              <Link href="/approvals" className="flex-shrink-0 px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold font-body hover:opacity-90">Review now →</Link>
            )}
          </div>
        )}

        {/* Incubatee: where you stand */}
        {user.role === 'incubatee' && serialized[0] && (() => {
          const app = serialized[0];
          const cur = PIPELINE.indexOf(progressStage(app) as Stage);
          const def = STAGES[app.stage as Stage];
          const days = daysSince(stageEnteredAt(app));
          return (
            <div className="bg-white border border-border rounded-2xl p-6 mb-8 shadow-card">
              <h2 className="font-display text-lg font-bold text-navy mb-4">Where you stand</h2>
              {app.stage !== 'rejected' && (
                <ol className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
                  {PIPELINE.map((s, i) => (
                    <li key={s} className={`rounded-xl border px-3 py-2 text-xs font-body ${i < cur || app.stage === 'ceo_approved' ? 'bg-leaf-50 border-leaf-100 text-brand' : i === cur ? 'bg-amber-50 border-amber-200 text-amber-800 font-semibold' : 'bg-bg border-border text-muted'}`}>
                      <span className="font-mono">{i + 1}.</span> {s === 'ceo_approved' ? 'Approved' : STAGES[s].label}
                    </li>
                  ))}
                </ol>
              )}
              {def?.next && (
                <p className="text-sm font-body text-secondary">
                  <strong className="text-navy">Now:</strong> waiting on the {def.waitingOn} ({daysLabel(days)} so far).
                  {' '}Next: {STAGES[def.next!].label === 'Approved' ? 'final decision' : STAGES[def.next!].label}. You will be notified by email and here.
                </p>
              )}
              {app.stage === 'ceo_approved' && (
                <p className="text-sm font-body text-green-700">
                  <strong>Approved.</strong> The incubation team will contact you about onboarding, agreements and your mentor.
                  {app.isPublic ? ' Your startup is listed in the public directory.' : ''}
                </p>
              )}
              {app.stage === 'returned' && (
                <div className="text-sm font-body bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-orange-800">
                  <p><strong>Changes requested</strong> by the reviewer:</p>
                  <p className="mt-1 whitespace-pre-line">{app.changeRequest}</p>
                  <Link href="/apply" className="mt-3 inline-flex px-4 py-2 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700">Edit &amp; resubmit →</Link>
                </div>
              )}
              {app.stage === 'rejected' && (
                <div className="text-sm font-body text-secondary space-y-1">
                  <p className="text-red-600"><strong>Not approved</strong> at this stage. Reason: {app.rejectionReason}</p>
                  <p>What you can do: use the reviewer&apos;s feedback, strengthen traction or team details, and reach out through Messages if you have questions. Re-application rules will be confirmed by CIMP.</p>
                </div>
              )}
              {app.steps?.length > 0 && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Review history</p>
                  <ul className="space-y-2">
                    {app.steps.map((s: any) => (
                      <li key={s.id} className="text-sm font-body text-secondary flex flex-col sm:flex-row sm:gap-2">
                        <span className="text-faint font-mono text-xs w-36 flex-shrink-0">{new Date(s.at).toLocaleDateString('en-IN')}</span>
                        {/* Internal remarks stay with the office; only the rejection reason is shared above. */}
                        <span><strong className="text-navy">{ROLE_LABELS[s.actorRole]}</strong>: {s.action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })()}

        {/* Stats cards */}
        {(isCEO || isManager) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3 mb-8">
            {[
              { label: 'Total', value: Object.values(stageCounts).reduce((a, b) => a + b, 0), color: 'text-navy', bg: 'bg-bg' },
              ...PIPELINE.filter(s => s !== 'ceo_approved').map(s => (
                { label: STAGES[s].label, value: stageCounts[s] ?? 0, color: 'text-leaf-700', bg: 'bg-leaf-50' })),
              { label: 'Approved', value: stageCounts.ceo_approved ?? 0, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Changes requested', value: stageCounts.returned ?? 0, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Rejected', value: stageCounts.rejected ?? 0, color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Fast-Tracked ⚡', value: fastTracked, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border border-border rounded-2xl p-4 shadow-card`}>
                <div className={`font-display text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-muted text-xs font-mono mt-1 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* CEO Analytics Chart */}
        {isCEO && industryData.length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-6 mb-8 shadow-card">
            <h2 className="font-display text-lg font-bold text-navy mb-5">Applications by Industry</h2>
            <div className="space-y-3">
              {industryData.map(([industry, count]) => (
                <div key={industry} className="flex items-center gap-4">
                  <span className="text-sm font-body text-secondary w-28 flex-shrink-0">{industry}</span>
                  <div className="flex-1 h-7 bg-bg rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center px-3 transition-all duration-700"
                      style={{ width: `${Math.max((count / maxCount) * 100, 8)}%`, background: '#3F7A16' }}>
                      <span className="text-white text-xs font-mono">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`grid gap-6 ${(isCEO || isManager) ? 'lg:grid-cols-3' : 'grid-cols-1'}`}>
          {/* Applications */}
          <div className={isCEO || isManager ? 'lg:col-span-2' : ''}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-navy">
                {user.role === 'incubatee' ? 'My Application' : 'Recent Applications'}
              </h2>
              {(isCEO || isManager) && (
                <Link href="/approvals" className="text-brand text-sm font-body hover:text-navy transition-colors font-medium">View all →</Link>
              )}
            </div>

            {user.role === 'incubatee' && serialized.length === 0 ? (
              <div className="bg-white border border-border rounded-2xl p-12 text-center shadow-card">
                <div className="text-5xl mb-4">🚀</div>
                <h3 className="font-display text-xl font-bold text-navy mb-2">Ready to launch?</h3>
                <p className="text-muted font-body text-sm mb-6">Submit your startup application and get in front of our team.</p>
                <Link href="/apply" className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl font-body text-sm hover:opacity-90" style={{ background: '#3F7A16' }}>
                  Submit Application →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {serialized.map((app: any) => (
                  <div key={app._id} className={`bg-white border rounded-2xl p-5 shadow-card transition-all hover:shadow-card-md ${app.isFastTracked ? 'border-amber-300' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-body font-semibold text-navy">{app.startupName}</h3>
                          {app.isFastTracked && <span className="text-xs font-mono text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚡ Fast-Tracked</span>}
                          {app.pitchDeckUrl && <span className="text-xs font-mono text-leaf-700 bg-leaf-50 border border-leaf-200 px-2 py-0.5 rounded-full">📎 Deck</span>}
                        </div>
                        <p className="text-secondary text-sm font-body line-clamp-2 mb-2">{app.idea}</p>
                        <div className="flex items-center gap-3 text-xs text-muted font-mono">
                          <span>{app.applicantName}</span><span>·</span>
                          <span>{app.industry}</span><span>·</span>
                          <span>{new Date(app.createdAt).toLocaleDateString('en-IN')}</span>
                        </div>
                        {app.rejectionReason && <p className="mt-2 text-xs text-red-500 font-body bg-red-50 px-3 py-1.5 rounded-lg">Rejected: {app.rejectionReason}</p>}
                        {app.isEditable && user.role === 'incubatee' && (
                          <Link href="/apply" className="inline-flex items-center gap-1 mt-2 text-xs text-brand hover:text-navy font-body font-medium">✏️ Edit application</Link>
                        )}
                      </div>
                      <StageBadge stage={app.stage} fastTracked={app.isFastTracked} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          {(isCEO || isManager) && (
            <div>
              <h2 className="font-display text-lg font-bold text-navy mb-4">Recent Activity</h2>
              <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
                {serializedActivity.length === 0 ? (
                  <p className="text-muted text-sm font-body text-center py-8">No activity yet</p>
                ) : (
                  <div className="space-y-4">
                    {serializedActivity.map((act: any, i: number) => (
                      <div key={act._id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-leaf-50 border border-leaf-200 flex items-center justify-center text-xs flex-shrink-0">
                            {ROLE_ICONS[act.actorRole] ?? '•'}
                          </div>
                          {i < serializedActivity.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                        </div>
                        <div className="pb-4 flex-1 min-w-0">
                          <p className="text-sm font-body text-navy font-medium">{act.actorName}</p>
                          <p className="text-xs text-secondary font-body">{act.action}</p>
                          {act.detail && <p className="text-xs text-muted font-body mt-0.5 truncate">“{act.detail}”</p>}
                          <p className="text-[10px] text-faint font-mono mt-1">{new Date(act.createdAt).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
