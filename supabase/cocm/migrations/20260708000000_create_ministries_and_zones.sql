-- Create ZONES table
CREATE TABLE IF NOT EXISTS public.zones (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    description text,
    leader_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view zones" ON public.zones FOR SELECT USING (public.has_permission(auth.uid(), 'view_members'));
CREATE POLICY "Authorized users can manage zones" ON public.zones USING (public.has_permission(auth.uid(), 'manage_members'));

-- Add zone_id to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL;

-- Add zone_id to visitors
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.zones(id) ON DELETE SET NULL;

-- Create ZONE_ATTENDANCE table
CREATE TABLE IF NOT EXISTS public.zone_attendance (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
    date date NOT NULL,
    meeting_type text DEFAULT 'Cell Meeting',
    total_present integer DEFAULT 0,
    notes text,
    recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.zone_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view zone attendance" ON public.zone_attendance FOR SELECT USING (public.has_permission(auth.uid(), 'view_attendance'));
CREATE POLICY "Authorized users can manage zone attendance" ON public.zone_attendance USING (public.has_permission(auth.uid(), 'record_attendance'));

-- Create MINISTRIES table
CREATE TABLE IF NOT EXISTS public.ministries (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name text NOT NULL,
    description text,
    color text,
    icon text,
    leader_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
    next_event_date timestamp with time zone,
    next_event_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ministries" ON public.ministries FOR SELECT USING (public.has_permission(auth.uid(), 'view_members'));
CREATE POLICY "Authorized users can manage ministries" ON public.ministries USING (public.has_permission(auth.uid(), 'manage_members'));

-- Create MINISTRY_MEMBERS table (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.ministry_members (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    role text DEFAULT 'Member',
    joined_at timestamp with time zone DEFAULT now(),
    UNIQUE(ministry_id, member_id)
);

ALTER TABLE public.ministry_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ministry members" ON public.ministry_members FOR SELECT USING (public.has_permission(auth.uid(), 'view_members'));
CREATE POLICY "Authorized users can manage ministry members" ON public.ministry_members USING (public.has_permission(auth.uid(), 'manage_members'));

-- Triggers for updated_at
CREATE OR REPLACE TRIGGER update_zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_zone_attendance_updated_at BEFORE UPDATE ON public.zone_attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE TRIGGER update_ministries_updated_at BEFORE UPDATE ON public.ministries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions to anon and authenticated
GRANT ALL ON TABLE public.zones TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.zone_attendance TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ministries TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ministry_members TO anon, authenticated, service_role;
