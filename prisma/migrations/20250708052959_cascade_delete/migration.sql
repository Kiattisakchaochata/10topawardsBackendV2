-- DropForeignKey
ALTER TABLE `VisitorCounter` DROP FOREIGN KEY `VisitorCounter_store_id_fkey`;

-- AddForeignKey
ALTER TABLE `VisitorCounter` ADD CONSTRAINT `VisitorCounter_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `Store`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
