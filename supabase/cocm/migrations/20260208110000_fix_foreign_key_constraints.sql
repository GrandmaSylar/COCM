-- Migration: Fix foreign key constraints to allow user deletion
-- Changes foreign keys to SET NULL on delete to preserve records while allowing user deletion

-- Fix service_records.created_by constraint
ALTER TABLE service_records
DROP CONSTRAINT IF EXISTS service_records_created_by_fkey;

ALTER TABLE service_records
ADD CONSTRAINT service_records_created_by_fkey
FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix activity_log.user_id constraint (if exists)
ALTER TABLE activity_log
DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;

ALTER TABLE activity_log
ADD CONSTRAINT activity_log_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix notifications.user_id constraint (if exists)
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

ALTER TABLE notifications
ADD CONSTRAINT notifications_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Fix user_tab_access.user_id constraint (if exists)
ALTER TABLE user_tab_access
DROP CONSTRAINT IF EXISTS user_tab_access_user_id_fkey;

ALTER TABLE user_tab_access
ADD CONSTRAINT user_tab_access_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Fix user_settings.user_id constraint (if exists)
ALTER TABLE user_settings
DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;

ALTER TABLE user_settings
ADD CONSTRAINT user_settings_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Fix temporary_permissions.user_id constraint (if exists)
ALTER TABLE temporary_permissions
DROP CONSTRAINT IF EXISTS temporary_permissions_user_id_fkey;

ALTER TABLE temporary_permissions
ADD CONSTRAINT temporary_permissions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Fix backup_history.created_by constraint (if exists)
ALTER TABLE backup_history
DROP CONSTRAINT IF EXISTS backup_history_created_by_fkey;

ALTER TABLE backup_history
ADD CONSTRAINT backup_history_created_by_fkey
FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
