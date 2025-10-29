/*
  Warnings:

  - You are about to drop the column `count` on the `VisitorCounter` table. All the data in the column will be lost.
  - You are about to drop the column `store_id` on the `VisitorCounter` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[storeId]` on the table `VisitorCounter` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `VisitorCounter` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `VisitorCounter` DROP FOREIGN KEY `VisitorCounter_store_id_fkey`;

-- DropIndex
DROP INDEX `VisitorCounter_store_id_key` ON `VisitorCounter`;

-- AlterTable
ALTER TABLE `VisitorCounter` DROP COLUMN `count`,
    DROP COLUMN `store_id`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `storeId` VARCHAR(191) NULL,
    ADD COLUMN `total` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `VisitorCounter_storeId_key` ON `VisitorCounter`(`storeId`);

-- AddForeignKey
ALTER TABLE `VisitorCounter` ADD CONSTRAINT `VisitorCounter_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
