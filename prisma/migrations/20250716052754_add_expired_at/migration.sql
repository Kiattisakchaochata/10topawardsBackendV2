-- AlterTable
ALTER TABLE `stores` ADD COLUMN `expired_at` DATETIME(3) NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;
