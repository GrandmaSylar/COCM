# Issues & Enhancements - Prioritized

## PHASE 1: CRITICAL - Broken Core Functionality
*These features are broken and block normal usage*

### 1. Attendance System Not Working
- [ ] **1.1** 'Save attendance' button in record attendance page does nothing
- [ ] **1.2** Mark attendance doesn't save or display recorded data
- **Type:** Frontend + Backend
- **Files:** `MarkAttendance.tsx`, `Attendance.tsx`, `server/index.ts`

### 2. Login Error Messages Not Specific
- [ ] **2.1** The error message 'invalid email or password' appears for ALL login errors (rejected, pending approval, deleted accounts)
- [ ] **2.2** Create and display separate error messages for different unsuccessful login causes
- **Type:** Frontend + Backend
- **Files:** `Login.tsx`, `AuthContext.tsx`, `server/index.ts`

### 3. User Management Issues
- [ ] **3.1** Update user role is not functional
- [ ] **3.2** Delete user anomaly: user 'myson uzziah' (uzi@church.com) cannot be deleted
- **Type:** Frontend + Backend
- **Files:** `Settings.tsx`, `server/index.ts`

---

## PHASE 2: HIGH - Important Frontend Fixes
*Core features that need fixing for proper functionality*

### 4. Family Member Search Not Working
- [ ] **4.1** 'Search family member' in Add Member form is not functional
- [ ] **4.2** Cannot link existing members via family relation
- [ ] **4.3** Search existing member in family information does not work
- **Type:** Frontend
- **Files:** `AddMember.tsx`

### 5. Family Members Not Displayed in Profile
- [ ] **5.1** Added family members details don't show in member profile
- [ ] **5.2** Add a family tree showing member's family in profile
- [ ] **5.3** Acknowledge family members who are also church members (clickable to their profile)
- **Type:** Frontend
- **Files:** `MemberProfile.tsx`

### 6. Missing Delete Member Button
- [ ] **6.1** There is no 'remove or delete member' button
- **Type:** Frontend + Backend
- **Files:** `MemberProfile.tsx`, `Members.tsx`, `server/index.ts`

### 7. Family Members Should Be Optional
- [ ] **7.1** Make add family members optional in member addition form
- **Type:** Frontend
- **Files:** `AddMember.tsx`

---

## PHASE 3: MEDIUM - UI/UX Improvements
*Enhancements that improve usability*

### 8. Search, Sort & Filter for System Users
- [ ] **8.1** Add sort, search and filter for system users list in dev/admin settings page
- **Type:** Frontend
- **Files:** `Settings.tsx`

### 9. Search, Sort & Filter for Members List
- [ ] **9.1** Add sort and filter feature at members list view
- **Type:** Frontend
- **Files:** `Members.tsx`

### 10. Zone Numbers Auto-Increment
- [ ] **10.1** Zone numbers should continue from the last one (begins from 1 and continues, not random)
- **Type:** Frontend + Backend
- **Files:** `AddMember.tsx`, `server/index.ts`

### 11. Loading Animations
- [ ] **11.1** Add subtle but obvious loading animations when fetching data or transitioning between screens
- **Type:** Frontend
- **Files:** All components

### 12. Visitor 'Referenced By' Should Search Members
- [ ] **12.1** In add visitor screen, let 'referenced by' actually reference an added member if there is a name match
- **Type:** Frontend
- **Files:** `AddVisitor.tsx`, `Visitors.tsx`

### 13. Remove Follow-up Fields from Visitors
- [ ] **13.1** Remove 'follow ups', 'follow up status' and 'follow up completed' from visitors page
- **Type:** Frontend + Backend (DB migration)
- **Files:** `Visitors.tsx`, `AddVisitor.tsx`, `server/index.ts`

---

## PHASE 4: FEATURE ADDITIONS - Visitor Conversion
*New features to add*

### 14. Convert Visitor to Member
- [ ] **14.1** Implement convert visitor to member option
- [ ] **14.2** Add 'add member from visitor' button to members page
- [ ] **14.3** Pre-fill AddMember form with visitor info
- **Type:** Frontend + Backend
- **Files:** `Visitors.tsx`, `Members.tsx`, `AddMember.tsx`, `server/index.ts`

---

## PHASE 5: COMPLEX - Attendance & Member Status System
*Complex features requiring significant logic*

### 15. Absentees Tracking
- [ ] **15.1** After marking attendance, all unmarked members are considered absent
- [ ] **15.2** List absentees with search, filter and sort
- [ ] **15.3** Allow marking 'requested permission to be absent' with reason and time period
- **Type:** Frontend + Backend + DB
- **Files:** `MarkAttendance.tsx`, `Attendance.tsx`, `server/index.ts`, DB migration

### 16. Attendance Edit Window
- [ ] **16.1** 12-hour window to edit attendance after first save
- [ ] **16.2** After window closes, only viewable (except dev can always edit)
- **Type:** Frontend + Backend
- **Files:** `Attendance.tsx`, `server/index.ts`

### 17. Member Status Logic (Auto-calculation)
- [ ] **17.1** Add new member status 'new' (auto-assigned to new members)
- [ ] **17.2** 'new'/'semi-active' → 'active': present 4 consecutive Sunday main services
- [ ] **17.3** 'active' stays active if absent at most once in past 4 Sunday services
- [ ] **17.4** 'active' → 'semi-active': absent 2-3 times in last 4 Sunday services
- [ ] **17.5** 'active'/'semi-active' → 'inactive': absent 4+ consecutive Sunday services
- [ ] **17.6** 'inactive' → 'active': present 5 consecutive Sunday services
- [ ] **17.7** Members with permission/reason marked as 'sabbatical' (not affected by logic)
- [ ] **17.8** Admin/dev can manually override status (restarts the logic)
- **Type:** Backend + DB (scheduled job)
- **Files:** `server/index.ts`, DB migration, possibly a Supabase scheduled function

### 18. Member Profile Attendance Display
- [ ] **18.1** Show attendance history and trends in member profile
- [ ] **18.2** Show status changes over time
- **Type:** Frontend + Backend
- **Files:** `MemberProfile.tsx`, `server/index.ts`

---

## PHASE 6: GIVING SYSTEM ENHANCEMENTS

### 19. Giving Record Display
- [ ] **19.1** Display who recorded each giving entry (user name and email)
- **Type:** Frontend + Backend
- **Files:** `Giving.tsx`, `server/index.ts`

### 20. Simplify Giving Form
- [ ] **20.1** Remove service name field
- [ ] **20.2** Default service type to 'Sunday main service'
- **Type:** Frontend
- **Files:** `Giving.tsx`

### 21. Foreign Currency Support
- [ ] **21.1** Add foreign currency in payment breakdown with currency dropdown
- [ ] **21.2** Foreign currency shown as suffix to GHC total (not added to GHC amount)
- **Type:** Frontend + Backend + DB
- **Files:** `Giving.tsx`, `server/index.ts`, DB migration

---

## PHASE 7: ADVANCED FEATURES

### 22. Export Functionality
- [ ] **22.1** Add export button to: Members, Attendance, Member Profile, Giving, Reports
- [ ] **22.2** Support formats: PDF, CSV, XLSX
- [ ] **22.3** Allow date range selection (days, weeks, months, specific range, or all)
- **Type:** Frontend
- **Files:** All relevant components, new `export.ts` utility

### 23. Interactive Reports & Analytics
- [ ] **23.1** Make graphs interactive with hover tooltips showing detailed values
- **Type:** Frontend
- **Files:** `Reports.tsx`

---

## Summary

| Phase | Category | Items | Priority |
|-------|----------|-------|----------|
| 1 | Critical - Broken Features | 3 issues | 🔴 Immediate |
| 2 | High - Frontend Fixes | 4 issues | 🟠 High |
| 3 | Medium - UI/UX | 6 issues | 🟡 Medium |
| 4 | Visitor Conversion | 1 feature | 🟡 Medium |
| 5 | Attendance/Status System | 4 features | 🔵 Complex |
| 6 | Giving Enhancements | 3 features | 🟢 Low |
| 7 | Advanced Features | 2 features | 🟢 Low |

**Total: 23 issues/features**

---

*Last Updated: January 24, 2026*
