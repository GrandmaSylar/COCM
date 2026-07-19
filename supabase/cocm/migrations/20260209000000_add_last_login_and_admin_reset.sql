-- Add last_login column to profiles for tracking online/offline status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Create index for efficient queries on last_login
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON profiles(last_login);

-- Comment for clarity
COMMENT ON COLUMN profiles.last_login IS 'Timestamp of last successful login, used to determine online/offline status';
