-- Add church/congregation field to visitors table
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS church text;

-- Add church/congregation field to children_visitors table
ALTER TABLE children_visitors ADD COLUMN IF NOT EXISTS church text;
