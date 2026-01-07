-- CreateTable
CREATE TABLE `Customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(20) NULL,
    `gstin` CHAR(15) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `stateCode` CHAR(2) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `openingBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `openingAsOfDate` DATETIME(3) NOT NULL,
    `creditDays` INTEGER NOT NULL DEFAULT 0,
    `creditLimit` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `hasPriceList` BOOLEAN NOT NULL DEFAULT false,
    `rateSheet` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_gstin_key`(`gstin`),
    INDEX `Customer_name_idx`(`name`),
    INDEX `Customer_gstin_idx`(`gstin`),
    INDEX `Customer_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
