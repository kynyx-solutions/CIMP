import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { withId, isId } from '@/lib/serialize';

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
  return NextResponse.json({ applications: withId(applications) });
}

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'incubatee') return NextResponse.json({ error: 'Only incubatees can apply' }, { status: 403 });

  const { startupName, idea, industry } = await req.json();
  if (!startupName || !idea || !industry) return NextResponse.json({ error: 'All fields required' }, { status: 400 });

  const existing = await prisma.application.findFirst({ where: { userId: user.userId } });
  if (existing) return NextResponse.json({ error: 'You already have an application' }, { status: 409 });

  const application = await prisma.application.create({
    data: {
      userId: user.userId, applicantName: user.name,
      startupName: startupName.trim(), idea, industry, status: 'pending', stage: 'submitted',
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

  const { applicationId, startupName, idea, industry } = await req.json();
  if (!isId(applicationId)) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

  const app = await prisma.application.findFirst({ where: { id: applicationId, userId: user.userId } });
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!app.isEditable) return NextResponse.json({ error: 'Application is locked for editing' }, { status: 400 });

  const updated = await prisma.application.update({
    where: { id: app.id },
    data: {
      ...(startupName ? { startupName } : {}),
      ...(idea ? { idea } : {}),
      ...(industry ? { industry } : {}),
    },
  });

  await prisma.activity.create({
    data: { applicationId: app.id, actorName: user.name, actorRole: user.role, action: 'edited application' },
  });

  return NextResponse.json({ success: true, application: withId(updated) });
}
