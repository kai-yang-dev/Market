-- Add feedback and rating columns to milestones table
ALTER TABLE milestones
ADD COLUMN feedback TEXT NULL,
ADD COLUMN rating INT NULL;

