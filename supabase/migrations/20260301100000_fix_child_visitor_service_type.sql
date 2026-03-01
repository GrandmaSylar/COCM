-- Section A: Drop the NOT NULL constraint on service_type
ALTER TABLE children_visitors ALTER COLUMN service_type DROP NOT NULL;

-- Section B: Defensive re-creation of children_visitor_guardians

CREATE TABLE IF NOT EXISTS children_visitor_guardians (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_id uuid NOT NULL REFERENCES children_visitors(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    residential_location text,
    contact_info text,
    created_at timestamptz DEFAULT now()
);

-- Index for join performance
CREATE INDEX IF NOT EXISTS idx_children_visitor_guardians_visitor_id ON children_visitor_guardians(visitor_id);

-- Enable RLS and add policies for children_visitor_guardians
ALTER TABLE children_visitor_guardians ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'children_visitor_guardians'
          AND policyname = 'Enable read access for view_members'
    ) THEN
        CREATE POLICY "Enable read access for view_members" ON children_visitor_guardians
            FOR SELECT
            USING (
                has_permission(auth.uid(), 'view_members')
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'children_visitor_guardians'
          AND policyname = 'Enable insert/update/delete for manage_members'
    ) THEN
        CREATE POLICY "Enable insert/update/delete for manage_members" ON children_visitor_guardians
            FOR ALL
            USING (
                has_permission(auth.uid(), 'manage_members')
            );
    END IF;
END
$$;
