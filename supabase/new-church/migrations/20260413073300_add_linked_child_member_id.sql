-- Migration: Add linked_child_member_id to children_member_parents
-- Enables child-to-child references and inverse links.

ALTER TABLE public.children_member_parents
ADD COLUMN IF NOT EXISTS linked_child_member_id uuid REFERENCES public.children_members(id) ON DELETE SET NULL;

