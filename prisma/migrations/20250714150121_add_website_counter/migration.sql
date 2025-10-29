-- CreateTable
CREATE TABLE `WebsiteVisitorCounter` (
    `id` VARCHAR(191) NOT NULL,
    `total` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
