/*
  Warnings:

  - Added the required column `order_number` to the `Category` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Category` ADD COLUMN `cover_image` VARCHAR(191) NULL,
    ADD COLUMN `order_number` INTEGER NOT NULL;
