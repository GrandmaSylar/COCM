# Church Management System - Comprehensive Testing Roadmap

## Overview
This roadmap provides step-by-step instructions to test every function of the Church of Christ Mataheko (CoC.M) Management System.

---

## 1. Authentication & User Management

### 1.1 User Signup
- [ ] Navigate to signup page
- [ ] Fill in all required fields (First Name, Last Name, Email, Password, Role)
- [ ] Submit the form
- [ ] **Expected:** Success message "Account created successfully! Please wait for administrator approval before logging in."
- [ ] Try to login → **Expected:** Error "Account is pending approval"

### 1.2 User Login (Pending Account)
- [ ] Use credentials from pending signup
- [ ] Attempt login
- [ ] **Expected:** Error message "Account is pending approval. Please wait for an administrator to approve your account."

### 1.3 Admin/Dev Login
- [ ] Login with dev account credentials
- [ ] **Expected:** Successful login, redirected to Dashboard

### 1.4 User Approval Workflow (Dev/Admin Only)
- [ ] Login as dev/admin
- [ ] Navigate to Settings → Users & Permissions tab
- [ ] **Expected:** See "Pending Account Approvals" section at top (orange highlight)
- [ ] Verify pending user information is displayed
- [ ] Click **Approve** button
- [ ] **Expected:** Success toast "User approved successfully"
- [ ] Pending user disappears from pending section
- [ ] Check "System Users" section → **Expected:** User now appears as "Active"

### 1.5 User Login (Approved Account)
- [ ] Logout from dev account
- [ ] Login with newly approved user credentials
- [ ] **Expected:** Successful login, redirected to Dashboard

### 1.6 User Rejection (Dev/Admin Only)
- [ ] Login as dev/admin
- [ ] Create another test signup
- [ ] Go to Settings → Pending Approvals
- [ ] Click **Reject** button
- [ ] Confirm rejection
- [ ] **Expected:** Success toast "User rejected successfully"
- [ ] Try to login with rejected account → **Expected:** Error "Account has been rejected. Please contact an administrator."

### 1.7 Direct User Creation (Dev/Admin Only)
- [ ] Login as dev/admin
- [ ] Navigate to Settings → Users & Permissions
- [ ] Click **Add User** button
- [ ] Fill in all required fields (Name, Email, Password, Role, Phone)
- [ ] Submit
- [ ] **Expected:** Success toast "User created successfully"
- [ ] New user appears in "System Users" list as "Active" (no approval needed)
- [ ] Test login with new user credentials → **Expected:** Successful login

### 1.8 Change User Role (Dev Only)
- [ ] Login as dev
- [ ] Go to Settings → Users & Permissions
- [ ] Find a user in "System Users" list
- [ ] Use the "Change Role" dropdown below their email
- [ ] Select a different role
- [ ] **Expected:** Success toast "User role updated successfully"
- [ ] Role badge updates immediately
- [ ] Login as that user → **Expected:** New role permissions apply

### 1.9 Delete User (Dev Only)
- [ ] Login as dev
- [ ] Go to Settings → Users & Permissions
- [ ] Click trash icon on a user (not yourself)
- [ ] Confirm deletion
- [ ] **Expected:** Success toast "User deleted successfully"
- [ ] User removed from list
- [ ] Try to login as deleted user → **Expected:** Error "Invalid credentials"

### 1.10 User Statistics
- [ ] Go to Settings → Users & Permissions
- [ ] Verify counters at top show correct numbers:
  - Total Users
  - Developers count
  - Admins count
  - Pastors count
  - Elders count

---

## 2. Dashboard & Overview

### 2.1 Dashboard Stats
- [ ] Login and view Dashboard
- [ ] Verify following stats cards display real data (not mock):
  - Total Members
  - Week Attendance (no mock percentage)
  - Monthly Giving (no mock growth rate)
  - **Note:** Growth Rate card should be removed
- [ ] Click each stat card
- [ ] **Expected:** Navigate to respective section

### 2.2 Recent Activity Feed
- [ ] Check "Recent Activity" section
- [ ] **Expected:** Shows recent member additions, attendance records, giving records
- [ ] Verify timestamps are accurate

### 2.3 Quick Actions
- [ ] Click "Add Member" quick action
- [ ] **Expected:** Navigate to Add Member page
- [ ] Go back to Dashboard
- [ ] Click "Record Attendance"
- [ ] **Expected:** Navigate to Record Attendance page
- [ ] Repeat for other quick actions

---

## 3. Members Management

### 3.1 View All Members
- [ ] Navigate to Members page
- [ ] **Expected:** List of all members displays
- [ ] Verify member cards show: Name, Zone, Photo, Status badge

### 3.2 Search Members
- [ ] Use search box at top
- [ ] Search by name
- [ ] **Expected:** Filtered results
- [ ] Search by phone number
- [ ] **Expected:** Matching member appears
- [ ] Search by zone
- [ ] **Expected:** Members in that zone appear

### 3.3 Filter Members
- [ ] Use Zone filter dropdown
- [ ] Select a specific zone (e.g., "Mataheko")
- [ ] **Expected:** Only members from that zone shown
- [ ] Use Status filter
- [ ] Select "Active"
- [ ] **Expected:** Only active members shown
- [ ] Try "Inactive" → **Expected:** Only inactive members shown

### 3.4 Add New Member
- [ ] Click "Add Member" button
- [ ] Fill in all required fields:
  - First Name *
  - Last Name *
  - Other Names
  - Email
  - Phone *
  - Second Phone
  - Gender * (Male/Female)
  - **Marital Status** (Single/Married/Divorced/Widowed) ← **NEW FIELD**
  - Date of Birth *
  - Residence Location *
  - Digital Address
  - Zone *
  - Notes
- [ ] Select zone → **Expected:** Zone number auto-generates (e.g., "M15")
- [ ] Upload a photo (optional)
- [ ] Fill Baptism Info section:
  - Date Type (Full Date / Month & Year / Year Only)
  - Previous Congregation
  - Role in Previous Congregation
- [ ] Add Family Members (search and link existing members)
- [ ] Fill Legal Info:
  - Ghana Card Number
  - Ghana Card Expiry Date
  - Alternative ID Type & Number
- [ ] Select Ministries (can select multiple)
- [ ] Click **Save**
- [ ] **Expected:** Success toast, redirected to Members list
- [ ] New member appears in list

### 3.5 View Member Profile
- [ ] Click on any member card
- [ ] **Expected:** Member Profile page opens
- [ ] Verify all information displays correctly:
  - Basic Info (Name, Gender, **Marital Status**, DOB, Age)
  - Contact Info (Phone, Email, Address)
  - Zone & Zone Number
  - Status
  - Photo
  - Baptism Info
  - Family Members (if any)
  - Legal Info
  - Ministries
- [ ] Check "Attendance Stats" section
- [ ] **Expected:** Shows attendance this month, total services, percentage
- [ ] Check "Recent Activity"
- [ ] **Expected:** Shows member's recent attendance and giving

### 3.6 Edit Member
- [ ] From Member Profile, click **Edit** button
- [ ] Update any field (e.g., change phone number, update marital status)
- [ ] Add/remove ministries
- [ ] Update family members
- [ ] Change member status (Active/Inactive/Transferred/Deceased)
- [ ] Click **Save**
- [ ] **Expected:** Success toast, changes reflected in profile

### 3.7 Upload/Update Member Photo
- [ ] Go to Edit Member
- [ ] Click photo upload area or drag & drop image
- [ ] **Expected:** Preview appears
- [ ] Click X to remove → **Expected:** Photo removed
- [ ] Add photo again and save
- [ ] **Expected:** Photo appears in member profile and list

### 3.8 Delete Member (if permitted)
- [ ] Check if user has permission to delete members
- [ ] If yes, find delete option in Edit Member page
- [ ] Confirm deletion
- [ ] **Expected:** Member removed from system

---

## 4. Visitors Management

### 4.1 View All Visitors
- [ ] Navigate to Visitors page
- [ ] **Expected:** List of visitors displays
- [ ] Verify visitor cards show: Name, Visit Date, Follow-up Status, Membership Interest

### 4.2 Filter Visitors
- [ ] Use "Follow-up Status" filter
  - Select "Pending" → **Expected:** Only pending follow-ups shown
  - Select "Contacted" → **Expected:** Only contacted visitors shown
  - Select "Completed" → **Expected:** Only completed follow-ups shown
- [ ] Use "Membership Interest" filter
  - Select "Interested" → **Expected:** Only interested visitors shown
  - Select "Not Interested" → **Expected:** Only not-interested visitors shown

### 4.3 Add New Visitor
- [ ] Click "Add Visitor" button
- [ ] Fill in required fields:
  - First Name *
  - Last Name *
  - Other Names
  - Email
  - Phone *
  - Second Phone
  - Gender
  - Date of Birth
  - Residence Location *
  - Visit Date (defaults to today)
  - Service Type (Sunday Main Service, etc.)
  - Referred By
  - Interested in Membership (checkbox)
  - Notes
  - Follow-up Status (Pending/Contacted/Scheduled/Completed)
  - Potential Zone
- [ ] **Type into each field and verify input works** ← **CRITICAL TEST**
- [ ] Click **Save**
- [ ] **Expected:** Success toast, visitor created, data saved to database
- [ ] New visitor appears in list

### 4.4 View Visitor Details
- [ ] Click on visitor card
- [ ] **Expected:** Visitor details page opens
- [ ] Verify all information displays correctly

### 4.5 Convert Visitor to Member
- [ ] From Visitor list or details page, click "Convert to Member"
- [ ] **Expected:** Add Member form pre-filled with visitor data
- [ ] Complete any missing fields
- [ ] Click **Save**
- [ ] **Expected:** Success toast "Visitor converted to member"
- [ ] Member appears in Members list
- [ ] Visitor marked as "Converted"

---

## 5. Attendance Management

### 5.1 View Attendance Records
- [ ] Navigate to Attendance page
- [ ] **Expected:** List of attendance records displayed
- [ ] Verify each record shows: Date, Service Type, Total Count, Attendees count

### 5.2 Filter Attendance by Service Type
- [ ] Use "Service Type" filter
- [ ] Select "Sunday Main Service"
- [ ] **Expected:** Only Sunday records shown
- [ ] Try other service types

### 5.3 Record New Attendance
- [ ] Click "Record Attendance" button
- [ ] Select Service Type → **Expected:** Start/End times auto-fill for Sunday Main Service
- [ ] Select Date (defaults to today)
- [ ] **Enter Total Count** → **Verify you can type into the field** ← **CRITICAL TEST**
- [ ] Search for members to mark as present:
  - Type member name in search box
  - **Expected:** Matching members appear
  - Click checkbox next to member names to mark attendance
  - **Expected:** Count updates as you select members
- [ ] Optionally adjust Start Time and End Time fields
  - **Verify you can type/select times** ← **CRITICAL TEST**
- [ ] Click **Save**
- [ ] **Expected:** Success toast, attendance record created, data saved to database
- [ ] New record appears in Attendance list

### 5.4 View Attendance Details
- [ ] Click on an attendance record
- [ ] **Expected:** Details page shows:
  - Service info
  - Total attendance
  - List of attendees with their names
  - Percentage of total members

### 5.5 Mark Attendance (Alternative Method)
- [ ] Go to Attendance → Mark Attendance
- [ ] Select Service from list
- [ ] **Expected:** Member list appears
- [ ] Click members to toggle attendance
- [ ] Save
- [ ] **Expected:** Attendance updated

---

## 6. Giving/Financial Management

### 6.1 View Giving Records
- [ ] Navigate to Giving page
- [ ] **Expected:** List of giving records displayed
- [ ] Verify each shows: Service Name, Date, Total Amount, Payment Breakdown

### 6.2 Filter Giving Records
- [ ] Use date range filter
- [ ] Select "This Month"
- [ ] **Expected:** Only current month records shown
- [ ] Try "Last Month", "This Year"

### 6.3 Record New Giving
- [ ] Click "Record Giving" button
- [ ] **Enter Service Name** → **Verify you can type** ← **CRITICAL TEST**
- [ ] Select Service Date (defaults to today)
- [ ] Select Service Type (Sunday Morning, Sunday Evening, Midweek, Special, Other)
- [ ] **Enter Offering Amounts:**
  - Offering → **Type amount and verify it works** ← **CRITICAL TEST**
  - Donation → **Type amount**
  - Thanksgiving → **Type amount**
- [ ] **Payment Breakdown:** (total must match offerings)
  - Cash → **Type amount** ← **CRITICAL TEST**
  - Mobile Money → **Type amount** ← **CRITICAL TEST**
  - Card → **Type amount** ← **CRITICAL TEST**
  - Bank Transfer → **Type amount** ← **CRITICAL TEST**
- [ ] **Expected:** Total Amount and Payment Total display at bottom
- [ ] **Expected:** If totals don't match, warning appears
- [ ] Balance the amounts
- [ ] Add Notes (optional)
- [ ] Click **Save**
- [ ] **Expected:** Success toast, giving record created, data saved to database
- [ ] New record appears in Giving list

### 6.4 View Giving Details
- [ ] Click on a giving record
- [ ] **Expected:** Details page shows:
  - Service information
  - Breakdown of all offering types
  - Payment methods breakdown
  - Notes

### 6.5 Manage Custom Giving Types
- [ ] Go to Giving → Custom Types
- [ ] Click "Add Custom Type"
- [ ] Enter name (e.g., "Building Fund", "Missions")
- [ ] Toggle "Is Active"
- [ ] Save
- [ ] **Expected:** New type appears in Record Giving form
- [ ] Test adding amount for custom type
- [ ] Deactivate custom type
- [ ] **Expected:** Type no longer appears in new records

### 6.6 Export Giving Data
- [ ] From Giving page, look for Export option
- [ ] Click Export
- [ ] **Expected:** Download file with giving records

---

## 7. Reports & Analytics

### 7.1 View Reports Dashboard
- [ ] Navigate to Reports
- [ ] **Expected:** Overview of key metrics:
  - Total Members
  - Average Attendance
  - Total Giving
  - Growth Rate
  - Attendance Rate
  - Giving Participation

### 7.2 Filter Reports by Period
- [ ] Use period selector
- [ ] Select "This Month"
- [ ] **Expected:** All stats update for current month
- [ ] Try "Last Month", "This Quarter", "This Year", "Custom Range"

### 7.3 View Charts & Graphs
- [ ] Check Attendance Trends chart
- [ ] **Expected:** Line graph showing attendance over time
- [ ] Check Giving Trends chart
- [ ] **Expected:** Bar/line graph showing giving over time

### 7.4 Export Reports
- [ ] Click Export button
- [ ] **Expected:** Download report as PDF or Excel

---

## 8. Settings & Configuration

### 8.1 View All Settings Tabs
- [ ] Navigate to Settings
- [ ] Verify tabs appear (based on permissions):
  - Users & Permissions
  - Role Permissions
  - Theme (if permitted)

### 8.2 Role Permissions Editor (Dev Only)
- [ ] Login as dev
- [ ] Go to Settings → Role Permissions tab
- [ ] See list of roles: Dev, Admin, Pastor, Elder
- [ ] **Dev role:** Shows "Supreme Access" badge, permissions cannot be edited
- [ ] **Admin role:**
  - Click any permission toggle/box
  - **Expected:** Permission toggles on/off
  - Green highlight when enabled
  - Success toast "Role permissions updated"
- [ ] **Pastor role:**
  - Toggle permissions
  - **Expected:** Changes apply immediately
- [ ] **Elder role:**
  - Toggle permissions
  - **Expected:** Changes apply immediately
- [ ] Logout and login as admin
- [ ] **Expected:** Only permissions granted to admin are accessible

### 8.3 Theme Customization (if permitted)
- [ ] Go to Settings → Theme tab
- [ ] Change Primary Color
- [ ] **Expected:** Color updates across app immediately
- [ ] Change Secondary, Accent, Background, Foreground colors
- [ ] Click "Save Colors"
- [ ] **Expected:** Theme persists after refresh
- [ ] Click "Reset to Default"
- [ ] **Expected:** Colors revert to original

### 8.4 Grant Temporary Permissions (Dev/Admin)
- [ ] Go to Settings → Users & Permissions
- [ ] Find a user with limited permissions
- [ ] Click "Grant Permission" or similar option
- [ ] Select permission to grant
- [ ] Set duration (1 hour, 24 hours, 1 week, etc.)
- [ ] Save
- [ ] **Expected:** User gains that permission temporarily
- [ ] Check after duration expires → **Expected:** Permission revoked

### 8.5 Toggle User Active/Inactive (Dev Only)
- [ ] Go to Settings → Users & Permissions
- [ ] Find approved user
- [ ] Toggle their Active/Inactive switch
- [ ] **Expected:** Status changes immediately
- [ ] Try to login as that user when inactive → **Expected:** Error "Account is deactivated"
- [ ] Toggle back to active
- [ ] Login → **Expected:** Success

---

## 9. Services Management

### 9.1 View Services
- [ ] Navigate to Services section (if available)
- [ ] **Expected:** List of church services/events

### 9.2 Add Custom Service
- [ ] Click "Add Service"
- [ ] Enter service name (e.g., "Prayer Meeting")
- [ ] Set default start and end times
- [ ] Toggle "Is Active"
- [ ] Save
- [ ] **Expected:** Service appears in attendance/giving service type dropdowns

### 9.3 Edit Service
- [ ] Click Edit on a service
- [ ] Update name or times
- [ ] Save
- [ ] **Expected:** Changes reflected in attendance and giving forms

### 9.4 Deactivate Service
- [ ] Toggle "Is Active" to off
- [ ] **Expected:** Service no longer appears in new records
- [ ] Existing records with that service still show

---

## 10. Navigation & Permissions

### 10.1 Test Navigation
- [ ] Click through all menu items:
  - Dashboard
  - Members
  - Visitors
  - Attendance
  - Giving
  - Reports
  - Settings
- [ ] **Expected:** Each page loads correctly

### 10.2 Test Permission-Based Access
- [ ] Login as Pastor (view-only role)
- [ ] **Expected:** Can view Members, Attendance, Giving, Reports
- [ ] **Expected:** CANNOT add/edit/delete records
- [ ] **Expected:** Settings tab has limited access
- [ ] Login as Elder (view-only role)
- [ ] Verify same restrictions
- [ ] Login as Admin
- [ ] **Expected:** Can manage all except user deletion
- [ ] **Expected:** Cannot change role permissions
- [ ] Login as Dev
- [ ] **Expected:** Full access to everything
- [ ] **Expected:** Can edit role permissions
- [ ] **Expected:** Can delete users

### 10.3 Mobile Responsiveness
- [ ] Resize browser to mobile width (or use device)
- [ ] **Expected:** Hamburger menu appears
- [ ] Click menu → **Expected:** Sidebar opens
- [ ] Navigate through pages
- [ ] **Expected:** All features work on mobile

---

## 11. Data Integrity & Edge Cases

### 11.1 Empty States
- [ ] Login to fresh account with no data
- [ ] **Expected:** Each page shows "No data" message with helpful text
- [ ] Add first record
- [ ] **Expected:** Empty state disappears

### 11.2 Form Validation
- [ ] Try to submit Add Member form without required fields
- [ ] **Expected:** Validation errors appear
- [ ] Fill required fields, submit
- [ ] **Expected:** Success

### 11.3 Concurrent Edits
- [ ] Open same member in two browser tabs
- [ ] Edit in first tab, save
- [ ] Edit in second tab, save
- [ ] **Expected:** Latest save wins (or conflict warning)

### 11.4 Network Error Handling
- [ ] Disconnect internet
- [ ] Try to save a record
- [ ] **Expected:** Error toast "Failed to save"
- [ ] Reconnect internet
- [ ] Try again → **Expected:** Success

---

## 12. Logout & Session Management

### 12.1 Logout
- [ ] Click Logout button (in sidebar or profile menu)
- [ ] **Expected:** Redirected to login page
- [ ] Try to access protected route directly
- [ ] **Expected:** Redirected to login

### 12.2 Session Persistence
- [ ] Login
- [ ] Refresh page
- [ ] **Expected:** Still logged in
- [ ] Close and reopen browser
- [ ] **Expected:** Session persists (or requires re-login based on your implementation)

---

## Test Completion Checklist

Mark each section as you complete testing:

- [ ] 1. Authentication & User Management
- [ ] 2. Dashboard & Overview
- [ ] 3. Members Management
- [ ] 4. Visitors Management
- [ ] 5. Attendance Management
- [ ] 6. Giving/Financial Management
- [ ] 7. Reports & Analytics
- [ ] 8. Settings & Configuration
- [ ] 9. Services Management
- [ ] 10. Navigation & Permissions
- [ ] 11. Data Integrity & Edge Cases
- [ ] 12. Logout & Session Management

---

## Critical Issues to Report

If you encounter any of these, report immediately:

1. **Cannot type in input fields** (Visitors, Attendance, Giving)
2. **Data not saving to database**
3. **Permission errors when user should have access**
4. **Login failures for approved users**
5. **Role permissions not applying correctly**
6. **Navigation breaks or infinite loops**
7. **Data loss on refresh**
8. **Unable to approve/reject pending users**

---

## Notes
- Test with multiple user roles to ensure permissions work correctly
- Clear browser cache if encountering unexpected behavior
- Check browser console for errors if something doesn't work
- Take screenshots of any bugs or unexpected behavior

**Happy Testing! 🎉**
