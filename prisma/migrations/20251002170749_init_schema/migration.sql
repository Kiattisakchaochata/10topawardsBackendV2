/*
  Warnings:

  - You are about to alter the column `name` on the `Category` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `order_number` on the `Category` table. The data in that column could be lost. The data in that column will be cast from `Int` to `UnsignedSmallInt`.
  - You are about to alter the column `rating` on the `Review` table. The data in that column could be lost. The data in that column will be cast from `Int` to `TinyInt`.
  - You are about to alter the column `name` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `password_hash` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Char(60)`.
  - You are about to alter the column `role` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(0))`.
  - You are about to alter the column `total` on the `VisitorCounter` table. The data in that column could be lost. The data in that column will be cast from `Int` to `UnsignedInt`.
  - The primary key for the `WebsiteVisitorCounter` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `WebsiteVisitorCounter` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(32)`.
  - You are about to alter the column `total` on the `WebsiteVisitorCounter` table. The data in that column could be lost. The data in that column will be cast from `Int` to `UnsignedInt`.
  - You are about to alter the column `order_number` on the `images` table. The data in that column could be lost. The data in that column will be cast from `Int` to `UnsignedTinyInt`.
  - You are about to alter the column `name` on the `stores` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(150)`.
  - You are about to alter the column `social_links` on the `stores` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `order_number` on the `stores` table. The data in that column could be lost. The data in that column will be cast from `Int` to `UnsignedSmallInt`.

*/
-- AlterTable
ALTER TABLE `Category` MODIFY `name` VARCHAR(100) NOT NULL,
    MODIFY `avg_review` DECIMAL(3, 2) NULL DEFAULT 0,
    MODIFY `image_url` VARCHAR(2048) NULL,
    MODIFY `cover_image` VARCHAR(2048) NULL,
    MODIFY `order_number` SMALLINT UNSIGNED NOT NULL;

-- AlterTable
ALTER TABLE `Review` MODIFY `rating` TINYINT NOT NULL,
    MODIFY `comment` VARCHAR(1000) NOT NULL;

-- AlterTable
ALTER TABLE `User` MODIFY `name` VARCHAR(100) NOT NULL,
    MODIFY `email` VARCHAR(254) NOT NULL,
    MODIFY `password_hash` CHAR(60) NOT NULL,
    MODIFY `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user';

-- AlterTable
ALTER TABLE `VisitorCounter` MODIFY `total` INTEGER UNSIGNED NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `WebsiteVisitorCounter` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(32) NOT NULL DEFAULT 'singleton',
    MODIFY `total` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `images` MODIFY `image_url` VARCHAR(2048) NOT NULL,
    MODIFY `order_number` TINYINT UNSIGNED NOT NULL,
    MODIFY `alt_text` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `stores` ADD COLUMN `avg_rating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `renewal_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN `review_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    MODIFY `name` VARCHAR(150) NOT NULL,
    MODIFY `description` VARCHAR(1200) NOT NULL,
    MODIFY `address` VARCHAR(255) NOT NULL,
    MODIFY `social_links` JSON NULL,
    MODIFY `order_number` SMALLINT UNSIGNED NOT NULL,
    MODIFY `cover_image` VARCHAR(2048) NULL;

-- CreateTable
CREATE TABLE `Banner` (
    `id` VARCHAR(191) NOT NULL,
    `image_url` VARCHAR(2048) NOT NULL,
    `cloudinary_public_id` VARCHAR(255) NULL,
    `title` VARCHAR(150) NULL,
    `alt_text` VARCHAR(255) NULL,
    `order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `href` VARCHAR(2048) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Banner_is_active_order_idx`(`is_active`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `videos` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `youtube_url` VARCHAR(512) NOT NULL,
    `thumbnail_url` VARCHAR(2048) NULL,
    `order_number` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `store_id` VARCHAR(191) NULL,

    INDEX `videos_is_active_start_date_end_date_idx`(`is_active`, `start_date`, `end_date`),
    INDEX `videos_store_id_is_active_order_number_idx`(`store_id`, `is_active`, `order_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Review_store_id_created_at_idx` ON `Review`(`store_id`, `created_at`);

-- CreateIndex
CREATE INDEX `images_store_id_order_number_idx` ON `images`(`store_id`, `order_number`);

-- CreateIndex
CREATE INDEX `stores_category_id_is_active_expired_at_idx` ON `stores`(`category_id`, `is_active`, `expired_at`);

-- AddForeignKey
ALTER TABLE `videos` ADD CONSTRAINT `videos_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
