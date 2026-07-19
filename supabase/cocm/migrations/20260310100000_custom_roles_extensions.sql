-- Section A — Add new columns to custom_roles
ALTER TABLE public.custom_roles
ADD COLUMN IF NOT EXISTS description TEXT NULL,
ADD COLUMN IF NOT EXISTS tab_access JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS dashboard_widgets JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Section B — Drop the profiles_role_check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Section C — Add the updated_at auto-update trigger on custom_roles
DROP TRIGGER IF EXISTS update_custom_roles_updated_at ON public.custom_roles;
CREATE TRIGGER update_custom_roles_updated_at
BEFORE UPDATE ON public.custom_roles
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
