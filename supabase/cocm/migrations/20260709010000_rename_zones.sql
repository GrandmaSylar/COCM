-- Migration: Update zone names and descriptions
UPDATE public.zones SET name = 'Zone A - Abossey Okai', description = 'Abossey Okai geographic cell group' WHERE name = 'Zone A';
UPDATE public.zones SET name = 'Zone B - Bubiashie', description = 'Bubiashie geographic cell group' WHERE name = 'Zone B';
UPDATE public.zones SET name = 'Zone F - Floating', description = 'Floating/Non-residential care cell group' WHERE name = 'Zone F';
UPDATE public.zones SET name = 'Zone K - Kasoa', description = 'Kasoa geographic cell group' WHERE name = 'Zone K';
UPDATE public.zones SET name = 'Zone M - Mataheko', description = 'Mataheko geographic cell group' WHERE name = 'Zone M';
UPDATE public.zones SET name = 'Zone R - Russia', description = 'Russia geographic cell group' WHERE name = 'Zone R';
