-- Fix delete_member_txn to properly handle expense_records, expense_requisitions, and children_members conversions

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

  -- 3. Reset visitor and child member conversions
  UPDATE visitors SET converted_to_member = false, converted_member_id = NULL WHERE converted_member_id = target_member_id;
  UPDATE children_visitors SET converted_to_member = false, converted_member_id = NULL WHERE converted_member_id = target_member_id;
  UPDATE children_members SET converted_to_member = false, converted_member_id = NULL WHERE converted_member_id = target_member_id;

  -- 4. Nullify expense records references
  UPDATE expense_records SET requested_by_id = NULL WHERE requested_by_id = target_member_id;
  UPDATE expense_records SET recommended_by_id = NULL WHERE recommended_by_id = target_member_id;
  UPDATE expense_records SET approved_by_id = NULL WHERE approved_by_id = target_member_id;

  -- 5. Nullify expense requisitions references
  UPDATE expense_requisitions SET requested_by = NULL WHERE requested_by = target_member_id;
  UPDATE expense_requisitions SET recommended_by = NULL WHERE recommended_by = target_member_id;
  UPDATE expense_requisitions SET approved_by = NULL WHERE approved_by = target_member_id;

  -- 6. Delete attendance, absentee, and status logs
  DELETE FROM attendance_entries WHERE member_id = target_member_id;
  DELETE FROM absentee_records WHERE member_id = target_member_id;
  DELETE FROM member_status_log WHERE member_id = target_member_id;

  -- 7. Finally, delete the member row
  DELETE FROM members WHERE id = target_member_id;
END;
$$;
