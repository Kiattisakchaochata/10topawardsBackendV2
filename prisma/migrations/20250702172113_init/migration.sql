/*
  Warnings:

  - You are about to drop the column `parent_category_id` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `parent_review` on the `Review` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Category` DROP COLUMN `parent_category_id`,
    ADD COLUMN `avg_review` DOUBLE NULL DEFAULT 0,
    ADD COLUMN `image_url` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `avg_review` DOUBLE NULL DEFAULT 0,
    MODIFY `description` VARCHAR(191) NULL,
    MODIFY `image_url` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Review` DROP COLUMN `parent_review`;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE `Image` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `image_url` VARCHAR(191) NOT NULL,
    `order_number` INTEGER NOT NULL,
    `alt_text` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Image` ADD CONSTRAINT `Image_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
