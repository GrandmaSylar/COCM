-- Create Postgres function for atomic custom role deletion and reassignment
CREATE OR REPLACE FUNCTION delete_custom_role_txn(
  p_role_id UUID,
  p_reassignments JSONB,
  p_user_id UUID,
  p_user_name TEXT,
  p_user_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role_name TEXT;
  v_rec JSONB;
BEGIN
  -- 1. Get the name of the role being deleted
  SELECT name INTO v_role_name FROM public.custom_roles WHERE id = p_role_id;
  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Custom role not found';
  END IF;

  -- 2. Loop through reassignments and update profiles
  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_reassignments)
  LOOP
    UPDATE public.profiles
    SET role = (v_rec->>'newRole')::TEXT,
        updated_at = NOW()
    WHERE id = (v_rec->>'userId')::UUID;

    -- Insert activity log for each reassignment
    INSERT INTO public.activity_log (user_id, user_name, user_role, action, entity_type, entity_id, description)
    VALUES (
      p_user_id,
      p_user_name,
      p_user_role,
      'update',
      'profile',
      (v_rec->>'userId')::UUID,
      'Changed role from ' || v_role_name || ' to ' || (v_rec->>'newRole')::TEXT || ' during custom role deletion'
    );
  END LOOP;

  -- 3. Delete the custom role
  DELETE FROM public.custom_roles WHERE id = p_role_id;

  -- 4. Insert activity log for role deletion
  INSERT INTO public.activity_log (user_id, user_name, user_role, action, entity_type, entity_id, description)
  VALUES (
    p_user_id,
    p_user_name,
    p_user_role,
    'delete',
    'custom_role',
    p_role_id,
    'Deleted custom role: ' || v_role_name
  );
END;
$$;
