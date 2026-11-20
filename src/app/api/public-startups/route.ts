import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withId } from '@/lib/serialize';

// Never cache at build time; the directory changes whenever an app is published.
export const dynamic = 'force-dynamic';

export async function GET() {
  const startups = await prisma.application.findMany({
    where: { isPublic: true, status: 'approved' },
    select: { id: true, startupName: true, applicantName: true, idea: true, industry: true, isFastTracked: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ startups: withId(startups) });
}
