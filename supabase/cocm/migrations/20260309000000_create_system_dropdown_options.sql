CREATE TABLE IF NOT EXISTS public.system_dropdown_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category, value)
);

ALTER TABLE public.system_dropdown_options ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.system_dropdown_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read options" ON public.system_dropdown_options;
CREATE POLICY "Allow authenticated users to read options"
    ON public.system_dropdown_options
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Allow dev users to manage options" ON public.system_dropdown_options;
CREATE POLICY "Allow dev users to manage options"
    ON public.system_dropdown_options
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'dev'
        )
    );

-- Seed initial data
INSERT INTO public.system_dropdown_options (category, label, value, sort_order) VALUES
-- Ministries
('ministries', 'Prayer Ministry', 'prayer_ministry', 1),
('ministries', 'Prophetic Ministry', 'prophetic_ministry', 2),
('ministries', 'Visitation Ministry', 'visitation_ministry', 3),
('ministries', 'Welfare Ministry', 'welfare_ministry', 4),
('ministries', 'Evangelism Ministry', 'evangelism_ministry', 5),
('ministries', 'Finance Ministry', 'finance_ministry', 6),
('ministries', 'Health Ministry', 'health_ministry', 7),
('ministries', 'Youth Ministry', 'youth_ministry', 8),
('ministries', 'Children''s Ministry', 'childrens_ministry', 9),
('ministries', 'Marriage Ministry', 'marriage_ministry', 10),
('ministries', 'Worship Ministry', 'worship_ministry', 11),
('ministries', 'Singing Ministry', 'singing_ministry', 12),
('ministries', 'House-Keeping Ministry', 'house_keeping_ministry', 13),
('ministries', 'Security Ministry', 'security_ministry', 14),
('ministries', 'Education Ministry', 'education_ministry', 15),
('ministries', 'Ushering Ministry', 'ushering_ministry', 16),
('ministries', 'Men Fellowship', 'men_fellowship', 17),
('ministries', 'Women Fellowship', 'women_fellowship', 18),
('ministries', 'Project/Building Committee', 'project_building_committee', 19),
('ministries', 'Scholarship Committee', 'scholarship_committee', 20),
('ministries', 'Business Support Fund Committee', 'business_support_fund_committee', 21),
('ministries', 'Zonal Leaders Committee', 'zonal_leaders_committee', 22),
('ministries', 'Equipment & Machines', 'equipment_machines', 23),
('ministries', 'Church Counsellors Committee', 'church_counsellors_committee', 24),
-- Position Held
('position_held', 'Pastor', 'pastor', 1),
('position_held', 'Elder', 'elder', 2),
('position_held', 'Deacon', 'deacon', 3),
('position_held', 'Usher', 'usher', 4),
('position_held', 'Youth Leader', 'youth_leader', 5),
('position_held', 'Song Leader', 'song_leader', 6),
('position_held', 'Prayer Leader', 'prayer_leader', 7),
('position_held', 'Secretary', 'secretary', 8),
('position_held', 'Treasurer', 'treasurer', 9),
-- ID Types
('id_types', 'Passport', 'passport', 1),
('id_types', 'Voter''s ID', 'voters_id', 2),
('id_types', 'Driver''s License', 'drivers_license', 3),
('id_types', 'NHIS Card', 'nhis_card', 4),
('id_types', 'Other', 'other', 5),
-- Service Types
('service_types', 'Sunday Main Service', 'sunday_main_service', 1),
('service_types', 'Midweek Service', 'midweek_service', 2),
('service_types', 'Prayer Meeting', 'prayer_meeting', 3),
('service_types', 'Special Programme', 'special_programme', 4),
-- Giving Types
('giving_types', 'Offering', 'offering', 1),
('giving_types', 'Donation', 'donation', 2),
('giving_types', 'Thanksgiving', 'thanksgiving', 3)
ON CONFLICT (category, value) DO NOTHING;

-- Add position_held to members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS position_held JSONB DEFAULT '[]'::jsonb;
