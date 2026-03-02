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
  'application/pdf': '.pdf',
};

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// GET /api/employees/[id]/documents — list documents
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await checkPermission('masters_employees', 'view');
  if (error) return error;

  try {
    const { id } = await params;

    const employee = await db.employee.findUnique({ where: { id }, select: { id: true } });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const documents = await db.employeeDocument.findMany({
      where: { employeeId: id },
      orderBy: { uploadedAt: 'desc' },
    });

    return NextResponse.json(documents);
  } catch (err) {
    console.error('Error fetching documents:', err);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST /api/employees/[id]/documents — upload document
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
    const file = formData.get('file') as File | null;
    const label = (formData.get('label') as string)?.trim();

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!label) {
      return NextResponse.json({ error: 'Document label is required' }, { status: 400 });
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Save file
    const uploadDir = path.join(process.cwd(), 'uploads', 'employees');
    await mkdir(uploadDir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    const filepath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const fileUrl = `/api/uploads/employees/${filename}`;

    // Create document record
    const document = await db.employeeDocument.create({
      data: {
        employeeId: id,
        label,
        fileUrl,
        fileType: file.type,
        fileSize: file.size,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (err) {
    console.error('Error uploading document:', err);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
