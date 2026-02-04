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

## 9. Services Tab (Date-Grouped Service Records)

### 9.1 View Services List
- [ ] Navigate to Services in the sidebar
- [ ] **Expected:** "All Services" list shows one row per date (not per service type)
- [ ] Each row shows: formatted date, combined service types (e.g., "Sunday Main Service, Sunday Evening"), total attendance count, total giving amount
- [ ] If services were recorded today, a "Today's Service" section appears at the top

### 9.2 Latest/Today Section
- [ ] Record attendance or giving for today
- [ ] Navigate to Services tab
- [ ] **Expected:** "Today's Service" card appears with combined stats
- [ ] If no services today, "Latest Service" shows the most recent date
- [ ] Card shows: attendance count, giving total, absentee count, visitor count

### 9.3 Date-Grouped Combining
- [ ] Record attendance for "Sunday Main Service" on a date
- [ ] Record giving for the same date (same or different service type)
- [ ] Navigate to Services tab
- [ ] **Expected:** Both records appear as ONE row for that date
- [ ] Attendance and giving totals are summed across service types
- [ ] Service types are listed together (e.g., "Sunday Main Service, Sunday Evening")

### 9.4 Service Detail View
- [ ] Click on any service date row
- [ ] **Expected:** Detail page opens showing:
  - Date with all service types listed
  - Summary cards: total attendance, total giving, absentees, visitors
  - Per-service giving breakdowns (if multiple services on same date, each has its own section with a heading)
  - Combined attendees list (deduplicated across services)
  - Combined absentees list (deduplicated)
  - Visitors for that date
  - New members registered on that date

### 9.5 New Records Overwrite Old
- [ ] Record attendance for a date/service type
- [ ] Note the attendance count in Services
- [ ] Record attendance again for the same date/service type (different count)
- [ ] **Expected:** Services tab shows the newer count, not a duplicate entry

### 9.6 Pagination
- [ ] Ensure there are more than 15 service dates
- [ ] **Expected:** Pagination controls appear at bottom
- [ ] Click Next → **Expected:** Next page of dates loads
- [ ] Click Previous → **Expected:** Returns to previous page

---

## 10. Tab Access Control

### 10.1 Default Tab Access (New User)
- [ ] Create a new user (admin, pastor, or elder) via Settings
- [ ] Login as that user
- [ ] **Expected:** Sidebar shows only Dashboard, Help, and Settings
- [ ] **Expected:** Dashboard shows NO quick actions (all require tab access)
- [ ] **Expected:** Cannot navigate to Members, Visitors, Attendance, Giving, Reports, Services, or Activity Log

### 10.2 Grant Tab Access (Dev Only)
- [ ] Login as dev
- [ ] Go to Settings → Users & Permissions
- [ ] Find the user in the System Users list
- [ ] **Expected:** Tab access section visible with icons for each tab (Members, Visitors, Attendance, Giving, Reports, Services, Activity Log)
- [ ] Click "Members" tab button to grant access
- [ ] **Expected:** Button turns blue/active with a filled style
- [ ] **Expected:** Toast "Updated tab access for [user name]"
- [ ] Grant access to a few more tabs

### 10.3 Verify Tab Access Takes Effect
- [ ] Login as the user who was granted access
- [ ] **Expected:** Sidebar now shows the granted tabs (e.g., Members, Giving)
- [ ] **Expected:** Tabs NOT granted are still hidden
- [ ] **Expected:** Dashboard quick actions appear only for granted tabs
- [ ] Click on a granted tab → **Expected:** Page loads normally
- [ ] Try manually navigating to a non-granted tab (if possible) → **Expected:** Not accessible

### 10.4 Revoke Tab Access
- [ ] Login as dev
- [ ] Go to Settings → Users & Permissions
- [ ] Click an active (blue) tab button to revoke it
- [ ] **Expected:** Button reverts to inactive/outline style
- [ ] Login as that user
- [ ] **Expected:** Revoked tab no longer appears in sidebar or quick actions

### 10.5 Dev Always Has Full Access
- [ ] Login as dev
- [ ] **Expected:** All tabs visible regardless of tab_access entries
- [ ] **Expected:** All quick actions visible on Dashboard

### 10.6 Tab Access Counter
- [ ] In Settings, check the tab access section for a user
- [ ] **Expected:** Shows "X of 7 tabs" counter reflecting how many are active

---

## 11. Activity Log

### 11.1 View Activity Log
- [ ] Navigate to Activity Log in the sidebar
- [ ] **Expected:** List of activity entries with: icon, description, user name, role, timestamp, action badge (colored)

### 11.2 Activity Logging on Actions
- [ ] Create a new member → go to Activity Log
- [ ] **Expected:** Entry like "Created member John Doe" with green "create" badge
- [ ] Update a member → check Activity Log
- [ ] **Expected:** Entry like "Updated member John Doe" with blue "update" badge
- [ ] Delete a member → check Activity Log
- [ ] **Expected:** Entry like "Deleted member John Doe" with red "delete" badge
- [ ] Record attendance → check Activity Log
- [ ] **Expected:** Attendance creation logged
- [ ] Record giving → check Activity Log
- [ ] **Expected:** Giving creation logged
- [ ] Login/logout → check Activity Log
- [ ] **Expected:** Login and logout events logged

### 11.3 Filter Activity Log
- [ ] Use the Action filter dropdown → select "Create"
- [ ] **Expected:** Only create actions shown
- [ ] Use the Entity Type filter → select "Member"
- [ ] **Expected:** Only member-related actions shown
- [ ] Set a date range using the From/To date inputs
- [ ] **Expected:** Only entries within that range shown
- [ ] Click "Clear" to reset all filters
- [ ] **Expected:** All entries shown again

### 11.4 Dev vs Non-Dev View
- [ ] Login as dev → go to Activity Log
- [ ] **Expected:** See ALL users' activity
- [ ] Login as a non-dev user → go to Activity Log
- [ ] **Expected:** See only YOUR OWN activity
- [ ] **Expected:** Message at bottom: "You are viewing your own activity..."

### 11.5 Export Activity Log
- [ ] Click the CSV export button
- [ ] **Expected:** CSV file downloads with columns: Date, User, Role, Action, Type, Description
- [ ] Click the Excel export button
- [ ] **Expected:** XLSX file downloads with same columns
- [ ] Click the PDF export button
- [ ] **Expected:** PDF file downloads with formatted table
- [ ] Apply filters, then export
- [ ] **Expected:** Export respects the active filters

### 11.6 Pagination
- [ ] Generate enough activity (create/update several records)
- [ ] **Expected:** If more than 30 entries, pagination appears
- [ ] Navigate between pages
- [ ] **Expected:** Different entries on each page

---

## 12. Notifications

### 12.1 Notification Bell (Sidebar & Mobile)
- [ ] Login to any account
- [ ] **Expected:** Notification bell icon visible in sidebar (desktop) and header (mobile)
- [ ] If there are unread notifications, **Expected:** Amber badge with count appears on bell icon
- [ ] Badge shows "9+" if count exceeds 9
- [ ] Click the bell → **Expected:** Navigate to Notifications page

### 12.2 View Notifications Page
- [ ] Navigate to Notifications (via bell or sidebar)
- [ ] **Expected:** List of notifications, each with:
  - Type icon (colored: Users, DollarSign, Calendar, Cake, etc.)
  - Title and message
  - Relative timestamp (e.g., "2h ago", "3d ago")
  - Tab badge (e.g., "members", "giving") if applicable
- [ ] Unread notifications have a left amber border and slight background tint

### 12.3 Mark as Read
- [ ] Find an unread notification (amber left border)
- [ ] Click the eye icon on the right
- [ ] **Expected:** Notification border/tint disappears (marked as read)
- [ ] Bell badge count decreases

### 12.4 Mark All as Read
- [ ] Ensure there are multiple unread notifications
- [ ] Click "Mark All Read" button
- [ ] **Expected:** All notifications lose their unread styling
- [ ] Bell badge disappears (count = 0)

### 12.5 Unread Only Filter
- [ ] Click "Unread Only" toggle button
- [ ] **Expected:** Only unread notifications shown
- [ ] Click again (shows "Show All")
- [ ] **Expected:** All notifications shown again

### 12.6 Notification Generation
- [ ] **Member status change:** Trigger an attendance record that changes a member's status (e.g., from active to semi-active)
- [ ] **Expected:** Users with "members" tab access receive a notification about the status change
- [ ] **Birthday:** Ensure a member has today's date as birthday
- [ ] Login → **Expected:** Birthday notification appears
- [ ] **New member registration:** Add a new member
- [ ] **Expected:** Users with "members" tab access get notified
- [ ] **High giving:** Record a giving that exceeds the previous maximum
- [ ] **Expected:** Users with "giving" tab access get notified
- [ ] **High attendance:** Record attendance that exceeds previous maximum
- [ ] **Expected:** Users with "attendance" tab access get notified

### 12.7 Notification Respects Tab Access
- [ ] Login as a user who only has "members" tab access
- [ ] **Expected:** Only see notifications related to members (not giving or attendance)
- [ ] Login as dev
- [ ] **Expected:** See all notifications

### 12.8 Pagination
- [ ] If more than 20 notifications, pagination controls appear
- [ ] Navigate between pages
- [ ] **Expected:** Different notifications on each page

### 12.9 Notification Bell Auto-Refresh
- [ ] Leave the app open on any page
- [ ] From another session/user, trigger an action that generates a notification for the current user
- [ ] **Expected:** Within 30 seconds, the bell badge count updates without page refresh

---

## 13. Two-Factor Authentication (2FA)

### 13.1 Enable 2FA
- [ ] Login to any account
- [ ] Go to Settings
- [ ] Find 2FA / OTP section
- [ ] Enable 2FA
- [ ] **Expected:** Confirmation that 2FA is now active

### 13.2 Login with 2FA
- [ ] Logout
- [ ] Enter email and password on login form
- [ ] **Expected:** After password verification, OTP input screen appears
- [ ] Check email for OTP code
- [ ] Enter correct OTP code
- [ ] **Expected:** Login completes successfully

### 13.3 Invalid OTP
- [ ] Start login with correct password
- [ ] Enter wrong OTP code
- [ ] **Expected:** Error message "Invalid or expired OTP"
- [ ] Enter correct code
- [ ] **Expected:** Login succeeds

### 13.4 OTP Expiry
- [ ] Start login, receive OTP
- [ ] Wait for OTP to expire (check configured timeout)
- [ ] Enter expired OTP
- [ ] **Expected:** Error "Invalid or expired OTP"
- [ ] Request a new OTP and use it
- [ ] **Expected:** Login succeeds

### 13.5 Forgot Password Flow
- [ ] On login page, click "Forgot Password"
- [ ] Enter email address
- [ ] **Expected:** Password reset email sent
- [ ] Follow reset link
- [ ] Set new password
- [ ] Login with new password → **Expected:** Success

---

## 14. Edit Windows (Attendance & Giving)

### 14.1 Attendance Edit Window (12 hours)
- [ ] Record attendance
- [ ] Immediately go to the record detail
- [ ] **Expected:** Edit button is visible and enabled
- [ ] Edit the record (change count or attendees)
- [ ] **Expected:** Success — changes saved
- [ ] Check again after 12 hours
- [ ] **Expected:** Edit button disabled or shows "Edit window closed" / lock icon

### 14.2 Giving Edit Window (3 hours)
- [ ] Record giving
- [ ] Immediately go to the record detail
- [ ] **Expected:** Edit button is visible and enabled
- [ ] Edit the record (change amounts)
- [ ] **Expected:** Success — changes saved
- [ ] Check again after 3 hours
- [ ] **Expected:** Edit button disabled or shows lock icon

### 14.3 Dev Bypasses Edit Window
- [ ] Login as dev
- [ ] Find an old attendance record (past 12 hours)
- [ ] **Expected:** Edit is still available (dev bypasses the edit window)
- [ ] Find an old giving record (past 3 hours)
- [ ] **Expected:** Edit is still available

### 14.4 Edit Tracking
- [ ] Edit an attendance or giving record
- [ ] **Expected:** Record shows "Edited by [user]" with edit timestamp
- [ ] Check Activity Log → **Expected:** Edit action logged

---

## 15. Navigation & Tab Access Integration

### 15.1 Test Full Navigation
- [ ] Click through all menu items:
  - Dashboard
  - Services
  - Members
  - Visitors
  - Attendance
  - Giving
  - Reports
  - Activity Log
  - Help
  - Settings
  - Notifications (via bell icon)
- [ ] **Expected:** Each page loads correctly
- [ ] **Expected:** Sidebar highlights the current page

### 15.2 Tab-Based Permission Filtering
- [ ] Login as a user with only "members" and "giving" tab access
- [ ] **Expected:** Sidebar shows: Dashboard, Services (if granted), Members, Giving, Help, Settings
- [ ] **Expected:** Visitors, Attendance, Reports, Activity Log are hidden
- [ ] **Expected:** Dashboard quick actions show only: Add Member, Record Giving (not Record Attendance, Add Visitor)

### 15.3 Mobile Navigation
- [ ] Resize browser to mobile width (or use device)
- [ ] **Expected:** Hamburger menu appears
- [ ] Click menu → **Expected:** Sidebar opens with correct tabs
- [ ] **Expected:** Notification bell visible in mobile header with badge
- [ ] **Expected:** Theme toggle visible in mobile header
- [ ] Navigate through pages on mobile
- [ ] **Expected:** All features work
- [ ] **Expected:** Bottom navigation bar shows first 4 tabs

---

## 16. Custom Service Types (Attendance Settings)

### 16.1 Add Custom Service Type
- [ ] Go to Attendance page, find service/settings option
- [ ] Click "Add Service"
- [ ] Enter service name (e.g., "Prayer Meeting")
- [ ] Set default start and end times
- [ ] Toggle "Is Active"
- [ ] Save
- [ ] **Expected:** Service appears in attendance/giving service type dropdowns

### 16.2 Edit Custom Service Type
- [ ] Click Edit on a custom service
- [ ] Update name or times
- [ ] Save
- [ ] **Expected:** Changes reflected in attendance and giving forms

### 16.3 Deactivate Custom Service Type
- [ ] Toggle "Is Active" to off
- [ ] **Expected:** Service no longer appears in new records
- [ ] Existing records with that service still show

---

## 17. Data Integrity & Edge Cases

### 17.1 Empty States
- [ ] Login to fresh account with no data
- [ ] **Expected:** Each page shows appropriate empty message:
  - Services: "No service records yet."
  - Activity Log: "No activity logs found."
  - Notifications: "No notifications yet."
  - Members/Visitors/Attendance/Giving: Empty state messages
- [ ] Add first record → **Expected:** Empty state disappears

### 17.2 Form Validation
- [ ] Try to submit Add Member form without required fields
- [ ] **Expected:** Validation errors appear
- [ ] Fill required fields, submit → **Expected:** Success

### 17.3 Concurrent Edits
- [ ] Open same member in two browser tabs
- [ ] Edit in first tab, save
- [ ] Edit in second tab, save
- [ ] **Expected:** Latest save wins (or conflict warning)

### 17.4 Network Error Handling
- [ ] Disconnect internet
- [ ] Try to save a record
- [ ] **Expected:** Error toast "Failed to save"
- [ ] Reconnect internet → Try again → **Expected:** Success

---

## 18. Performance & Caching

### 18.1 Page Load Speed
- [ ] Navigate to Dashboard → **Expected:** Stats load quickly (cached for 2 minutes)
- [ ] Navigate away, then back to Dashboard
- [ ] **Expected:** Instant load from cache (no loading spinner if within 2 min)

### 18.2 Members List Caching
- [ ] Navigate to Members → note load time
- [ ] Navigate away, then back to Members within 5 minutes
- [ ] **Expected:** Instant load from cache (no spinner)

### 18.3 Visitors List Caching
- [ ] Navigate to Visitors → note load time
- [ ] Navigate away, then back within 3 minutes
- [ ] **Expected:** Instant load from cache

### 18.4 Attendance & Giving Caching
- [ ] Navigate to Attendance → note load time
- [ ] Navigate away, then back within 2 minutes
- [ ] **Expected:** Faster load from cache
- [ ] Same test for Giving page

### 18.5 Cache Invalidation on Mutation
- [ ] View Members list (cached)
- [ ] Add a new member
- [ ] Return to Members list
- [ ] **Expected:** New member appears (cache invalidated by the POST request)

### 18.6 Request Deduplication
- [ ] Open browser dev tools → Network tab
- [ ] Rapidly switch between pages
- [ ] **Expected:** No duplicate simultaneous requests to the same endpoint

### 18.7 Services Tab Performance
- [ ] Navigate to Services with many records
- [ ] **Expected:** List loads without excessive delay (backend uses batch queries, not per-record)
- [ ] Click into a detail view → **Expected:** Loads promptly

### 18.8 Settings Performance
- [ ] Navigate to Settings (as dev with many users)
- [ ] **Expected:** Users list loads with permissions in a single batch (not one request per user)
- [ ] Check Network tab → **Expected:** One call to `/users/temporary-permissions/all` instead of multiple per-user calls

---

## 19. Row Level Security (RLS)

### 19.1 Verify RLS is Active
- [ ] Open browser dev tools console
- [ ] Try querying a protected table directly via Supabase client:
  ```js
  const { data } = await supabase.from('otp_codes').select('*');
  console.log(data); // Should be empty or error
  ```
- [ ] **Expected:** Returns empty array or permission denied (not actual data)

### 19.2 Test Each Protected Table
- [ ] Repeat direct query test for each table:
  - `absentee_records` → **Expected:** No data returned
  - `activity_log` → **Expected:** No data returned
  - `member_status_log` → **Expected:** No data returned
  - `notifications` → **Expected:** No data returned
  - `otp_codes` → **Expected:** No data returned
  - `service_records` → **Expected:** No data returned
  - `user_tab_access` → **Expected:** No data returned
- [ ] **Expected:** All data access still works through the app (Edge Function uses service_role)

### 19.3 Verify App Still Functions
- [ ] After RLS is enabled, test normal workflows:
  - Record attendance → **Expected:** Works
  - Record giving → **Expected:** Works
  - View notifications → **Expected:** Works
  - View activity log → **Expected:** Works
  - View services → **Expected:** Works
  - Manage tab access in Settings → **Expected:** Works

---

## 20. Logout & Session Management

### 20.1 Logout
- [ ] Click Logout button in sidebar
- [ ] **Expected:** Redirected to login page
- [ ] **Expected:** Logout event logged in Activity Log
- [ ] Try to access protected route directly → **Expected:** Redirected to login

### 20.2 Session Persistence
- [ ] Login
- [ ] Refresh page → **Expected:** Still logged in
- [ ] Close and reopen browser → **Expected:** Session persists (based on token expiry)

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
- [ ] 9. Services Tab (Date-Grouped)
- [ ] 10. Tab Access Control
- [ ] 11. Activity Log
- [ ] 12. Notifications
- [ ] 13. Two-Factor Authentication (2FA)
- [ ] 14. Edit Windows (Attendance & Giving)
- [ ] 15. Navigation & Tab Access Integration
- [ ] 16. Custom Service Types
- [ ] 17. Data Integrity & Edge Cases
- [ ] 18. Performance & Caching
- [ ] 19. Row Level Security (RLS)
- [ ] 20. Logout & Session Management

---

## Critical Issues to Report

If you encounter any of these, report immediately:

1. **Cannot type in input fields** (Visitors, Attendance, Giving)
2. **Data not saving to database**
3. **Permission errors when user should have access**
4. **Login failures for approved users**
5. **Role permissions not applying correctly**
6. **Tab access not filtering sidebar/quick actions**
7. **Navigation breaks or infinite loops**
8. **Data loss on refresh**
9. **Unable to approve/reject pending users**
10. **Activity log not recording actions**
11. **Notifications not generating or not respecting tab access**
12. **Edit window allowing edits after expiry (for non-dev users)**
13. **Direct Supabase queries returning data from RLS-protected tables**
14. **Cache showing stale data after mutations**
15. **2FA OTP codes readable via direct database query**

---

## Notes
- Test with multiple user roles (dev, admin, pastor, elder) to ensure permissions and tab access work correctly
- For tab access testing, create a fresh user with no tabs, then grant tabs incrementally
- Clear browser cache if encountering unexpected behavior
- Check browser console for errors if something doesn't work
- Use browser Network tab to verify caching and request deduplication
- Take screenshots of any bugs or unexpected behavior
