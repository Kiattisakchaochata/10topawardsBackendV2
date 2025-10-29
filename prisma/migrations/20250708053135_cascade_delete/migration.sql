-- DropForeignKey
ALTER TABLE `Image` DROP FOREIGN KEY `Image_store_id_fkey`;

-- DropIndex
DROP INDEX `Image_store_id_fkey` ON `Image`;

-- AddForeignKey
ALTER TABLE `Image` ADD CONSTRAINT `Image_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
