import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth-utils';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPin, newPin } = await request.json();

    if (!currentPin || !newPin) {
      return NextResponse.json(
        { error: 'Current PIN and new PIN are required' },
        { status: 400 }
      );
    }

    const newPinStr = String(newPin).replace(/\D/g, '');
    if (newPinStr.length !== 6) {
      return NextResponse.json(
        { error: 'New PIN must be exactly 6 digits' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, password: true, pin: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current PIN
    const storedPin = user.pin;

    if (storedPin) {
      const valid = await verifyPassword(currentPin, storedPin);
      if (!valid) {
        return NextResponse.json(
          { error: 'Current PIN is incorrect' },
          { status: 400 }
        );
      }
    } else {
      // No stored pin → user is on default PIN
      if (String(currentPin) !== '123456') {
        return NextResponse.json(
          { error: 'Current PIN is incorrect' },
          { status: 400 }
        );
      }
    }

    // Hash new PIN
    const hashedNewPin = await hashPassword(newPinStr);
    const placeholderPassword = await hashPassword('123456');

    // Update user
    await transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          pin: hashedNewPin,
          password: placeholderPassword,
        },
      });
    });

    return NextResponse.json({ message: 'PIN changed successfully' });
  } catch (error) {
    console.error('Error changing PIN:', error);
    return NextResponse.json(
      { error: 'Failed to change PIN' },
      { status: 500 }
    );
  }
}
