-- Migration: Member Status Auto-Calculation & Enhanced Attendance System
-- Adds 'new' status, sabbatical tracking fields, absentee records, and status audit log

-- 1. Update members status constraint to include 'new'
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS "members_status_check";
ALTER TABLE public.members ADD CONSTRAINT "members_status_check"
  CHECK (("status" = ANY (ARRAY['new'::"text", 'active'::"text", 'semi-active'::"text", 'inactive'::"text", 'sabbatical'::"text", 'blacklisted'::"text"])));

-- 2. Add sabbatical tracking columns to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS sabbatical_start_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS sabbatical_end_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS sabbatical_reason TEXT;

-- 3. Create absentee_records table
CREATE TABLE IF NOT EXISTS public.absentee_records (
    id UUID DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    attendance_record_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    requested_permission BOOLEAN DEFAULT false,
    reason TEXT CHECK (reason IS NULL OR reason = ANY (ARRAY['Sick', 'Travel', 'Work', 'Family Emergency', 'Other'])),
    reason_notes TEXT,
    absence_start_date DATE,
    absence_end_date DATE,
    until_further_notice BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(attendance_record_id, member_id)
);

-- 4. Create member_status_log table (audit trail)
CREATE TABLE IF NOT EXISTS public.member_status_log (
    id UUID DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type = ANY (ARRAY['automatic', 'manual'])),
    changed_by UUID,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_absentee_records_attendance_id ON public.absentee_records(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_absentee_records_member_id ON public.absentee_records(member_id);
CREATE INDEX IF NOT EXISTS idx_member_status_log_member_id ON public.member_status_log(member_id);
CREATE INDEX IF NOT EXISTS idx_member_status_log_created_at ON public.member_status_log(created_at);
