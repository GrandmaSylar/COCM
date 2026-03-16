/*
 * Script: 07-reset-data.sql
 * Purpose: Wipe all transactional data; preserve users, reference data, and configuration
 * Date: 2026-03-16
 *
 * Cleared tables:
 * - otp_codes
 * - backup_history
 * - notifications
 * - activity_log
 * - service_records
 * - expense_records
 * - children_visitor_guardians
 * - children_attendance_entries
 * - children_attendance_records
 * - children_giving_records
 * - children_visitors
 * - children_member_parents
 * - children_members
 * - absentee_records
 * - member_status_log
 * - attendance_entries
 * - attendance_records
 * - giving_records
 * - visitors
 * - family_members
 * - members
 *
 * Preserved tables:
 * - profiles
 * - auth.users
 * - custom_services
 * - custom_giving_types
 * - custom_roles
 * - system_dropdown_options
 * - expense_payment_methods
 * - notification_type_config
 * - activity_log_config
 * - backup_schedule
 * - user_settings
 * - user_tab_access
 * - temporary_permissions
 *
 * ⚠️ WARNING: This operation is IRREVERSIBLE after COMMIT. There is no SQL-level undo.
 *
 * Pre-flight checklist:
 * 1. Confirm the Supabase SQL Editor is connected to the correct environment.
 * 2. Confirm a recent backup exists — check backup_history table or Supabase dashboard.
 * 3. Note current row counts: SELECT COUNT(*) FROM profiles, FROM members, FROM custom_services.
 * 4. Confirm intent with a second person if possible.
 *
 * Rollback instruction: restore from backup using the app's backup/restore system.
 */

BEGIN;

ALTER TABLE attendance_entries DISABLE TRIGGER update_attendance_count_trigger;

-- ── Auth / OTP ──
DELETE FROM otp_codes;

-- ── Backup History ──
DELETE FROM backup_history;

-- ── Notifications & Activity Log ──
DELETE FROM notifications;
DELETE FROM activity_log;

-- ── Service Records ──
DELETE FROM service_records;

-- ── Expenses ──
DELETE FROM expense_records;

-- ── Children Module ──
DELETE FROM children_visitor_guardians;
DELETE FROM children_attendance_entries;
DELETE FROM children_attendance_records;
DELETE FROM children_giving_records;
DELETE FROM children_visitors;
DELETE FROM children_member_parents;
DELETE FROM children_members;

-- ── Attendance ──
DELETE FROM absentee_records;

-- ── Members (dependents) ──
DELETE FROM member_status_log;

-- ── Attendance (entries — trigger disabled) ──
DELETE FROM attendance_entries;
DELETE FROM attendance_records;

-- ── Giving ──
DELETE FROM giving_records;

-- ── Visitors ──
DELETE FROM visitors;

-- ── Members ──
DELETE FROM family_members;
DELETE FROM members;

ALTER TABLE attendance_entries ENABLE TRIGGER update_attendance_count_trigger;

-- ROLLBACK;  -- Uncomment this line instead of COMMIT to do a dry run
COMMIT;

-- Section 3: VACUUM ANALYZE (must run outside transaction)
-- Note: Supabase SQL Editor executes the entire script as a single batch (implicit transaction).
-- Running VACUUM within this batch causes ERROR: 25001. If you need to VACUUM these tables,
-- please highlight the block below and run it completely separately from the reset transaction.
-- VACUUM ANALYZE otp_codes;
-- VACUUM ANALYZE backup_history;
-- VACUUM ANALYZE notifications;
-- VACUUM ANALYZE activity_log;
-- VACUUM ANALYZE service_records;
-- VACUUM ANALYZE expense_records;
-- VACUUM ANALYZE children_visitor_guardians;
-- VACUUM ANALYZE children_attendance_entries;
-- VACUUM ANALYZE children_attendance_records;
-- VACUUM ANALYZE children_giving_records;
-- VACUUM ANALYZE children_visitors;
-- VACUUM ANALYZE children_member_parents;
-- VACUUM ANALYZE children_members;
-- VACUUM ANALYZE absentee_records;
-- VACUUM ANALYZE member_status_log;
-- VACUUM ANALYZE attendance_entries;
-- VACUUM ANALYZE attendance_records;
-- VACUUM ANALYZE giving_records;
-- VACUUM ANALYZE visitors;
-- VACUUM ANALYZE family_members;
-- VACUUM ANALYZE members;

-- Section 4: Verification Queries
-- Note: Returning both table name and count makes the results readable in Supabase SQL Editor
SELECT 'otp_codes' as table_name, COUNT(*) FROM otp_codes
UNION ALL SELECT 'backup_history', COUNT(*) FROM backup_history
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log
UNION ALL SELECT 'service_records', COUNT(*) FROM service_records
UNION ALL SELECT 'expense_records', COUNT(*) FROM expense_records
UNION ALL SELECT 'children_visitor_guardians', COUNT(*) FROM children_visitor_guardians
UNION ALL SELECT 'children_attendance_entries', COUNT(*) FROM children_attendance_entries
UNION ALL SELECT 'children_attendance_records', COUNT(*) FROM children_attendance_records
UNION ALL SELECT 'children_giving_records', COUNT(*) FROM children_giving_records
UNION ALL SELECT 'children_visitors', COUNT(*) FROM children_visitors
UNION ALL SELECT 'children_member_parents', COUNT(*) FROM children_member_parents
UNION ALL SELECT 'children_members', COUNT(*) FROM children_members
UNION ALL SELECT 'absentee_records', COUNT(*) FROM absentee_records
UNION ALL SELECT 'member_status_log', COUNT(*) FROM member_status_log
UNION ALL SELECT 'attendance_entries', COUNT(*) FROM attendance_entries
UNION ALL SELECT 'attendance_records', COUNT(*) FROM attendance_records
UNION ALL SELECT 'giving_records', COUNT(*) FROM giving_records
UNION ALL SELECT 'visitors', COUNT(*) FROM visitors
UNION ALL SELECT 'family_members', COUNT(*) FROM family_members
UNION ALL SELECT 'members', COUNT(*) FROM members;

SELECT 'profiles' as table_name, COUNT(*) FROM profiles -- must match pre-execution count
UNION ALL SELECT 'custom_services', COUNT(*) FROM custom_services -- must be 4 (seeded rows)
UNION ALL SELECT 'expense_payment_methods', COUNT(*) FROM expense_payment_methods -- must be >= 5 (seeded rows)
UNION ALL SELECT 'system_dropdown_options', COUNT(*) FROM system_dropdown_options -- must be > 0
UNION ALL SELECT 'user_settings', COUNT(*) FROM user_settings
UNION ALL SELECT 'user_tab_access', COUNT(*) FROM user_tab_access
UNION ALL SELECT 'temporary_permissions', COUNT(*) FROM temporary_permissions;

DO $$ BEGIN RAISE NOTICE 'Reset complete. Verify counts above.'; END $$;
