-- ============================================================================
-- STEP 6: CREATE RLS POLICIES
-- Run this script after enabling RLS
-- ============================================================================

-- Profiles policies
CREATE POLICY "Users can view all profiles" 
ON profiles FOR SELECT 
USING (true);

CREATE POLICY "Admins and Devs can update profiles" 
ON profiles FOR UPDATE 
USING (has_permission(auth.uid(), 'manage_users'));

-- Members policies
CREATE POLICY "Anyone can view members" 
ON members FOR SELECT 
USING (has_permission(auth.uid(), 'view_members'));

CREATE POLICY "Authorized users can insert members" 
ON members FOR INSERT 
WITH CHECK (has_permission(auth.uid(), 'manage_members'));

CREATE POLICY "Authorized users can update members" 
ON members FOR UPDATE 
USING (has_permission(auth.uid(), 'edit_members'));

CREATE POLICY "Authorized users can delete members" 
ON members FOR DELETE 
USING (has_permission(auth.uid(), 'delete_members'));

-- Family members policies
CREATE POLICY "View family members with member view permission" 
ON family_members FOR SELECT 
USING (has_permission(auth.uid(), 'view_members'));

CREATE POLICY "Manage family members with member manage permission" 
ON family_members FOR ALL 
USING (has_permission(auth.uid(), 'manage_members'));

-- Attendance policies
CREATE POLICY "Anyone can view attendance" 
ON attendance_records FOR SELECT 
USING (has_permission(auth.uid(), 'view_attendance'));

CREATE POLICY "Authorized users can record attendance" 
ON attendance_records FOR INSERT 
WITH CHECK (has_permission(auth.uid(), 'record_attendance'));

CREATE POLICY "Authorized users can update attendance" 
ON attendance_records FOR UPDATE 
USING (has_permission(auth.uid(), 'manage_attendance'));

CREATE POLICY "Authorized users can delete attendance" 
ON attendance_records FOR DELETE 
USING (has_permission(auth.uid(), 'manage_attendance'));

-- Attendance entries policies
CREATE POLICY "View attendance entries" 
ON attendance_entries FOR SELECT 
USING (has_permission(auth.uid(), 'view_attendance'));

CREATE POLICY "Manage attendance entries" 
ON attendance_entries FOR ALL 
USING (has_permission(auth.uid(), 'record_attendance'));

-- Custom services policies
CREATE POLICY "Anyone can view services" 
ON custom_services FOR SELECT 
USING (true);

CREATE POLICY "Authorized users can manage services" 
ON custom_services FOR ALL 
USING (has_permission(auth.uid(), 'manage_services'));

-- Giving policies
CREATE POLICY "Anyone can view giving" 
ON giving_records FOR SELECT 
USING (has_permission(auth.uid(), 'view_giving'));

CREATE POLICY "Authorized users can record giving" 
ON giving_records FOR INSERT 
WITH CHECK (has_permission(auth.uid(), 'record_giving'));

CREATE POLICY "Authorized users can update giving" 
ON giving_records FOR UPDATE 
USING (has_permission(auth.uid(), 'manage_giving'));

CREATE POLICY "Authorized users can delete giving" 
ON giving_records FOR DELETE 
USING (has_permission(auth.uid(), 'manage_giving'));

-- Custom giving types policies
CREATE POLICY "Anyone can view giving types" 
ON custom_giving_types FOR SELECT 
USING (true);

CREATE POLICY "Authorized users can manage giving types" 
ON custom_giving_types FOR ALL 
USING (has_permission(auth.uid(), 'manage_giving_types'));

-- Visitors policies
CREATE POLICY "Anyone can view visitors" 
ON visitors FOR SELECT 
USING (has_permission(auth.uid(), 'view_members'));

CREATE POLICY "Authorized users can manage visitors" 
ON visitors FOR ALL 
USING (has_permission(auth.uid(), 'manage_members'));

-- Temporary permissions policies
CREATE POLICY "Admins can manage temp permissions" 
ON temporary_permissions FOR ALL 
USING (has_permission(auth.uid(), 'grant_permissions'));

-- Custom roles policies
CREATE POLICY "Anyone can view custom roles" 
ON custom_roles FOR SELECT 
USING (true);

CREATE POLICY "Dev can manage custom roles" 
ON custom_roles FOR ALL 
USING (get_user_role(auth.uid()) = 'dev');
