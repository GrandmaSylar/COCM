-- Migration to drop the restrictive relationship constraint on children_member_parents
-- This allows setting relations like 'sibling' between members and children, or between two children.

ALTER TABLE public.children_member_parents 
  DROP CONSTRAINT IF EXISTS children_member_parents_relationship_check;

-- Optionally, you can add a less restrictive constraint, but it's often safer to rely on application-level validation
-- If you want to add it back with 'sibling', you could do:
-- ALTER TABLE public.children_member_parents 
--   ADD CONSTRAINT children_member_parents_relationship_check 
--   CHECK (relationship = ANY (ARRAY['mother'::text, 'father'::text, 'guardian'::text, 'sibling'::text]));
