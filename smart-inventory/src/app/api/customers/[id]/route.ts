import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';
import { normalizeGstin, validateGstin } from '@/lib/gst-validation';

// GET /api/customers/[id] - Get a single customer by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_customers', 'view');
    if (error) return error;
    const { id } = await params;

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        rateSheets: {
          include: {
            rateSheet: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

// PUT /api/customers/[id] - Update a customer
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_customers', 'edit');
    if (error) return error;
    const { id } = await params;
    const body = await request.json();

    // Check if customer exists
    const existingCustomer = await db.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const hasGstinField = body.gstin !== undefined;
    const normalizedGstin = hasGstinField
      ? normalizeGstin(body.gstin || '')
      : normalizeGstin(existingCustomer.gstin || '');

    const gstValidation = validateGstin(normalizedGstin);
    if (!gstValidation.valid) {
      return NextResponse.json(
        { error: gstValidation.error },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.contactName !== undefined) updateData.contactName = body.contactName || null;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (hasGstinField) updateData.gstin = normalizedGstin;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.city !== undefined) updateData.city = body.city || null;
    if (body.state !== undefined) updateData.state = body.state || null;
    if (body.pincode !== undefined) updateData.pincode = body.pincode || null;
    if (body.creditLimit !== undefined) updateData.creditLimit = body.creditLimit;
    if (body.creditDays !== undefined) updateData.creditDays = body.creditDays;
    if (body.openingBalance !== undefined) updateData.openingBalance = body.openingBalance;
    if (body.status !== undefined) {
      if (!['ACTIVE', 'INACTIVE'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      updateData.status = body.status;
    }

    // Update customer
    const customer = await db.customer.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Error updating customer:', error);

    // Handle unique constraint violation (duplicate GSTIN)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A customer with this GSTIN already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

// DELETE /api/customers/[id] - Delete a customer
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_customers', 'edit');
    if (error) return error;
    const { id } = await params;

    // Check if customer exists
    const existingCustomer = await db.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Delete customer
    await db.customer.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
