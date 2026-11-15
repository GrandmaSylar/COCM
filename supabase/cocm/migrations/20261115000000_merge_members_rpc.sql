-- Merge a duplicate member record into the one being kept, in one transaction.
--
-- Everything that points at the duplicate is moved to the kept member, any blank
-- fields on the kept member can be filled from the duplicate (the caller chooses
-- which), the duplicate row is deleted, and one activity_log entry is written that
-- includes a full copy of the deleted row. If anything fails, nothing changes.
--
-- Called only by the Edge Function (service role) for the developer admin app.
-- Apply by hand in the SQL editor: `supabase db push` is not safe on this project
-- (see CLAUDE.md), so this migration is not applied automatically.

CREATE OR REPLACE FUNCTION public.merge_members_txn(
  keep_id uuid,
  drop_id uuid,
  field_patch jsonb DEFAULT '{}'::jsonb,
  actor_id uuid DEFAULT NULL,
  actor_name text DEFAULT NULL,
  actor_role text DEFAULT NULL,
  merge_reason text DEFAULT NULL,
  expected_keep_updated timestamptz DEFAULT NULL,
  expected_drop_updated timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keep_row members%ROWTYPE;
  drop_row members%ROWTYPE;
  moved jsonb := '{}'::jsonb;
  n integer;
  removed integer;
BEGIN
  IF keep_id IS NULL OR drop_id IS NULL OR keep_id = drop_id THEN
    RAISE EXCEPTION 'Choose two different members';
  END IF;

  -- Lock both rows in a fixed order so two merges cannot deadlock.
  PERFORM 1 FROM members WHERE id IN (keep_id, drop_id) ORDER BY id FOR UPDATE;
  SELECT * INTO keep_row FROM members WHERE id = keep_id;
  SELECT * INTO drop_row FROM members WHERE id = drop_id;
  IF keep_row.id IS NULL THEN RAISE EXCEPTION 'The member to keep was not found'; END IF;
  IF drop_row.id IS NULL THEN RAISE EXCEPTION 'The duplicate member was not found'; END IF;
  -- Refuse if either record changed after the person looked at it (checked under the lock).
  IF keep_row.updated_at IS DISTINCT FROM expected_keep_updated OR drop_row.updated_at IS DISTINCT FROM expected_drop_updated THEN
    RAISE EXCEPTION 'STALE: a record changed since it was previewed';
  END IF;

  -- Attendance: a member can only appear once per attendance record. Where both
  -- records were ticked on the same service, the person was counted twice, so the
  -- record's total drops by one and the duplicate tick is removed.
  UPDATE attendance_records r
     SET total_count = GREATEST(r.total_count - 1, 0)
   WHERE r.id IN (
     SELECT d.attendance_record_id
       FROM attendance_entries d
       JOIN attendance_entries k ON k.attendance_record_id = d.attendance_record_id
      WHERE d.member_id = drop_id AND k.member_id = keep_id
   );
  DELETE FROM attendance_entries d
   WHERE d.member_id = drop_id
     AND EXISTS (SELECT 1 FROM attendance_entries k WHERE k.attendance_record_id = d.attendance_record_id AND k.member_id = keep_id);
  GET DIAGNOSTICS removed = ROW_COUNT;
  UPDATE attendance_entries SET member_id = keep_id WHERE member_id = drop_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  moved := moved || jsonb_build_object('attendance_entries', n, 'attendance_entries_already_present', removed);

  DELETE FROM absentee_records d
   WHERE d.member_id = drop_id
     AND EXISTS (SELECT 1 FROM absentee_records k WHERE k.attendance_record_id = d.attendance_record_id AND k.member_id = keep_id);
  UPDATE absentee_records SET member_id = keep_id WHERE member_id = drop_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  moved := moved || jsonb_build_object('absentee_records', n);

  UPDATE member_status_log SET member_id = keep_id WHERE member_id = drop_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  moved := moved || jsonb_build_object('member_status_log', n);

  -- Family links, in both directions.
  UPDATE family_members SET member_id = keep_id WHERE member_id = drop_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  moved := moved || jsonb_build_object('family_members', n);
  UPDATE family_members SET linked_member_id = keep_id WHERE linked_member_id = drop_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  moved := moved || jsonb_build_object('family_links', n);
  -- A person cannot be their own relative (the two records may have listed each other).
  DELETE FROM family_members WHERE member_id = keep_id AND linked_member_id = keep_id;

  UPDATE children_member_parents SET linked_member_id = keep_id WHERE linked_member_id = drop_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  moved := moved || jsonb_build_object('children_parent_links', n);

  UPDATE service_setups SET mc_member_id = keep_id WHERE mc_member_id = drop_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  moved := moved || jsonb_build_object('service_setups_mc', n);
  UPDATE service_setups SET preacher_member_id = keep_id WHERE preacher_member_id = drop_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  moved := moved || jsonb_build_object('service_setups_preacher', n);

  UPDATE visitors SET converted_member_id = keep_id WHERE converted_member_id = drop_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  moved := moved || jsonb_build_object('visitors_converted', n);
  UPDATE children_members SET converted_member_id = keep_id WHERE converted_member_id = drop_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  moved := moved || jsonb_build_object('children_converted', n);

  UPDATE expense_records SET requested_by_id = keep_id WHERE requested_by_id = drop_id;
  UPDATE expense_records SET recommended_by_id = keep_id WHERE recommended_by_id = drop_id;
  UPDATE expense_records SET approved_by_id = keep_id WHERE approved_by_id = drop_id;
  UPDATE expense_requisitions SET requested_by = keep_id WHERE requested_by = drop_id;
  UPDATE expense_requisitions SET recommended_by = keep_id WHERE recommended_by = drop_id;
  UPDATE expense_requisitions SET approved_by = keep_id WHERE approved_by = drop_id;

  -- Blank fields on the kept member that the caller chose to fill from the duplicate.
  UPDATE members SET
    other_names     = CASE WHEN field_patch ? 'other_names'     THEN field_patch->>'other_names'     ELSE other_names END,
    email           = CASE WHEN field_patch ? 'email'           THEN field_patch->>'email'           ELSE email END,
    second_phone    = CASE WHEN field_patch ? 'second_phone'    THEN field_patch->>'second_phone'    ELSE second_phone END,
    gender          = CASE WHEN field_patch ? 'gender'          THEN field_patch->>'gender'          ELSE gender END,
    date_of_birth   = CASE WHEN field_patch ? 'date_of_birth'   THEN (field_patch->>'date_of_birth')::date ELSE date_of_birth END,
    digital_address = CASE WHEN field_patch ? 'digital_address' THEN field_patch->>'digital_address' ELSE digital_address END,
    notes           = CASE WHEN field_patch ? 'notes'           THEN field_patch->>'notes'           ELSE notes END,
    photo_url       = CASE WHEN field_patch ? 'photo_url'       THEN field_patch->>'photo_url'       ELSE photo_url END,
    baptism_info    = CASE WHEN field_patch ? 'baptism_info'    THEN field_patch->'baptism_info'     ELSE baptism_info END,
    legal_info      = CASE WHEN field_patch ? 'legal_info'      THEN field_patch->'legal_info'       ELSE legal_info END,
    ministries      = CASE WHEN field_patch ? 'ministries'      THEN field_patch->'ministries'       ELSE ministries END,
    updated_at      = now()
  WHERE id = keep_id;

  -- Any reference this function does not know about makes this fail and roll back.
  DELETE FROM members WHERE id = drop_id;

  INSERT INTO activity_log (user_id, user_name, user_role, action, entity_type, entity_id, description, metadata)
  VALUES (
    actor_id, actor_name, actor_role, 'admin_fix', 'member', keep_id,
    format('Merged duplicate member %s %s (%s) into %s %s (%s) (admin fix)',
      drop_row.first_name, drop_row.last_name, drop_row.zone_number,
      keep_row.first_name, keep_row.last_name, keep_row.zone_number),
    jsonb_build_object(
      'kind', 'member_merge',
      'memberId', keep_id,
      'before', drop_row.zone_number,
      'after', keep_row.zone_number,
      'reason', merge_reason,
      'source', 'admin-app',
      'deletedMemberId', drop_id,
      'deletedMember', to_jsonb(drop_row),
      'fieldsFilled', field_patch,
      'moved', moved
    )
  );

  RETURN jsonb_build_object('keptId', keep_id, 'deletedId', drop_id, 'moved', moved);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_members_txn(uuid, uuid, jsonb, uuid, text, text, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_members_txn(uuid, uuid, jsonb, uuid, text, text, text, timestamptz, timestamptz) TO service_role;
