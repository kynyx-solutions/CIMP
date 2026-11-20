import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { withId, isId } from '@/lib/serialize';
import { APPROVAL_RANK, ROLE_LABELS } from '@/lib/workflow';

function getUser(req: NextRequest) {
  const token = req.cookies.get('incubator_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET /api/messages?applicationId=xxx
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const applicationId = req.nextUrl.searchParams.get('applicationId');
  if (!isId(applicationId)) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

  // Verify access: incubatee can only see their own app's messages
  if (user.role === 'incubatee') {
    const app = await prisma.application.findFirst({ where: { id: applicationId, userId: user.userId } });
    if (!app) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const messages = await prisma.message.findMany({ where: { applicationId }, orderBy: { createdAt: 'asc' } });

  // Mark messages from others as read
  await prisma.message.updateMany({
    where: { applicationId, senderId: { not: user.userId }, read: false },
    data: { read: true },
  });

  return NextResponse.json({ messages: withId(messages) });
}

// POST /api/messages
export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { applicationId, content } = await req.json();
  if (!isId(applicationId) || !content?.trim()) {
    return NextResponse.json({ error: 'applicationId and content required' }, { status: 400 });
  }

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  if (user.role === 'incubatee' && app.userId !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const message = await prisma.message.create({
    data: {
      applicationId, senderId: user.userId, senderName: user.name, senderRole: user.role,
      content: content.trim(),
    },
  });

  // Notify the other party
  if (user.role === 'incubatee') {
    // office users with approval authority
    const reviewers = await prisma.user.findMany({
      where: { role: { in: Object.keys(APPROVAL_RANK) } }, select: { id: true },
    });
    if (reviewers.length) {
      await prisma.notification.createMany({
        data: reviewers.map(r => ({
          userId: r.id, title: 'New Message', type: 'info', applicationId: app.id,
          message: `${user.name} sent a message about "${app.startupName}"`,
        })),
      });
    }
  } else {
    await prisma.notification.create({
      data: {
        userId: app.userId, title: 'New Message', type: 'info', applicationId: app.id,
        message: `${user.name} (${ROLE_LABELS[user.role] ?? user.role}) sent you a message about "${app.startupName}"`,
      },
    });
  }

  return NextResponse.json({ success: true, message: withId(message) });
}
