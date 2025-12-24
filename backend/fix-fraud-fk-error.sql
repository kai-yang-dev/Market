-- If TypeORM sync previously attempted to create foreign keys and failed,
-- run these cleanup steps, then restart backend.

-- 1) If the fraud tables exist but are in a bad state, easiest fix (dev):
-- DROP TABLE IF EXISTS fraud_detections;
-- DROP TABLE IF EXISTS conversation_reactivation_requests;

-- 2) If fraud_detections exists and you want to keep data, delete rows whose message_id is missing:
-- DELETE fd
-- FROM fraud_detections fd
-- LEFT JOIN messages m ON m.id = fd.message_id
-- WHERE m.id IS NULL;


