-- ============================================================================
-- SEED DATA: MEMBERS (Core Info Only)
-- Run this in the Supabase SQL Editor to populate the members table
-- ============================================================================

INSERT INTO members (
  join_date,
  first_name, 
  other_names, 
  last_name,
  gender, 
  marital_status,
  date_of_birth, 
  occupation,
  hometown,
  phone,
  second_phone,
  email, 
  residence_location, 
  digital_address, 
  zone, 
  zone_number,-- Required field (NOT NULL)
) VALUES 
-- Member 1
(
  '2026-03-17',
  'Richmond',                  -- first_name
  NULL,                 -- other_names
  'Kwesi', 
  'male',
  'married',                  -- last_name (surname)
  '1984-10-15',
  'Lecturer',
  'Banso',   
  '0247262960',
  NULL,
  'domingorichie@gmail.com',
  'Ayi Mensah',
  NULL,
  'F',
  'F05'
),
(
    '2026-03-17',
    'Abigail',
    'Obieley',
    'Otoo-Commey',
    'female',
    'single'
    '1996-07-16'
    'Makeup Artist',
    'Greater ACcra',
    '0555929649',
    NULL,
    'abigailotoocommey74@gmail.com',
    'Chorkor-Accra',
    'GA-370-8496',
    'R',
    'R53',
    '2022-11-23',   
),
(
    '2026-03-17',
    'Alex',
    'Kwesi',
    'Appiah',
    'male',
    'single',
    '1989-02-04',
    'House help',
    'Agona Nyankrom',
    '0551753044',
    '0598851555',
    'alexappia825@gmail.com',
    
)

  
);
