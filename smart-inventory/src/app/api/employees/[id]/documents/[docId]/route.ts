import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';
import { unlink } from 'fs/promises';
import path from 'path';

// DELETE /api/employees/[id]/documents/[docId]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { error } = await checkPermission('masters_employees', 'edit');
  if (error) return error;

  try {
    const { id, docId } = await params;

    const document = await db.employeeDocument.findFirst({
      where: { id: docId, employeeId: id },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete file from disk
    try {
      const urlPath = document.fileUrl.replace('/api/uploads/', '');
      const filePath = path.join(process.cwd(), 'uploads', urlPath);
      await unlink(filePath);
    } catch {
      // File may already be deleted — continue with DB cleanup
    }

    // Delete record
    await db.employeeDocument.delete({ where: { id: docId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting document:', err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
