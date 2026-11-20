import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { isId } from '@/lib/serialize';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

function getUser(req: NextRequest) {
  const token = req.cookies.get('incubator_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'incubatee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const applicationId = formData.get('applicationId') as string;

    if (!file || !isId(applicationId)) {
      return NextResponse.json({ error: 'file and applicationId required' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    const app = await prisma.application.findFirst({ where: { id: applicationId, userId: user.userId } });
    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!app.isEditable) return NextResponse.json({ error: 'Application is locked' }, { status: 400 });

    // Save file to public/uploads (demo only; Phase 1 uses S3 presigned uploads)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const ext = file.name.split('.').pop() || 'pdf';
    const filename = `${applicationId}-pitch.${ext}`;
    const filepath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const pitchDeckUrl = `/uploads/${filename}`;
    await prisma.application.update({
      where: { id: app.id },
      data: { pitchDeckUrl, pitchDeckName: file.name },
    });

    await prisma.activity.create({
      data: { applicationId, actorName: user.name, actorRole: user.role, action: 'uploaded pitch deck', detail: file.name },
    });

    return NextResponse.json({ success: true, url: pitchDeckUrl, name: file.name });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
