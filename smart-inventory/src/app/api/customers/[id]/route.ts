import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/customers/[id] - Get a single customer by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id);

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    const customer = await db.customer.findUnique({
      where: { id: customerId },
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
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id);

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Check if customer exists
    const existingCustomer = await db.customer.findUnique({
      where: { id: customerId },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Validate GSTIN format if provided
    if (body.gstin && body.gstin.length !== 15) {
      return NextResponse.json(
        { error: 'GSTIN must be exactly 15 characters' },
        { status: 400 }
      );
    }

    // Validate state code if provided
    if (body.stateCode && body.stateCode.length !== 2) {
      return NextResponse.json(
        { error: 'State code must be exactly 2 characters' },
        { status: 400 }
      );
    }

    // Update customer
    const customer = await db.customer.update({
      where: { id: customerId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.gstin && { gstin: body.gstin }),
        ...(body.state && { state: body.state }),
        ...(body.stateCode && { stateCode: body.stateCode }),
        ...(body.city && { city: body.city }),
        ...(body.addressLine1 && { addressLine1: body.addressLine1 }),
        ...(body.addressLine2 !== undefined && {
          addressLine2: body.addressLine2 || null,
        }),
        ...(body.openingBalance !== undefined && {
          openingBalance: body.openingBalance,
        }),
        ...(body.openingAsOfDate && {
          openingAsOfDate: new Date(body.openingAsOfDate),
        }),
        ...(body.creditDays !== undefined && { creditDays: body.creditDays }),
        ...(body.creditLimit !== undefined && {
          creditLimit: body.creditLimit,
        }),
        ...(body.hasPriceList !== undefined && {
          hasPriceList: body.hasPriceList,
        }),
        ...(body.rateSheet !== undefined && {
          rateSheet: body.rateSheet || null,
        }),
      },
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
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id);

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    // Check if customer exists
    const existingCustomer = await db.customer.findUnique({
      where: { id: customerId },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Delete customer
    await db.customer.delete({
      where: { id: customerId },
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
