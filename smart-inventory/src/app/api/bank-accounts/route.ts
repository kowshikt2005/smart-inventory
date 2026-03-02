import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/bank-accounts - List bank accounts
export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('bank_accounts', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const where: any = {};

    if (activeOnly) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { accountName: { contains: search } },
        { bankName: { contains: search } },
        { accountNumber: { contains: search } },
      ];
    }

    const bankAccounts = await db.bankAccount.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { accountName: 'asc' },
      ],
    });

    return NextResponse.json({ bankAccounts });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank accounts' },
      { status: 500 }
    );
  }
}

// POST /api/bank-accounts - Create bank account
export async function POST(request: Request) {
  try {
    const { error } = await checkPermission('bank_accounts', 'edit');
    if (error) return error;

    const body = await request.json();

    if (!body.accountName) {
      return NextResponse.json(
        { error: 'Account name is required' },
        { status: 400 }
      );
    }

    if (!body.accountNumber) {
      return NextResponse.json(
        { error: 'Account number is required' },
        { status: 400 }
      );
    }

    if (!body.bankName) {
      return NextResponse.json(
        { error: 'Bank name is required' },
        { status: 400 }
      );
    }

    const openingBalance = body.openingBalance ? Number(body.openingBalance) : 0;

    const bankAccount = await transaction(async (tx) => {
      const newAccount = await tx.bankAccount.create({
        data: {
          accountName: body.accountName,
          accountNumber: body.accountNumber,
          bankName: body.bankName,
          ifscCode: body.ifscCode || null,
          branch: body.branch || null,
          accountType: body.accountType || 'SAVINGS',
          openingBalance,
          currentBalance: openingBalance,
          isDefault: body.isDefault || false,
        },
      });

      // Create opening balance ledger entry if opening balance > 0
      if (openingBalance > 0) {
        await tx.bankLedger.create({
          data: {
            bankAccountId: newAccount.id,
            date: new Date(),
            description: 'Opening Balance',
            type: 'OPENING_BALANCE',
            debit: 0,
            credit: openingBalance,
            balance: openingBalance,
            referenceType: 'opening_balance',
            referenceId: newAccount.id,
          },
        });
      }

      return newAccount;
    });

    return NextResponse.json(bankAccount, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating bank account:', error);

    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Account number already exists' },
        { status: 409 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create bank account';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
