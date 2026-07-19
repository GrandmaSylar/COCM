-- Enable RLS on tables that previously had it disabled.
-- All access to these tables goes through the Edge Function (service_role),
-- so we deny direct access from anon/authenticated and allow only service_role.

-- 1. absentee_records
ALTER TABLE absentee_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on absentee_records"
  ON absentee_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on activity_log"
  ON activity_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. member_status_log
ALTER TABLE member_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on member_status_log"
  ON member_status_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on notifications"
  ON notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. otp_codes
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on otp_codes"
  ON otp_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. service_records
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on service_records"
  ON service_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. user_tab_access
ALTER TABLE user_tab_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on user_tab_access"
  ON user_tab_access
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
