-- DropForeignKey
ALTER TABLE `Review` DROP FOREIGN KEY `Review_store_id_fkey`;

-- DropIndex
DROP INDEX `Review_store_id_fkey` ON `Review`;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
