CREATE OR REPLACE FUNCTION delete_member_txn(target_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clean up inverse links
  DELETE FROM family_members WHERE linked_member_id = target_member_id;
  DELETE FROM children_member_parents WHERE linked_member_id = target_member_id;

  -- Delete the member row
  DELETE FROM members WHERE id = target_member_id;
END;
$$;
