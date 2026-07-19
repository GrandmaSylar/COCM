-- Add phone column to profiles table for phone-based login
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "phone" "text";

-- Create index for faster phone lookups
CREATE INDEX IF NOT EXISTS "idx_profiles_phone" ON "public"."profiles" ("phone");
