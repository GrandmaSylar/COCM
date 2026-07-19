-- Migration: Add attendance_type column to distinguish individual vs general (head count) attendance
-- Individual: per-member tracking, feeds member status calculation and profile analytics
-- General: head count only, feeds church attendance trends and reports

-- 1. Add attendance_type column
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS attendance_type TEXT NOT NULL DEFAULT 'individual'
  CONSTRAINT attendance_records_type_check CHECK (attendance_type IN ('individual', 'general'));

-- 2. Replace unique constraint to allow both types for same date+service
ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_date_service_type_key;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_date_service_type_attendance_type_key
  UNIQUE (date, service_type, attendance_type);

-- 3. Add index for filtering by type
CREATE INDEX IF NOT EXISTS idx_attendance_records_type
  ON public.attendance_records(attendance_type);
