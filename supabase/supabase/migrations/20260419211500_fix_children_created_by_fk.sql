-- Drop existing constraints that block profile deletion
ALTER TABLE public.children_members 
  DROP CONSTRAINT IF EXISTS children_members_created_by_fkey;

ALTER TABLE public.children_attendance_records 
  DROP CONSTRAINT IF EXISTS children_attendance_records_created_by_fkey;

ALTER TABLE public.children_giving_records 
  DROP CONSTRAINT IF EXISTS children_giving_records_created_by_fkey;

ALTER TABLE public.children_visitors 
  DROP CONSTRAINT IF EXISTS children_visitors_created_by_fkey;

-- Re-add constraints with ON DELETE SET NULL
ALTER TABLE public.children_members
  ADD CONSTRAINT children_members_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) 
  ON DELETE SET NULL;

ALTER TABLE public.children_attendance_records
  ADD CONSTRAINT children_attendance_records_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) 
  ON DELETE SET NULL;

ALTER TABLE public.children_giving_records
  ADD CONSTRAINT children_giving_records_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) 
  ON DELETE SET NULL;

ALTER TABLE public.children_visitors
  ADD CONSTRAINT children_visitors_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) 
  ON DELETE SET NULL;
