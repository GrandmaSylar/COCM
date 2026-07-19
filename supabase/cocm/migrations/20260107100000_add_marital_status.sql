-- Add marital_status column to members table
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS marital_status TEXT
CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed'));

COMMENT ON COLUMN public.members.marital_status IS 'Marital status of the member: single, married, divorced, or widowed';
