import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';
import { withId, isId } from '@/lib/serialize';
import {
  STAGES, PIPELINE, ROLE_LABELS,
  canAct, isOfficeRole, type Stage, type WorkflowAction,
} from '@/lib/workflow';
import { notify, notifyReviewers } from '@/lib/notify';
import { audit, diffOf } from '@/lib/audit';
import { emitEvent } from '@/lib/integrations';

// Applicants get an email for every decision on their application (PRD NOT-1).
const APPLICANT_EMAIL = { ctaPath: '/dashboard', ctaLabel: 'Open your dashboard' };

async function getUser(req: NextRequest) {
  const token = req.cookies.get('incubator_token')?.value;
  if (!token) return null;
  return verifySession(token);
}


const ACTIONS: WorkflowAction[] = ['advance', 'reject', 'send_back', 'fasttrack', 'toggle_public'];

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOfficeRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { applicationId, action, remark, signature, signatureImage } = await req.json();
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

  const step = (toStage: string, stepAction: string) => ({
    create: {
      fromStage, toStage, action: stepAction,
      actorId: user.userId, actorName: user.name, actorRole: user.role,
      remark: cleanRemark || null, signature: cleanSignature || null, signatureImage: cleanImage,
    },
  });
  const log = (actionText: string, detail?: string) =>
    prisma.activity.create({ data: { applicationId: app.id, actorName: user.name, actorRole: user.role, action: actionText, detail: detail || null } });

  if (action === 'advance') {
    const def = STAGES[fromStage];
    if (def.needsSignature && (!cleanSignature || !cleanImage))
      return NextResponse.json({ error: 'Draw your signature and type your name to sign at this stage' }, { status: 400 });

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
      await notify(app.userId, '🎉 Application Approved!', `Congratulations! "${app.startupName}" has received final CEO approval. Welcome to CIMP-BIIF!`, 'success', app.id, APPLICANT_EMAIL);
    } else {
      await notify(app.userId, 'Application Progressed ✅', `"${app.startupName}" cleared ${def.label} and moved to ${STAGES[toStage].label}.`, 'success', app.id, APPLICANT_EMAIL);
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
    await notify(app.userId, 'Application Rejected', `"${app.startupName}" was not approved at ${STAGES[fromStage].label}. Reason: ${cleanRemark}`, 'error', app.id, APPLICANT_EMAIL);
  }

  else if (action === 'send_back') {
    // Return to the applicant for edits instead of rejecting (PRD WF-3).
    if (!cleanRemark) return NextResponse.json({ error: 'Tell the applicant what to change' }, { status: 400 });
    await prisma.application.update({
      where: { id: app.id },
      data: {
        stage: 'returned', returnedFrom: fromStage, changeRequest: cleanRemark,
        isEditable: true, steps: step('returned', 'sent back for changes'),
      },
    });
    await log(`sent back for changes at ${STAGES[fromStage].label} (${roleLabel})`, cleanRemark);
    await notify(app.userId, 'Changes requested ✏️', `The reviewer asked for changes to "${app.startupName}": ${cleanRemark}`, 'warning', app.id, APPLICANT_EMAIL);
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
    await notify(app.userId, '⚡ Fast-Tracked by CEO!', `"${app.startupName}" was personally fast-tracked and approved by the CEO.`, 'success', app.id, APPLICANT_EMAIL);
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
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOfficeRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [byStage, fastTracked] = await Promise.all([
    prisma.application.groupBy({ by: ['stage'], _count: { _all: true } }),
    prisma.application.count({ where: { isFastTracked: true } }),
  ]);
  const stages: Record<string, number> = Object.fromEntries([...PIPELINE, 'returned', 'rejected'].map(s => [s, 0]));
  for (const s of byStage) stages[s.stage] = s._count._all;
  const total = Object.values(stages).reduce((a, b) => a + b, 0);

  return NextResponse.json({ total, stages, fastTracked });
}
