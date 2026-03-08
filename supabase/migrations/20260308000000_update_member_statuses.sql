-- ============================================================================
-- MEMBER STATUS UPDATE MIGRATION
-- Replaces 'sabbatical' with 'sick', 'traveled', 'schooling'
-- Adds 'not baptised' status
-- Updates absentee reasoning
-- ============================================================================

-- 1. Map existing 'sabbatical' to 'traveled' to avoid constraint violations when we apply the new constraint.
UPDATE members SET status = 'traveled' WHERE status = 'sabbatical';
UPDATE member_status_log SET new_status = 'traveled' WHERE new_status = 'sabbatical';
UPDATE member_status_log SET previous_status = 'traveled' WHERE previous_status = 'sabbatical';

-- 2. Drop the old constrain and create the new one in members
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE public.members ADD CONSTRAINT members_status_check
  CHECK (status IN ('new', 'active', 'semi-active', 'inactive', 'blacklisted', 'sick', 'traveled', 'schooling', 'not baptised'));

-- 3. Map existing absentee records 'sabbatical' if any exist (though constraint checked reasons)
-- Previous check constraint on absentee_records: CHECK (reason IS NULL OR reason = ANY (ARRAY['Sick', 'Travel', 'Work', 'Family Emergency', 'Other']))
UPDATE absentee_records SET reason = 'Traveled' WHERE reason = 'Travel';

-- 4. Drop the old constraint and create the new one in absentee_records
ALTER TABLE public.absentee_records DROP CONSTRAINT IF EXISTS absentee_records_reason_check;
ALTER TABLE public.absentee_records ADD CONSTRAINT absentee_records_reason_check
  CHECK (reason IS NULL OR reason = ANY (ARRAY['Sick', 'Traveled', 'Schooling', 'Work', 'Family Emergency', 'Other']));
