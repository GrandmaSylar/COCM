-- Add approval_status column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'
CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Update existing users to have 'approved' status
UPDATE public.profiles
SET approval_status = 'approved'
WHERE approval_status IS NULL;

-- Add index for faster queries on pending users
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON public.profiles(approval_status);

-- Add approved_by and approved_at columns for audit trail
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.profiles.approval_status IS 'Status of user account approval: pending, approved, or rejected';
COMMENT ON COLUMN public.profiles.approved_by IS 'User ID of the admin/dev who approved this account';
COMMENT ON COLUMN public.profiles.approved_at IS 'Timestamp when the account was approved';
