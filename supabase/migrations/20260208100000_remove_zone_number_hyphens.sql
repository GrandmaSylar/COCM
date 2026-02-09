-- Migration: Remove hyphens from zone numbers
-- Changes format from 'M-15' to 'M15'

UPDATE members
SET zone_number = REPLACE(zone_number, '-', '')
WHERE zone_number LIKE '%-%';
