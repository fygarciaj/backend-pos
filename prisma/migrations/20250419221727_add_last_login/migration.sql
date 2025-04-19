-- AlterTable
ALTER TABLE `users` ADD COLUMN `lastLogin` DATETIME(3) NULL,
    MODIFY `role` ENUM('ADMIN', 'MANAGER', 'CASHIER', 'INVENTORY_MANAGER', 'REPORTS_VIEWER', 'SALES_MANAGER', 'GUEST') NOT NULL DEFAULT 'CASHIER';
