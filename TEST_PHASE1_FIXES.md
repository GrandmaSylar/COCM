# Phase 1 Fixes - Testing Guide

## Overview
All 4 Phase 1 critical bugs have been fixed in the backend. Please follow this guide to test each fix.

## Prerequisites
1. Backend has been deployed (✅ Completed)
2. Frontend build is successful (✅ Completed)
3. You need to test with a **Dev** or **Admin** account

---

## Fix #1: Update User Role Functionality ✅

### What was fixed:
- Added missing `checkPermission` helper function to the backend
- Endpoint: `PATCH /users/:id/role`

### How to test:
1. Log in with a **Dev** account (only Devs can change roles)
2. Navigate to **Settings** page
3. Find a user in the "System Users" section
4. Click on the role dropdown for that user (should say "Change Role:")
5. Select a new role (e.g., change from "Pastor" to "Elder")
6. **Expected result:** Toast message "User role updated successfully" appears
7. **Expected result:** The user's badge updates to reflect the new role immediately
8. **Verification:** Refresh the page and confirm the role persists

### Common issues:
- ❌ If you're not logged in as Dev, the role dropdown won't appear
- ❌ Make sure you're not trying to change your own role

---

## Fix #2: Member Details Update ✅

### What was fixed:
- Added camelCase to snake_case conversion in `PUT /members/:id` endpoint
- Fixed field mapping for photo_url
- Fixed family members data transformation

### How to test:
1. Navigate to **Members** page
2. Click on any member to view their profile
3. Click the **Edit** button
4. Make changes to any field (e.g., phone number, email, address, notes)
5. Click **Save**
6. **Expected result:** Toast message "Member updated successfully!" appears
7. **Expected result:** You're navigated back to the member profile
8. **Expected result:** All your changes are visible on the profile
9. **Verification:** Refresh the page and confirm changes persisted

### Test these specific fields:
- ✅ Basic info: firstName, lastName, email, phone
- ✅ Location: residenceLocation, digitalAddress
- ✅ Zone and zone number
- ✅ Marital status and gender
- ✅ Baptism information
- ✅ Family members (add/edit/remove)
- ✅ Legal info: Ghana Card details
- ✅ Ministries selection
- ✅ Notes

---

## Fix #3: Attendance Records Not Displaying ✅

### What was fixed:
- Fixed data transformation bug where `attendance_entries` was being accessed after camelCase conversion
- Added null safety check for empty attendance entries
- Properly extract attendee IDs before transformation

### How to test:
1. First, record some attendance:
   - Navigate to **Attendance** page
   - Click **Mark Attendance** or **Record Attendance**
   - Select a service date and type
   - Mark several members as present
   - Click **Save**

2. View attendance records:
   - Navigate back to **Attendance** page
   - **Expected result:** You should see the attendance record you just created
   - **Expected result:** The record shows:
     - Service type (e.g., "Sunday Main Service")
     - Date
     - Time range
     - Attendee count (e.g., "15 attendees")
     - Badge showing "Permanent" or "Custom"

3. Test filters:
   - Use the search box to filter by service type
   - Use the dropdown to filter by specific service
   - **Expected result:** Records filter correctly

### Common issues:
- ❌ If no records appear, check browser console for errors
- ❌ Make sure you actually recorded attendance first
- ❌ Check that the attendance record was saved successfully (check toast message)

---

## Fix #4: Grant Permissions Functionality ✅

### What was fixed:
- Added missing `checkPermission` helper function
- Endpoint: `POST /users/:id/grant-permission`
- Endpoint: `DELETE /users/:id/revoke-permission/:permission`

### How to test:
1. Log in with **Dev** or **Admin** account (both can grant permissions)
2. Navigate to **Settings** page
3. Find a **Pastor** or **Elder** user in the System Users list
4. Click the **Grant Permission** button
5. **Expected result:** A dialog opens with:
   - Permission dropdown (showing permissions they don't already have)
   - Duration dropdown (1 hour, 3 hours, 6 hours, 12 hours, 24 hours, 48 hours, 1 week)
6. Select a permission (e.g., "Edit Members") and duration (e.g., "24 Hours")
7. Click **Grant Permission**
8. **Expected result:** Toast message "Permission granted for 24 hour(s)" appears
9. **Expected result:** A blue box appears showing "Temporary Permissions" with:
   - The permission name (e.g., "Edit Members")
   - Expiration time (e.g., "Expires in 23h 59m")
   - Revoke button (trash icon)

10. Test revoking:
    - Click the trash icon next to the temporary permission
    - **Expected result:** Toast message "Permission revoked" appears
    - **Expected result:** The permission disappears from the list

### Test the permission system works:
1. Log in as a **Pastor** account (they normally only have view permissions)
2. Try to edit a member - you should see "Access Restricted"
3. Have an admin grant them "edit_members" permission temporarily
4. **Expected result:** Pastor can now edit members
5. Wait for the permission to expire or have admin revoke it
6. **Expected result:** Pastor can no longer edit members

---

## Debugging Tips

### If something still doesn't work:

1. **Check browser console** (F12 → Console tab)
   - Look for red error messages
   - Look for failed API calls (status 401, 403, 500)

2. **Check Network tab** (F12 → Network tab)
   - Filter by "Fetch/XHR"
   - Look for failed requests
   - Click on failed requests to see error details

3. **Clear cache and reload**
   - Hard refresh: Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac)
   - Or clear browser cache completely

4. **Check your account role**
   - Some features require Dev role
   - Some features require Admin or Dev role
   - Pastor and Elder have limited permissions by default

5. **Check backend logs**
   - Go to Supabase Dashboard → Edge Functions → server
   - Click "Logs" to see backend errors

---

## Summary of Changes

### Backend Files Modified:
- `supabase/functions/server/index.ts`
  - Added `checkPermission()` helper function (line 47-86)
  - Fixed member update endpoint to convert camelCase (line 566-573)
  - Fixed attendance data transformation (line 656-663)

### Deployments:
- ✅ Backend deployed to Supabase Edge Functions
- ✅ Frontend build completed successfully

---

## If bugs persist after testing:

Please provide:
1. Your account role (Dev/Admin/Pastor/Elder)
2. Which specific test failed
3. Screenshot of the error
4. Browser console error messages
5. Network tab showing failed request

