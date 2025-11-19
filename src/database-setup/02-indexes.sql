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
