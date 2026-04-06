import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// PUT /api/customers/[id]/shipping-addresses/[addressId]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { error } = await checkPermission('masters_customers', 'edit');
    if (error) return error;
    const { id, addressId } = await params;
    const body = await request.json();

    const existing = await db.customerShippingAddress.findUnique({
      where: { id: addressId, customerId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Shipping address not found' }, { status: 404 });
    }

    // If setting as default, unset others
    if (body.isDefault) {
      await db.customerShippingAddress.updateMany({
        where: { customerId: id, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const updated = await db.customerShippingAddress.update({
      where: { id: addressId },
      data: {
        label: body.label ?? existing.label,
        address: body.address ?? existing.address,
        city: body.city !== undefined ? body.city : existing.city,
        state: body.state !== undefined ? body.state : existing.state,
        pincode: body.pincode !== undefined ? body.pincode : existing.pincode,
        contactName: body.contactName !== undefined ? body.contactName : existing.contactName,
        contactPhone: body.contactPhone !== undefined ? body.contactPhone : existing.contactPhone,
        isDefault: body.isDefault !== undefined ? body.isDefault : existing.isDefault,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating shipping address:', error);
    return NextResponse.json({ error: 'Failed to update shipping address' }, { status: 500 });
  }
}

// DELETE /api/customers/[id]/shipping-addresses/[addressId]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { error } = await checkPermission('masters_customers', 'edit');
    if (error) return error;
    const { id, addressId } = await params;

    const existing = await db.customerShippingAddress.findUnique({
      where: { id: addressId, customerId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Shipping address not found' }, { status: 404 });
    }

    await db.customerShippingAddress.delete({ where: { id: addressId } });

    return NextResponse.json({ message: 'Shipping address deleted' });
  } catch (error) {
    console.error('Error deleting shipping address:', error);
    return NextResponse.json({ error: 'Failed to delete shipping address' }, { status: 500 });
  }
}
