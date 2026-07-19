-- Migration: Add attendance denominations (Men, Women, Children, Visitors)
-- These columns store the breakdown for head count attendance records.

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS men_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS women_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS visitors_count INTEGER DEFAULT 0 NOT NULL;

-- Add index to the new columns if helpful for reporting (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_attendance_records_breakdown 
  ON public.attendance_records(men_count, women_count, children_count, visitors_count);
