// Test Prisma client in Next.js environment
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    console.log('Testing Prisma client...');
    
    // Simple test query
    const result = await db.$queryRaw`SELECT 1 as test`;
    console.log('Prisma query result:', result);
    
    // Test purchase orders count
    const count = await db.purchaseOrder.count();
    console.log('Purchase orders count:', count);
    
    return NextResponse.json({
      success: true,
      message: 'Prisma client working!',
      testResult: result,
      orderCount: count
    });
    
  } catch (error: any) {
    console.error('Prisma test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code
    }, { status: 500 });
  }
}