-- Revert: drop the optional itemCode column that was added by mistake
ALTER TABLE `items` DROP INDEX `items_itemCode_idx`;
ALTER TABLE `items` DROP COLUMN `itemCode`;

-- Revert: rename `code` back to `itemCode`
ALTER TABLE `items` DROP INDEX `items_code_key`;
ALTER TABLE `items` DROP INDEX `items_code_idx`;
ALTER TABLE `items` CHANGE COLUMN `code` `itemCode` VARCHAR(191) NOT NULL;
ALTER TABLE `items` ADD UNIQUE INDEX `items_itemCode_key`(`itemCode`);
ALTER TABLE `items` ADD INDEX `items_itemCode_idx`(`itemCode`);

-- Add the new userCode field
ALTER TABLE `items` ADD COLUMN `userCode` VARCHAR(191) NULL;
ALTER TABLE `items` ADD INDEX `items_userCode_idx`(`userCode`);
