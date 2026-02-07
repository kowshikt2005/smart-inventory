import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateReturnNumber } from '@/lib/invoice-utils';

export async function GET() {
  try {
    const nextReturnNumber = await generateReturnNumber(db);
    return NextResponse.json({ returnNumber: nextReturnNumber });
  } catch (error) {
    console.error('Error generating next return number:', error);
    return NextResponse.json(
      { error: 'Failed to generate return number' },
      { status: 500 }
    );
  }
}
