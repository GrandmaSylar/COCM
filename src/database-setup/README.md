# Database Setup Instructions

Follow these steps **in order** to set up your Church Management System database.

## Prerequisites

1. A Supabase account and project
2. Access to the Supabase SQL Editor

## Setup Steps

### Step 1: Create Tables

1. Open your Supabase Dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire contents of `01-tables.sql`
5. Paste into the SQL Editor
6. Click **Run** or press `Ctrl+Enter`
7. ✅ Wait for "Success. No rows returned"

### Step 2: Create Indexes

1. Click **New Query** again
2. Copy the entire contents of `02-indexes.sql`
3. Paste into the SQL Editor
4. Click **Run**
5. ✅ Wait for success

### Step 3: Create Functions

**IMPORTANT: Run each function ONE AT A TIME**

#### Function 1: get_user_role
1. Click **New Query**
2. Copy ONLY this function from `03-functions.sql`:
```sql
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$;
```
3. Paste and click **Run**
4. ✅ Wait for "Success"

#### Function 2: has_permission
1. Click **New Query**
2. Copy ONLY this function from `03-functions.sql`:
```sql
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
```
3. Paste and click **Run**
4. ✅ Wait for "Success"

#### Function 3: cleanup_expired_permissions
1. Click **New Query**
2. Copy ONLY this function from `03-functions.sql`:
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM temporary_permissions WHERE expires_at < NOW();
END;
$$;
```
3. Paste and click **Run**
4. ✅ Wait for "Success"

#### Function 4: update_attendance_total_count
1. Click **New Query**
2. Copy ONLY this function from `03-functions.sql`:
```sql
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
```
3. Paste and click **Run**
4. ✅ Wait for "Success"

#### Function 5: update_updated_at_column
1. Click **New Query**
2. Copy ONLY this function from `03-functions.sql`:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```
3. Paste and click **Run**
4. ✅ Wait for "Success"

### Step 4: Create Triggers

1. Click **New Query**
2. Copy the entire contents of `04-triggers.sql`
3. Paste into the SQL Editor
4. Click **Run**
5. ✅ Wait for success

### Step 5: Enable Row Level Security

1. Click **New Query**
2. Copy the entire contents of `05-rls-enable.sql`
3. Paste into the SQL Editor
4. Click **Run**
5. ✅ Wait for success

### Step 6: Create RLS Policies

1. Click **New Query**
2. Copy the entire contents of `06-rls-policies.sql`
3. Paste into the SQL Editor
4. Click **Run**
5. ✅ Wait for success

## Verification

To verify your setup is complete, run this query:

```sql
SELECT 
  'Tables' as type, 
  COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public'

UNION ALL

SELECT 
  'Functions' as type, 
  COUNT(*) as count 
FROM information_schema.routines 
WHERE routine_schema = 'public'

UNION ALL

SELECT 
  'Policies' as type, 
  COUNT(*) as count 
FROM pg_policies 
WHERE schemaname = 'public';
```

Expected results:
- Tables: 11
- Functions: 5
- Policies: 23

## Troubleshooting

### "Unterminated dollar-quoted string" Error

If you still get this error:
1. Make sure you're running **each function separately** in Step 3
2. Clear the SQL Editor completely before pasting each new query
3. Don't copy multiple functions at once

### "Function already exists" Error

This is fine - it means you already created that function. Continue to the next step.

### "Permission denied" Error

Make sure you're using your Supabase project with proper admin access.

## Next Steps

After completing the database setup:

1. Go to **Storage** in Supabase Dashboard
2. Create a bucket named `member-photos` (set as private)
3. Continue with the backend API deployment from `SERVER_IMPLEMENTATION.md`
4. Update your frontend to use the API from `BACKEND_INTEGRATION_GUIDE.md`

## Storage Setup (After Database)

### Create Storage Bucket for Photos

1. Go to **Storage** in Supabase Dashboard
2. Click **New Bucket**
3. Name: `member-photos`
4. Set as **Private**
5. Click **Save**

### Add Storage Policies

Go to Storage → member-photos → Policies and run this SQL:

```sql
-- Policy for uploading photos
CREATE POLICY "Authenticated users can upload member photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'member-photos' AND
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'admin')
  ))
);

-- Policy for viewing photos
CREATE POLICY "Authenticated users can view member photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'member-photos');

-- Policy for updating photos
CREATE POLICY "Authenticated users can update member photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'member-photos' AND
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'admin')
  ))
);

-- Policy for deleting photos
CREATE POLICY "Authenticated users can delete member photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'member-photos' AND
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'admin')
  ))
);
```

## Support

If you encounter any issues:
1. Check the Supabase Dashboard logs
2. Verify each step was completed successfully
3. Ensure you're running queries in the correct order
4. Check that your Supabase project has sufficient resources
