**MEMBER STATUS TRACKING LOGIC**

* Evaluation Window
* Last 4 Sunday Main Services only
* Sabbatical members excluded from automatic evaluation
* Status recalculated after each Sunday Main Service attendance recording

**Status Definitions**
New:
- Auto-assigned to all newly registered members
- Remains "New" until 4 Sunday Main Service attendance records exist
- After 4 Sundays, transitions to Active/Semi-Active/Inactive based on attendance

Active:
- Present in 3 or 4 of last 4 Sunday Main Services
- Allows 1 absence without penalty

Semi-Active:
- Present in 1 or 2 of last 4 Sunday Main Services
- Indicates irregular attendance

Inactive:
- Present in 0 of last 4 Sunday Main Services
- Reflects sustained absence

Sabbatical:
- Manual status assigned by Admin/Dev/Pastor (with temp permission)
- Not evaluated for attendance-based status changes
Requires:
Start Date (required)
End Date (optional - "until further notice" option)
Reason (text field)
Upon end:
If member attended services after sabbatical end date, status recalculated using last 4 Sunday attendances
If no attendances after sabbatical, status remains as "Sabbatical (Ended)" until next attendance

**Status Transition Rules**

- New → Active/Semi-Active/Inactive:
Triggered after 4 Sunday attendance records
Assigned based on attendance frequency

- Active → Semi-Active:
Attendance drops to 1-2 in last 4 services

- Active or Semi-Active → Inactive:
Attendance is 0 in last 4 services

- Inactive → Semi-Active:
Attendance increases to 1-2 in last 4 services

- Inactive or Semi-Active → Active:
Attendance reaches 3-4 in last 4 services

- Any Status → Sabbatical:
Manual override by authorized role
Attendance evaluation paused
Manual Status Override

`Admin/Dev can manually change member status`
Manual change overrides automatic tracking
System resumes automatic tracking from the point of override
Log shows manual override with timestamp and user who made the change

**ATTENDANCE SYSTEM**
Two Complementary Systems

`System 1: Bulk Service Attendance`
- Recording Process:
Select Service Type
Sunday Main Service (permanent)
Custom temporary services from dropdown
Select Date and Time
Mark members present (multi-select checklist or toggle all)
Enter total attendance count (auto-calculated, editable for guests)
Add service-specific notes (optional)
Save attendance

- After Saving:
All unmarked members considered absent
Absentee List displays with:
Search, filter, sort functionality
Checkbox: "Requested Permission to be Absent"
Dropdown: "Reason/Excuse" (Sick, Travel, Work, Family Emergency, Other)
Time Period options:
Specific date range (from/to)
"Until further notice"
Save absentee information

- Edit Window:
12-hour window after saving to make changes
After 12 hours, record is locked (view-only)
Only Dev can edit after window closes
Visual indicator showing time remaining in edit window

- Status Impact:
Only Sunday Main Service attendance affects member status
Status recalculated automatically after each Sunday Main Service record is saved

`System 2: Individual Attendance Marking`
Use Cases:

Mark individual member attendance outside service time
Late arrivals
Individual follow-up corrections
Process:

Search for member
Select date and service type
Mark present/absent
Add notes if needed
Updates member's attendance record immediately
