# Church Management System (ChMS) MVP - Summary

A comprehensive church management system for tracking members, attendance, giving, and generating reports.

## 🎯 Core Features

### 1. Authentication & Access Control
- Login, signup, password recovery
- 4 user roles: Dev, Admin, Pastor, Elder
- Temporary permissions (1hr - 1 week)
- Two-factor authentication

### 2. Dashboard
- Quick action buttons (Add Member, Record Attendance, etc.)
- Statistics overview (members, attendance, giving)
- Activity feed and notifications

### 3. Member Management
- Register members with contact info, zones (A-F), status
- Member profiles with family relationships
- Search, filter, and edit capabilities
- Photo uploads and ministry tracking
- Automatic status updates based on attendance

### 4. Attendance Tracking
- **Bulk Recording:** Mark entire service attendance at once
- **Individual Marking:** Record individual member attendance
- **Absentee Management:** Track absences with reasons
- **Custom Services:** Create temporary services
- **12-hour Edit Window:** Lock records after 12 hours

### 5. Visitor Management
- Register and track visitors
- Engagement tracking
- Convert visitors to members

### 6. Giving & Tithes
- Record donations in Ghana Cedis (GHS)
- Types: Offering, Donation, Thanksgiving, Custom
- Anonymous giving option
- Financial reports and receipts

### 7. Reports & Analytics
- Member statistics (growth, status distribution)
- Attendance trends and patterns
- Financial summaries and giving analysis
- Export: CSV, PDF, XLSX
- Interactive charts and graphs

### 8. Settings & Admin
- User management and approval
- Permission controls
- System configuration
- Theme customization (colors for light/dark mode)

### 9. Additional Features
- Activity log (audit trail)
- Absentee review and follow-up
- Interactive demo guide
- Notifications and alerts
- Help documentation

### Member Status Logic
- **New:** Auto-assigned until 4 Sundays attended
- **Active:** 3-4 attendances in last 4 Sundays
- **Semi-Active:** 1-2 attendances in last 4 Sundays
- **Inactive:** 0 attendances in last 4 Sundays
- **Sabbatical:** Manually assigned, evaluation paused
- Auto-updates after each Sunday service

---

## 🔌 User Roles & Permissions

| Role | Access Level | Key Permissions |
|------|-------------|-----------------|
| **Dev** | Full Access | Everything, theme customization, user management |
| **Admin** | Full Operational | All data management, user approval, temp permissions |
| **Pastor** | View-Only Default | Read all data, can get temporary write access |
| **Elder** | View-Only Default | Read members/attendance, limited editing |

**Temporary Permissions:** Can be granted for 1hr to 1 week (1hr, 3hr, 6hr, 12hr, 24hr, 48hr, 1 week)

---



## ✅ Key Capabilities

- ✅ Secure user authentication with role-based access
- ✅ Complete member database with 6-zone tracking
- ✅ Dual attendance systems (bulk & individual)
- ✅ Financial giving management in Ghana Cedis
- ✅ Comprehensive reports & analytics
- ✅ Visitor-to-member conversion workflow
- ✅ Activity audit trails
- ✅ Data export (CSV, PDF, Excel)
- ✅ Mobile-responsive design
- ✅ Light & dark theme support
