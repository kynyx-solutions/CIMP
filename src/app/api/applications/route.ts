import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { withId, isId } from '@/lib/serialize';
import { canViewApplicants, isOfficeRole, ROLE_LABELS, type Stage } from '@/lib/workflow';
import { validateFields, valueOf, displayValue, type AnswerValue, type FieldDef } from '@/lib/forms';
import { getForm } from '@/lib/forms-server';
import { notify, notifyReviewers } from '@/lib/notify';
import { audit, type Diff } from '@/lib/audit';

// Office roles that may correct application fields (PRD RBAC-4, permissions matrix §5).
const OFFICE_EDITORS = ['staff', 'executive', 'manager', 'sr_manager', 'ceo'];

/** Split validated values into column data (core fields) and the `answers` JSON (custom fields). */
function split(fields: FieldDef[], data: Record<string, AnswerValue>, previousAnswers?: unknown) {
  const columns: Record<string, AnswerValue> = {};
  const answers: Record<string, AnswerValue> = { ...((previousAnswers as Record<string, AnswerValue>) ?? {}) };
  for (const f of fields) {
    if (!(f.key in data)) continue;
    if (f.core) columns[f.key] = data[f.key];
    else answers[f.key] = data[f.key];
  }
  return { columns, answers };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Incubatees see their own; the office sees all; other roles (mentors) none.
  if (user.role !== 'incubatee' && !canViewApplicants(user.role)) return NextResponse.json({ applications: [] });
  const applications = await prisma.application.findMany({
    where: user.role === 'incubatee' ? { userId: user.userId } : {},
    include: { steps: { orderBy: { at: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  // Internal review remarks are for the office only (the rejection reason is shared separately).
  const visible = user.role === 'incubatee'
    ? applications.map(a => ({ ...a, steps: a.steps.map(({ remark, signatureImage, ...s }) => s) }))
    : applications;
  return NextResponse.json({ applications: withId(visible) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'incubatee') return NextResponse.json({ error: 'Only incubatees can apply' }, { status: 403 });

  const form = await getForm('application');
  const parsed = validateFields(form.fields, await req.json());
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.application.findFirst({ where: { userId: user.userId } });
  if (existing) return NextResponse.json({ error: 'You already have an application' }, { status: 409 });

  const { columns, answers } = split(form.fields, parsed.data!);
  const application = await prisma.application.create({
    data: {
      ...(columns as any),
      answers: answers as Prisma.InputJsonValue, formVersion: form.version,
      userId: user.userId, applicantName: user.name, status: 'pending', stage: 'submitted',
    },
  });

  await prisma.activity.create({
    data: { applicationId: application.id, actorName: user.name, actorRole: user.role, action: 'submitted application' },
  });
  await audit(req, user, 'application.submit', 'application', application.id, `Submitted application "${application.startupName}" (form v${form.version})`);

  await notify(user.userId, 'Application received',
    `We have received "${application.startupName}". An Executive will check it first; you can follow every stage on your dashboard.`,
    'success', application.id, { ctaPath: '/dashboard', ctaLabel: 'Track your application' });
  await notifyReviewers('submitted', application.startupName, application.id, 'New application');

  return NextResponse.json({ success: true, application: withId(application) }, { status: 201 });
}

// PATCH — the applicant edits (while editable), or an office user corrects fields (RBAC-4).
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { applicationId } = body;
  if (!isId(applicationId)) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

  if (isOfficeRole(user.role)) return officeCorrection(req, user, applicationId, body);
  if (user.role !== 'incubatee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const form = await getForm('application');
  const parsed = validateFields(form.fields, body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const app = await prisma.application.findFirst({ where: { id: applicationId, userId: user.userId } });
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!app.isEditable) return NextResponse.json({ error: 'Application is locked for editing' }, { status: 400 });

  // Resubmitting after "send back for changes": return to the stage it came from (PRD WF-3).
  const resubmit = body.resubmit === true && app.stage === 'returned';
  const target = (resubmit ? app.returnedFrom ?? 'submitted' : app.stage) as Stage;
  const { columns, answers } = split(form.fields, parsed.data!, app.answers);

  const updated = await prisma.application.update({
    where: { id: app.id },
    data: {
      ...(columns as any),
      answers: answers as Prisma.InputJsonValue, formVersion: form.version,
      ...(resubmit ? {
        stage: target,
        isEditable: target === 'submitted', // editable again only before Executive acceptance
        returnedFrom: null, changeRequest: null,
        steps: { create: {
          fromStage: 'returned', toStage: target, action: 'resubmitted with changes',
          actorId: user.userId, actorName: user.name, actorRole: user.role,
        } },
      } : {}),
    },
  });

  await prisma.activity.create({
    data: { applicationId: app.id, actorName: user.name, actorRole: user.role, action: resubmit ? 'resubmitted application with changes' : 'edited application' },
  });
  await audit(req, user, resubmit ? 'application.resubmit' : 'application.edit', 'application', app.id,
    `${resubmit ? 'Resubmitted' : 'Edited'} application "${updated.startupName}"`, fieldDiff(form.fields, app, updated));
  if (resubmit) await notifyReviewers(target, app.startupName, app.id, 'Application Resubmitted');

  return NextResponse.json({ success: true, application: withId(updated) });
}

function fieldDiff(fields: FieldDef[], before: Record<string, any>, after: Record<string, any>): Diff {
  const out: Diff = {};
  for (const f of fields) {
    const a = valueOf(before, f) ?? null, b = valueOf(after, f) ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out[f.key] = { from: a, to: b };
  }
  return out;
}

// Office correction (PRD RBAC-4): only the fields sent, a reason is required, the application
// is flagged, the applicant is told, and old/new values go to the audit log.
async function officeCorrection(req: NextRequest, user: { userId: string; name: string; role: string }, applicationId: string, body: any) {
  if (!OFFICE_EDITORS.includes(user.role)) return NextResponse.json({ error: 'Your role cannot edit applications' }, { status: 403 });
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (!reason) return NextResponse.json({ error: 'Give a reason for the correction' }, { status: 400 });
  const changes = body.changes && typeof body.changes === 'object' ? body.changes as Record<string, unknown> : null;
  if (!changes || !Object.keys(changes).length) return NextResponse.json({ error: 'No changes sent' }, { status: 400 });

  const form = await getForm('application');
  const known = new Set(form.fields.map(f => f.key));
  const unknown = Object.keys(changes).filter(k => !known.has(k));
  if (unknown.length) return NextResponse.json({ error: `Unknown field: ${unknown.join(', ')}` }, { status: 400 });
  const parsed = validateFields(form.fields, changes, { partial: true });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const { columns, answers } = split(form.fields, parsed.data!, app.answers);
  const preview = { ...app, ...columns, answers };
  const diff = fieldDiff(form.fields.filter(f => f.key in parsed.data!), app, preview);
  if (!Object.keys(diff).length) return NextResponse.json({ error: 'Nothing changed' }, { status: 400 });

  const updated = await prisma.application.update({
    where: { id: app.id },
    data: { ...(columns as any), answers: answers as Prisma.InputJsonValue, officeEdited: true },
    include: { steps: { orderBy: { at: 'asc' } } },
  });

  const labels = form.fields.filter(f => f.key in diff).map(f => f.label);
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
  await prisma.activity.create({
    data: {
      applicationId: app.id, actorName: user.name, actorRole: user.role,
      action: `corrected ${labels.join(', ')} (office edit)`,
      detail: `${reason} — ${form.fields.filter(f => f.key in diff).map(f => `${f.label}: "${displayValue(diff[f.key].from as AnswerValue)}" → "${displayValue(diff[f.key].to as AnswerValue)}"`).join('; ')}`.slice(0, 2000),
    },
  });
  await audit(req, user, 'application.office_edit', 'application', app.id,
    `${roleLabel} corrected ${labels.join(', ')} on "${updated.startupName}" (reason: ${reason})`, diff);
  await notify(app.userId, 'The office corrected your application',
    `${roleLabel} updated ${labels.join(', ')} on "${updated.startupName}". Reason: ${reason}. You can see the old and new values in your application history.`,
    'info', app.id, { ctaPath: '/dashboard', ctaLabel: 'Review the change' });

  return NextResponse.json({ success: true, application: withId(updated) });
}
