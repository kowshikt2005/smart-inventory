-- ============================================
-- MIGRATION: Add Partial Invoicing Support and FIFO
-- Date: 2026-01-21
-- Description:
--   1. Enable partial quantity invoicing for sales orders
--   2. Add FIFO support for ledgers (via ordering)
--   3. Update invoice-order relationship from one-to-one to one-to-many
-- ============================================

-- Step 1: Add new status values to SalesOrderStatus enum
ALTER TABLE sales_orders
MODIFY COLUMN status ENUM('OPEN', 'HOLD', 'REJECTED', 'PARTIALLY_INVOICED', 'FULLY_INVOICED') DEFAULT 'OPEN';

-- Step 2: Add invoicedQuantity tracking to sales_order_items
ALTER TABLE sales_order_items
ADD COLUMN invoicedQuantity DECIMAL(15,3) DEFAULT 0 AFTER quantity;

-- Step 3: Add salesOrderItemId link to invoice_items for tracking
ALTER TABLE invoice_items
ADD COLUMN salesOrderItemId VARCHAR(191) AFTER invoiceId,
ADD INDEX idx_invoice_items_salesOrderItemId (salesOrderItemId);

-- Step 4: Remove UNIQUE constraint from invoices.salesOrderId (allow multiple invoices per order)
-- First, find the constraint name
SELECT CONSTRAINT_NAME
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'invoices'
  AND CONSTRAINT_TYPE = 'UNIQUE'
  AND CONSTRAINT_NAME LIKE '%salesOrderId%';

-- Drop the unique constraint (replace 'constraint_name' with actual name from above query)
-- This will vary by database, manual step required:
-- ALTER TABLE invoices DROP INDEX invoices_salesOrderId_key;

-- Alternative: Drop and recreate the index as non-unique
ALTER TABLE invoices DROP INDEX invoices_salesOrderId_key;
CREATE INDEX idx_invoices_salesOrderId ON invoices(salesOrderId);

-- Step 5: Add FIFO ordering columns (already exist, just ensure indexes)
-- Customer Ledger - ensure date and createdAt are indexed for FIFO
CREATE INDEX IF NOT EXISTS idx_customer_ledger_date_created ON customer_ledger(customerId, date, createdAt);

-- Vendor Ledger - ensure date and createdAt are indexed for FIFO
CREATE INDEX IF NOT EXISTS idx_vendor_ledger_date_created ON vendor_ledger(vendorId, date, createdAt);

-- Stock Movements - ensure createdAt is indexed for FIFO
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(itemId, createdAt);

-- Step 6: Backfill invoicedQuantity for existing data
-- Set invoicedQuantity = quantity for all items in orders that have invoices
UPDATE sales_order_items soi
INNER JOIN sales_orders so ON soi.salesOrderId = so.id
INNER JOIN invoices i ON so.id = i.salesOrderId
SET soi.invoicedQuantity = soi.quantity
WHERE soi.invoicedQuantity = 0;

-- Step 7: Update order status for existing invoiced orders
UPDATE sales_orders so
INNER JOIN invoices i ON so.id = i.salesOrderId
SET so.status = 'FULLY_INVOICED'
WHERE so.status IN ('OPEN', 'HOLD');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify sales_order_items has invoicedQuantity column
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'sales_order_items'
  AND COLUMN_NAME = 'invoicedQuantity';

-- Verify invoice_items has salesOrderItemId column
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'invoice_items'
  AND COLUMN_NAME = 'salesOrderItemId';

-- Verify invoices.salesOrderId is NOT unique anymore
SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'invoices'
  AND COLUMN_NAME = 'salesOrderId';

-- Verify SalesOrderStatus enum includes new values
SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'sales_orders'
  AND COLUMN_NAME = 'status';

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================

-- To rollback (USE WITH CAUTION):
/*
-- Remove added columns
ALTER TABLE sales_order_items DROP COLUMN invoicedQuantity;
ALTER TABLE invoice_items DROP COLUMN salesOrderItemId;

-- Restore unique constraint on salesOrderId
ALTER TABLE invoices DROP INDEX idx_invoices_salesOrderId;
CREATE UNIQUE INDEX invoices_salesOrderId_key ON invoices(salesOrderId);

-- Revert enum
ALTER TABLE sales_orders
MODIFY COLUMN status ENUM('OPEN', 'HOLD', 'REJECTED') DEFAULT 'OPEN';

-- Remove FIFO indexes
DROP INDEX IF EXISTS idx_customer_ledger_date_created ON customer_ledger;
DROP INDEX IF EXISTS idx_vendor_ledger_date_created ON vendor_ledger;
DROP INDEX IF EXISTS idx_stock_movements_created ON stock_movements;
*/
