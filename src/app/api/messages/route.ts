// Application thread (incubatee ↔ office), used by the Approvals side panel.
// Same rules as /api/chat?type=application: only the applicant and the office.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { withId, isId } from '@/lib/serialize';
import { threadAccess, notifyNewMessage } from '@/lib/chat';
import { audit } from '@/lib/audit';

// GET /api/messages?applicationId=xxx
export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const applicationId = req.nextUrl.searchParams.get('applicationId');
  if (!isId(applicationId)) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

  const access = await threadAccess(user, 'application', applicationId);
  if (!access.canRead) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const messages = await prisma.message.findMany({ where: { applicationId }, orderBy: { createdAt: 'asc' } });
  await prisma.message.updateMany({
    where: { applicationId, senderId: { not: user.userId }, read: false },
    data: { read: true },
  });
  return NextResponse.json({ messages: withId(messages) });
}

// POST /api/messages { applicationId, content }
export async function POST(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { applicationId, content } = await req.json();
  const text = typeof content === 'string' ? content.trim() : '';
  if (!isId(applicationId) || !text) {
    return NextResponse.json({ error: 'applicationId and content required' }, { status: 400 });
  }
  if (text.length > 2000) return NextResponse.json({ error: 'Keep messages under 2000 characters' }, { status: 400 });

  const access = await threadAccess(user, 'application', applicationId);
  if (!access.canPost) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const message = await prisma.message.create({
    data: { applicationId, senderId: user.userId, senderName: user.name, senderRole: user.role, content: text },
  });
  await notifyNewMessage(user, access, 'application');
  await audit(req, user, 'message.send', 'message', message.id, `Sent a message in application thread ${applicationId}`);
  return NextResponse.json({ success: true, message: withId(message) });
}
