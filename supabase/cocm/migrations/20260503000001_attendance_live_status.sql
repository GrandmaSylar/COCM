-- Add status column to attendance_records to distinguish live sessions from finalized ones
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'finalized';

-- Mark any existing records as finalized (they were all saved via the old batch flow)
UPDATE attendance_records SET status = 'finalized' WHERE status IS NULL;

-- Index for fast lookups of live sessions
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records (status) WHERE status = 'live';
