# Implementation Guide: Partial Invoicing & FIFO Ledgers

## Overview

This guide walks through implementing:
1. **Partial Quantity Invoicing** - Allow creating multiple invoices from a single sales order
2. **FIFO Ledger Management** - First-In-First-Out ordering for customer, vendor, and stock ledgers

---

## 📋 Prerequisites

- **Database Backup**: Create a backup before running migrations
- **Server Access**: You'll need to stop/restart the development server
- **Database Access**: Direct MySQL/database access for running migration SQL

---

## 🚀 Implementation Steps

### Step 1: Stop the Development Server

```bash
# Stop your running dev server (Ctrl+C if running)
# OR kill the process
```

### Step 2: Backup Your Database

```bash
# MySQL backup example
mysqldump -u your_username -p your_database > backup_$(date +%Y%m%d_%H%M%S).sql

# OR use your database provider's backup tool
```

### Step 3: Update Prisma Schema

The schema has already been updated in `prisma/schema.prisma`. Key changes:

```prisma
// 1. New enum values for SalesOrderStatus
enum SalesOrderStatus {
  OPEN
  HOLD
  REJECTED
  PARTIALLY_INVOICED  // NEW
  FULLY_INVOICED      // NEW
}

// 2. Invoice can link to multiple orders (removed @unique)
model Invoice {
  salesOrderId String? // No longer @unique
  invoices     Invoice[] // Multiple invoices allowed
}

// 3. Track invoiced quantity per order item
model SalesOrderItem {
  invoicedQuantity Decimal @default(0) @db.Decimal(15, 3) // NEW
}

// 4. Link invoice items to order items
model InvoiceItem {
  salesOrderItemId String? // NEW - tracks which order item this came from
}
```

### Step 4: Run Database Migration

**Option A: Using Migration SQL (Recommended)**

```bash
# Navigate to your project directory
cd C:\Users\kowsh\Desktop\ledger\smart-inventory

# Connect to your MySQL database
mysql -u your_username -p your_database_name

# Run the migration SQL
source migrations/add_partial_invoicing_and_fifo.sql

# OR copy-paste the SQL contents directly into your MySQL client
```

**Option B: Using Prisma (If no conflicts)**

```bash
# Generate Prisma client
npx prisma generate

# Push schema changes to database
npx prisma db push

# If that fails, you may need to reset (WARNING: deletes data)
# npx prisma migrate reset
```

### Step 5: Verify Migration Success

Run these SQL queries to verify:

```sql
-- Check SalesOrderStatus enum
SELECT COLUMN_TYPE FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'sales_orders' AND COLUMN_NAME = 'status';
-- Should show: enum('OPEN','HOLD','REJECTED','PARTIALLY_INVOICED','FULLY_INVOICED')

-- Check invoicedQuantity column exists
SELECT * FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'sales_order_items' AND COLUMN_NAME = 'invoicedQuantity';
-- Should return 1 row

-- Check salesOrderItemId column exists
SELECT * FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'invoice_items' AND COLUMN_NAME = 'salesOrderItemId';
-- Should return 1 row

-- Check salesOrderId is NOT unique anymore
SELECT CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_NAME = 'invoices'
  AND COLUMN_NAME = 'salesOrderId'
  AND CONSTRAINT_TYPE = 'UNIQUE';
-- Should return 0 rows (no unique constraint)
```

### Step 6: Update Invoice API Route

Replace the old invoice creation logic with the new partial invoicing logic:

```bash
# Backup current file
cp src/app/api/sales-invoices/route.ts src/app/api/sales-invoices/route.OLD.ts

# Replace with new version
cp src/app/api/sales-invoices/route.NEW.ts src/app/api/sales-invoices/route.ts
```

**Key Changes in New API:**
- Accepts `items` array with `salesOrderItemId` and `quantity`
- Validates requested quantities against remaining uninvoiced quantities
- Updates `invoicedQuantity` instead of deleting the order
- Sets order status to `PARTIALLY_INVOICED` or `FULLY_INVOICED`
- Supports FIFO ledger entry ordering

### Step 7: Regenerate Prisma Client

```bash
# Generate updated Prisma client with new types
npx prisma generate

# This may require closing file locks (kill dev server first)
```

### Step 8: Start Development Server

```bash
npm run dev
# OR
bun dev
# OR
yarn dev
```

### Step 9: Test Partial Invoicing

**Test Case 1: Create a Sales Order**
1. Go to `/sales/orders/new`
2. Create an order with multiple items
3. Note the order number

**Test Case 2: Create Partial Invoice**

New invoice request body format:

```json
{
  "salesOrderId": "uuid-of-sales-order",
  "invoiceDate": "2026-01-21",
  "roundOff": 0,
  "notes": "Partial shipment",
  "items": [
    {
      "salesOrderItemId": "uuid-of-order-item-1",
      "quantity": 5  // Can be less than ordered quantity
    },
    {
      "salesOrderItemId": "uuid-of-order-item-2",
      "quantity": 10
    }
  ]
}
```

**Expected Behavior:**
- Invoice created with specified quantities
- Sales order status → `PARTIALLY_INVOICED`
- Remaining quantity available for future invoices
- Sales order NOT deleted

**Test Case 3: Complete Invoicing**
- Create another invoice for remaining quantities
- Sales order status → `FULLY_INVOICED`

---

## 📊 FIFO Implementation

### Customer Ledger FIFO

```typescript
import { getCustomerLedgerFIFO, allocatePaymentFIFO } from '@/lib/fifo-utils';

// Get ledger entries in FIFO order (oldest first)
const entries = await getCustomerLedgerFIFO(db, customerId, {
  startDate: new Date('2025-01-01'),
  endDate: new Date('2026-01-31'),
});

// Allocate payment to oldest invoices first
const result = await allocatePaymentFIFO(
  db,
  customerId,
  paymentAmount,
  paymentId,
  paymentDate
);

console.log('Allocations:', result.allocations);
console.log('Remaining:', result.remainingAmount);
```

### Stock Ledger FIFO

```typescript
import { getStockMovementsFIFO, calculateFIFOCost } from '@/lib/fifo-utils';

// Get stock movements in FIFO order
const movements = await getStockMovementsFIFO(db, itemId, {
  type: 'PURCHASE',
  startDate: startDate,
});

// Calculate FIFO cost of goods sold
const costAnalysis = await calculateFIFOCost(db, itemId, quantitySold);
console.log('Total Cost:', costAnalysis.totalCost);
console.log('Average Cost:', costAnalysis.averageCost);
```

### Aging Reports

```typescript
import { getCustomerAgingReportFIFO } from '@/lib/fifo-utils';

// Generate aging report using FIFO
const aging = await getCustomerAgingReportFIFO(db, customerId);

console.log('Current (0-30 days):', aging.aging.current);
console.log('31-60 days:', aging.aging.days31to60);
console.log('61-90 days:', aging.aging.days61to90);
console.log('Over 90 days:', aging.aging.over90);
```

---

## 🎨 UI Updates Needed

### 1. Update Sales Order Detail Page

Add button to create partial invoice:

```tsx
// Show invoice status
{order.status === 'PARTIALLY_INVOICED' && (
  <Badge variant="warning">Partially Invoiced</Badge>
)}
{order.status === 'FULLY_INVOICED' && (
  <Badge variant="success">Fully Invoiced</Badge>
)}

// Show remaining quantities
{order.items.map(item => (
  <div key={item.id}>
    <span>Ordered: {item.quantity}</span>
    <span>Invoiced: {item.invoicedQuantity}</span>
    <span>Remaining: {item.quantity - item.invoicedQuantity}</span>
  </div>
))}

// Button to create invoice
<Button onClick={handleCreatePartialInvoice}>
  {order.status === 'OPEN' ? 'Create Invoice' : 'Create Another Invoice'}
</Button>
```

### 2. Create Partial Invoice Modal

Create a modal component that allows selecting quantities to invoice:

```tsx
<PartialInvoiceModal
  salesOrder={order}
  onSubmit={async (selectedItems) => {
    const response = await fetch('/api/sales-invoices', {
      method: 'POST',
      body: JSON.stringify({
        salesOrderId: order.id,
        items: selectedItems.map(item => ({
          salesOrderItemId: item.id,
          quantity: item.selectedQuantity,
        })),
      }),
    });
  }}
/>
```

### 3. Update Invoice List

Show linked order number:

```tsx
<td>
  {invoice.orderNumber && (
    <Link href={`/sales/orders/${invoice.salesOrderId}`}>
      Order: {invoice.orderNumber}
    </Link>
  )}
</td>
```

---

## ✅ Testing Checklist

### Partial Invoicing Tests

- [ ] Create sales order with multiple items
- [ ] Create partial invoice (invoice less than ordered quantity)
- [ ] Verify order status is `PARTIALLY_INVOICED`
- [ ] Verify `invoicedQuantity` updated correctly
- [ ] Create second invoice for remaining quantity
- [ ] Verify order status becomes `FULLY_INVOICED`
- [ ] Verify stock deduction matches invoiced quantities
- [ ] Verify customer ledger entries created with correct amounts
- [ ] Try to over-invoice (should fail validation)
- [ ] Try to invoice already fully-invoiced order (should fail)

### FIFO Tests

- [ ] Customer ledger displays oldest entries first
- [ ] Payment allocation applies to oldest invoices
- [ ] Stock movements show in chronological order
- [ ] Aging report groups by correct date ranges
- [ ] Balance calculation reflects FIFO order

---

## 🔄 Rollback Plan

If something goes wrong:

```bash
# Restore database backup
mysql -u username -p database_name < backup_file.sql

# Revert code changes
git checkout HEAD -- src/app/api/sales-invoices/route.ts
git checkout HEAD -- prisma/schema.prisma

# Regenerate Prisma client
npx prisma generate

# Restart server
npm run dev
```

---

## 📞 Troubleshooting

### Issue: Prisma generate fails with "operation not permitted"

**Solution**: Close VS Code, stop dev server, then run:
```bash
taskkill /F /IM node.exe
npx prisma generate
```

### Issue: Migration fails with "Duplicate foreign key constraint"

**Solution**: The constraint already exists. Skip the specific ALTER TABLE statement causing the error.

### Issue: Invoice creation fails with "Invalid order item ID"

**Solution**: Ensure you're passing `salesOrderItemId` (not `itemId`) in the items array.

### Issue: Orders not showing correct remaining quantity

**Solution**: Check `invoicedQuantity` was properly added to database:
```sql
SELECT * FROM sales_order_items LIMIT 5;
-- Should have invoicedQuantity column
```

---

## 🎉 Success Criteria

You'll know implementation is successful when:

1. ✅ You can create multiple invoices from one sales order
2. ✅ Order shows correct remaining quantities
3. ✅ Stock deducts only invoiced quantities
4. ✅ Ledger entries appear in chronological (FIFO) order
5. ✅ Payment allocation applies to oldest invoices first
6. ✅ No errors in console or server logs

---

## 📚 Additional Resources

- **Prisma Schema**: `prisma/schema.prisma`
- **Migration SQL**: `migrations/add_partial_invoicing_and_fifo.sql`
- **New Invoice API**: `src/app/api/sales-invoices/route.NEW.ts`
- **FIFO Utilities**: `src/lib/fifo-utils.ts`

---

## 🤝 Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify database schema matches expected structure
3. Test with small sample data first
4. Rollback if needed and review each step

---

**Last Updated**: 2026-01-21
**Version**: 1.0.0
