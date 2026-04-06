import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/bank-accounts/[id] - Get single bank account
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('bank_accounts', 'view');
    if (error) return error;

    const { id } = await params;

    const bankAccount = await db.bankAccount.findUnique({
      where: { id },
    });

    if (!bankAccount) {
      return NextResponse.json(
        { error: 'Bank account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(bankAccount);
  } catch (error) {
    console.error('Error fetching bank account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank account' },
      { status: 500 }
    );
  }
}

// PUT /api/bank-accounts/[id] - Update bank account
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('bank_accounts', 'edit');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    const existing = await db.bankAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Bank account not found' },
        { status: 404 }
      );
    }

    // Cannot change account type of CASH account
    if (existing.accountType === 'CASH' && body.accountType && body.accountType !== 'CASH') {
      return NextResponse.json(
        { error: 'Cannot change account type of Cash account' },
        { status: 400 }
      );
    }

    const updated = await db.bankAccount.update({
      where: { id },
      data: {
        ...(body.accountName && { accountName: body.accountName }),
        ...(body.accountNumber && { accountNumber: body.accountNumber }),
        ...(body.bankName && { bankName: body.bankName }),
        ...(body.ifscCode !== undefined && { ifscCode: body.ifscCode || null }),
        ...(body.branch !== undefined && { branch: body.branch || null }),
        ...(body.accountType && { accountType: body.accountType }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error('Error updating bank account:', error);

    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Account number already exists' },
        { status: 409 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to update bank account';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/bank-accounts/[id] - Soft-delete (deactivate) bank account
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: deleteError } = await checkPermission('bank_accounts', 'edit');
    if (deleteError) return deleteError;

    const { id } = await params;

    const existing = await db.bankAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Bank account not found' },
        { status: 404 }
      );
    }

    await db.bankAccount.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: 'Bank account deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating bank account:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate bank account' },
      { status: 500 }
    );
  }
}
