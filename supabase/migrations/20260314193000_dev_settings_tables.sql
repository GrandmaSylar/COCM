-- Migration: Dev Settings Config Tables
-- Description: Creates tables for notification and activity log visibility configuration.

-- 1. Notification Type Configuration
CREATE TABLE IF NOT EXISTS public.notification_type_config (
    type TEXT PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT true,
    allowed_roles TEXT[] DEFAULT '{}',
    allowed_user_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_type_config ENABLE ROW LEVEL SECURITY;

-- 2. Activity Log Configuration
CREATE TABLE IF NOT EXISTS public.activity_log_config (
    action_type TEXT,
    entity_type TEXT,
    is_enabled BOOLEAN DEFAULT true,
    allowed_roles TEXT[] DEFAULT '{}',
    allowed_user_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (action_type, entity_type)
);

-- Enable RLS
ALTER TABLE public.activity_log_config ENABLE ROW LEVEL SECURITY;

-- Add policies for dev role access
-- (Assuming profiles table has a 'role' column)
CREATE POLICY "Devs can manage notification config" ON public.notification_type_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'dev'
        )
    );

CREATE POLICY "Devs can manage activity log config" ON public.activity_log_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'dev'
        )
    );

-- Also allow authenticated users to view enabled configs
CREATE POLICY "Authenticated users can view notification config" ON public.notification_type_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view activity log config" ON public.activity_log_config
    FOR SELECT TO authenticated USING (true);
