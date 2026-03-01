-- Adding missing columns to children_visitors
ALTER TABLE children_visitors ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE children_visitors ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Create children_visitor_guardians table
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

-- Drop old columns from children_visitors
ALTER TABLE children_visitors DROP COLUMN IF EXISTS follow_up_status;
ALTER TABLE children_visitors DROP COLUMN IF EXISTS parent_guardian_name;
ALTER TABLE children_visitors DROP COLUMN IF EXISTS parent_guardian_phone;

-- Enable RLS and add policies for children_visitor_guardians
ALTER TABLE children_visitor_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for view_members" ON children_visitor_guardians
    FOR SELECT
    USING (
        has_permission(auth.uid(), 'view_members')
    );

CREATE POLICY "Enable insert/update/delete for manage_members" ON children_visitor_guardians
    FOR ALL
    USING (
        has_permission(auth.uid(), 'manage_members')
    );
