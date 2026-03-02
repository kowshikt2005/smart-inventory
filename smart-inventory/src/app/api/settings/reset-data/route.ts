import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { compare } from 'bcryptjs';
import { checkPermission } from '@/lib/api-auth';

// POST /api/settings/reset-data - Wipe all business data, keep users
export async function POST(request: Request) {
  try {
    const { error, session } = await checkPermission('settings', 'edit');
    if (error) return error;

    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Verify admin password
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isValid = await compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 401 }
      );
    }

    // Delete all data in correct FK order (children first)
    await db.$transaction([
      // Ledger entries
      db.bankLedger.deleteMany(),
      db.customerLedger.deleteMany(),
      db.vendorLedger.deleteMany(),

      // Payment allocations and payments
      db.paymentAllocation.deleteMany(),
      db.payment.deleteMany(),
      db.vendorPayment.deleteMany(),

      // Sales returns
      db.salesReturnItem.deleteMany(),
      db.salesReturn.deleteMany(),

      // Purchase returns
      db.purchaseReturnItem.deleteMany(),
      db.purchaseReturn.deleteMany(),

      // Sales invoices
      db.invoiceItem.deleteMany(),
      db.invoice.deleteMany(),

      // Purchase invoices
      db.purchaseInvoiceItem.deleteMany(),
      db.purchaseInvoice.deleteMany(),

      // Sales orders
      db.salesOrderItem.deleteMany(),
      db.orderStatusHistory.deleteMany(),
      db.salesOrder.deleteMany(),

      // Purchase orders
      db.purchaseOrderItem.deleteMany(),
      db.purchaseOrder.deleteMany(),

      // Stock
      db.stockJournal.deleteMany(),
      db.stockMovement.deleteMany(),
      db.inventory.deleteMany(),

      // Items & brands
      db.item.deleteMany(),
      db.subBrand.deleteMany(),
      db.brand.deleteMany(),

      // Rate sheets
      db.rateSheetCustomer.deleteMany(),
      db.rateSheet.deleteMany(),

      // Customers & vendors
      db.customer.deleteMany(),
      db.vendor.deleteMany(),

      // Employees
      db.employee.deleteMany(),

      // Bank accounts
      db.bankAccount.deleteMany(),

      // App settings (will re-create defaults)
      db.appSetting.deleteMany(),
    ]);

    // Re-create default app settings
    await db.appSetting.create({
      data: {
        key: 'negative_billing',
        value: 'false',
        label: 'Negative Billing',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'All business data has been reset. User accounts are preserved.',
    });
  } catch (error) {
    console.error('Error resetting data:', error);
    return NextResponse.json(
      { error: 'Failed to reset data. Please try again.' },
      { status: 500 }
    );
  }
}
