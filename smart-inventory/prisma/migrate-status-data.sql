-- Migrate existing sales order status data
-- Update REJECT to REJECTED in sales_orders
UPDATE sales_orders SET status = 'REJECTED' WHERE status = 'REJECT';

-- Update DELIVER and DELIVERED to OPEN in sales_orders
UPDATE sales_orders SET status = 'OPEN' WHERE status IN ('DELIVER', 'DELIVERED');

-- Update status history
UPDATE order_status_history SET fromStatus = 'REJECTED' WHERE fromStatus = 'REJECT';
UPDATE order_status_history SET fromStatus = 'OPEN' WHERE fromStatus IN ('DELIVER', 'DELIVERED');
UPDATE order_status_history SET toStatus = 'REJECTED' WHERE toStatus = 'REJECT';
UPDATE order_status_history SET toStatus = 'OPEN' WHERE toStatus IN ('DELIVER', 'DELIVERED');
