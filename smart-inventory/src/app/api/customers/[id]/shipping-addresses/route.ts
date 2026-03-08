import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/customers/[id]/shipping-addresses
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_customers', 'view');
    if (error) return error;
    const { id } = await params;

    const addresses = await db.customerShippingAddress.findMany({
      where: { customerId: id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('Error fetching shipping addresses:', error);
    return NextResponse.json({ error: 'Failed to fetch shipping addresses' }, { status: 500 });
  }
}

// POST /api/customers/[id]/shipping-addresses
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_customers', 'edit');
    if (error) return error;
    const { id } = await params;
    const body = await request.json();

    if (!body.label || !body.address) {
      return NextResponse.json({ error: 'Label and address are required' }, { status: 400 });
    }

    // If this is set as default, unset all other defaults
    if (body.isDefault) {
      await db.customerShippingAddress.updateMany({
        where: { customerId: id },
        data: { isDefault: false },
      });
    }

    const address = await db.customerShippingAddress.create({
      data: {
        customerId: id,
        label: body.label,
        address: body.address,
        city: body.city || null,
        state: body.state || null,
        pincode: body.pincode || null,
        isDefault: body.isDefault || false,
      },
    });

    return NextResponse.json(address, { status: 201 });
  } catch (error) {
    console.error('Error creating shipping address:', error);
    return NextResponse.json({ error: 'Failed to create shipping address' }, { status: 500 });
  }
}
