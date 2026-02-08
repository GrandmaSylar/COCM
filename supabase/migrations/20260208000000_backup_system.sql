-- Backup System Tables
-- Phase 1: Core backup functionality

-- Backup history table to track all backups
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('full', 'differential')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  file_name TEXT NOT NULL,
  file_size BIGINT,
  record_counts JSONB,  -- {"members": 150, "attendance": 520, ...}
  based_on_backup_id UUID REFERENCES backup_history(id),  -- For differential backups
  based_on_backup_date TIMESTAMPTZ,  -- Date of the full backup this diff is based on
  storage_locations TEXT[] DEFAULT ARRAY['device'],  -- ['device', 'supabase', 'google_drive']
  supabase_path TEXT,  -- Path in Supabase storage bucket
  external_refs JSONB,  -- {"google_drive": "file_id", "dropbox": "file_id"}
  error_message TEXT,  -- Error details if status is 'failed'
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ  -- For auto-cleanup (optional)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_backup_history_type ON backup_history(type);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_by ON backup_history(created_by);

-- Enable RLS
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view backup history" ON backup_history;
DROP POLICY IF EXISTS "Admins can create backups" ON backup_history;
DROP POLICY IF EXISTS "Admins can update backups" ON backup_history;
DROP POLICY IF EXISTS "Admins can delete backups" ON backup_history;

-- Policies: Only admins and devs can manage backups
CREATE POLICY "Users can view backup history"
  ON backup_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('dev', 'admin')
    )
  );

CREATE POLICY "Admins can create backups"
  ON backup_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('dev', 'admin')
    )
  );

CREATE POLICY "Admins can update backups"
  ON backup_history FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('dev', 'admin')
    )
  );

CREATE POLICY "Admins can delete backups"
  ON backup_history FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('dev', 'admin')
    )
  );

-- Backup schedule settings (for future automation)
CREATE TABLE IF NOT EXISTS backup_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT false,
  full_backup_day TEXT DEFAULT 'sunday',  -- Day of week for full backup
  full_backup_time TIME DEFAULT '02:00',
  diff_backup_frequency TEXT DEFAULT 'daily',  -- 'daily' or 'weekly'
  diff_backup_time TIME DEFAULT '03:00',
  storage_destinations TEXT[] DEFAULT ARRAY['supabase'],
  retention_full INTEGER DEFAULT 4,  -- Keep last N full backups
  retention_diff INTEGER DEFAULT 7,  -- Keep last N differential backups
  last_full_backup_at TIMESTAMPTZ,
  last_diff_backup_at TIMESTAMPTZ,
  last_full_backup_id UUID REFERENCES backup_history(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for backup_schedule
ALTER TABLE backup_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage backup schedule" ON backup_schedule;

CREATE POLICY "Admins can manage backup schedule"
  ON backup_schedule FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('dev', 'admin')
    )
  );

-- Add comment
COMMENT ON TABLE backup_history IS 'Tracks all backup operations including full and differential backups';
COMMENT ON TABLE backup_schedule IS 'Configuration for automated backup scheduling';
