-- ============================================================================
-- STEP 3: CREATE FUNCTIONS
-- Run each function separately in the Supabase SQL Editor
-- ============================================================================

-- FUNCTION 1: Get user role
-- Copy and run this first:
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$;

-- Wait for success, then run FUNCTION 2: Check permissions
-- Copy and run this second:
CREATE OR REPLACE FUNCTION has_permission(user_id UUID, permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
  has_temp_perm BOOLEAN;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = user_id;
  
  IF user_role = 'dev' THEN
    RETURN true;
  END IF;
  
  IF user_role = 'admin' AND permission_name IN (
    'manage_users', 'manage_members', 'view_members', 'edit_members', 'delete_members',
    'manage_attendance', 'view_attendance', 'record_attendance',
    'manage_giving', 'view_giving', 'record_giving', 'manage_giving_types',
    'view_reports', 'manage_settings', 'manage_services', 'grant_permissions'
  ) THEN
    RETURN true;
  END IF;
  
  IF user_role IN ('pastor', 'elder') AND permission_name IN (
    'view_members', 'view_attendance', 'view_giving', 'view_reports'
  ) THEN
    RETURN true;
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM temporary_permissions
    WHERE temporary_permissions.user_id = has_permission.user_id 
    AND permission = permission_name 
    AND expires_at > NOW()
  ) INTO has_temp_perm;
  
  RETURN has_temp_perm;
END;
$$;

-- Wait for success, then run FUNCTION 3: Cleanup expired permissions
-- Copy and run this third:
CREATE OR REPLACE FUNCTION cleanup_expired_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM temporary_permissions WHERE expires_at < NOW();
END;
$$;

-- Wait for success, then run FUNCTION 4: Update attendance count
-- Copy and run this fourth:
CREATE OR REPLACE FUNCTION update_attendance_total_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE attendance_records
  SET total_count = (
    SELECT COUNT(*) FROM attendance_entries 
    WHERE attendance_record_id = NEW.attendance_record_id
  )
  WHERE id = NEW.attendance_record_id;
  RETURN NEW;
END;
$$;

-- Wait for success, then run FUNCTION 5: Update timestamps
-- Copy and run this fifth:
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
