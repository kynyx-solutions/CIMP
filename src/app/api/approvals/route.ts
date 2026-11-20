import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { withId, isId } from '@/lib/serialize';
import {
  STAGES, PIPELINE, ROLE_LABELS, APPROVAL_RANK,
  canAct, isOfficeRole, type Stage, type WorkflowAction,
} from '@/lib/workflow';

function getUser(req: NextRequest) {
  const token = req.cookies.get('incubator_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

type NotifyType = 'info' | 'success' | 'warning' | 'error';

async function notify(userId: string, title: string, message: string, type: NotifyType, applicationId: string) {
  await prisma.notification.create({ data: { userId, title, message, type, applicationId } });
}

// Notify every office user who has authority to act on `stage`.
async function notifyReviewers(stage: Stage, startupName: string, applicationId: string) {
  const required = STAGES[stage].requiredRank;
  if (!required) return;
  const roles = Object.entries(APPROVAL_RANK).filter(([, r]) => r === required).map(([role]) => role);
  const reviewers = await prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true } });
  if (reviewers.length === 0) return;
  await prisma.notification.createMany({
    data: reviewers.map(r => ({
      userId: r.id, title: 'Action Required', type: 'info', applicationId,
      message: `"${startupName}" is waiting for ${STAGES[stage].label}.`,
    })),
  });
}

const ACTIONS: WorkflowAction[] = ['advance', 'reject', 'fasttrack', 'toggle_public'];

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOfficeRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { applicationId, action, remark, signature } = await req.json();
  if (!isId(applicationId) || !ACTIONS.includes(action))
    return NextResponse.json({ error: 'Valid applicationId and action required' }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  if (!canAct(user.role, app.stage, action, app.status))
    return NextResponse.json({ error: 'You cannot perform this action at the current stage' }, { status: 403 });

  const fromStage = app.stage as Stage;
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
  const cleanRemark = typeof remark === 'string' ? remark.trim() : '';
  const cleanSignature = typeof signature === 'string' ? signature.trim() : '';

  const step = (toStage: string, stepAction: string) => ({
    create: {
      fromStage, toStage, action: stepAction,
      actorId: user.userId, actorName: user.name, actorRole: user.role,
      remark: cleanRemark || null, signature: cleanSignature || null,
    },
  });
  const log = (actionText: string, detail?: string) =>
    prisma.activity.create({ data: { applicationId: app.id, actorName: user.name, actorRole: user.role, action: actionText, detail: detail || null } });

  if (action === 'advance') {
    const def = STAGES[fromStage];
    if (def.needsSignature && !cleanSignature)
      return NextResponse.json({ error: 'Signature is required at this stage' }, { status: 400 });

    const toStage = def.next!;
    await prisma.application.update({
      where: { id: app.id },
      data: {
        stage: toStage,
        isEditable: false, // locked once review starts (PRD WF-3)
        ...(toStage === 'ceo_approved' ? { status: 'approved' } : {}),
        steps: step(toStage, def.actionLabel ?? 'advanced'),
      },
    });
    await log(`${def.actionLabel} (${roleLabel})`, cleanRemark);

    if (toStage === 'ceo_approved') {
      await notify(app.userId, '🎉 Application Approved!', `Congratulations! "${app.startupName}" has received final CEO approval. Welcome to CIMP-BIIF!`, 'success', app.id);
    } else {
      await notify(app.userId, 'Application Progressed ✅', `"${app.startupName}" cleared ${def.label} and moved to ${STAGES[toStage].label}.`, 'success', app.id);
      await notifyReviewers(toStage, app.startupName, app.id);
    }
  }

  else if (action === 'reject') {
    if (!cleanRemark) return NextResponse.json({ error: 'A reason is required to reject' }, { status: 400 });
    await prisma.application.update({
      where: { id: app.id },
      data: {
        stage: 'rejected', status: 'rejected', rejectedBy: user.role, rejectionReason: cleanRemark,
        isEditable: false, steps: step('rejected', 'rejected'),
      },
    });
    await log(`rejected at ${STAGES[fromStage].label} (${roleLabel})`, cleanRemark);
    await notify(app.userId, 'Application Rejected', `"${app.startupName}" was not approved at ${STAGES[fromStage].label}. Reason: ${cleanRemark}`, 'error', app.id);
  }

  else if (action === 'fasttrack') {
    await prisma.application.update({
      where: { id: app.id },
      data: {
        stage: 'ceo_approved', status: 'approved', isFastTracked: true, isEditable: false,
        steps: step('ceo_approved', 'fast-tracked'),
      },
    });
    await log('⚡ fast-tracked application', `Skipped from ${STAGES[fromStage].label}`);
    await notify(app.userId, '⚡ Fast-Tracked by CEO!', `"${app.startupName}" was personally fast-tracked and approved by the CEO.`, 'success', app.id);
  }

  else if (action === 'toggle_public') {
    const isPublic = !app.isPublic;
    await prisma.application.update({ where: { id: app.id }, data: { isPublic } });
    await log(isPublic ? 'published to public directory' : 'removed from public directory');
    await notify(app.userId,
      isPublic ? '🌐 Now Live in the Directory!' : 'Removed from Directory',
      isPublic ? `"${app.startupName}" is now listed in the CIMP-BIIF public directory.` : `"${app.startupName}" has been removed from the public directory.`,
      'info', app.id);
  }

  const application = await prisma.application.findUnique({
    where: { id: app.id }, include: { steps: { orderBy: { at: 'asc' } } },
  });
  return NextResponse.json({ success: true, application: withId(application) });
}

// GET — pipeline stats (count per stage)
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOfficeRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [byStage, fastTracked] = await Promise.all([
    prisma.application.groupBy({ by: ['stage'], _count: { _all: true } }),
    prisma.application.count({ where: { isFastTracked: true } }),
  ]);
  const stages: Record<string, number> = Object.fromEntries([...PIPELINE, 'rejected'].map(s => [s, 0]));
  for (const s of byStage) stages[s.stage] = s._count._all;
  const total = Object.values(stages).reduce((a, b) => a + b, 0);

  return NextResponse.json({ total, stages, fastTracked });
}
