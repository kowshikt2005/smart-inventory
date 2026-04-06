ALTER TABLE `customers`
  ADD COLUMN `contactName` VARCHAR(191) NULL;

ALTER TABLE `purchase_invoices`
  ADD COLUMN `roundOff` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;
