-- Add fraud detection + conversation blocking support
-- Run this if you have DB_SYNCHRONIZE=false in production.

-- 1) Add block fields to conversations
ALTER TABLE conversations
ADD COLUMN is_blocked TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN blocked_at TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN blocked_reason VARCHAR(255) NULL;

CREATE INDEX idx_conversations_is_blocked ON conversations(is_blocked);

-- 2) Fraud detections table (one row per fraudulent message)
CREATE TABLE fraud_detections (
  id CHAR(36) NOT NULL PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  message_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  message_text TEXT NOT NULL,
  category VARCHAR(100) NULL,
  reason VARCHAR(255) NULL,
  confidence VARCHAR(10) NULL,
  signals JSON NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_fraud_detections_conversation_id (conversation_id),
  INDEX idx_fraud_detections_message_id (message_id),
  INDEX idx_fraud_detections_sender_id (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Reactivation requests
CREATE TABLE conversation_reactivation_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  requester_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  decided_at TIMESTAMP NULL DEFAULT NULL,
  decided_by CHAR(36) NULL,
  note VARCHAR(255) NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_reactivation_conversation_id (conversation_id),
  INDEX idx_reactivation_requester_id (requester_id),
  INDEX idx_reactivation_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


