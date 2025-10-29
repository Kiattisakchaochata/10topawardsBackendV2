/*
  Warnings:

  - A unique constraint covering the columns `[order_number]` on the table `Category` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Category_order_number_key` ON `Category`(`order_number`);
