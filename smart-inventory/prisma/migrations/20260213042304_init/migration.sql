-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `googleId` VARCHAR(191) NULL,
    `role` ENUM('SALESMAN', 'BILLING_OPERATOR', 'ACCOUNTANT', 'MANAGER', 'ADMIN') NOT NULL DEFAULT 'SALESMAN',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_googleId_key`(`googleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `customerNumber` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `gstin` VARCHAR(15) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `creditLimit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `creditDays` INTEGER NOT NULL DEFAULT 0,
    `openingBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customers_customerNumber_key`(`customerNumber`),
    INDEX `customers_customerNumber_idx`(`customerNumber`),
    INDEX `customers_gstin_idx`(`gstin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_ledger` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `type` ENUM('OPENING_BALANCE', 'SALES_INVOICE', 'SALES_RECEIPT', 'SALES_RETURN', 'ADJUSTMENT', 'PURCHASE_INVOICE', 'PURCHASE_PAYMENT', 'PURCHASE_RETURN') NOT NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `referenceType` VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_ledger_customerId_idx`(`customerId`),
    INDEX `customer_ledger_date_idx`(`date`),
    INDEX `customer_ledger_type_idx`(`type`),
    INDEX `customer_ledger_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendors` (
    `id` VARCHAR(191) NOT NULL,
    `vendorNumber` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `gstin` VARCHAR(15) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `creditDays` INTEGER NOT NULL DEFAULT 0,
    `openingBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendors_vendorNumber_key`(`vendorNumber`),
    INDEX `vendors_vendorNumber_idx`(`vendorNumber`),
    INDEX `vendors_gstin_idx`(`gstin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brands` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `brands_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_brands` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `brandId` VARCHAR(191) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sub_brands_brandId_idx`(`brandId`),
    UNIQUE INDEX `sub_brands_name_brandId_key`(`name`, `brandId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `id` VARCHAR(191) NOT NULL,
    `itemCode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `brandId` VARCHAR(191) NULL,
    `subBrandId` VARCHAR(191) NULL,
    `hsnCode` VARCHAR(8) NULL,
    `gstRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `purchasePrice` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `mrp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `sellingPrice` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `margin` DECIMAL(15, 2) NULL,
    `marginType` VARCHAR(191) NOT NULL DEFAULT 'PERCENTAGE',
    `discountPercent` DECIMAL(5, 2) NULL,
    `minStock` DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'PCS',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `items_itemCode_key`(`itemCode`),
    INDEX `items_itemCode_idx`(`itemCode`),
    INDEX `items_brandId_idx`(`brandId`),
    INDEX `items_subBrandId_idx`(`subBrandId`),
    INDEX `items_hsnCode_idx`(`hsnCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `physicalStock` DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
    `reservedQuantity` DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
    `minStockLevel` DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
    `lastUpdated` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_itemId_key`(`itemId`),
    INDEX `inventory_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` VARCHAR(191) NOT NULL,
    `inventoryId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `type` ENUM('PURCHASE', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN', 'DAMAGE', 'TRANSFER') NOT NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,

    INDEX `stock_movements_inventoryId_idx`(`inventoryId`),
    INDEX `stock_movements_itemId_idx`(`itemId`),
    INDEX `stock_movements_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_journals` (
    `id` VARCHAR(191) NOT NULL,
    `journalNumber` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `type` ENUM('PURCHASE', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN', 'DAMAGE', 'TRANSFER') NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `stock_journals_journalNumber_key`(`journalNumber`),
    INDEX `stock_journals_journalNumber_idx`(`journalNumber`),
    INDEX `stock_journals_date_idx`(`date`),
    INDEX `stock_journals_createdBy_fkey`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_orders` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `orderDate` DATETIME(3) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `expectedDelivery` DATETIME(3) NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `status` ENUM('OPEN', 'HOLD', 'REJECTED', 'PARTIALLY_INVOICED', 'FULLY_INVOICED') NOT NULL DEFAULT 'OPEN',
    `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `discountAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `terms` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `sales_orders_orderNumber_key`(`orderNumber`),
    INDEX `sales_orders_orderNumber_idx`(`orderNumber`),
    INDEX `sales_orders_customerId_idx`(`customerId`),
    INDEX `sales_orders_status_idx`(`status`),
    INDEX `sales_orders_orderDate_idx`(`orderDate`),
    INDEX `sales_orders_createdBy_fkey`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_order_items` (
    `id` VARCHAR(191) NOT NULL,
    `salesOrderId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `invoicedQuantity` DECIMAL(15, 3) NOT NULL DEFAULT 0.000,
    `rate` DECIMAL(15, 2) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    INDEX `sales_order_items_salesOrderId_idx`(`salesOrderId`),
    INDEX `sales_order_items_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `salesOrderId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('OPEN', 'HOLD', 'REJECTED', 'PARTIALLY_INVOICED', 'FULLY_INVOICED') NULL,
    `toStatus` ENUM('OPEN', 'HOLD', 'REJECTED', 'PARTIALLY_INVOICED', 'FULLY_INVOICED') NOT NULL,
    `reason` TEXT NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `changedBy` VARCHAR(191) NOT NULL,

    INDEX `order_status_history_salesOrderId_idx`(`salesOrderId`),
    INDEX `order_status_history_changedAt_idx`(`changedAt`),
    INDEX `osh_user_fkey`(`changedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `vendorName` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `expectedDelivery` DATETIME(3) NULL,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('OPEN', 'PARTIAL', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_orders_orderNumber_key`(`orderNumber`),
    INDEX `purchase_orders_orderNumber_idx`(`orderNumber`),
    INDEX `purchase_orders_vendorId_idx`(`vendorId`),
    INDEX `purchase_orders_date_idx`(`date`),
    INDEX `purchase_orders_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_items` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `rate` DECIMAL(15, 2) NOT NULL,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    INDEX `purchase_order_items_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `purchase_order_items_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_sheets` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validTo` DATETIME(3) NULL,
    `itemRatePercent` DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `excludedItemIds` JSON NULL,
    `excludedBrandIds` JSON NULL,
    `excludedSubBrandIds` JSON NULL,
    `useInclusionModel` BOOLEAN NOT NULL DEFAULT true,
    `inclusionDiscounts` JSON NULL,
    `currency` ENUM('INR', 'USD', 'EUR', 'GBP', 'AED') NOT NULL DEFAULT 'INR',
    `roundOff` ENUM('NONE', 'UP', 'DOWN', 'NEAREST') NOT NULL DEFAULT 'NONE',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rate_sheets_validFrom_validTo_idx`(`validFrom`, `validTo`),
    INDEX `rate_sheets_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_sheet_customers` (
    `rateSheetId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,

    INDEX `rate_sheet_customers_customerId_idx`(`customerId`),
    PRIMARY KEY (`rateSheetId`, `customerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `invoiceDate` DATETIME(3) NOT NULL,
    `salesOrderId` VARCHAR(191) NULL,
    `orderNumber` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `cgst` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `sgst` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `roundOff` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `paidAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `balanceAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `paymentStatus` ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `dueDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_invoiceNumber_key`(`invoiceNumber`),
    INDEX `invoices_invoiceNumber_idx`(`invoiceNumber`),
    INDEX `invoices_customerId_idx`(`customerId`),
    INDEX `invoices_invoiceDate_idx`(`invoiceDate`),
    INDEX `invoices_paymentStatus_idx`(`paymentStatus`),
    INDEX `invoices_salesOrderId_fkey`(`salesOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `salesOrderItemId` VARCHAR(191) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `rate` DECIMAL(15, 2) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    INDEX `invoice_items_invoiceId_idx`(`invoiceId`),
    INDEX `invoice_items_itemId_idx`(`itemId`),
    INDEX `invoice_items_salesOrderItemId_idx`(`salesOrderItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `paymentNumber` VARCHAR(191) NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `mode` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD', 'OTHER') NOT NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `bankAccountId` VARCHAR(191) NULL,
    `chequeCollected` BOOLEAN NOT NULL DEFAULT false,
    `chequeCollectedDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_paymentNumber_key`(`paymentNumber`),
    INDEX `payments_paymentNumber_idx`(`paymentNumber`),
    INDEX `payments_customerId_idx`(`customerId`),
    INDEX `payments_invoiceId_idx`(`invoiceId`),
    INDEX `payments_paymentDate_idx`(`paymentDate`),
    INDEX `payments_bankAccountId_idx`(`bankAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,

    INDEX `payment_allocations_paymentId_idx`(`paymentId`),
    INDEX `payment_allocations_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_returns` (
    `id` VARCHAR(191) NOT NULL,
    `returnNumber` VARCHAR(191) NOT NULL,
    `returnDate` DATETIME(3) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `cgst` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `sgst` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `reason` TEXT NULL,
    `status` ENUM('OPEN', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_returns_returnNumber_key`(`returnNumber`),
    INDEX `sales_returns_returnNumber_idx`(`returnNumber`),
    INDEX `sales_returns_customerId_idx`(`customerId`),
    INDEX `sales_returns_invoiceId_idx`(`invoiceId`),
    INDEX `sales_returns_status_idx`(`status`),
    INDEX `sales_returns_returnDate_idx`(`returnDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_return_items` (
    `id` VARCHAR(191) NOT NULL,
    `salesReturnId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `rate` DECIMAL(15, 2) NOT NULL,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    INDEX `sales_return_items_salesReturnId_idx`(`salesReturnId`),
    INDEX `sales_return_items_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` VARCHAR(191) NOT NULL,
    `employeeNumber` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `salary` DECIMAL(15, 2) NULL,
    `joinDate` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employees_employeeNumber_key`(`employeeNumber`),
    UNIQUE INDEX `employees_email_key`(`email`),
    INDEX `employees_employeeNumber_idx`(`employeeNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `accountName` VARCHAR(191) NOT NULL,
    `accountNumber` VARCHAR(191) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `ifscCode` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `accountType` ENUM('CASH', 'SAVINGS', 'CURRENT', 'OVERDRAFT', 'LOAN', 'CREDIT_CARD') NOT NULL DEFAULT 'SAVINGS',
    `openingBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `currentBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bank_accounts_accountNumber_key`(`accountNumber`),
    INDEX `bank_accounts_accountNumber_idx`(`accountNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_ledger` (
    `id` VARCHAR(191) NOT NULL,
    `bankAccountId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `type` ENUM('OPENING_BALANCE', 'SALES_INVOICE', 'SALES_RECEIPT', 'SALES_RETURN', 'ADJUSTMENT', 'PURCHASE_INVOICE', 'PURCHASE_PAYMENT', 'PURCHASE_RETURN') NOT NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `referenceType` VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bank_ledger_bankAccountId_idx`(`bankAccountId`),
    INDEX `bank_ledger_date_idx`(`date`),
    INDEX `bank_ledger_type_idx`(`type`),
    INDEX `bank_ledger_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `vendorName` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `paidAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `balanceAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('PENDING', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_invoices_invoiceNumber_key`(`invoiceNumber`),
    INDEX `purchase_invoices_invoiceNumber_idx`(`invoiceNumber`),
    INDEX `purchase_invoices_vendorId_idx`(`vendorId`),
    INDEX `purchase_invoices_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `purchase_invoices_date_idx`(`date`),
    INDEX `purchase_invoices_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_invoice_items` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseInvoiceId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `rate` DECIMAL(15, 2) NOT NULL,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    INDEX `purchase_invoice_items_purchaseInvoiceId_idx`(`purchaseInvoiceId`),
    INDEX `purchase_invoice_items_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_payments` (
    `id` VARCHAR(191) NOT NULL,
    `paymentNumber` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `purchaseInvoiceId` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `mode` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD', 'OTHER') NOT NULL,
    `paidFrom` VARCHAR(191) NOT NULL,
    `bankAccountId` VARCHAR(191) NULL,
    `chequeCollected` BOOLEAN NOT NULL DEFAULT false,
    `chequeCollectedDate` DATETIME(3) NULL,
    `reference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendor_payments_paymentNumber_key`(`paymentNumber`),
    INDEX `vendor_payments_paymentNumber_idx`(`paymentNumber`),
    INDEX `vendor_payments_vendorId_idx`(`vendorId`),
    INDEX `vendor_payments_purchaseInvoiceId_idx`(`purchaseInvoiceId`),
    INDEX `vendor_payments_bankAccountId_idx`(`bankAccountId`),
    INDEX `vendor_payments_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_returns` (
    `id` VARCHAR(191) NOT NULL,
    `returnNumber` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `vendorName` VARCHAR(191) NOT NULL,
    `purchaseInvoiceId` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `totalAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('OPEN', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `reason` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_returns_returnNumber_key`(`returnNumber`),
    INDEX `purchase_returns_returnNumber_idx`(`returnNumber`),
    INDEX `purchase_returns_vendorId_idx`(`vendorId`),
    INDEX `purchase_returns_purchaseInvoiceId_idx`(`purchaseInvoiceId`),
    INDEX `purchase_returns_status_idx`(`status`),
    INDEX `purchase_returns_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_return_items` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseReturnId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `rate` DECIMAL(15, 2) NOT NULL,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,

    INDEX `purchase_return_items_purchaseReturnId_idx`(`purchaseReturnId`),
    INDEX `purchase_return_items_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_ledger` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `type` ENUM('OPENING_BALANCE', 'SALES_INVOICE', 'SALES_RECEIPT', 'SALES_RETURN', 'ADJUSTMENT', 'PURCHASE_INVOICE', 'PURCHASE_PAYMENT', 'PURCHASE_RETURN') NOT NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `referenceType` VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vendor_ledger_vendorId_idx`(`vendorId`),
    INDEX `vendor_ledger_date_idx`(`date`),
    INDEX `vendor_ledger_type_idx`(`type`),
    INDEX `vendor_ledger_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customer_ledger` ADD CONSTRAINT `customer_ledger_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_brands` ADD CONSTRAINT `sub_brands_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_subBrandId_fkey` FOREIGN KEY (`subBrandId`) REFERENCES `sub_brands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_inventoryId_fkey` FOREIGN KEY (`inventoryId`) REFERENCES `inventory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_journals` ADD CONSTRAINT `stock_journals_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_order_items` ADD CONSTRAINT `sales_order_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_order_items` ADD CONSTRAINT `sales_order_items_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `osh_salesOrder_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `osh_user_fkey` FOREIGN KEY (`changedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rate_sheet_customers` ADD CONSTRAINT `rate_sheet_customers_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rate_sheet_customers` ADD CONSTRAINT `rate_sheet_customers_rateSheetId_fkey` FOREIGN KEY (`rateSheetId`) REFERENCES `rate_sheets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_salesReturnId_fkey` FOREIGN KEY (`salesReturnId`) REFERENCES `sales_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_ledger` ADD CONSTRAINT `bank_ledger_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_invoices` ADD CONSTRAINT `purchase_invoices_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `purchase_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_invoices` ADD CONSTRAINT `purchase_invoices_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_invoice_items` ADD CONSTRAINT `purchase_invoice_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_invoice_items` ADD CONSTRAINT `purchase_invoice_items_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchase_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchase_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_payments` ADD CONSTRAINT `vendor_payments_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchase_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_items` ADD CONSTRAINT `purchase_return_items_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_items` ADD CONSTRAINT `purchase_return_items_purchaseReturnId_fkey` FOREIGN KEY (`purchaseReturnId`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_ledger` ADD CONSTRAINT `vendor_ledger_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
