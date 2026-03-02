import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/api-auth';

// GET /api/reports/claim-report - Get claim report data
export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('reports', 'view');
    if (error) return error;
    const { searchParams } = new URL(request.url);

    // Parse filters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const brandId = searchParams.get('brandId') || '';
    const customerId = searchParams.get('customerId') || '';
    const productId = searchParams.get('productId') || '';
    const hideZeroClaims = searchParams.get('hideZeroClaims') === 'true';
    const usePrice = searchParams.get('usePrice') || 'sellingPrice'; // 'sellingPrice' or 'mrp'

    // Build where clause for invoices
    const where: any = {};

    // Date range filter (default to current month if not provided)
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    where.invoiceDate = {
      gte: startDate ? new Date(startDate) : defaultStartDate,
      lte: endDate ? new Date(endDate) : defaultEndDate,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    // Fetch invoices with items and related data
    const invoices = await db.invoice.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            item: {
              include: {
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                subBrand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        invoiceDate: 'desc',
      },
    });

    // Process invoice items to calculate claims
    const claimData: any[] = [];

    for (const invoice of invoices) {
      for (const invoiceItem of invoice.items) {
        const item = invoiceItem.item;

        // Apply filters
        if (brandId && item.brandId !== brandId) continue;
        if (productId && item.id !== productId) continue;

        // Calculate claim based on selected price type
        const mrp = Number(item.mrp);
        const sellingPrice = Number(item.sellingPrice);
        const soldRate = Number(invoiceItem.rate);
        const quantity = Number(invoiceItem.quantity);

        // Filter based on which price the invoice was generated from
        if (usePrice === 'mrp') {
          // For MRP claims: Only show if sold rate is between selling price and MRP
          // This indicates the invoice was priced based on MRP
          if (soldRate <= sellingPrice) continue; // Skip if priced at or below selling price
        } else {
          // For Selling Price claims: Only show if sold rate is at or below selling price
          // This indicates the invoice was priced based on selling price
          if (soldRate > sellingPrice) continue; // Skip if priced above selling price
        }

        // Use MRP or sellingPrice based on user selection
        const basePrice = usePrice === 'mrp' ? mrp : sellingPrice;
        const unitClaim = basePrice - soldRate;
        const totalClaim = unitClaim * quantity;

        // Skip if hideZeroClaims is true and claim is zero or negative
        if (hideZeroClaims && unitClaim <= 0) continue;

        claimData.push({
          date: invoice.invoiceDate,
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice.id,
          brand: item.brand?.name || 'N/A',
          brandId: item.brandId,
          subBrand: item.subBrand?.name || 'N/A',
          subBrandId: item.subBrandId,
          customer: invoice.customer.name,
          customerId: invoice.customerId,
          productName: item.name,
          productId: item.id,
          mrp: mrp,
          sellingPrice: sellingPrice,
          basePrice: basePrice, // The price used for claim calculation
          soldRate: soldRate,
          quantity: quantity,
          unitClaim: unitClaim,
          totalClaim: totalClaim,
        });
      }
    }

    return NextResponse.json({
      claims: claimData,
      summary: {
        totalRecords: claimData.length,
        totalClaimAmount: claimData.reduce((sum, claim) => sum + claim.totalClaim, 0),
      },
    });
  } catch (error) {
    console.error('Error fetching claim report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch claim report' },
      { status: 500 }
    );
  }
}
