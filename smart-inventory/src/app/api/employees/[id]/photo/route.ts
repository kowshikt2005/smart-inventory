import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// POST /api/employees/[id]/photo — upload or replace profile photo
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await checkPermission('masters_employees', 'edit');
  if (error) return error;

  try {
    const { id } = await params;

    const employee = await db.employee.findUnique({ where: { id }, select: { id: true } });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'employees', 'photos');
    await mkdir(uploadDir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    const filepath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const photoUrl = `/api/uploads/employees/photos/${filename}`;

    const updated = await db.employee.update({
      where: { id },
      data: { photoUrl },
      select: { id: true, photoUrl: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error uploading employee photo:', err);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
