# Remaining Fixes and Enhancements

## Phase 1 - Still Not Working (0 items) ✅ COMPLETED

### 2. Fix Update User Role Functionality ✅
**Issue:** User role updates are not working properly
**Location:** Settings component
**Status:** ✅ FIXED - Endpoint was working, added missing `checkPermission` helper function

### 3. Fix Member Details Update ✅
**Issue:** Member details updates are not saving correctly
**Location:** EditMember component
**Status:** ✅ FIXED - Added camelCase to snake_case conversion in PUT /members/:id endpoint

### ~~5. Fix Attendance Records Not Displaying~~ ✅
**Issue:** Recorded attendance does not show in the list
**Location:** Attendance component
**Status:** ✅ FIXED - Added null check for attendance_entries in data transformation

### ~~6. Fix Grant Permissions Functionality~~ ✅
**Issue:** Granting temporary permissions is not working
**Location:** Settings component
**Status:** ✅ FIXED - Added missing `checkPermission` helper function

---

## Phase 2 - User Management Enhancements (9 items)

### 1. Add Phone Number to User Registration
**Description:** Add phone field to signup and allow login by phone or email
**Files:** SignUp.tsx, Login.tsx, server/index.ts
**Backend:** Modify auth endpoints to accept phone number
**Frontend:** Add phone input field, update login to accept email OR phone

### 2. Remove Department/Ministry from User Registration
**Description:** Users should not select department/ministry during account creation
**Files:** SignUp.tsx, AddUser.tsx
**Action:** Remove ministry/department selection fields

### 3. Add Rejected Users Count Tile
**Description:** Show rejected users separately and exclude from total count
**Files:** Settings.tsx
**Action:** Add new stats card for rejected users, update total calculation

### 4. Add Search, Filter, Sort to System Users
**Description:** Make system users list searchable and sortable
**Files:** Settings.tsx
**Features:**
- Search by name, email, phone
- Filter by role (dev, admin, pastor, elder)
- Filter by status (active, inactive, pending, approved, rejected)
- Sort by name, role, join date

### 5. Fix Zone Numbers to Continue from Last
**Description:** Zone numbers should increment from the last number, not be random
**Files:** AddMember.tsx, server/index.ts
**Backend:** Query database for highest zone number per zone
**Frontend:** Auto-fill next available zone number

### 6. Show Added Family Members in Member Profile
**Description:** Display list of family members in member profile view
**Files:** MemberProfile.tsx
**Action:** Add family members section showing all linked family members

### 7. Add Family Tree Visualization
**Description:** Visual representation of family relationships
**Files:** MemberProfile.tsx or new component
**Technology:** Consider using a graph library (react-d3-tree, react-family-tree)

### 8. Make Family Members Clickable
**Description:** Click on family member to view their profile
**Files:** MemberProfile.tsx
**Action:** Add click handlers to navigate to linked member profiles

### 9. Add Filter and Sort to Members List
**Description:** Enhanced member list filtering and sorting
**Files:** Members.tsx
**Features:**
- Filter by status (active, semi-active, inactive, sabbatical, blacklisted)
- Filter by zone (A, B, F, K, M, R)
- Filter by gender
- Filter by marital status
- Sort by name, join date, zone number, status

---

## Phase 3 - Feature Enhancements (18 items)

### 1. Add Loading Animations
**Description:** Add loading states throughout the application
**Files:** All components
**Components:** Skeleton loaders, spinners, progress indicators

### 2. Add Delete Member Button
**Description:** Allow authorized users to delete members
**Files:** MemberProfile.tsx, EditMember.tsx, server/index.ts
**Backend:** Add DELETE /members/:id endpoint
**Frontend:** Add delete button with confirmation dialog

### 3. Add 'Referenced By' Member Lookup in Add Visitor
**Description:** When adding visitor, search for existing members who referred them
**Files:** AddVisitor.tsx
**Action:** Add member search/autocomplete for "Referred By" field

### 4. Add Convert Visitor to Member Button
**Description:** Quick action to convert visitor record to member
**Files:** VisitorProfile.tsx, Visitors.tsx
**Action:** Pre-fill AddMember form with visitor data

### 5. Add 'Add Member from Visitor' Button
**Description:** Alternative flow to convert visitor to member
**Files:** Visitors.tsx
**Action:** Same as #4 but different entry point

### 6. Remove Follow-up Fields from Visitors
**Description:** Remove follow-up status and related fields from visitor forms
**Files:** AddVisitor.tsx, Visitors.tsx, VisitorProfile.tsx
**Database:** Migration to remove follow_up_status column
**Backend:** Update visitor endpoints

### 7. Implement Absent Members Tracking
**Description:** Track which members were absent from services
**Files:** Attendance.tsx, MarkAttendance.tsx, server/index.ts
**Backend:** Create absentees table or add to attendance_entries
**Frontend:** Show list of absent members per service

### 8. Make Attendance Start/End Time Editable
**Description:** Allow editing attendance times after recording
**Files:** Attendance.tsx, server/index.ts
**Backend:** Add PATCH /attendance/:id endpoint
**Frontend:** Add edit functionality to attendance records

### 9. Add Absentees List with Permission Request
**Description:** Show who was absent with permission to request access
**Files:** Attendance.tsx
**Action:** Integrate with permissions system

### 10. Implement 12-Hour Edit Window for Attendance
**Description:** Attendance can only be edited within 12 hours of recording
**Files:** Attendance.tsx, server/index.ts
**Backend:** Check timestamp before allowing edits
**Frontend:** Disable edit button after 12 hours

### 11. Track Member Status Based on Attendance
**Description:** Automatically update member status based on attendance patterns
**Files:** Background job or scheduled function
**Logic:**
- Active: Present in last 2 services
- Semi-active: Absent less than 1 month
- Inactive: Absent more than 1 month without permission
**Backend:** Scheduled job to update member statuses

### 12. Show Recorder Name/Email in Giving Records
**Description:** Display who recorded each giving entry
**Files:** Giving.tsx
**Backend:** Already stored as created_by
**Frontend:** Join with profiles table and display user info

### 13. Add View Giving Details Page
**Description:** Detailed view of individual giving record
**Files:** New GivingDetails.tsx component
**Features:**
- Full breakdown of offerings and custom types
- Payment method breakdown
- Service details
- Notes
- Recorder information
- Timestamp

### 14. Add Export Buttons (PDF/CSV/XLSX)
**Description:** Export data from all pages
**Files:** Members.tsx, Attendance.tsx, Giving.tsx, Visitors.tsx, Reports.tsx
**Libraries:**
- PDF: jsPDF or react-pdf
- CSV: Papa Parse
- XLSX: xlsx or exceljs
**Features:**
- Export current view/filtered data
- Include all relevant fields
- Proper formatting

### 15. Make Reports Graphs Interactive with Tooltips
**Description:** Enhanced report visualizations
**Files:** Reports.tsx
**Library:** Upgrade chart library or add tooltips
**Features:**
- Hover tooltips showing exact values
- Click to drill down
- Legend interactions
- Date range selection

### 16. Force Re-login on Browser/Tab Close
**Description:** Session should not persist after closing browser
**Files:** AuthContext.tsx
**Implementation:**
- Use sessionStorage instead of localStorage
- Clear session on window close
- Add session timeout

### 17. Add Custom Service Delete/Edit Functions
**Description:** Allow editing and deleting custom services
**Files:** Attendance.tsx (ServiceManager component)
**Backend:** Add PATCH /services/:id and DELETE /services/:id
**Frontend:** Add edit and delete buttons with confirmation

### 18. Add Member Status Change History
**Description:** Track when and why member status changed
**Database:** New member_status_history table
**Fields:** member_id, old_status, new_status, reason, changed_by, changed_at
**Backend:** Insert history record on status change
**Frontend:** Show status history in member profile

---

## Summary

- **Phase 1 (Critical Bugs):** ✅ 4/4 COMPLETED
- **Phase 2:** 9 user management and data enhancements
- **Phase 3:** 18 feature enhancements

**Total Remaining:** 27 items
**Total Completed:** 4 items

---

## Priority Order (Recommended)

1. Fix Phase 1 bugs first (items 2, 3, 5, 6)
2. Phase 2 items 1-5 (User management improvements)
3. Phase 2 items 6-9 (Family and member features)
4. Phase 3 items 1-6 (Core functionality improvements)
5. Phase 3 items 7-11 (Attendance enhancements)
6. Phase 3 items 12-18 (Advanced features)

---

**Last Updated:** January 8, 2026
