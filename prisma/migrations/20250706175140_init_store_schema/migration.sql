/*
  Warnings:

  - You are about to drop the column `product_id` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `product_id` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `product_id` on the `VisitorCounter` table. All the data in the column will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[store_id]` on the table `VisitorCounter` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `store_id` to the `Image` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store_id` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store_id` to the `VisitorCounter` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Image` DROP FOREIGN KEY `Image_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `Product` DROP FOREIGN KEY `Product_category_id_fkey`;

-- DropForeignKey
ALTER TABLE `Review` DROP FOREIGN KEY `Review_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `VisitorCounter` DROP FOREIGN KEY `VisitorCounter_product_id_fkey`;

-- DropIndex
DROP INDEX `Image_product_id_fkey` ON `Image`;

-- DropIndex
DROP INDEX `Review_product_id_fkey` ON `Review`;

-- DropIndex
DROP INDEX `VisitorCounter_product_id_key` ON `VisitorCounter`;

-- AlterTable
ALTER TABLE `Image` DROP COLUMN `product_id`,
    ADD COLUMN `store_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Review` DROP COLUMN `product_id`,
    ADD COLUMN `store_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `VisitorCounter` DROP COLUMN `product_id`,
    ADD COLUMN `store_id` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `Product`;

-- CreateTable
CREATE TABLE `Store` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `image_url` VARCHAR(191) NULL,
    `social_links` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `avg_review` DOUBLE NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Category_name_key` ON `Category`(`name`);

-- CreateIndex
CREATE UNIQUE INDEX `VisitorCounter_store_id_key` ON `VisitorCounter`(`store_id`);

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Store` ADD CONSTRAINT `Store_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisitorCounter` ADD CONSTRAINT `VisitorCounter_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Image` ADD CONSTRAINT `Image_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `Store`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
