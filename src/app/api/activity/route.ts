import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { withId, isId } from '@/lib/serialize';
import { isOfficeRole } from '@/lib/workflow';

function getUser(req: NextRequest) {
  const token = req.cookies.get('incubator_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET /api/activity?applicationId=xxx
export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const applicationId = req.nextUrl.searchParams.get('applicationId');
  if (!isId(applicationId)) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

  if (!isOfficeRole(user.role)) {
    const app = await prisma.application.findFirst({ where: { id: applicationId, userId: user.userId } });
    if (!app) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const activities = await prisma.activity.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ activities: withId(activities) });
}
