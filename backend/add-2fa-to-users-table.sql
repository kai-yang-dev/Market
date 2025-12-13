-- Add 2FA related columns to users table
-- Run this script to add Two-Factor Authentication support

ALTER TABLE `users` 
ADD COLUMN `two_factor_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `phone_verified`,
ADD COLUMN `two_factor_secret` VARCHAR(255) NULL AFTER `two_factor_enabled`,
ADD COLUMN `two_factor_method` VARCHAR(50) NULL DEFAULT 'totp' AFTER `two_factor_secret`,
ADD COLUMN `backup_codes` TEXT NULL AFTER `two_factor_method`,
ADD COLUMN `two_factor_verified_at` DATETIME(6) NULL AFTER `backup_codes`;

-- Index for faster lookups
CREATE INDEX `IDX_users_two_factor_enabled` ON `users` (`two_factor_enabled`);

