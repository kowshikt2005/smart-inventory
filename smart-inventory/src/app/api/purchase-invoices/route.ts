import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { generatePurchaseInvoiceNumber, calculatePurchaseLineItem, calculatePurchaseTotals } from '@/lib/purchase-utils';
import { checkPermission } from '@/lib/api-auth';

// GET /api/purchase-invoices - Get all purchase invoices with filtering
export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('purchases_invoices', 'view');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const vendorId = searchParams.get('vendorId') || '';
    const purchaseOrderId = searchParams.get('purchaseOrderId') || '';
    const brandId = searchParams.get('brandId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (purchaseOrderId) {
      where.purchaseOrderId = purchaseOrderId;
    }

    if (brandId) {
      where.items = { some: { item: { brandId } } };
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { vendorName: { contains: search } },
        { vendor: { vendorNumber: { contains: search } } },
      ];
    }

    // Get purchase invoices with relations
    const [purchaseInvoices, total] = await Promise.all([
      db.purchaseInvoice.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              vendorNumber: true,
              name: true,
              gstin: true,
              city: true,
              state: true,
            },
          },
          purchaseOrder: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
            },
          },
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  unit: true,
                  hsnCode: true,
                  gstRate: true,
                  purchasePrice: true,
                },
              },
            },
          },
          vendorPayments: {
            select: {
              id: true,
              paymentNumber: true,
              amount: true,
              date: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      db.purchaseInvoice.count({ where }),
    ]);

    // Check for overdue invoices and compute effectiveStatus
    const now = new Date();
    const invoicesWithStatus = purchaseInvoices.map((invoice) => {
      let effectiveStatus = invoice.status;

      // If pending and past due date with outstanding balance, mark as overdue
      if (
        invoice.status === 'PENDING' &&
        invoice.dueDate &&
        new Date(invoice.dueDate) < now &&
        Number(invoice.balanceAmount) > 0
      ) {
        effectiveStatus = 'OVERDUE';
      }

      return {
        ...invoice,
        effectiveStatus,
      };
    });

    // Calculate server-side stats using database aggregation
    const [paidCount, overdueStats, pendingStats, totalInvoiceCount] = await Promise.all([
      db.purchaseInvoice.count({ where: { status: 'PAID' } }),
      db.purchaseInvoice.aggregate({
        where: {
          status: 'PENDING',
          dueDate: { lt: now },
          balanceAmount: { gt: 0 },
        },
        _count: true,
        _sum: { balanceAmount: true },
      }),
      db.purchaseInvoice.aggregate({
        where: {
          status: 'PENDING',
          OR: [
            { dueDate: { gte: now } },
            { balanceAmount: 0 },
          ],
        },
        _count: true,
        _sum: { balanceAmount: true },
      }),
      db.purchaseInvoice.count(),
    ]);

    const totalPayable =
      Number(overdueStats._sum.balanceAmount || 0) +
      Number(pendingStats._sum.balanceAmount || 0);

    return NextResponse.json({
      purchaseInvoices: invoicesWithStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total: totalInvoiceCount,
        pending: pendingStats._count,
        overdue: overdueStats._count,
        paid: paidCount,
        totalPayable,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase invoices' },
      { status: 500 }
    );
  }
}

// POST /api/purchase-invoices - Create a new purchase invoice
export async function POST(request: Request) {
  try {
    const { error } = await checkPermission('purchases_invoices', 'edit');
    if (error) return error;

    const body = await request.json();

    // Validate required fields
    if (!body.vendorId) {
      return NextResponse.json(
        { error: 'Vendor is required' },
        { status: 400 }
      );
    }

    if (!body.date) {
      return NextResponse.json(
        { error: 'Invoice date is required' },
        { status: 400 }
      );
    }

    if (!body.dueDate) {
      return NextResponse.json(
        { error: 'Due date is required' },
        { status: 400 }
      );
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      );
    }

    // Validate invoice date is not in the future
    const invoiceDate = new Date(body.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (invoiceDate > today) {
      return NextResponse.json(
        { error: 'Invoice date cannot be in the future' },
        { status: 400 }
      );
    }

    // Validate vendor exists and is active
    const vendor = await db.vendor.findUnique({
      where: { id: body.vendorId },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    if (!vendor.isActive) {
      return NextResponse.json(
        { error: 'Cannot create invoice for inactive vendor' },
        { status: 400 }
      );
    }

    // Validate purchase order if provided
    let purchaseOrder = null;
    if (body.purchaseOrderId) {
      purchaseOrder = await db.purchaseOrder.findUnique({
        where: { id: body.purchaseOrderId },
      });

      if (!purchaseOrder) {
        return NextResponse.json(
          { error: 'Purchase order not found' },
          { status: 404 }
        );
      }

      if (purchaseOrder.vendorId !== body.vendorId) {
        return NextResponse.json(
          { error: 'Purchase order belongs to a different vendor' },
          { status: 400 }
        );
      }

      if (purchaseOrder.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'Cannot create invoice for cancelled purchase order' },
          { status: 400 }
        );
      }
    }

    // Validate all items exist
    const itemIds = body.items.map((item: any) => item.itemId);
    const items = await db.item.findMany({
      where: { id: { in: itemIds } },
      include: { inventory: true },
    });

    if (items.length !== itemIds.length) {
      return NextResponse.json(
        { error: 'One or more items not found' },
        { status: 400 }
      );
    }

    // Validate quantities and rates
    for (const invoiceItem of body.items) {
      if (!invoiceItem.quantity || invoiceItem.quantity <= 0) {
        return NextResponse.json(
          { error: 'All quantities must be greater than 0' },
          { status: 400 }
        );
      }
      if (!invoiceItem.rate || invoiceItem.rate <= 0) {
        return NextResponse.json(
          { error: 'All rates must be greater than 0' },
          { status: 400 }
        );
      }
    }

    // Create invoice in a transaction
    const purchaseInvoice = await transaction(async (tx) => {
      // Generate invoice number
      const invoiceNumber = await generatePurchaseInvoiceNumber(tx as any);

      // Calculate item totals
      const invoiceItems = body.items.map((invoiceItem: any) => {
        const item = items.find((i) => i.id === invoiceItem.itemId)!;
        const taxRate = invoiceItem.taxRate ?? Number(item.gstRate);
        const { amount, taxAmount } = calculatePurchaseLineItem(
          invoiceItem.quantity,
          invoiceItem.rate,
          taxRate
        );

        return {
          itemId: invoiceItem.itemId,
          quantity: invoiceItem.quantity,
          rate: invoiceItem.rate,
          taxRate,
          taxAmount,
          amount,
        };
      });

      // Calculate invoice totals
      const { subtotal, totalTax, totalAmount } = calculatePurchaseTotals(invoiceItems);

      // Create the purchase invoice
      const invoice = await tx.purchaseInvoice.create({
        data: {
          invoiceNumber,
          vendorId: body.vendorId,
          vendorName: vendor.name,
          purchaseOrderId: body.purchaseOrderId || null,
          date: new Date(body.date),
          dueDate: new Date(body.dueDate),
          amount: subtotal,
          taxAmount: totalTax,
          totalAmount,
          paidAmount: 0,
          balanceAmount: totalAmount,
          status: 'PENDING',
          notes: body.notes || null,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          vendor: {
            select: {
              id: true,
              vendorNumber: true,
              name: true,
            },
          },
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
        },
      });

      // Update inventory - increase physical stock for each item
      for (const invoiceItem of invoiceItems) {
        const item = items.find((i) => i.id === invoiceItem.itemId)!;

        if (item.inventory) {
          // Update existing inventory
          await tx.inventory.update({
            where: { itemId: invoiceItem.itemId },
            data: {
              physicalStock: {
                increment: invoiceItem.quantity,
              },
            },
          });
        } else {
          // Create inventory record if it doesn't exist
          await tx.inventory.create({
            data: {
              itemId: invoiceItem.itemId,
              physicalStock: invoiceItem.quantity,
              reservedQuantity: 0,
              minStockLevel: 0,
            },
          });
        }

        // Create stock movement record
        const inventory = await tx.inventory.findUnique({
          where: { itemId: invoiceItem.itemId },
        });

        if (inventory) {
          await tx.stockMovement.create({
            data: {
              inventoryId: inventory.id,
              itemId: invoiceItem.itemId,
              quantity: invoiceItem.quantity,
              type: 'PURCHASE',
              referenceType: 'PURCHASE_INVOICE',
              referenceId: invoice.id,
              notes: `Purchase invoice ${invoiceNumber}`,
            },
          });
        }
      }

      // Get the last ledger entry for this vendor to calculate running balance
      const lastLedgerEntry = await tx.vendorLedger.findFirst({
        where: { vendorId: body.vendorId },
        orderBy: { createdAt: 'desc' },
      });

      const previousBalance = lastLedgerEntry ? Number(lastLedgerEntry.balance) : Number(vendor.openingBalance);
      // Purchase invoice increases what we owe to vendor (credit to vendor = we owe more)
      const newBalance = previousBalance + totalAmount;

      // Create vendor ledger entry
      await tx.vendorLedger.create({
        data: {
          vendorId: body.vendorId,
          date: new Date(body.date),
          description: `Purchase Invoice ${invoiceNumber}`,
          type: 'PURCHASE_INVOICE',
          debit: 0,
          credit: totalAmount, // Credit means we owe the vendor
          balance: newBalance,
          referenceType: 'purchase_invoice',
          referenceId: invoice.id,
        },
      });

      // Update purchase order status if linked
      if (purchaseOrder) {
        // Check total invoiced amount for this PO
        const totalInvoiced = await tx.purchaseInvoice.aggregate({
          where: { purchaseOrderId: purchaseOrder.id },
          _sum: { totalAmount: true },
        });

        const invoicedAmount = Number(totalInvoiced._sum.totalAmount || 0);
        const poTotal = Number(purchaseOrder.totalAmount);

        if (invoicedAmount >= poTotal) {
          await tx.purchaseOrder.update({
            where: { id: purchaseOrder.id },
            data: { status: 'RECEIVED' },
          });
        } else if (invoicedAmount > 0) {
          await tx.purchaseOrder.update({
            where: { id: purchaseOrder.id },
            data: { status: 'PARTIAL' },
          });
        }
      }

      return invoice;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json(purchaseInvoice, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating purchase invoice:', error);

    const prismaError = error as { code?: string; message?: string };

    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Invoice number already exists' },
        { status: 409 }
      );
    }

    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Related record not found. Please check that all items and vendor exist.' },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to create purchase invoice';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
