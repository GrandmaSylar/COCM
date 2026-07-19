-- Supabase Realtime requires REPLICA IDENTITY FULL on the table
-- so that DELETE events include the old row data (needed for member_id)
ALTER TABLE attendance_entries REPLICA IDENTITY FULL;
