-- ============================================================================
-- CURRENT INDEXES (cleaned)
-- Indexes tailored to the project's current tables and common filters/sorts
-- Run this script in Supabase SQL Editor or via `supabase db query`
-- ============================================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Temporary permissions
CREATE INDEX IF NOT EXISTS idx_temp_permissions_user_id ON temporary_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_temp_permissions_expires_at ON temporary_permissions(expires_at);

-- Members: basic filters/sorts
CREATE INDEX IF NOT EXISTS idx_members_zone ON members(zone);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_zone_number ON members(zone_number);
CREATE INDEX IF NOT EXISTS idx_members_date_of_birth ON members(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);
CREATE INDEX IF NOT EXISTS idx_members_join_date ON members(join_date);

-- Composite index for common filter combination (zone + status)
CREATE INDEX IF NOT EXISTS idx_members_zone_status ON members(zone, status);

-- JSONB / array fields (ministries, baptism_info)
-- Use GIN indexes for containment and existence checks
CREATE INDEX IF NOT EXISTS idx_members_ministries_gin ON members USING GIN (ministries);
CREATE INDEX IF NOT EXISTS idx_members_baptism_info_gin ON members USING GIN (baptism_info);

-- Expression index for baptism year if stored in JSONB as text
CREATE INDEX IF NOT EXISTS idx_members_baptism_year_expr ON members ((baptism_info->>'year'));

-- Family members
CREATE INDEX IF NOT EXISTS idx_family_members_member_id ON family_members(member_id);
CREATE INDEX IF NOT EXISTS idx_family_members_linked_member_id ON family_members(linked_member_id);

-- Attendance records and entries
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_service_type ON attendance_records(service_type);
CREATE INDEX IF NOT EXISTS idx_attendance_entries_record_id ON attendance_entries(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_attendance_entries_member_id ON attendance_entries(member_id);

-- Giving records
CREATE INDEX IF NOT EXISTS idx_giving_records_service_date ON giving_records(service_date);
CREATE INDEX IF NOT EXISTS idx_giving_records_service_type ON giving_records(service_type);

-- Visitors
CREATE INDEX IF NOT EXISTS idx_visitors_visit_date ON visitors(visit_date);
CREATE INDEX IF NOT EXISTS idx_visitors_follow_up_status ON visitors(follow_up_status);
CREATE INDEX IF NOT EXISTS idx_visitors_interested_in_membership ON visitors(interested_in_membership);

-- Optional: tune and add more indexes after checking query plans with EXPLAIN
-- End of file
