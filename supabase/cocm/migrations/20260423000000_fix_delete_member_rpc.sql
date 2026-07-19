-- Fix delete_member_txn to properly cascade delete all dependent records

CREATE OR REPLACE FUNCTION delete_member_txn(target_member_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Clean up inverse and family links
  DELETE FROM family_members WHERE linked_member_id = target_member_id OR member_id = target_member_id;
  DELETE FROM children_member_parents WHERE linked_member_id = target_member_id;

  -- 2. Nullify service_setups
  UPDATE service_setups SET mc_member_id = NULL WHERE mc_member_id = target_member_id;
  UPDATE service_setups SET preacher_member_id = NULL WHERE preacher_member_id = target_member_id;

  -- 3. Reset visitor conversions
  UPDATE visitors SET converted_to_member = false, converted_member_id = NULL WHERE converted_member_id = target_member_id;
  UPDATE children_visitors SET converted_to_member = false, converted_member_id = NULL WHERE converted_member_id = target_member_id;

  -- 4. Delete attendance, giving, absentee, and status logs
  DELETE FROM attendance_entries WHERE member_id = target_member_id;
  DELETE FROM giving_records WHERE member_id = target_member_id;
  DELETE FROM absentee_records WHERE member_id = target_member_id;
  DELETE FROM member_status_log WHERE member_id = target_member_id;

  -- 5. Finally, delete the member row
  DELETE FROM members WHERE id = target_member_id;
END;
$$;
