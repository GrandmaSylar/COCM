-- ============================================================================
-- STEP 1: CREATE TABLES
-- Run this script first
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('dev', 'admin', 'pastor', 'elder')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Temporary permissions table
CREATE TABLE temporary_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom roles table
CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members table
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  other_names TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  second_phone TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')),
  date_of_birth DATE,
  residence_location TEXT NOT NULL,
  digital_address TEXT,
  zone TEXT NOT NULL CHECK (zone IN ('A', 'B', 'F', 'K', 'M', 'R')),
  zone_number TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'semi-active', 'inactive', 'sabbatical', 'blacklisted')),
  join_date DATE NOT NULL,
  photo_url TEXT,
  baptism_info JSONB,
  legal_info JSONB,
  ministries JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(zone_number)
);

-- Family members table
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('mother', 'father', 'spouse', 'child', 'sibling')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  other_names TEXT,
  phone TEXT,
  is_linked BOOLEAN DEFAULT false,
  linked_member_id UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom services table
CREATE TABLE custom_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance records table
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  service_type TEXT NOT NULL,
  start_time TIME,
  end_time TIME,
  total_count INTEGER NOT NULL DEFAULT 0,
  is_custom_service BOOLEAN DEFAULT false,
  custom_service_id UUID REFERENCES custom_services(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(date, service_type)
);

-- Attendance entries (individual member attendance)
CREATE TABLE attendance_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(attendance_record_id, member_id)
);

-- Custom giving types table
CREATE TABLE custom_giving_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Giving records table
CREATE TABLE giving_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name TEXT NOT NULL,
  service_date DATE NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('sunday_morning', 'sunday_evening', 'midweek', 'special', 'other')),
  offering_amount DECIMAL(10, 2) DEFAULT 0,
  donation_amount DECIMAL(10, 2) DEFAULT 0,
  thanksgiving_amount DECIMAL(10, 2) DEFAULT 0,
  custom_types JSONB DEFAULT '{}',
  total_amount DECIMAL(10, 2) NOT NULL,
  cash_amount DECIMAL(10, 2) DEFAULT 0,
  mobile_money_amount DECIMAL(10, 2) DEFAULT 0,
  card_amount DECIMAL(10, 2) DEFAULT 0,
  bank_transfer_amount DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(service_date, service_type)
);

-- Visitors table
CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  other_names TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  second_phone TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')),
  date_of_birth DATE,
  residence_location TEXT NOT NULL,
  visit_date DATE NOT NULL,
  service_type TEXT NOT NULL,
  referred_by TEXT,
  interested_in_membership BOOLEAN DEFAULT false,
  notes TEXT,
  follow_up_status TEXT NOT NULL CHECK (follow_up_status IN ('pending', 'contacted', 'scheduled', 'completed')),
  potential_zone TEXT CHECK (potential_zone IN ('A', 'B', 'F', 'K', 'M', 'R')),
  converted_to_member BOOLEAN DEFAULT false,
  converted_member_id UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
