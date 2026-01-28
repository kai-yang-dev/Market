-- Create unblock_requests table (user account unblock requests)
-- Run this script if DB_SYNCHRONIZE is disabled and you want to create the table manually.

CREATE TABLE IF NOT EXISTS `unblock_requests` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `user_id` CHAR(36) NOT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `decided_at` TIMESTAMP NULL DEFAULT NULL,
  `decided_by` CHAR(36) NULL,
  `admin_note` VARCHAR(500) NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX `IDX_unblock_requests_user_id` (`user_id`),
  INDEX `IDX_unblock_requests_status` (`status`),
  INDEX `IDX_unblock_requests_createdAt` (`createdAt`),
  INDEX `IDX_unblock_requests_decided_by` (`decided_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

