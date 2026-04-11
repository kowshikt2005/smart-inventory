import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';
import { normalizeGstin, validateGstin } from '@/lib/gst-validation';
import { hashPassword } from '@/lib/auth-utils';

function normalizeCustomerPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.length > 10 ? digits.slice(-10) : digits;
  if (last10.length !== 10) {
    throw new Error('Please enter a valid 10-digit phone number');
  }
  return `+91${last10}`;
}

function splitAddress(address: string | null | undefined) {
  if (!address) {
    return { addressLine1: '', addressLine2: '' };
  }

  const [line1, ...rest] = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    addressLine1: line1 || '',
    addressLine2: rest.join(', '),
  };
}

function getStateCodeFromGstin(gstin: string | null | undefined) {
  if (!gstin) return '';
  const normalized = normalizeGstin(gstin);
  return normalized.length >= 2 ? normalized.slice(0, 2) : '';
}

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
        rateSheets: { include: { rateSheet: true } },
        preferredBrands: { select: { brandId: true } },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Never expose the hashed PIN — replace with a boolean for the UI
    const { portalPassword, ...customerData } = customer;
    const { addressLine1, addressLine2 } = splitAddress(customer.address);
    return NextResponse.json({
      ...customerData,
      addressLine1,
      addressLine2,
      stateCode: getStateCodeFromGstin(customer.gstin),
      hasPortalPin: portalPassword !== null,
    });
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
    const normalizedGstin = hasGstinField ? normalizeGstin(body.gstin || '') : null;

    if (hasGstinField) {
      const gstValidation = validateGstin(normalizedGstin || '');
      if (!gstValidation.valid) {
        return NextResponse.json(
          { error: gstValidation.error },
          { status: 400 }
        );
      }
    }

    // Validate financial fields
    if (body.creditLimit !== undefined && Number(body.creditLimit) < 0) {
      return NextResponse.json({ error: 'Credit limit cannot be negative' }, { status: 400 });
    }
    if (body.creditDays !== undefined && Number(body.creditDays) < 0) {
      return NextResponse.json({ error: 'Credit days cannot be negative' }, { status: 400 });
    }
    if (body.openingBalance !== undefined && Number(body.openingBalance) < 0) {
      return NextResponse.json({ error: 'Opening balance cannot be negative' }, { status: 400 });
    }

    // Build update data
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.contactName !== undefined) updateData.contactName = body.contactName || null;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.phone !== undefined) {
      if (!body.phone || !String(body.phone).trim()) {
        updateData.phone = null;
      } else {
        try {
          updateData.phone = normalizeCustomerPhone(String(body.phone));
        } catch (error) {
          return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Invalid phone number' },
            { status: 400 }
          );
        }
      }
    }
    if (hasGstinField) updateData.gstin = normalizedGstin;
    if (
      body.address !== undefined ||
      body.addressLine1 !== undefined ||
      body.addressLine2 !== undefined
    ) {
      if (
        body.address !== undefined &&
        body.addressLine1 === undefined &&
        body.addressLine2 === undefined
      ) {
        updateData.address = body.address || null;
      } else {
        const existingAddress = splitAddress(existingCustomer.address);
        const addressLine1 = String(body.addressLine1 ?? existingAddress.addressLine1).trim();
        const addressLine2 = String(body.addressLine2 ?? existingAddress.addressLine2).trim();
        const combinedAddress = [addressLine1, addressLine2].filter(Boolean).join(', ');
        updateData.address = combinedAddress || null;
      }
    }
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
    if (body.portalPassword !== undefined) {
      // Allow null/empty (clears PIN) or exactly 6 digits
      if (body.portalPassword && !/^\d{6}$/.test(body.portalPassword)) {
        return NextResponse.json({ error: "Portal PIN must be exactly 6 digits" }, { status: 400 });
      }
      // Hash before storing; null clears portal access
      updateData.portalPassword = body.portalPassword
        ? await hashPassword(body.portalPassword)
        : null;
    }

    // Handle preferred brands update (array of brand IDs)
    if (Array.isArray(body.preferredBrandIds)) {
      await db.$transaction([
        db.customerPreferredBrand.deleteMany({ where: { customerId: id } }),
        ...(body.preferredBrandIds.length > 0
          ? [db.customerPreferredBrand.createMany({
              data: body.preferredBrandIds.map((brandId: string) => ({ customerId: id, brandId })),
              skipDuplicates: true,
            })]
          : []),
      ]);
    }

    // Update customer
    const updated = await db.customer.update({
      where: { id },
      data: updateData,
      include: {
        rateSheets: { include: { rateSheet: true } },
        preferredBrands: { select: { brandId: true } },
      },
    });

    const { portalPassword, ...updatedData } = updated;
    const { addressLine1, addressLine2 } = splitAddress(updated.address);
    return NextResponse.json({
      ...updatedData,
      addressLine1,
      addressLine2,
      stateCode: getStateCodeFromGstin(updated.gstin),
      hasPortalPin: portalPassword !== null,
    });
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
