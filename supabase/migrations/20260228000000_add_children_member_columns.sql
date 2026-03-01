-- Migration: Add missing columns to children_members and children_member_parents
-- These columns were created in the Supabase dashboard but are absent from migration files.

ALTER TABLE public.children_members
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS second_phone TEXT,
  ADD COLUMN IF NOT EXISTS digital_address TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS hometown TEXT;

ALTER TABLE public.children_member_parents
  ADD COLUMN IF NOT EXISTS other_names TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS hometown TEXT;
