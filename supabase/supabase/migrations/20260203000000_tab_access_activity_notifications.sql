-- ============================================================================
-- Per-User Tab Access Control
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_tab_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tab text NOT NULL CHECK (tab IN ('members', 'visitors', 'attendance', 'giving', 'reports', 'services', 'activity-log')),
  granted_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tab)
);

-- ============================================================================
-- Service Records (aggregated per-service view)
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_date date NOT NULL,
  service_type text NOT NULL,
  attendance_record_id uuid REFERENCES attendance_records(id) ON DELETE SET NULL,
  giving_record_id uuid REFERENCES giving_records(id) ON DELETE SET NULL,
  members_registered integer DEFAULT 0,
  absentees_count integer DEFAULT 0,
  visitors_count integer DEFAULT 0,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(service_date, service_type)
);

-- ============================================================================
-- Activity Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_name text NOT NULL,
  user_role text NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'login', 'logout', 'approve', 'reject', 'grant', 'revoke')),
  entity_type text NOT NULL,
  entity_id text,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- ============================================================================
-- Notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  tab text,
  entity_type text,
  entity_id text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
