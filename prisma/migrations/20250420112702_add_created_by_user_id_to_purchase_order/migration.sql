/*
  Warnings:

  - Added the required column `createdByUserId` to the `purchase_orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `purchase_orders` ADD COLUMN `createdByUserId` VARCHAR(191) NOT NULL;
