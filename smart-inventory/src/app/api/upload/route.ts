import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import { checkAuth } from '@/lib/api-auth';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const requestId = randomUUID();
  let folder = 'items';
  let fileMeta: { name: string; type: string; size: number } | null = null;
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        {
          error: 'No file provided',
          code: 'UPLOAD_NO_FILE',
          requestId,
        },
        { status: 400 }
      );
    }

    fileMeta = {
      name: file.name,
      type: file.type,
      size: file.size,
    };

    // Validate file type
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.',
          code: 'UPLOAD_INVALID_TYPE',
          requestId,
          diagnostics: {
            receivedType: file.type || 'unknown',
            fileName: file.name,
            allowedTypes: Object.keys(ALLOWED_TYPES),
          },
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large. Maximum size is 10MB.',
          code: 'UPLOAD_FILE_TOO_LARGE',
          requestId,
          diagnostics: {
            fileName: file.name,
            fileSize: file.size,
            maxSize: MAX_SIZE,
          },
        },
        { status: 400 }
      );
    }

    // Determine upload folder
    folder = (formData.get('folder') as string) || 'items';
    const VALID_FOLDERS = ['items', 'brands', 'employees'];
    if (!VALID_FOLDERS.includes(folder)) {
      return NextResponse.json(
        {
          error: `Invalid folder. Allowed: ${VALID_FOLDERS.join(', ')}`,
          code: 'UPLOAD_INVALID_FOLDER',
          requestId,
          diagnostics: {
            folder,
            allowedFolders: VALID_FOLDERS,
          },
        },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'uploads', folder);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const filename = `${randomUUID()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Return the URL path for serving the file
    const url = `/api/uploads/${folder}/${filename}`;

    return NextResponse.json({ url, requestId });
  } catch (error) {
    console.error('[upload] failed', {
      requestId,
      folder,
      fileMeta,
      error,
    });

    return NextResponse.json(
      {
        error: 'Failed to upload file',
        code: 'UPLOAD_INTERNAL_ERROR',
        requestId,
      },
      { status: 500 }
    );
  }
}
