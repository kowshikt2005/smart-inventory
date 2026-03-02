import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SYSTEM_USER_ID } from '@/lib/order-utils';
import { checkPermission } from '@/lib/api-auth';

// POST /api/system/setup - Create system user if not exists
export async function POST() {
  try {
    const { error } = await checkPermission('settings', 'edit');
    if (error) return error;

    // Check if system user already exists
    const existingUser = await db.user.findUnique({
      where: { id: SYSTEM_USER_ID },
    });

    if (existingUser) {
      return NextResponse.json({
        message: 'System user already exists',
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
      });
    }

    // Create system user
    const systemUser = await db.user.create({
      data: {
        id: SYSTEM_USER_ID,
        email: 'system@ledgerzen.local',
        name: 'System',
        password: 'not-for-login', // Cannot be used for actual login
        role: 'ADMIN',
        isActive: true,
      },
    });

    return NextResponse.json({
      message: 'System user created successfully',
      user: {
        id: systemUser.id,
        email: systemUser.email,
        name: systemUser.name,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error setting up system user:', error);

    // Handle unique constraint violation
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json({
        message: 'System user already exists (email conflict)',
      });
    }

    return NextResponse.json(
      { error: 'Failed to setup system user' },
      { status: 500 }
    );
  }
}

// GET /api/system/setup - Check if system user exists
export async function GET() {
  try {
    const { error } = await checkPermission('settings', 'view');
    if (error) return error;

    const systemUser = await db.user.findUnique({
      where: { id: SYSTEM_USER_ID },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    if (systemUser) {
      return NextResponse.json({
        exists: true,
        user: systemUser,
      });
    }

    return NextResponse.json({
      exists: false,
      message: 'System user not found. Call POST to create.',
    });
  } catch (error) {
    console.error('Error checking system user:', error);
    return NextResponse.json(
      { error: 'Failed to check system user' },
      { status: 500 }
    );
  }
}
