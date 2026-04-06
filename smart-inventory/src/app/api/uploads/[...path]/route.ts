import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { checkAuth } from '@/lib/api-auth';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { error } = await checkAuth();
    if (error) return error;

    const { path: segments } = await params;
    const filePath = segments.join('/');

    // Prevent directory traversal
    if (filePath.includes('..') || filePath.includes('~')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const fullPath = path.join(process.cwd(), 'uploads', filePath);

    // Verify the resolved path is still within uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(uploadsDir))) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Check file exists
    try {
      await stat(fullPath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Determine content type
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const fileBuffer = await readFile(fullPath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
