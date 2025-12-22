-- Add attachment_files column to messages table (idempotent, MySQL)
-- This is required when DB_SYNCHRONIZE=false so attachment URLs persist and show in chat history.

SET @db := DATABASE();
SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db
    AND table_name = 'messages'
    AND column_name = 'attachment_files'
);

SET @sql := IF(
  @exists = 0,
  'ALTER TABLE messages ADD COLUMN attachment_files JSON NULL;',
  'SELECT ''messages.attachment_files already exists'';'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


