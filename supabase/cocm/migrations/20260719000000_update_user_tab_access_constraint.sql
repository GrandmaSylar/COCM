-- Drop the existing constraint
ALTER TABLE public.user_tab_access DROP CONSTRAINT IF EXISTS user_tab_access_tab_check;

-- Add the updated constraint including 'ministry' and 'zones'
ALTER TABLE public.user_tab_access ADD CONSTRAINT user_tab_access_tab_check CHECK (
  tab = ANY (ARRAY[
    'members'::text,
    'visitors'::text,
    'attendance'::text,
    'giving'::text,
    'reports'::text,
    'services'::text,
    'activity-log'::text,
    'children'::text,
    'expenses'::text,
    'ministry'::text,
    'zones'::text
  ])
);
