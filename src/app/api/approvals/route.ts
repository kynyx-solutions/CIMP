import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { withId, isId } from '@/lib/serialize';
import {
  STAGES, PIPELINE, ROLE_LABELS,
  canAct, canViewApplicants, type Stage, type WorkflowAction,
} from '@/lib/workflow';
import { notify, notifyReviewers } from '@/lib/notify';
import { audit, diffOf } from '@/lib/audit';
import { emitEvent } from '@/lib/integrations';

// Applicants get an email for every decision on their application (PRD NOT-1).
const APPLICANT_EMAIL = { ctaPath: '/dashboard', ctaLabel: 'Open your dashboard' };


const ACTIONS: WorkflowAction[] = ['advance', 'reject', 'send_back', 'fasttrack', 'toggle_public'];

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canViewApplicants(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { applicationId, action, remark, signature, signatureImage } = await req.json().catch(() => ({}));
  if (!isId(applicationId) || !ACTIONS.includes(action))
    return NextResponse.json({ error: 'Valid applicationId and action required' }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  if (!canAct(user.role, app.stage, action, app.status))
    return NextResponse.json({ error: 'You cannot perform this action at the current stage' }, { status: 403 });

  const fromStage = app.stage as Stage;
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
  const cleanRemark = typeof remark === 'string' ? remark.trim() : '';
  const cleanSignature = typeof signature === 'string' ? signature.trim().slice(0, 120) : '';
  // Drawn signature: a PNG data URL of at most 100 KB, checked by its bytes
  let cleanImage: string | null = null;
  if (typeof signatureImage === 'string' && signatureImage) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(signatureImage);
    const bytes = m ? Buffer.from(m[1], 'base64') : null;
    if (!bytes || bytes.length > 100_000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
      return NextResponse.json({ error: 'The drawn signature could not be read; clear it and sign again' }, { status: 400 });
    cleanImage = signatureImage;
  }

  // Apply a decision only if the application is still where this reviewer saw it, so two
  // reviewers acting at the same moment cannot both move it (the second one gets a 409).
  const move = (data: Prisma.ApplicationUpdateManyMutationInput, toStage: string, stepAction: string | null) =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.application.updateMany({ where: { id: app.id, stage: fromStage, status: app.status, isPublic: app.isPublic }, data });
      if (count !== 1) return false;
      if (stepAction) await tx.approvalStep.create({
        data: {
          applicationId: app.id, fromStage, toStage, action: stepAction,
          actorId: user.userId, actorName: user.name, actorRole: user.role,
          remark: cleanRemark || null, signature: cleanSignature || null, signatureImage: cleanImage,
        },
      });
      return true;
    });
  const conflict = () => NextResponse.json({ error: 'Someone else acted on this application just now. Reload to see where it is.' }, { status: 409 });
  const log = (actionText: string, detail?: string) =>
    prisma.activity.create({ data: { applicationId: app.id, actorName: user.name, actorRole: user.role, action: actionText, detail: detail || null } });

  if (action === 'advance') {
    const def = STAGES[fromStage];
    if (def.needsSignature && (!cleanSignature || !cleanImage))
      return NextResponse.json({ error: 'Draw your signature and type your name to sign at this stage' }, { status: 400 });

    const toStage = def.next!;
    const moved = await move({
      stage: toStage,
      isEditable: false, // locked once review starts (PRD WF-3)
      ...(toStage === 'ceo_approved' ? { status: 'approved' } : {}),
    }, toStage, def.actionLabel ?? 'advanced');
    if (!moved) return conflict();
    await log(`${def.actionLabel} (${roleLabel})`, cleanRemark);

    if (toStage === 'ceo_approved') {
      await notify(app.userId, '🎉 Application Approved!', `Congratulations! "${app.startupName}" has received final CEO approval. Welcome to CIMP-BIIF!`, 'success', app.id, APPLICANT_EMAIL);
    } else {
      await notify(app.userId, 'Application Progressed ✅', `"${app.startupName}" cleared ${def.label} and moved to ${STAGES[toStage].label}.`, 'success', app.id, APPLICANT_EMAIL);
      await notifyReviewers(toStage, app.startupName, app.id);
    }
  }

  else if (action === 'reject') {
    if (!cleanRemark) return NextResponse.json({ error: 'A reason is required to reject' }, { status: 400 });
    const moved = await move({ stage: 'rejected', status: 'rejected', rejectedBy: user.role, rejectionReason: cleanRemark, isEditable: false }, 'rejected', 'rejected');
    if (!moved) return conflict();
    await log(`rejected at ${STAGES[fromStage].label} (${roleLabel})`, cleanRemark);
    await notify(app.userId, 'Application Rejected', `"${app.startupName}" was not approved at ${STAGES[fromStage].label}. Reason: ${cleanRemark}`, 'error', app.id, APPLICANT_EMAIL);
  }

  else if (action === 'send_back') {
    // Return to the applicant for edits instead of rejecting (PRD WF-3).
    if (!cleanRemark) return NextResponse.json({ error: 'Tell the applicant what to change' }, { status: 400 });
    const moved = await move({ stage: 'returned', returnedFrom: fromStage, changeRequest: cleanRemark, isEditable: true }, 'returned', 'sent back for changes');
    if (!moved) return conflict();
    await log(`sent back for changes at ${STAGES[fromStage].label} (${roleLabel})`, cleanRemark);
    await notify(app.userId, 'Changes requested ✏️', `The reviewer asked for changes to "${app.startupName}": ${cleanRemark}`, 'warning', app.id, APPLICANT_EMAIL);
  }

  else if (action === 'fasttrack') {
    const moved = await move({ stage: 'ceo_approved', status: 'approved', isFastTracked: true, isEditable: false }, 'ceo_approved', 'fast-tracked');
    if (!moved) return conflict();
    await log('⚡ fast-tracked application', `Skipped from ${STAGES[fromStage].label}`);
    await notify(app.userId, '⚡ Fast-Tracked by CEO!', `"${app.startupName}" was personally fast-tracked and approved by the CEO.`, 'success', app.id, APPLICANT_EMAIL);
  }

  else if (action === 'toggle_public') {
    const isPublic = !app.isPublic;
    if (!(await move({ isPublic }, fromStage, null))) return conflict();
    await log(isPublic ? 'published to public directory' : 'removed from public directory');
    await notify(app.userId,
      isPublic ? '🌐 Now Live in the Directory!' : 'Removed from Directory',
      isPublic ? `"${app.startupName}" is now listed in the CIMP-BIIF public directory.` : `"${app.startupName}" has been removed from the public directory.`,
      'info', app.id);
  }

  const application = await prisma.application.findUnique({
    where: { id: app.id }, include: { steps: { orderBy: { at: 'asc' } } },
  });
  if (application) {
    // Partner webhooks (BIIF 2.0): public, non-sensitive fields only
    const pub = { id: application.id, startupName: application.startupName, industry: application.industry, city: application.city, state: application.state };
    if (application.status === 'approved' && app.status !== 'approved') await emitEvent('application.approved', { ...pub, fastTracked: application.isFastTracked });
    if (application.isPublic && !app.isPublic) await emitEvent('startup.published', { ...pub, idea: application.idea, website: application.website });
    const changed = diffOf(app, application, ['stage', 'status', 'isPublic', 'isFastTracked']);
    const what = `${roleLabel}: ${action.replace('_', ' ')} "${app.startupName}"`;
    await audit(req, user, `application.${action}`, 'application', app.id,
      `${what}${cleanRemark ? ` (remark: ${cleanRemark})` : ''}${cleanSignature ? ' [signed]' : ''}`, changed);
  }
  return NextResponse.json({ success: true, application: withId(application) });
}

// GET — pipeline stats (count per stage)
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canViewApplicants(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [byStage, fastTracked] = await Promise.all([
    prisma.application.groupBy({ by: ['stage'], _count: { _all: true } }),
    prisma.application.count({ where: { isFastTracked: true } }),
  ]);
  const stages: Record<string, number> = Object.fromEntries([...PIPELINE, 'returned', 'rejected'].map(s => [s, 0]));
  for (const s of byStage) stages[s.stage] = s._count._all;
  const total = Object.values(stages).reduce((a, b) => a + b, 0);

  return NextResponse.json({ total, stages, fastTracked });
}
