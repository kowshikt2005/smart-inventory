-- Clean all data except employees
-- This script deletes all data in the correct order to respect foreign key constraints

-- Disable foreign key checks temporarily for easier deletion
SET FOREIGN_KEY_CHECKS = 0;

-- Delete payment and invoice related data
DELETE FROM payment_allocations;
DELETE FROM payments;
DELETE FROM invoices;
DELETE FROM invoice_items;

-- Delete sales returns
DELETE FROM sales_return_items;
DELETE FROM sales_returns;

-- Delete sales orders
DELETE FROM sales_order_items;
DELETE FROM order_status_history;
DELETE FROM sales_orders;

-- Delete purchase orders
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;

-- Delete stock movements and journals
DELETE FROM stock_movements;
DELETE FROM stock_journals;

-- Delete inventory
DELETE FROM inventory;

-- Delete customer ledger and customers
DELETE FROM customer_ledger;
DELETE FROM rate_sheets;
DELETE FROM customers;

-- Delete vendors
DELETE FROM vendors;

-- Delete items and brands
DELETE FROM items;
DELETE FROM sub_brands;
DELETE FROM brands;

-- Delete bank accounts
DELETE FROM bank_accounts;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Note: employees and users tables are NOT deleted
SELECT 'Database cleaned successfully! Employees and users preserved.' AS status;
