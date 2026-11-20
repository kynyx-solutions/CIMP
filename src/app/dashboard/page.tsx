import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Application } from '@/models/Application';
import { Activity } from '@/models/Activity';
import Navbar from '@/components/Navbar';
import StageBadge from '@/components/StageBadge';
import Link from 'next/link';
import { PIPELINE, STAGES, ROLE_ICONS, ROLE_LABELS, isOfficeRole } from '@/lib/workflow';

async function getUser() {
  const cookieStore = cookies();
  const token = cookieStore.get('incubator_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export default async function DashboardPage() {
  const user = await getUser();
  
  if (!user) redirect('/login');
  await connectDB();

  const isCEO = user.role === 'ceo';
  // Any office role gets the office dashboard (stats, activity).
  const isManager = isOfficeRole(user.role);

  let applications: any[] = [];
  let stageCounts: Record<string, number> = {};
  let fastTracked = 0;
  let recentActivity: any[] = [];
  let industryBreakdown: Record<string, number> = {};

  if (user.role === 'incubatee') {
    applications = await Application.find({ userId: user.userId }).sort({ createdAt: -1 }).lean();
  } else {
    const [byStage, ft, allApps] = await Promise.all([
      Application.aggregate([{ $group: { _id: '$stage', count: { $sum: 1 } } }]),
      Application.countDocuments({ isFastTracked: true }),
      Application.find({}).sort({ createdAt: -1 }).limit(6).lean(),
    ]);
    for (const s of byStage) stageCounts[s._id] = s.count;
    fastTracked = ft;
    applications = allApps;

    // Industry breakdown for CEO chart
    if (isCEO) {
      const allForChart = await Application.find({}).select('industry').lean();
      for (const a of allForChart) {
        industryBreakdown[a.industry] = (industryBreakdown[a.industry] || 0) + 1;
      }
    }

    // Recent activity
    const appIds = applications.map((a: any) => a._id);
    recentActivity = await Activity.find({ applicationId: { $in: appIds } })
      .sort({ createdAt: -1 }).limit(8).lean();
  }

  const serialized = applications.map((a: any) => ({
    ...a, _id: a._id.toString(), userId: a.userId?.toString(),
    managerId: a.managerId?.toString(), createdAt: a.createdAt?.toISOString(),
    updatedAt: a.updatedAt?.toISOString(),
  }));
  const serializedActivity = recentActivity.map((a: any) => ({
    ...a, _id: a._id.toString(), applicationId: a.applicationId?.toString(),
    createdAt: a.createdAt?.toISOString(),
  }));
  const industryData = Object.entries(industryBreakdown).sort((a, b) => b[1] - a[1]);
  const maxCount = industryData.length > 0 ? Math.max(...industryData.map(([, v]) => v)) : 1;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-navy mb-1">
            {isCEO ? <><span className="shimmer-blue">CEO</span> Command Center</> : 'Dashboard'}
          </h1>
          <p className="text-secondary font-body text-sm">
            Welcome back, <span className="font-semibold text-navy">{user.name}</span>
            {isManager && ` · ${ROLE_LABELS[user.role]}`}
          </p>
        </div>

        {/* Stats cards */}
        {(isCEO || isManager) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
            {[
              { label: 'Total', value: Object.values(stageCounts).reduce((a, b) => a + b, 0), color: 'text-navy', bg: 'bg-bg' },
              ...PIPELINE.filter(s => s !== 'ceo_approved').map(s => (
                { label: STAGES[s].label, value: stageCounts[s] ?? 0, color: 'text-blue-600', bg: 'bg-blue-50' })),
              { label: 'Approved', value: stageCounts.ceo_approved ?? 0, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Rejected', value: stageCounts.rejected ?? 0, color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Fast-Tracked ⚡', value: fastTracked, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border border-border rounded-2xl p-4 shadow-card`}>
                <div className={`font-display text-3xl font-semibold ${s.color}`}>{s.value}</div>
                <div className="text-muted text-xs font-mono mt-1 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* CEO Analytics Chart */}
        {isCEO && industryData.length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-6 mb-8 shadow-card">
            <h2 className="font-display text-lg font-semibold text-navy mb-5">Applications by Industry</h2>
            <div className="space-y-3">
              {industryData.map(([industry, count]) => (
                <div key={industry} className="flex items-center gap-4">
                  <span className="text-sm font-body text-secondary w-28 flex-shrink-0">{industry}</span>
                  <div className="flex-1 h-7 bg-bg rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center px-3 transition-all duration-700"
                      style={{ width: `${Math.max((count / maxCount) * 100, 8)}%`, background: '#1D4ED8' }}>
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
              <h2 className="font-display text-lg font-semibold text-navy">
                {user.role === 'incubatee' ? 'My Application' : 'Recent Applications'}
              </h2>
              {(isCEO || isManager) && (
                <Link href="/approvals" className="text-brand text-sm font-body hover:text-navy transition-colors font-medium">View all →</Link>
              )}
            </div>

            {user.role === 'incubatee' && serialized.length === 0 ? (
              <div className="bg-white border border-border rounded-2xl p-12 text-center shadow-card">
                <div className="text-5xl mb-4">🚀</div>
                <h3 className="font-display text-xl font-semibold text-navy mb-2">Ready to launch?</h3>
                <p className="text-muted font-body text-sm mb-6">Submit your startup application and get in front of our team.</p>
                <Link href="/apply" className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl font-body text-sm hover:opacity-90" style={{ background: '#1D4ED8' }}>
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
                          {app.pitchDeckUrl && <span className="text-xs font-mono text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">📎 Deck</span>}
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
              <h2 className="font-display text-lg font-semibold text-navy mb-4">Recent Activity</h2>
              <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
                {serializedActivity.length === 0 ? (
                  <p className="text-muted text-sm font-body text-center py-8">No activity yet</p>
                ) : (
                  <div className="space-y-4">
                    {serializedActivity.map((act: any, i: number) => (
                      <div key={act._id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs flex-shrink-0">
                            {ROLE_ICONS[act.actorRole] ?? '•'}
                          </div>
                          {i < serializedActivity.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                        </div>
                        <div className="pb-4 flex-1 min-w-0">
                          <p className="text-sm font-body text-navy font-medium">{act.actorName}</p>
                          <p className="text-xs text-secondary font-body">{act.action}</p>
                          {act.detail && <p className="text-xs text-muted font-body mt-0.5 truncate">"{act.detail}"</p>}
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
