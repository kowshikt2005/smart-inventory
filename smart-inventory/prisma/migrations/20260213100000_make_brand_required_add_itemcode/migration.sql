-- Fix NULL values for brand and subBrand
UPDATE `items` SET `brandId` = (SELECT id FROM `brands` LIMIT 1) WHERE `brandId` IS NULL;
UPDATE `items` SET `subBrandId` = (SELECT id FROM `sub_brands` LIMIT 1) WHERE `subBrandId` IS NULL;

-- Add new optional userCode field for user-provided search codes
ALTER TABLE `items` ADD COLUMN `userCode` VARCHAR(191) NULL;
ALTER TABLE `items` ADD INDEX `items_userCode_idx`(`userCode`);

-- Drop existing foreign keys that use SET NULL
ALTER TABLE `items` DROP FOREIGN KEY `items_brandId_fkey`;
ALTER TABLE `items` DROP FOREIGN KEY `items_subBrandId_fkey`;

-- Make brandId and subBrandId required
ALTER TABLE `items` MODIFY COLUMN `brandId` VARCHAR(191) NOT NULL;
ALTER TABLE `items` MODIFY COLUMN `subBrandId` VARCHAR(191) NOT NULL;

-- Recreate foreign keys with RESTRICT instead of SET NULL
ALTER TABLE `items` ADD CONSTRAINT `items_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `items` ADD CONSTRAINT `items_subBrandId_fkey` FOREIGN KEY (`subBrandId`) REFERENCES `sub_brands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
