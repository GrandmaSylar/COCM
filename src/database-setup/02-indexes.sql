-- ============================================================================
-- STEP 2: CREATE INDEXES
-- Run this script after creating tables
-- ============================================================================

-- Profiles indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Temporary permissions indexes
CREATE INDEX idx_temp_permissions_user_id ON temporary_permissions(user_id);
CREATE INDEX idx_temp_permissions_expires_at ON temporary_permissions(expires_at);

-- Members indexes
CREATE INDEX idx_members_zone ON members(zone);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_zone_number ON members(zone_number);

-- Additional members indexes for performance (filters/sorts)
-- Index on date_of_birth for birthday and age queries
CREATE INDEX IF NOT EXISTS idx_members_date_of_birth ON members(date_of_birth);

-- Indexes to support sorting and recent queries
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);
CREATE INDEX IF NOT EXISTS idx_members_join_date ON members(join_date);

-- Composite index to speed up common filter combinations (zone + status)
CREATE INDEX IF NOT EXISTS idx_members_zone_status ON members(zone, status);

-- JSONB indexes: ministries (array/jsonb) and baptism_info
-- Use GIN for jsonb containment queries (e.g., ministries @> '"Prayer Ministry"')
CREATE INDEX IF NOT EXISTS idx_members_ministries_gin ON members USING GIN (ministries);
CREATE INDEX IF NOT EXISTS idx_members_baptism_info_gin ON members USING GIN (baptism_info);

-- Expression index for baptism year (if baptism_info->>'year' is used for sorting/filtering)
CREATE INDEX IF NOT EXISTS idx_members_baptism_year_expr ON members ((baptism_info->>'year'));

-- Family members indexes
CREATE INDEX idx_family_members_member_id ON family_members(member_id);
CREATE INDEX idx_family_members_linked_member_id ON family_members(linked_member_id);

-- Attendance records indexes
CREATE INDEX idx_attendance_records_date ON attendance_records(date);
CREATE INDEX idx_attendance_records_service_type ON attendance_records(service_type);

-- Attendance entries indexes
CREATE INDEX idx_attendance_entries_record_id ON attendance_entries(attendance_record_id);
CREATE INDEX idx_attendance_entries_member_id ON attendance_entries(member_id);

-- Giving records indexes
CREATE INDEX idx_giving_records_service_date ON giving_records(service_date);
CREATE INDEX idx_giving_records_service_type ON giving_records(service_type);

-- Visitors indexes
CREATE INDEX idx_visitors_visit_date ON visitors(visit_date);
CREATE INDEX idx_visitors_follow_up_status ON visitors(follow_up_status);
CREATE INDEX idx_visitors_interested_in_membership ON visitors(interested_in_membership);
