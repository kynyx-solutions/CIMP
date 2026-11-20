import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { withId, isId } from '@/lib/serialize';
import { parseApplication } from '@/lib/application-fields';
import { notifyReviewers } from '@/lib/notify';
import type { Stage } from '@/lib/workflow';

function getUser(req: NextRequest) {
  const token = req.cookies.get('incubator_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const applications = await prisma.application.findMany({
    where: user.role === 'incubatee' ? { userId: user.userId } : {},
    include: { steps: { orderBy: { at: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  // Internal review remarks are for the office only (the rejection reason is shared separately).
  const visible = user.role === 'incubatee'
    ? applications.map(a => ({ ...a, steps: a.steps.map(({ remark, ...s }) => s) }))
    : applications;
  return NextResponse.json({ applications: withId(visible) });
}

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'incubatee') return NextResponse.json({ error: 'Only incubatees can apply' }, { status: 403 });

  const parsed = parseApplication(await req.json());
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await prisma.application.findFirst({ where: { userId: user.userId } });
  if (existing) return NextResponse.json({ error: 'You already have an application' }, { status: 409 });

  const application = await prisma.application.create({
    data: {
      ...(parsed.data as any),
      userId: user.userId, applicantName: user.name, status: 'pending', stage: 'submitted',
    },
  });

  await prisma.activity.create({
    data: { applicationId: application.id, actorName: user.name, actorRole: user.role, action: 'submitted application' },
  });

  return NextResponse.json({ success: true, application: withId(application) }, { status: 201 });
}

// PATCH — edit application (only if still editable)
export async function PATCH(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'incubatee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { applicationId } = body;
  if (!isId(applicationId)) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

  const parsed = parseApplication(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const app = await prisma.application.findFirst({ where: { id: applicationId, userId: user.userId } });
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!app.isEditable) return NextResponse.json({ error: 'Application is locked for editing' }, { status: 400 });

  // Resubmitting after "send back for changes": return to the stage it came from (PRD WF-3).
  const resubmit = body.resubmit === true && app.stage === 'returned';
  const target = (resubmit ? app.returnedFrom ?? 'submitted' : app.stage) as Stage;

  const updated = await prisma.application.update({
    where: { id: app.id },
    data: {
      ...(parsed.data as any),
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
  if (resubmit) await notifyReviewers(target, app.startupName, app.id, 'Application Resubmitted');

  return NextResponse.json({ success: true, application: withId(updated) });
}
