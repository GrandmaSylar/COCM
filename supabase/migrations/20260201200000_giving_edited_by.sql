-- Add edited_by and edited_at columns to giving_records
ALTER TABLE public.giving_records
  ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
