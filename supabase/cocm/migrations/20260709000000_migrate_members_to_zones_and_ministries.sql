-- Migration: Move historical members data into zones and ministries tables
DO $$
DECLARE
    m RECORD;
    z_id UUID;
    min_name TEXT;
    min_id UUID;
    zone_name TEXT;
BEGIN
    -- 1. Create zones from members
    FOR zone_name IN 
        SELECT DISTINCT zone FROM public.members WHERE zone IS NOT NULL AND zone <> ''
    LOOP
        -- Insert into zones if not exists
        IF NOT EXISTS (SELECT 1 FROM public.zones WHERE name = 'Zone ' || zone_name) THEN
            INSERT INTO public.zones (name, description)
            VALUES ('Zone ' || zone_name, 'Geographic cell group ' || zone_name);
        END IF;
    END LOOP;

    -- 2. Create ministries from members
    FOR min_name IN 
        SELECT DISTINCT jsonb_array_elements_text(ministries) FROM public.members WHERE ministries IS NOT NULL AND jsonb_typeof(ministries) = 'array'
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.ministries WHERE name = min_name) THEN
            INSERT INTO public.ministries (name, description, color, icon)
            VALUES (
                min_name, 
                min_name || ' Department', 
                'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400', 
                CASE 
                    WHEN min_name ILIKE '%singing%' OR min_name ILIKE '%music%' THEN 'music'
                    WHEN min_name ILIKE '%security%' THEN 'shield'
                    WHEN min_name ILIKE '%usher%' THEN 'hearthandshake'
                    ELSE 'handheart'
                END
            );
        END IF;
    END LOOP;

    -- 3. Link members to zones
    FOR m IN SELECT id, zone FROM public.members WHERE zone IS NOT NULL AND zone <> '' LOOP
        SELECT id INTO z_id FROM public.zones WHERE name = 'Zone ' || m.zone LIMIT 1;
        IF z_id IS NOT NULL THEN
            UPDATE public.members SET zone_id = z_id WHERE id = m.id;
        END IF;
    END LOOP;

    -- 4. Link members to ministries
    FOR m IN SELECT id, ministries FROM public.members WHERE ministries IS NOT NULL AND jsonb_typeof(ministries) = 'array' LOOP
        FOR min_name IN SELECT jsonb_array_elements_text(m.ministries) LOOP
            SELECT id INTO min_id FROM public.ministries WHERE name = min_name LIMIT 1;
            IF min_id IS NOT NULL THEN
                -- Insert with conflict check manually
                IF NOT EXISTS (SELECT 1 FROM public.ministry_members WHERE ministry_id = min_id AND member_id = m.id) THEN
                    INSERT INTO public.ministry_members (ministry_id, member_id, role)
                    VALUES (min_id, m.id, 'Member');
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END $$;
