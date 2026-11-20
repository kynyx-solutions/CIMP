import { NextRequest, NextResponse } from 'next/server';
import { isValidObjectId } from 'mongoose';
import { connectDB } from '@/lib/db';
import { Application } from '@/models/Application';
import { Notification } from '@/models/Notification';
import { Activity } from '@/models/Activity';
import { User } from '@/models/User';
import { verifyToken } from '@/lib/auth';
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
  await Notification.create({ userId, title, message, type, applicationId });
}

// Notify every office user who has authority to act on `stage`.
async function notifyReviewers(stage: Stage, startupName: string, applicationId: string) {
  const required = STAGES[stage].requiredRank;
  if (!required) return;
  const roles = Object.entries(APPROVAL_RANK).filter(([, r]) => r === required).map(([role]) => role);
  const reviewers = await User.find({ role: { $in: roles } }).select('_id');
  await Promise.all(reviewers.map(r =>
    notify(r._id.toString(), 'Action Required', `"${startupName}" is waiting for ${STAGES[stage].label}.`, 'info', applicationId)
  ));
}

const ACTIONS: WorkflowAction[] = ['advance', 'reject', 'fasttrack', 'toggle_public'];

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOfficeRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { applicationId, action, remark, signature } = await req.json();
  if (!applicationId || !isValidObjectId(applicationId) || !ACTIONS.includes(action))
    return NextResponse.json({ error: 'Valid applicationId and action required' }, { status: 400 });

  await connectDB();
  const app = await Application.findById(applicationId);
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  if (!canAct(user.role, app.stage, action, app.status))
    return NextResponse.json({ error: 'You cannot perform this action at the current stage' }, { status: 403 });

  const appIdStr = app._id.toString();
  const ownerId = app.userId.toString();
  const fromStage = app.stage as Stage;
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
  const cleanRemark = typeof remark === 'string' ? remark.trim() : '';
  const cleanSignature = typeof signature === 'string' ? signature.trim() : '';

  const recordStep = (toStage: string, stepAction: string) => {
    app.steps.push({
      fromStage, toStage, action: stepAction,
      actorId: user.userId as any, actorName: user.name, actorRole: user.role,
      remark: cleanRemark || undefined, signature: cleanSignature || undefined, at: new Date(),
    });
  };

  if (action === 'advance') {
    const def = STAGES[fromStage];
    if (def.needsSignature && !cleanSignature)
      return NextResponse.json({ error: 'Signature is required at this stage' }, { status: 400 });

    const toStage = def.next!;
    app.stage = toStage;
    app.isEditable = false; // locked once review starts (PRD WF-3)
    if (toStage === 'ceo_approved') app.status = 'approved';
    recordStep(toStage, def.actionLabel ?? 'advanced');
    await app.save();

    await Activity.create({ applicationId: appIdStr, actorName: user.name, actorRole: user.role,
      action: `${def.actionLabel} (${roleLabel})`, detail: cleanRemark || undefined });

    if (toStage === 'ceo_approved') {
      await notify(ownerId, '🎉 Application Approved!', `Congratulations! "${app.startupName}" has received final CEO approval. Welcome to CIMP-BIIF!`, 'success', appIdStr);
    } else {
      await notify(ownerId, 'Application Progressed ✅', `"${app.startupName}" cleared ${def.label} and moved to ${STAGES[toStage].label}.`, 'success', appIdStr);
      await notifyReviewers(toStage, app.startupName, appIdStr);
    }
  }

  else if (action === 'reject') {
    if (!cleanRemark) return NextResponse.json({ error: 'A reason is required to reject' }, { status: 400 });
    app.stage = 'rejected'; app.status = 'rejected';
    app.rejectedBy = user.role; app.rejectionReason = cleanRemark;
    app.isEditable = false;
    recordStep('rejected', 'rejected');
    await app.save();
    await Activity.create({ applicationId: appIdStr, actorName: user.name, actorRole: user.role,
      action: `rejected at ${STAGES[fromStage].label} (${roleLabel})`, detail: cleanRemark });
    await notify(ownerId, 'Application Rejected', `"${app.startupName}" was not approved at ${STAGES[fromStage].label}. Reason: ${cleanRemark}`, 'error', appIdStr);
  }

  else if (action === 'fasttrack') {
    app.stage = 'ceo_approved'; app.status = 'approved';
    app.isFastTracked = true; app.isEditable = false;
    recordStep('ceo_approved', 'fast-tracked');
    await app.save();
    await Activity.create({ applicationId: appIdStr, actorName: user.name, actorRole: user.role,
      action: '⚡ fast-tracked application', detail: `Skipped from ${STAGES[fromStage].label}` });
    await notify(ownerId, '⚡ Fast-Tracked by CEO!', `"${app.startupName}" was personally fast-tracked and approved by the CEO.`, 'success', appIdStr);
  }

  else if (action === 'toggle_public') {
    app.isPublic = !app.isPublic;
    await app.save();
    await Activity.create({ applicationId: appIdStr, actorName: user.name, actorRole: user.role,
      action: app.isPublic ? 'published to public directory' : 'removed from public directory' });
    await notify(ownerId,
      app.isPublic ? '🌐 Now Live in the Directory!' : 'Removed from Directory',
      app.isPublic ? `"${app.startupName}" is now listed in the CIMP-BIIF public directory.` : `"${app.startupName}" has been removed from the public directory.`,
      'info', appIdStr);
  }

  return NextResponse.json({ success: true, application: app });
}

// GET — pipeline stats (count per stage)
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOfficeRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await connectDB();
  const [byStage, fastTracked] = await Promise.all([
    Application.aggregate([{ $group: { _id: '$stage', count: { $sum: 1 } } }]),
    Application.countDocuments({ isFastTracked: true }),
  ]);
  const stages: Record<string, number> = Object.fromEntries([...PIPELINE, 'rejected'].map(s => [s, 0]));
  for (const s of byStage) stages[s._id] = s.count;
  const total = Object.values(stages).reduce((a, b) => a + b, 0);

  return NextResponse.json({ total, stages, fastTracked });
}
