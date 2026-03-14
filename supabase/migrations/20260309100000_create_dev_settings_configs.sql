-- Create notification_type_config table
CREATE TABLE IF NOT EXISTS public.notification_type_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL UNIQUE,
    is_enabled BOOLEAN DEFAULT true,
    allowed_roles JSONB DEFAULT '[]'::jsonb,
    allowed_user_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notification_type_config ENABLE ROW LEVEL SECURITY;

-- Dev role can manage
DROP POLICY IF EXISTS "Devs can manage notification config" ON public.notification_type_config;
CREATE POLICY "Devs can manage notification config"
    ON public.notification_type_config
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'dev'
        )
    );

-- All authenticated users can read (needed for filtering)
DROP POLICY IF EXISTS "Authenticated users can read notification config" ON public.notification_type_config;
CREATE POLICY "Authenticated users can read notification config"
    ON public.notification_type_config
    FOR SELECT
    TO authenticated
    USING (true);


-- Create activity_log_config table
CREATE TABLE IF NOT EXISTS public.activity_log_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    allowed_roles JSONB DEFAULT '[]'::jsonb,
    allowed_user_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(action_type, entity_type)
);

-- Enable RLS
ALTER TABLE public.activity_log_config ENABLE ROW LEVEL SECURITY;

-- Dev role can manage
DROP POLICY IF EXISTS "Devs can manage activity log config" ON public.activity_log_config;
CREATE POLICY "Devs can manage activity log config"
    ON public.activity_log_config
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'dev'
        )
    );

-- All authenticated users can read
DROP POLICY IF EXISTS "Authenticated users can read activity log config" ON public.activity_log_config;
CREATE POLICY "Authenticated users can read activity log config"
    ON public.activity_log_config
    FOR SELECT
    TO authenticated
    USING (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_notification_type_config_updated_at ON public.notification_type_config;
CREATE TRIGGER update_notification_type_config_updated_at
    BEFORE UPDATE ON public.notification_type_config
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_activity_log_config_updated_at ON public.activity_log_config;
CREATE TRIGGER update_activity_log_config_updated_at
    BEFORE UPDATE ON public.activity_log_config
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
