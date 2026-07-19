-- Fix missing INSERT policy for custom_giving_types table
-- The existing "Authorized users can manage giving types" policy only has USING clause
-- which doesn't apply to INSERT operations. We need to add a specific INSERT policy.

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Authorized users can insert giving types" ON "public"."custom_giving_types";

-- Add INSERT policy for custom_giving_types
CREATE POLICY "Authorized users can insert giving types"
  ON "public"."custom_giving_types"
  FOR INSERT
  WITH CHECK ("public"."has_permission"("auth"."uid"(), 'manage_giving_types'::"text"));
