# Church Management System - Backend Integration & Deployment Guide

## Table of Contents
1. [Database Setup](#database-setup)
2. [Authentication Configuration](#authentication-configuration)
3. [File Storage Setup](#file-storage-setup)
4. [Backend API Implementation](#backend-api-implementation)
5. [Frontend Migration from Mock Data](#frontend-migration-from-mock-data)
6. [Deployment Guide](#deployment-guide)
7. [Mobile App Development](#mobile-app-development)

---

## 1. Database Setup

### Step 1: Access Supabase Dashboard

1. Go to [https://supabase.com](https://supabase.com)
2. Click on your project
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Create Database Tables

Run the following SQL scripts in order:

#### A. Users and Roles Table

```sql
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

-- Indexes for performance
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_temp_permissions_user_id ON temporary_permissions(user_id);
CREATE INDEX idx_temp_permissions_expires_at ON temporary_permissions(expires_at);
```

#### B. Members Table

```sql
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

-- Indexes
CREATE INDEX idx_members_zone ON members(zone);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_zone_number ON members(zone_number);
CREATE INDEX idx_family_members_member_id ON family_members(member_id);
CREATE INDEX idx_family_members_linked_member_id ON family_members(linked_member_id);
```

#### C. Attendance Tables

```sql
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

-- Indexes
CREATE INDEX idx_attendance_records_date ON attendance_records(date);
CREATE INDEX idx_attendance_records_service_type ON attendance_records(service_type);
CREATE INDEX idx_attendance_entries_record_id ON attendance_entries(attendance_record_id);
CREATE INDEX idx_attendance_entries_member_id ON attendance_entries(member_id);
```

#### D. Giving Tables

```sql
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

-- Indexes
CREATE INDEX idx_giving_records_service_date ON giving_records(service_date);
CREATE INDEX idx_giving_records_service_type ON giving_records(service_type);
```

#### E. Visitors Table

```sql
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

-- Indexes
CREATE INDEX idx_visitors_visit_date ON visitors(visit_date);
CREATE INDEX idx_visitors_follow_up_status ON visitors(follow_up_status);
CREATE INDEX idx_visitors_interested_in_membership ON visitors(interested_in_membership);
```

### Step 3: Create Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_giving_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE giving_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $get_role$
  SELECT role FROM profiles WHERE id = user_id;
$get_role$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Create function to check permissions
CREATE OR REPLACE FUNCTION has_permission(user_id UUID, permission_name TEXT)
RETURNS BOOLEAN AS $has_perm$
DECLARE
  user_role TEXT;
  has_temp_perm BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM profiles WHERE id = user_id;
  
  -- Dev has all permissions
  IF user_role = 'dev' THEN
    RETURN true;
  END IF;
  
  -- Check role-based permissions
  IF user_role = 'admin' AND permission_name IN (
    'manage_users', 'manage_members', 'view_members', 'edit_members', 'delete_members',
    'manage_attendance', 'view_attendance', 'record_attendance',
    'manage_giving', 'view_giving', 'record_giving', 'manage_giving_types',
    'view_reports', 'manage_settings', 'manage_services', 'grant_permissions'
  ) THEN
    RETURN true;
  END IF;
  
  IF user_role IN ('pastor', 'elder') AND permission_name IN (
    'view_members', 'view_attendance', 'view_giving', 'view_reports'
  ) THEN
    RETURN true;
  END IF;
  
  -- Check temporary permissions
  SELECT EXISTS(
    SELECT 1 FROM temporary_permissions
    WHERE user_id = $1 AND permission = permission_name AND expires_at > NOW()
  ) INTO has_temp_perm;
  
  RETURN has_temp_perm;
END;
$has_perm$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Admins and Devs can update profiles" ON profiles
  FOR UPDATE USING (
    has_permission(auth.uid(), 'manage_users')
  );

-- Members policies
CREATE POLICY "Anyone can view members" ON members
  FOR SELECT USING (has_permission(auth.uid(), 'view_members'));

CREATE POLICY "Authorized users can insert members" ON members
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'manage_members'));

CREATE POLICY "Authorized users can update members" ON members
  FOR UPDATE USING (has_permission(auth.uid(), 'edit_members'));

CREATE POLICY "Authorized users can delete members" ON members
  FOR DELETE USING (has_permission(auth.uid(), 'delete_members'));

-- Family members policies (inherit from members)
CREATE POLICY "View family members with member view permission" ON family_members
  FOR SELECT USING (has_permission(auth.uid(), 'view_members'));

CREATE POLICY "Manage family members with member manage permission" ON family_members
  FOR ALL USING (has_permission(auth.uid(), 'manage_members'));

-- Attendance policies
CREATE POLICY "Anyone can view attendance" ON attendance_records
  FOR SELECT USING (has_permission(auth.uid(), 'view_attendance'));

CREATE POLICY "Authorized users can record attendance" ON attendance_records
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'record_attendance'));

CREATE POLICY "Authorized users can update attendance" ON attendance_records
  FOR UPDATE USING (has_permission(auth.uid(), 'manage_attendance'));

CREATE POLICY "Authorized users can delete attendance" ON attendance_records
  FOR DELETE USING (has_permission(auth.uid(), 'manage_attendance'));

-- Attendance entries policies
CREATE POLICY "View attendance entries" ON attendance_entries
  FOR SELECT USING (has_permission(auth.uid(), 'view_attendance'));

CREATE POLICY "Manage attendance entries" ON attendance_entries
  FOR ALL USING (has_permission(auth.uid(), 'record_attendance'));

-- Custom services policies
CREATE POLICY "Anyone can view services" ON custom_services
  FOR SELECT USING (true);

CREATE POLICY "Authorized users can manage services" ON custom_services
  FOR ALL USING (has_permission(auth.uid(), 'manage_services'));

-- Giving policies
CREATE POLICY "Anyone can view giving" ON giving_records
  FOR SELECT USING (has_permission(auth.uid(), 'view_giving'));

CREATE POLICY "Authorized users can record giving" ON giving_records
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'record_giving'));

CREATE POLICY "Authorized users can update giving" ON giving_records
  FOR UPDATE USING (has_permission(auth.uid(), 'manage_giving'));

CREATE POLICY "Authorized users can delete giving" ON giving_records
  FOR DELETE USING (has_permission(auth.uid(), 'manage_giving'));

-- Custom giving types policies
CREATE POLICY "Anyone can view giving types" ON custom_giving_types
  FOR SELECT USING (true);

CREATE POLICY "Authorized users can manage giving types" ON custom_giving_types
  FOR ALL USING (has_permission(auth.uid(), 'manage_giving_types'));

-- Visitors policies
CREATE POLICY "Anyone can view visitors" ON visitors
  FOR SELECT USING (has_permission(auth.uid(), 'view_members'));

CREATE POLICY "Authorized users can manage visitors" ON visitors
  FOR ALL USING (has_permission(auth.uid(), 'manage_members'));

-- Temporary permissions policies
CREATE POLICY "Admins can manage temp permissions" ON temporary_permissions
  FOR ALL USING (has_permission(auth.uid(), 'grant_permissions'));

-- Custom roles policies
CREATE POLICY "Anyone can view custom roles" ON custom_roles
  FOR SELECT USING (true);

CREATE POLICY "Dev can manage custom roles" ON custom_roles
  FOR ALL USING (get_user_role(auth.uid()) = 'dev');
```

### Step 4: Create Database Functions

```sql
-- Function to auto-expire temporary permissions
CREATE OR REPLACE FUNCTION cleanup_expired_permissions()
RETURNS void AS $cleanup$
BEGIN
  DELETE FROM temporary_permissions WHERE expires_at < NOW();
END;
$cleanup$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (you'll need to set up a cron job or use pg_cron extension)
-- For now, this will be called from the server periodically

-- Function to update attendance total count
CREATE OR REPLACE FUNCTION update_attendance_total_count()
RETURNS TRIGGER AS $attendance_count$
BEGIN
  UPDATE attendance_records
  SET total_count = (
    SELECT COUNT(*) FROM attendance_entries WHERE attendance_record_id = NEW.attendance_record_id
  )
  WHERE id = NEW.attendance_record_id;
  RETURN NEW;
END;
$attendance_count$ LANGUAGE plpgsql;

-- Trigger to auto-update attendance count
CREATE TRIGGER update_attendance_count_trigger
AFTER INSERT OR DELETE ON attendance_entries
FOR EACH ROW
EXECUTE FUNCTION update_attendance_total_count();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $update_timestamp$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$update_timestamp$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitors_updated_at BEFORE UPDATE ON visitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_services_updated_at BEFORE UPDATE ON custom_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_giving_types_updated_at BEFORE UPDATE ON custom_giving_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 2. Authentication Configuration

### Step 1: Configure Supabase Auth

1. Go to **Authentication** → **Settings** in Supabase Dashboard
2. Enable **Email Auth** provider
3. Configure email templates (optional but recommended):
   - Confirmation email
   - Password reset email
4. Set **Site URL** to your production URL (e.g., `https://yourchurch.com`)

### Step 2: Create Initial Users via SQL

```sql
-- Note: You'll need to use Supabase Admin API to create users
-- This is a placeholder for the initial dev user
-- In production, create this through your application's signup flow or Supabase Dashboard

-- After creating a user in Supabase Auth, add their profile:
INSERT INTO profiles (id, name, email, role, is_active)
VALUES 
  ('USER_ID_FROM_AUTH', 'Dev Administrator', 'dev@cocm.com', 'dev', true);

-- Create demo users (do this through the backend API after deployment)
```

### Step 3: Update Auth Settings

In your application, you'll configure the Supabase client. Here's the structure:

```typescript
// utils/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

## 3. File Storage Setup

### Step 1: Create Storage Bucket

1. Go to **Storage** in Supabase Dashboard
2. Click **Create Bucket**
3. Create bucket named: `member-photos`
4. Set as **Private** bucket
5. Click **Save**

### Step 2: Configure Storage Policies

Go to **Storage** → **Policies** and add:

```sql
-- Policy for uploading photos
CREATE POLICY "Authenticated users can upload member photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'member-photos' AND
  has_permission(auth.uid(), 'manage_members')
);

-- Policy for viewing photos
CREATE POLICY "Authenticated users can view member photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'member-photos');

-- Policy for updating photos
CREATE POLICY "Authenticated users can update member photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'member-photos' AND
  has_permission(auth.uid(), 'manage_members')
);

-- Policy for deleting photos
CREATE POLICY "Authenticated users can delete member photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'member-photos' AND
  has_permission(auth.uid(), 'delete_members')
);
```

---

## 4. Backend API Implementation

The backend server will handle all business logic. Here are the key endpoints to implement:

### File: `/supabase/functions/server/index.tsx`

You'll need to add these routes to handle the ChMS operations. See the separate file `SERVER_IMPLEMENTATION.md` for the complete server code.

**Key Routes to Implement:**

1. **Auth Routes**
   - `POST /make-server-cac55325/auth/signup` - Create new user
   - `POST /make-server-cac55325/auth/signin` - Sign in user
   - `POST /make-server-cac55325/auth/signout` - Sign out user
   - `GET /make-server-cac55325/auth/session` - Get current session
   - `POST /make-server-cac55325/auth/reset-password` - Password reset

2. **Members Routes**
   - `GET /make-server-cac55325/members` - List all members
   - `POST /make-server-cac55325/members` - Create member
   - `GET /make-server-cac55325/members/:id` - Get member
   - `PUT /make-server-cac55325/members/:id` - Update member
   - `DELETE /make-server-cac55325/members/:id` - Delete member
   - `POST /make-server-cac55325/members/:id/photo` - Upload photo

3. **Attendance Routes**
   - `GET /make-server-cac55325/attendance` - List attendance records
   - `POST /make-server-cac55325/attendance` - Create attendance record
   - `GET /make-server-cac55325/attendance/:id` - Get attendance record
   - `PUT /make-server-cac55325/attendance/:id` - Update attendance
   - `DELETE /make-server-cac55325/attendance/:id` - Delete attendance

4. **Giving Routes**
   - `GET /make-server-cac55325/giving` - List giving records
   - `POST /make-server-cac55325/giving` - Create giving record
   - `GET /make-server-cac55325/giving/:id` - Get giving record
   - `PUT /make-server-cac55325/giving/:id` - Update giving
   - `DELETE /make-server-cac55325/giving/:id` - Delete giving
   - `GET /make-server-cac55325/giving/types` - List custom types
   - `POST /make-server-cac55325/giving/types` - Create custom type

5. **Visitors Routes**
   - `GET /make-server-cac55325/visitors` - List visitors
   - `POST /make-server-cac55325/visitors` - Create visitor
   - `GET /make-server-cac55325/visitors/:id` - Get visitor
   - `PUT /make-server-cac55325/visitors/:id` - Update visitor
   - `DELETE /make-server-cac55325/visitors/:id` - Delete visitor
   - `POST /make-server-cac55325/visitors/:id/convert` - Convert to member

6. **Permissions Routes**
   - `POST /make-server-cac55325/permissions/grant` - Grant temporary permission
   - `POST /make-server-cac55325/permissions/revoke` - Revoke permission

---

## 5. Frontend Migration from Mock Data

### Step 1: Create Supabase Client Singleton

Create file: `/utils/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from './info'

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
)
```

### Step 2: Create API Service Layer

Create file: `/services/api.ts` to centralize all API calls:

```typescript
import { projectId, publicAnonKey } from '../utils/supabase/info'

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-cac55325`

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token')
  
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token || publicAnonKey}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new ApiError(response.status, error || `Request failed: ${response.statusText}`)
  }

  return response.json()
}

export const api = {
  // Auth
  signUp: (data: { email: string; password: string; name: string; role: string }) =>
    fetchApi('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  
  signIn: (email: string, password: string) =>
    fetchApi('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }),
  
  signOut: () =>
    fetchApi('/auth/signout', { method: 'POST' }),
  
  getSession: () =>
    fetchApi('/auth/session'),

  // Members
  getMembers: () => fetchApi('/members'),
  getMember: (id: string) => fetchApi(`/members/${id}`),
  createMember: (data: any) => fetchApi('/members', { method: 'POST', body: JSON.stringify(data) }),
  updateMember: (id: string, data: any) => fetchApi(`/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMember: (id: string) => fetchApi(`/members/${id}`, { method: 'DELETE' }),

  // Attendance
  getAttendance: () => fetchApi('/attendance'),
  createAttendance: (data: any) => fetchApi('/attendance', { method: 'POST', body: JSON.stringify(data) }),
  updateAttendance: (id: string, data: any) => fetchApi(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Giving
  getGiving: () => fetchApi('/giving'),
  createGiving: (data: any) => fetchApi('/giving', { method: 'POST', body: JSON.stringify(data) }),
  getGivingTypes: () => fetchApi('/giving/types'),
  createGivingType: (data: any) => fetchApi('/giving/types', { method: 'POST', body: JSON.stringify(data) }),

  // Visitors
  getVisitors: () => fetchApi('/visitors'),
  createVisitor: (data: any) => fetchApi('/visitors', { method: 'POST', body: JSON.stringify(data) }),
  convertVisitor: (id: string, memberData: any) => fetchApi(`/visitors/${id}/convert`, { method: 'POST', body: JSON.stringify(memberData) }),

  // Permissions
  grantPermission: (data: { userId: string; permission: string; durationHours: number }) =>
    fetchApi('/permissions/grant', { method: 'POST', body: JSON.stringify(data) }),
}
```

### Step 3: Update Components to Use Real API

For each component, replace mock data with API calls. Example for `Members.tsx`:

**Before (Mock):**
```typescript
const [members] = useState<Member[]>(mockMembers);
```

**After (Real API):**
```typescript
import { api } from '../services/api';

const [members, setMembers] = useState<Member[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  async function loadMembers() {
    try {
      setIsLoading(true);
      const data = await api.getMembers();
      setMembers(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load members:', err);
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  }
  
  loadMembers();
}, []);
```

### Step 4: Update AuthContext to Use Real Auth

Replace the mock authentication in `AuthContext.tsx` with real Supabase auth calls.

---

## 6. Deployment Guide

### A. Deploy Backend (Supabase Edge Functions)

The backend is already hosted on Supabase! You just need to deploy your server code:

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link to your project:**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Deploy the edge function:**
   ```bash
   supabase functions deploy server
   ```

Your backend API is now live at:
`https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-cac55325/*`

### B. Deploy Frontend (Web App)

#### Option 1: Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Set Environment Variables:**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add:
     - `VITE_SUPABASE_URL`: Your Supabase URL
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

4. **Redeploy with production settings:**
   ```bash
   vercel --prod
   ```

#### Option 2: Netlify

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build your app:**
   ```bash
   npm run build
   ```

3. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

4. **Set Environment Variables:**
   - Go to Netlify Dashboard → Site Settings → Build & Deploy → Environment
   - Add the same variables as Vercel

#### Option 3: Self-Hosted (Ubuntu Server)

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Install Nginx:**
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

3. **Copy build files:**
   ```bash
   sudo cp -r dist/* /var/www/html/
   ```

4. **Configure Nginx:**
   ```nginx
   server {
       listen 80;
       server_name yourchurch.com;
       root /var/www/html;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

5. **Restart Nginx:**
   ```bash
   sudo systemctl restart nginx
   ```

6. **Setup SSL with Let's Encrypt:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourchurch.com
   ```

---

## 7. Mobile App Development

### Option 1: Progressive Web App (PWA) - Fastest

Your current web app can become a PWA with minimal changes:

1. **Add manifest.json:**
   ```json
   {
     "name": "CoC.M Church Management System",
     "short_name": "CoC.M ChMS",
     "description": "Church Management System for Church of Christ, Mataheko",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#4f46e5",
     "icons": [
       {
         "src": "/icon-192.png",
         "sizes": "192x192",
         "type": "image/png"
       },
       {
         "src": "/icon-512.png",
         "sizes": "512x512",
         "type": "image/png"
       }
     ]
   }
   ```

2. **Add service worker:**
   ```javascript
   // public/sw.js
   self.addEventListener('install', (event) => {
     event.waitUntil(
       caches.open('v1').then((cache) => {
         return cache.addAll([
           '/',
           '/index.html',
           '/App.tsx',
           '/styles/globals.css'
         ]);
       })
     );
   });

   self.addEventListener('fetch', (event) => {
     event.respondWith(
       caches.match(event.request).then((response) => {
         return response || fetch(event.request);
       })
     );
   });
   ```

3. **Register service worker in your app:**
   ```typescript
   // Add to main.tsx or index.tsx
   if ('serviceWorker' in navigator) {
     window.addEventListener('load', () => {
       navigator.serviceWorker.register('/sw.js')
         .then(registration => console.log('SW registered:', registration))
         .catch(error => console.log('SW registration failed:', error));
     });
   }
   ```

**Users can "install" the app from their browser:**
- Android: Chrome → Menu → "Install App" or "Add to Home Screen"
- iOS: Safari → Share → "Add to Home Screen"

### Option 2: React Native with Expo - Full Native App

Create a native mobile app that shares logic with your web app:

1. **Install Expo CLI:**
   ```bash
   npm install -g expo-cli
   ```

2. **Create new Expo project:**
   ```bash
   npx create-expo-app cocm-mobile
   cd cocm-mobile
   ```

3. **Install dependencies:**
   ```bash
   npx expo install @supabase/supabase-js
   npx expo install @react-native-async-storage/async-storage
   npx expo install react-native-url-polyfill
   ```

4. **Share components:**
   - Copy your business logic components to a `shared` folder
   - Adapt UI components to use React Native primitives:
     - `<div>` → `<View>`
     - `<button>` → `<TouchableOpacity>` or `<Button>`
     - `<input>` → `<TextInput>`

5. **Configure Supabase:**
   ```typescript
   // lib/supabase.ts
   import 'react-native-url-polyfill/auto'
   import AsyncStorage from '@react-native-async-storage/async-storage'
   import { createClient } from '@supabase/supabase-js'

   const supabaseUrl = 'YOUR_SUPABASE_URL'
   const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'

   export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
     auth: {
       storage: AsyncStorage,
       autoRefreshToken: true,
       persistSession: true,
       detectSessionInUrl: false,
     },
   })
   ```

6. **Build and publish:**
   ```bash
   # For development
   npx expo start

   # Build for Android
   eas build --platform android

   # Build for iOS (requires Mac)
   eas build --platform ios

   # Submit to app stores
   eas submit --platform android
   eas submit --platform ios
   ```

### Option 3: Capacitor - Use Same Web Code

Convert your React web app to native with Capacitor:

1. **Install Capacitor:**
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init
   ```

2. **Add platforms:**
   ```bash
   npm install @capacitor/android @capacitor/ios
   npx cap add android
   npx cap add ios
   ```

3. **Build web app:**
   ```bash
   npm run build
   ```

4. **Sync with native projects:**
   ```bash
   npx cap sync
   ```

5. **Open in native IDEs:**
   ```bash
   # Android Studio
   npx cap open android

   # Xcode (macOS only)
   npx cap open ios
   ```

6. **Build APK/IPA from the respective IDEs**

---

## 8. Post-Deployment Checklist

### Security
- [ ] All API endpoints have authentication
- [ ] RLS policies are enabled on all tables
- [ ] Storage buckets have proper access policies
- [ ] Environment variables are secure
- [ ] HTTPS is enabled
- [ ] CORS is properly configured

### Performance
- [ ] Database indexes are created
- [ ] Images are optimized
- [ ] Lazy loading is implemented
- [ ] Caching is configured

### Data Privacy
- [ ] GDPR compliance reviewed
- [ ] Data retention policies set
- [ ] Backup strategy implemented
- [ ] Access logs enabled

### Testing
- [ ] All CRUD operations tested
- [ ] Role permissions tested
- [ ] Mobile responsiveness verified
- [ ] Cross-browser testing done

### Monitoring
- [ ] Error tracking setup (e.g., Sentry)
- [ ] Analytics configured (optional)
- [ ] Uptime monitoring active
- [ ] Database backup automated

---

## 9. Migration Steps Summary

1. ✅ **Set up Supabase database** (Run all SQL scripts)
2. ✅ **Configure authentication**
3. ✅ **Set up file storage**
4. ✅ **Implement backend API** (Complete server implementation)
5. ✅ **Update frontend to use API** (Replace mock data)
6. ✅ **Test locally**
7. ✅ **Deploy backend** (Supabase Edge Functions)
8. ✅ **Deploy frontend** (Vercel/Netlify/Self-hosted)
9. ✅ **Create mobile app** (PWA/React Native/Capacitor)
10. ✅ **Test in production**
11. ✅ **Train users**
12. ✅ **Launch** 🎉

---

## Support & Resources

- **Supabase Docs:** https://supabase.com/docs
- **React Docs:** https://react.dev
- **Expo Docs:** https://docs.expo.dev
- **Capacitor Docs:** https://capacitorjs.com/docs

---

**Note:** This guide provides a complete roadmap for migrating from demo mode to production. Implement each section carefully and test thoroughly before deploying to production with real church data.
