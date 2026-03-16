-- Add image tracking columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_source VARCHAR(50);
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_accuracy VARCHAR(20);
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMP;

-- Create index for reporting
CREATE INDEX IF NOT EXISTS idx_events_image_source ON events(image_source) WHERE image_source IS NOT NULL;
