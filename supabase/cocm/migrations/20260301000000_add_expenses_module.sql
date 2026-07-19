-- Create expense_payment_methods table
CREATE TABLE IF NOT EXISTS expense_payment_methods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create expense_records table
CREATE TABLE IF NOT EXISTS expense_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id text UNIQUE NOT NULL,
    expense_date date NOT NULL,
    details text NOT NULL,
    service_date date NOT NULL,
    service_type text NOT NULL,
    amount decimal(10,2) NOT NULL,
    payment_method_id uuid REFERENCES expense_payment_methods(id),
    payment_method_name text NOT NULL,
    reference_number text,
    requested_by_id uuid REFERENCES members(id),
    requested_by_name text,
    recommended_by_id uuid REFERENCES members(id),
    recommended_by_name text,
    approved_by_id uuid REFERENCES members(id),
    approved_by_name text,
    status text NOT NULL DEFAULT 'approved',
    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Seed default payment methods
INSERT INTO expense_payment_methods (name) VALUES 
('Cash'), ('Cheque'), ('Mobile Money'), ('Bank Transfer'), ('Other')
ON CONFLICT (name) DO NOTHING;

-- DB-level guard: status must always be 'approved' for this ticket scope
ALTER TABLE expense_records ADD CONSTRAINT chk_expense_status CHECK (status = 'approved');

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_expense_records_expense_date ON expense_records(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_records_service_date_type ON expense_records(service_date, service_type);

-- Enable RLS
ALTER TABLE expense_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;

-- Policies for expense_payment_methods
CREATE POLICY "Enable read access for view_members" ON expense_payment_methods
    FOR SELECT USING (has_permission(auth.uid(), 'view_members'));
CREATE POLICY "Enable insert/update/delete for manage_members" ON expense_payment_methods
    FOR ALL USING (has_permission(auth.uid(), 'manage_members'));

-- Policies for expense_records
CREATE POLICY "Enable read access for view_members" ON expense_records
    FOR SELECT USING (has_permission(auth.uid(), 'view_members'));
CREATE POLICY "Enable insert/update/delete for manage_members" ON expense_records
    FOR ALL USING (has_permission(auth.uid(), 'manage_members'));
