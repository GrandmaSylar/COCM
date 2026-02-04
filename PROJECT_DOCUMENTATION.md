User: /fix JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., Could not find a declaration file for module 'react/jsx-runtime'. 'c:/Users/berna/back/node_modules/react/jsx-runtime.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/react` if it exists or add a new declaration (.d.ts) file containing `declare module 'react/jsx-runtime';`, JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists., JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.

VS Code: The errors you're seeing indicate that TypeScript is missing type definitions for React and JSX. Here's how to fix this:

1. Install the React type definitions by running this command in your terminal:


```bash
npm install --save-dev @types/react @types/react-dom
```


2. If you're using React 17+ with the new JSX transform, you may also need to ensure your `tsconfig.json` has the correct JSX settings:


```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```


3. After installing the types, restart the TypeScript server using the **TypeScript: Restart TS Server** command:



Show in Command Palette



The errors should be resolved once the type definitions are installed and the TypeScript server has restarted.

User: 'record service giving button' leads to a blank page

GitHub Copilot: The issue is that the `RecordGiving` component is being rendered, but it's not being returned or displayed in your component structure. You need to add state management in the `Giving` component to track whether to show the record giving form.

Here's the fix:

````typescript
export function Giving({ onRecordGiving }: GivingProps) {
  const [records, setRecords] = useState<GivingRecord[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomGivingType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState('all');
  const [showCustomTypeManager, setShowCustomTypeManager] = useState(false);
  const [showRecordGiving, setShowRecordGiving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, canAccess } = useAuth();

  // ...existing code...

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Giving</h1>
          <p className="text-muted-foreground">Loading giving data...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (showRecordGiving) {
    return <RecordGiving
      onBack={() => {
        setShowRecordGiving(false);
        onRecordGiving();
      }}
      onSave={async (record) => {
        setRecords(prev => [...prev, { ...record, id: Date.now().toString(), createdBy: user?.name, createdAt: new Date().toISOString() }]);
        setShowRecordGiving(false);
        toast.success('Service giving recorded successfully');
      }}
    />;
  }

  if (showCustomTypeManager && canManageCustomTypes) {
    return <CustomTypeManager
      customTypes={customTypes}
      onBack={() => setShowCustomTypeManager(false)}
      onDelete={handleDeleteCustomType}
      onToggle={handleToggleCustomType}
      onAdd={async (newType) => {
        try {
          const createdType = await api.giving.types.create({
            name: newType.name,
            description: newType.description
          });
          setCustomTypes(prev => [...prev, createdType]);
          toast.success('Giving type created successfully');
        } catch (error) {
          console.error('Failed to create giving type:', error);
          toast.error('Failed to create giving type');
        }
      }}
    />;
  }

  return (
    <div className="space-y-6">
      {/* ...existing code... */}
      {canRecordGiving && (
        <Button onClick={() => setShowRecordGiving(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Record Service Giving
        </Button>
      )}
      {/* ...rest of existing code... */}
    </div>
  );
}
````

The key changes:
1. Added `showRecordGiving` state to track whether to display the form
2. Added conditional rendering to show `RecordGiving` component when `showRecordGiving` is true
3. Updated button clicks to use `setShowRecordGiving(true)` instead of `onRecordGiving()`

User: still displaying blank page

GitHub Copilot: The issue is that `RecordGiving` is being called as a function through `onRecordGiving()` in the parent component, but there's no state management to handle showing it. You need to add a `showRecordGiving` state to the `Giving` component.

````typescript
export function Giving({ onRecordGiving }: GivingProps) {
  const [records, setRecords] = useState<GivingRecord[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomGivingType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState('all');
  const [showCustomTypeManager, setShowCustomTypeManager] = useState(false);
  const [showRecordGiving, setShowRecordGiving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, canAccess } = useAuth();

  // ...existing code...

  if (showRecordGiving) {
    return <RecordGiving
      onBack={() => setShowRecordGiving(false)}
      onSave={async (record) => {
        setRecords(prev => [...prev, { ...record, id: Date.now().toString(), createdBy: user?.name, createdAt: new Date().toISOString() }]);
        setShowRecordGiving(false);
        onRecordGiving();
        toast.success('Service giving recorded successfully');
      }}
    />;
  }

  // ...existing if statements for loading and showCustomTypeManager...

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1>Giving</h1>
          <p className="text-muted-foreground">
            Track offerings, donations, and thanksgiving per service
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* ...existing export button... */}
          {canManageCustomTypes && (
            <Button variant="outline" onClick={() => setShowCustomTypeManager(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Manage Types
            </Button>
          )}
          {canRecordGiving && (
            <Button onClick={() => setShowRecordGiving(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Record Service Giving
            </Button>
          )}
        </div>
      </div>

      {/* ...rest of existing code... */}
    </div>
  );
}
````

Key changes:
1. Added `showRecordGiving` state
2. Added conditional rendering check before the main return
3. Changed button click handlers from `onRecordGiving()` to `setShowRecordGiving(true)`
4. Updated `onSave` to close the form and show success message

User: scan through entire project and document all pages, functions, flows, features, logics, basically everything as a md file. I need to restart the project afresh but this timme with proper functional and non functional requirements. do the md file

GitHub Copilot: I'll scan through your project and create a comprehensive documentation file. However, I need to see all the files in your project first.

Run this command in your terminal to get a complete file structure:

```bash
dir /s /b c:\Users\berna\back\src > project_structure.txt
```

Then, please share the key files from your project so I can document everything properly. At minimum, I need:

1. All files in components
2. All files in `src/pages/`
3. All files in services or `src/api/`
4. App.tsx or main entry point
5. package.json
6. Any hooks, utilities, or context files
7. Database schema or data models

Once you provide these files (or attach them), I'll create a comprehensive `.md` file documenting:

- **Project Overview**
- **Architecture & Structure**
- **Pages & Routes**
- **Components & Their Functions**
- **Data Flows & State Management**
- **Features & Functionalities**
- **Business Logic**
- **Authentication & Authorization**
- **API Integrations**
- **Functional Requirements**
- **Non-Functional Requirements**
- **Known Issues & TODOs**

You can either:
- Share file contents via attachments
- Run `tree /F > project_tree.txt` and share that
- Copy-paste key files here

What's the best way for you to share the project files?

User: are these enough?

GitHub Copilot: Not quite. I need the actual **content** of the key files, not just the structure. Please share the contents of:

**Critical files:**
1. App.tsx - Main app structure and routing
2. AuthContext.tsx - Auth logic and state
3. api.ts - All API calls and business logic
4. Login.tsx - Login flow
5. SignUp.tsx - Sign up flow
6. Dashboard.tsx - Main dashboard
7. Members.tsx - Members list
8. AddMember.tsx - Add member form
9. MemberProfile.tsx - Member details
10. Attendance.tsx - Attendance tracking
11. MarkAttendance.tsx - Mark attendance
12. Visitors.tsx - Visitors management
13. Giving.tsx - Giving/offerings
14. Reports.tsx - Reports & analytics
15. Settings.tsx - Settings/Admin panel
16. 20260101210940_remote_schema.sql - Database schema
17. package.json - Dependencies

You can do this by:
- Opening each file in VS Code and copying its content
- Or running: `cat src/App.tsx` in terminal and sharing output

Once I have these, I'll create a comprehensive **PROJECT_DOCUMENTATION.md** with everything mapped out.

User: anything else

GitHub Copilot: # Church Management System - Complete Project Documentation

## Project Overview

**Project Name:** Church Management System (CoC.M)  
**Organization:** Church of Christ, Mataheko Congregation  
**Technology Stack:** React + TypeScript, Vite, Supabase, Tailwind CSS  
**Current Status:** MVP with known issues requiring fixes

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Tech Stack
- **Frontend:** React 18, TypeScript, Vite
- **UI Framework:** Custom Shadcn/ui components
- **Styling:** Tailwind CSS
- **State Management:** React Context API (Auth, Theme)
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **API Client:** Custom API service layer
- **Charts:** Recharts
- **Export:** CSV, PDF, XLSX support

### 1.2 Project Structure
```
src/
├── components/          # React components
│   ├── AuthContext.tsx  # Authentication & permissions
│   ├── ThemeContext.tsx # Theme management
│   ├── Layout.tsx       # Main layout wrapper
│   ├── Dashboard.tsx    # Dashboard page
│   ├── Members.tsx      # Members management
│   ├── AddMember.tsx    # Add member form
│   ├── EditMember.tsx   # Edit member form
│   ├── MemberProfile.tsx # Member details view
│   ├── Visitors.tsx     # Visitors management
│   ├── Attendance.tsx   # Attendance tracking
│   ├── MarkAttendance.tsx # Individual attendance marking
│   ├── Giving.tsx       # Tithes/offerings management
│   ├── Reports.tsx      # Analytics & reports
│   ├── Settings.tsx     # Admin settings & user management
│   ├── Help.tsx         # Help & user guide
│   ├── Login.tsx        # Login page
│   ├── SignUp.tsx       # Registration page
│   ├── ForgotPassword.tsx # Password reset
│   └── ui/              # UI component library
├── services/
│   └── api.ts           # API integration layer
├── utils/
│   ├── export.ts        # Export utilities
│   └── supabase/
│       └── client.ts    # Supabase client
├── App.tsx              # Main app component
└── main.tsx             # Entry point
```

---

## 2. CORE FEATURES & MODULES

### 2.1 Authentication & Authorization
**Status:** ✅ Implemented (with issues)

**Features:**
- Email/Phone login (flexible identifier)
- Role-based access control (RBAC)
- Four user roles: Dev, Admin, Pastor, Elder
- Temporary permission system (time-limited access)
- Account approval workflow (pending/approved/rejected)

**User Roles & Permissions:**
| Role | View | Create/Edit | Delete | Manage Users | Manage Theme |
|------|------|-----------|--------|--------------|--------------|
| Dev | ✅ All | ✅ All | ✅ All | ✅ Yes | ✅ Yes |
| Admin | ✅ All | ✅ All | ✅ All | ✅ Yes (not Dev) | ❌ No |
| Pastor | ✅ All | ❌ No | ❌ No | ❌ No | ❌ No |
| Elder | ✅ All | ❌ No | ❌ No | ❌ No | ❌ No |

**Issues:**
- Generic error message for all login failures (should differentiate pending/rejected/deleted)
- Login by phone number not fully functional

### 2.2 Member Management
**Status:** 🟡 Partially Working (has issues)

**Features:**
- Add/Edit/Delete members with comprehensive profiles
- Personal info: name, contact, date of birth, gender, marital status
- Location: residence, digital address, zone assignment
- Baptism tracking: date, previous congregation, role history
- Family relationships: link family members, create family tree
- Legal info: Ghana card, alternative ID
- Ministry assignment: multiple ministry enrollment
- Member status: Active, Semi-active, Inactive, Sabbatical, Blacklisted
- Search, filter (by zone, status, gender), sort (name, zone, status, join date)
- Export: CSV, PDF, XLSX
- Photo upload support

**Data Model:**
```typescript
Member {
  id: string
  firstName, lastName, otherNames: string
  email?, phone, secondPhone: string
  gender: 'male' | 'female'
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed'
  dateOfBirth: string
  residenceLocation, digitalAddress?: string
  zone: 'A' | 'B' | 'F' | 'K' | 'M' | 'R'
  zoneNumber: string (e.g., "M01", "B15")
  status: MemberStatus
  joinDate: string
  photo?: string (base64)
  baptismInfo?: {
    dateType: 'full' | 'monthYear' | 'yearOnly'
    fullDate?, month?, year?: string
    previousCongregation?, roleInPreviousCongregation?: string
  }
  familyMembers?: FamilyMember[] (relationships)
  legalInfo?: {
    ghanaCardNumber?, ghanaCardExpiryDate?: string
    alternativeIdType?, alternativeIdNumber?: string
  }
  ministries?: string[] (multiple)
}
```

**Issues:**
- ❌ Cannot delete user "myson uzziah" (email: uzi@church.com)
- ❌ Family member search not functional
- ❌ Family members details don't display in member profile
- ❌ Family tree feature incomplete
- ❌ Delete member button missing
- ⚠️ Zone numbers should auto-increment (now random)

### 2.3 Visitor Management
**Status:** 🟡 Partially Working

**Features:**
- Add visitor records with contact info
- Track visit date and service type
- Record referral source (attempt to link to members)
- Membership interest tracking
- Follow-up status: pending, contacted, scheduled, completed
- Convert visitor to member workflow
- Statistics: total visitors, interested in membership, this month

**Data Model:**
```typescript
Visitor {
  id: string
  firstName, lastName, otherNames: string
  email?, phone, secondPhone?: string
  gender: 'male' | 'female'
  dateOfBirth?: string
  residenceLocation: string
  visitDate: string
  serviceType: string
  referredBy?: string (attempt auto-link)
  interestedInMembership: boolean
  followUpStatus: 'pending' | 'contacted' | 'scheduled' | 'completed'
  potentialZone?: Zone
  convertedToMember?, convertedMemberId?: boolean/string
  notes: string
}
```

**Issues:**
- ❌ "Referenced by" member matching not functional
- ⚠️ Search existing member for referral broken

### 2.4 Attendance Tracking
**Status:** 🔴 Broken

**Features:**
- Record attendance for services
- Mark individual members present/absent
- Bulk operations (mark all present, mark all absent, clear all)
- Zone-based filtering
- Service type support (Sunday Main, custom services)
- Statistics: total services, average attendance, this week
- View attendance history and trends

**Data Model:**
```typescript
AttendanceRecord {
  id: string
  date: string
  serviceType: string
  startTime?, endTime?: string
  presentMembers: string[] (member IDs)
  absentMembers: string[] (member IDs)
  totalPresent: number
  markedBy: string
  markedAt: string
}

CustomService {
  id: string
  name: string
  description?: string
  startDate, endDate: string
  startTime, endTime: string
  daysOfWeek: number[] (0=Sunday)
  isActive: boolean
}
```

**Issues:**
- ❌ "Save attendance" button does nothing
- ❌ Mark attendance doesn't save or display recorded data
- ⚠️ Custom service manager needs UI completion

### 2.5 Giving & Tithes Management
**Status:** 🟡 Partially Working

**Features:**
- Record offerings, donations, thanksgiving per service
- Custom giving types (Building Fund, Missions, etc.)
- Payment method breakdown: cash, mobile money, card, bank transfer
- Foreign currency support with GHS conversion
- Service-based giving tracking (not member-specific)
- Statistics: total giving, this month, this week
- Filter by service type and date range
- Export: CSV, PDF, XLSX
- Manage custom giving types (add, toggle active, delete)

**Data Model:**
```typescript
GivingRecord {
  id: string
  serviceName: string
  serviceDate: string
  serviceType: 'sunday_morning' | 'sunday_evening' | 'midweek' | 'special' | 'other'
  offerings: {
    offering, donation, thanksgiving: number
    customTypes: { [key: string]: number }
  }
  totalAmount: number
  paymentBreakdown: {
    cash, mobile_money, card, bank_transfer: number
    foreign_currency?: {
      currency: string
      amount, ghs_equivalent: number
    }
  }
  notes?: string
  createdBy?, createdAt?: string
}
```

**Issues:**
- ⚠️ Blank page when clicking "record giving" (state management issue)
- ⚠️ RecordGiving component rendering issue

### 2.6 Reports & Analytics
**Status:** ✅ Mostly Working

**Features:**
- Dashboard summary: total members, attendance, giving, growth
- Interactive charts: attendance trends, giving trends, membership growth
- Filter by period: month, quarter, year
- Key metrics: attendance rate, giving participation, retention
- Monthly statistics
- Export reports

**Charts & Metrics:**
- Attendance line chart with month-by-month data
- Giving bar chart with monthly totals
- Membership growth line chart (total + new members)
- Summary cards with KPIs
- Participation percentages

### 2.7 System Settings & User Management
**Status:** 🟡 Partially Working

**Features:**
- User management (create, approve, reject, deactivate)
- Role assignment and role permissions
- Temporary permission granting (Admin/Dev only)
- User search, filter, sort
- Pending account approvals queue
- System statistics (total users, by role)
- Dev-only: Custom role creation
- Dev-only: Theme color customization
- Role permission configuration

**Issues:**
- ⚠️ User role update not functional
- ⚠️ Sort, search, filter for users list incomplete
- ⚠️ Theme customization needs completion

---

## 3. DATA MODELS & DATABASE SCHEMA

### 3.1 Main Tables (Supabase)
```
profiles (extends auth.users)
├── id (user_id)
├── email
├── name
├── role (dev, admin, pastor, elder)
├── is_active
├── approval_status (pending, approved, rejected)
├── phone

members
├── id (UUID)
├── first_name, last_name, other_names
├── email, phone, second_phone
├── gender (male, female)
├── marital_status
├── date_of_birth
├── residence_location, digital_address
├── zone (A, B, F, K, M, R)
├── zone_number
├── status (active, semi-active, inactive, sabbatical, blacklisted)
├── notes
├── photo_url
├── created_at, updated_at, created_by

baptism_info
├── id
├── member_id
├── date_type (full, monthYear, yearOnly)
├── full_date, month, year
├── previous_congregation
├── role_in_previous_congregation

family_members
├── id
├── member_id
├── relationship (mother, father, spouse, child, sibling)
├── first_name, last_name, other_names
├── phone
├── is_linked
├── linked_member_id

legal_info
├── id
├── member_id
├── ghana_card_number, ghana_card_expiry
├── alternative_id_type, alternative_id_number

member_ministries
├── member_id
├── ministry_name

visitors
├── id
├── first_name, last_name, other_names
├── email, phone, second_phone
├── gender
├── date_of_birth
├── residence_location
├── visit_date
├── service_type
├── referred_by
├── interested_in_membership
├── follow_up_status
├── converted_to_member
├── notes
├── created_at

attendance_records
├── id
├── date
├── service_type
├── start_time, end_time
├── total_count
├── is_custom_service
├── created_by, created_at

attendance_entries
├── id
├── attendance_record_id
├── member_id
├── present (boolean)

giving_records
├── id
├── service_name, service_date
├── service_type
├── offering_amount, donation_amount, thanksgiving_amount
├── total_amount
├── cash, mobile_money, card, bank_transfer
├── foreign_currency, foreign_amount, ghs_equivalent
├── notes
├── created_by, created_at

custom_giving_types
├── id
├── name, description
├── is_active
├── created_by, created_at

services (custom services)
├── id
├── name, description
├── start_date, end_date
├── start_time, end_time
├── days_of_week
├── is_active
├── created_by, created_at

temporary_permissions
├── id
├── user_id
├── permission
├── expires_at
├── granted_by, granted_at
```

---

## 4. KNOWN ISSUES & BUGS (From "To fix.md")

### Critical 🔴
| Issue | Component | Impact | Fix |
|-------|-----------|--------|-----|
| Save attendance button does nothing | Attendance | Data loss | Implement save handler |
| Mark attendance doesn't save/display | MarkAttendance | Data loss | Fix state update + API call |
| Cannot delete user "uzi@church.com" | Settings | UX | Database constraint check |
| Record giving leads to blank page | Giving | UX broken | Fix RecordGiving rendering |

### High Priority ⚠️
| Issue | Component | Impact | Fix |
|-------|-----------|--------|-----|
| Family member search not functional | Members | Data entry | Implement search in AddMember |
| Family members don't show in profile | MemberProfile | Missing data | Fetch + display family tree |
| Zone numbers random (should increment) | Members | Data integrity | Implement sequential numbering |
| Login error generic for all causes | Login | Poor UX | Differentiate error types |
| Update user role not functional | Settings | Permission broken | Fix role update API |
| Search existing member fails | Members | Referral broken | Fix member search logic |

### Medium Priority 🟡
| Issue | Component | Impact | Fix |
|-------|-----------|--------|-----|
| No delete member button | MemberProfile | Can't remove | Add delete confirmation |
| Sort/filter members list incomplete | Members | UX | Complete implementation |
| Sort/filter users list incomplete | Settings | Admin UX | Complete implementation |
| Make family optional in add member | AddMember | UX | Remove 2-member minimum |
| Visitor referral auto-link broken | Visitors | Data entry | Implement matching logic |
| Loading animations missing | All pages | UX | Add subtle spinners |
| Convert visitor to member incomplete | Visitors | Workflow | Finish implementation |

### Low Priority 💡
| Issue | Component | Impact | Fix |
|-------|-----------|--------|-----|
| Generic giving type names | Giving | UX | Better naming |
| Theme customization incomplete | Settings | Feature incomplete | Finish dev-only controls |
| Help page incomplete | Help | Documentation | Complete user guide |

---

## 5. FUNCTIONAL REQUIREMENTS

### 5.1 Authentication & Security
- ✅ Email/Phone login flexibility
- ✅ Secure password reset
- ✅ Role-based access control
- ✅ Temporary permission system
- ✅ Account approval workflow
- ❌ Differentiated login error messages
- ❌ Session timeout
- ❌ Password complexity validation

### 5.2 Member Management
- ✅ Complete member profiles
- ✅ Family relationship tracking
- ✅ Ministry assignment
- ✅ Import/export functionality
- ❌ Bulk member operations
- ❌ Member deactivation reasons
- ❌ Member communication history
- ❌ Member notes timeline

### 5.3 Attendance
- ❌ Record attendance (broken)
- ❌ Mark individual attendance (broken)
- ✅ View attendance history
- ❌ Attendance reports
- ❌ Absent member follow-up alerts
- ❌ Zone-wise attendance analysis

### 5.4 Giving Management
- ✅ Record tithes/offerings
- ✅ Multiple payment methods
- ✅ Foreign currency support
- ✅ Custom giving types
- ❌ Member-wise giving tracking
- ❌ Giving trends analysis
- ❌ Giving goal tracking

### 5.5 Visitor Management
- ✅ Add visitor records
- ⚠️ Track follow-ups
- ⚠️ Convert to member
- ❌ Auto-link referrals
- ❌ Follow-up task assignment
- ❌ Visitor communication log

### 5.6 Reports & Analytics
- ✅ Attendance trends
- ✅ Giving trends
- ✅ Membership growth
- ✅ Key performance indicators
- ❌ Retention analysis
- ❌ Financial projections
- ❌ Demographic reports

---

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Performance
- ⚠️ Loading animations (missing)
- ⚠️ Lazy loading for large lists
- ⚠️ Pagination for reports
- ⚠️ Database query optimization
- ✅ Client-side caching

### 6.2 Usability
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Dark/Light/System theme support
- ✅ Intuitive navigation
- ❌ Accessible (WCAG compliance)
- ❌ Keyboard navigation
- ✅ Toast notifications

### 6.3 Reliability
- ✅ Error handling with user-friendly messages
- ✅ Form validation
- ⚠️ Data persistence (some issues)
- ❌ Automatic retry on failure
- ❌ Data backup & recovery

### 6.4 Security
- ✅ Password hashing (Supabase)
- ✅ Role-based permissions
- ⚠️ Input sanitization
- ⚠️ SQL injection prevention
- ❌ Rate limiting
- ❌ Audit logging
- ❌ HTTPS enforcement

### 6.5 Maintainability
- ✅ TypeScript for type safety
- ✅ Component-based architecture
- ⚠️ API abstraction layer
- ⚠️ Code documentation
- ❌ Unit tests
- ❌ Integration tests
- ❌ E2E tests

---

## 7. ROUTES & NAVIGATION

### 7.1 Route Structure
```
/login                  # Login page
/signup                 # Registration
/forgot-password        # Password reset

/dashboard              # Main dashboard
/members                # Members list
/members/add            # Add member
/members/:id/edit       # Edit member
/members/:id/profile    # View member profile

/visitors               # Visitors list
/visitors/add           # Add visitor
/visitors/:id/profile   # View visitor
/visitors/:id/convert   # Convert to member

/attendance             # Attendance home
/attendance/record      # Record attendance
/attendance/mark        # Mark individual attendance

/giving                 # Giving records
/giving/record          # Record giving

/reports                # Reports & analytics

/settings               # System settings
/settings/users/add     # Add system user

/help                   # Help & guide
```

### 7.2 Navigation Menu
**Desktop:** Vertical sidebar with icons  
**Mobile:** Top header + bottom navigation (first 4 items)

Items:
- Dashboard
- Members
- Visitors
- Attendance
- Giving
- Reports
- Help
- Settings

---

## 8. API SERVICE LAYER (src/services/api.ts)

### 8.1 Authentication
```typescript
api.auth.signIn(identifier, password)
api.auth.signUp(userData)
api.auth.resetPassword(email)
api.auth.logout()
```

### 8.2 Members
```typescript
api.members.getAll()
api.members.getById(id)
api.members.create(data)
api.members.update(id, data)
api.members.delete(id)
api.members.getAnalytics(id)
```

### 8.3 Visitors
```typescript
api.visitors.getAll()
api.visitors.getById(id)
api.visitors.create(data)
api.visitors.update(id, data)
api.visitors.delete(id)
```

### 8.4 Attendance
```typescript
api.attendance.getAll()
api.attendance.create(data)
api.attendance.getByDate(date)
```

### 8.5 Giving
```typescript
api.giving.getAll()
api.giving.create(data)
api.giving.types.getAll()
api.giving.types.create(data)
api.giving.types.delete(id)
```

### 8.6 Reports
```typescript
api.reports.getReports(period)
api.stats.getDashboard()
```

### 8.7 Users (Admin)
```typescript
api.users.getAll()
api.users.getPending()
api.users.create(data)
api.users.update(id, data)
api.users.delete(id)
api.users.approve(id)
api.users.reject(id)
api.users.grantPermission(userId, permission, hours)
api.users.revokePermission(userId, permission)
api.users.getTemporaryPermissions(userId)
api.users.updateRole(userId, newRole)
```

---

## 9. ENVIRONMENT SETUP

### 9.1 Environment Variables (.env)
```
VITE_SUPABASE_URL=https://szligatlxwpcknwkhdyp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 9.2 Dependencies
```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "typescript": "^5.x",
  "@supabase/supabase-js": "^2.x",
  "tailwindcss": "^3.x",
  "recharts": "^2.x",
  "lucide-react": "latest",
  "sonner": "^2.x"
}
```

---

## 10. DEPLOYMENT

### 10.1 Build Process
```bash
npm run build  # Vite build to /build directory
```

### 10.2 Hosting
- Built files in index.html
- Deploy to Vercel, Netlify, or static hosting
- Environment variables required for Supabase

---

## 11. TESTING CREDENTIALS (Demo)

**Developer Role**
- Email: `dev@cocm.com`
- Password: `dev123`
- Access: Supreme access

**Administrator Role**
- Email: `admin@cocm.com`
- Password: `admin123`
- Access: Full management

**Pastor Role**
- Email: `pastor@cocm.com`
- Password: `pastor123`
- Access: View-only (can request permissions)

**Elder Role**
- Email: `elder@cocm.com`
- Password: `elder123`
- Access: View-only (can request permissions)

---

## 12. FUTURE ENHANCEMENTS

- 📱 Mobile app (React Native)
- 📧 Email notifications for follow-ups
- 📅 Calendar integration
- 💬 In-app messaging system
- 📊 Advanced financial dashboards
- 🔐 Two-factor authentication
- 🌐 Multi-language support
- 📈 Predictive analytics
- 🗂️ Bulk member import/export
- 🎯 Member engagement tracking

---

**Last Updated:** January 18, 2026  
**Project Status:** MVP with critical bugs requiring immediate attention

User: where is this md file saved?

GitHub Copilot: The markdown file **has NOT been saved yet**. I only provided it to you in this conversation.

To save it, you need to:

**Option 1: Create it manually in VS Code**
1. Open VS Code
2. Create a new file: `File → New Text File`
3. Copy the entire documentation above
4. Save as: `PROJECT_DOCUMENTATION.md` in back
5. Press `Ctrl+S` and choose the location

**Option 2: Create via Terminal**
Run this command in your terminal at back:

```bash
echo [paste the entire md content here] > PROJECT_DOCUMENTATION.md
```

**Option 3: Use a script**
Create a file called `save_docs.ps1` with the content, then run it.

**I recommend Option 1** - it's easiest. Once you create the file, you'll have a complete reference document at:
```
c:\Users\berna\back\PROJECT_DOCUMENTATION.md
```

Would you like me to adjust or expand any sections of the documentation before you save it?

User: yes

GitHub Copilot: Great! What sections would you like me to adjust or expand? Here are some options:

1. **Add more detail to specific components?**
   - Which components need deeper explanation? (e.g., AuthContext flow, api.ts methods)

2. **Expand the issues section?**
   - Add root cause analysis for each bug?
   - Add reproduction steps?
   - Add proposed solutions?

3. **Add implementation guides?**
   - Step-by-step fix for each critical bug?
   - Code examples for missing features?

4. **Add data flow diagrams?**
   - Authentication flow
   - Member creation flow
   - Attendance marking flow

5. **Add API documentation?**
   - All endpoint details
   - Request/response formats
   - Error codes

6. **Add testing scenarios?**
   - Test cases for each module
   - Edge cases to handle

7. **Add development guidelines?**
   - Code style standards
   - Component patterns
   - State management best practices

8. **Expand all of the above?**

Which would be most valuable for your fresh restart? Or should I expand **all sections** to make it truly comprehensive?

User: no. 8

GitHub Copilot: # Church Management System - Complete Project Documentation (EXPANDED)

## Project Overview

**Project Name:** Church Management System (CoC.M)  
**Organization:** Church of Christ, Mataheko Congregation  
**Technology Stack:** React + TypeScript, Vite, Supabase, Tailwind CSS  
**Current Status:** MVP with known issues requiring fixes  
**Last Updated:** January 18, 2026

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Tech Stack Details
- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite (fast dev server, optimized builds)
- **UI Framework:** Custom Shadcn/ui component library
- **Styling:** Tailwind CSS 3.x with custom theme support
- **State Management:** React Context API (AuthContext, ThemeContext)
- **Backend:** Supabase (PostgreSQL database, Auth system, Storage)
- **API Communication:** Fetch API with custom service layer
- **Data Visualization:** Recharts for charts/graphs
- **Icons:** Lucide React (24x24 SVG icons)
- **Notifications:** Sonner (toast notifications)
- **Export Formats:** CSV, PDF, XLSX

### 1.2 Project Structure & File Organization
```
c:\Users\berna\back\
├── src/
│   ├── components/                      # React components (JSX/TSX)
│   │   ├── AuthContext.tsx             # Auth state & permissions (Context)
│   │   ├── ThemeContext.tsx            # Theme state management
│   │   ├── Layout.tsx                  # Main layout wrapper
│   │   ├── Dashboard.tsx               # Dashboard/home page
│   │   ├── Members.tsx                 # Members list & management
│   │   ├── AddMember.tsx               # Add new member form
│   │   ├── EditMember.tsx              # Edit member form
│   │   ├── MemberProfile.tsx           # Member detail view
│   │   ├── Visitors.tsx                # Visitors tracking
│   │   ├── Attendance.tsx              # Attendance home
│   │   ├── MarkAttendance.tsx          # Mark attendance form
│   │   ├── Giving.tsx                  # Tithes/offerings management
│   │   ├── Reports.tsx                 # Analytics & reports
│   │   ├── Settings.tsx                # Admin settings & user mgmt
│   │   ├── Help.tsx                    # Help & user guide
│   │   ├── Login.tsx                   # Login page
│   │   ├── SignUp.tsx                  # Registration page
│   │   ├── ForgotPassword.tsx          # Password reset
│   │   ├── DemoGuide.tsx               # Demo walkthrough
│   │   ├── ui/                         # UI component library (30+ components)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   ├── card.tsx
│   │   │   ├── form.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── chart.tsx
│   │   │   └── ... (20+ more)
│   │   └── figma/
│   │       └── ImageWithFallback.tsx
│   ├── services/
│   │   └── api.ts                      # API integration layer (all calls)
│   ├── utils/
│   │   ├── export.ts                   # CSV/PDF/XLSX export utilities
│   │   └── supabase/
│   │       └── client.ts               # Supabase client initialization
│   ├── styles/
│   │   ├── globals.css                 # Global Tailwind + custom CSS
│   │   └── index.css                   # Vite entry point styles
│   ├── App.tsx                         # Main app component & routing
│   ├── main.tsx                        # React entry point
│   ├── index.css                       # Global styles
│   ├── database-setup/                 # Database setup scripts
│   │   ├── 01-tables.sql              # Create tables
│   │   ├── 02-indexes.sql             # Create indexes
│   │   ├── 03-functions.sql           # PL/pgSQL functions
│   │   ├── 04-triggers.sql            # Database triggers
│   │   ├── 05-rls-enable.sql          # Enable RLS
│   │   └── 06-rls-policies.sql        # RLS policies
│   ├── guidelines/
│   │   ├── Guidelines.md               # Development guidelines
│   │   └── PermissionSystem.md         # Permission system docs
│   └── supabase.backup/                # Local Supabase config backup
├── supabase/                            # Supabase configuration
│   ├── config.toml                     # Supabase local config
│   ├── migrations/                     # Database migrations
│   │   ├── 20260101210940_remote_schema.sql
│   │   ├── 20260102062441_create_storage_bucket.sql
│   │   ├── 20260107000000_add_approval_status.sql
│   │   ├── 20260107100000_add_marital_status.sql
│   │   └── 20260117000000_add_phone_to_profiles.sql
│   └── functions/                      # Edge functions
│       └── server/
│           ├── index.ts
│           ├── kv_store.ts
│           └── deno.json
├── build/                              # Production build output
│   ├── index.html
│   └── assets/
├── public/                             # Static assets
├── package.json                        # Dependencies & scripts
├── tsconfig.json                       # TypeScript configuration
├── vite.config.ts                      # Vite configuration
├── tailwind.config.ts                  # Tailwind CSS config
└── .env                                # Environment variables (Supabase)
```

### 1.3 Component Hierarchy
```
App (main router)
├── Layout (wrapper with sidebar + header)
│   ├── Dashboard
│   ├── Members
│   │   ├── AddMember
│   │   ├── EditMember
│   │   └── MemberProfile
│   │       └── Family Tree (nested)
│   ├── Visitors
│   │   └── AddVisitor
│   ├── Attendance
│   │   └── MarkAttendance
│   ├── Giving
│   │   ├── RecordGiving
│   │   └── CustomTypeManager
│   ├── Reports
│   ├── Settings
│   │   ├── User Management
│   │   └── Theme Customization (Dev only)
│   └── Help
├── Login
├── SignUp
└── ForgotPassword
```

---

## 2. CORE FEATURES & MODULES (EXPANDED)

### 2.1 Authentication & Authorization System

#### 2.1.1 Overview
The authentication system uses Supabase Auth for backend security with a custom permission layer on top. It supports role-based access control (RBAC) with four predefined roles and a temporary permission system for time-limited access elevation.

#### 2.1.2 Architecture Flow
```
User Input (email/phone + password)
    ↓
Login Component (Login.tsx)
    ↓
api.auth.signIn() (api.ts)
    ↓
Supabase Auth.signIn()
    ↓
Check approval_status in profiles table
    ├─ pending → Show "Awaiting Approval" error
    ├─ rejected → Show "Account Rejected" error
    ├─ deleted → Show "Account Deleted" error
    └─ approved → Continue
    ↓
Fetch user profile + roles
    ↓
AuthContext.setUser() (AuthContext.tsx)
    ↓
localStorage.setItem('authToken', token)
    ↓
Redirect to Dashboard
```

#### 2.1.3 User Roles & Permissions Matrix

**Role Hierarchy:** Dev > Admin > Pastor = Elder

| Feature | Dev | Admin | Pastor | Elder | Notes |
|---------|-----|-------|--------|-------|-------|
| **Members** | | | | | |
| View all | ✅ | ✅ | ✅ | ✅ | All members visible to all roles |
| Add member | ✅ | ✅ | ❌ | ❌ | Requires admin capability |
| Edit member | ✅ | ✅ | ❌ | ❌ | Requires admin capability |
| Delete member | ✅ | ✅ | ❌ | ❌ | Requires admin capability |
| Export members | ✅ | ✅ | ✅ | ✅ | All can export |
| **Attendance** | | | | | |
| View attendance | ✅ | ✅ | ✅ | ✅ | All can view |
| Record attendance | ✅ | ✅ | ✅ | ✅ | All can record (with permission check) |
| Mark attendance | ✅ | ✅ | ✅ | ✅ | All can mark (with permission check) |
| **Giving** | | | | | |
| View giving | ✅ | ✅ | ✅ | ✅ | All can view |
| Record giving | ✅ | ✅ | ✅ | ✅ | All can record (with permission check) |
| Manage giving types | ✅ | ✅ | ❌ | ❌ | Requires admin capability |
| **Visitors** | | | | | |
| View visitors | ✅ | ✅ | ✅ | ✅ | All can view |
| Add visitor | ✅ | ✅ | ✅ | ✅ | All can add |
| Convert to member | ✅ | ✅ | ❌ | ❌ | Requires admin capability |
| **System** | | | | | |
| Manage users | ✅ | ✅ (not Dev) | ❌ | ❌ | Admin can't manage Dev users |
| Approve users | ✅ | ✅ | ❌ | ❌ | System users only |
| Grant permissions | ✅ | ✅ | ❌ | ❌ | System users only |
| Manage theme | ✅ | ❌ | ❌ | ❌ | Dev only |
| Create custom roles | ✅ | ❌ | ❌ | ❌ | Dev only (future) |
| View reports | ✅ | ✅ | ✅ | ✅ | All can view |

#### 2.1.4 Permission System Implementation

**Code Example (AuthContext.tsx):**
```typescript
export const permissions: RolePermissions = {
  dev: [
    'view_all', 'add_member', 'edit_member', 'delete_member',
    'record_attendance', 'record_giving', 'manage_giving_types',
    'manage_users', 'manage_theme', 'view_reports', 'export_data'
  ],
  admin: [
    'view_all', 'add_member', 'edit_member', 'delete_member',
    'record_attendance', 'record_giving', 'manage_giving_types',
    'manage_users', 'view_reports', 'export_data'
  ],
  pastor: [
    'view_all', 'record_attendance', 'record_giving',
    'view_reports', 'export_data'
  ],
  elder: [
    'view_all', 'record_attendance', 'record_giving',
    'view_reports', 'export_data'
  ]
};

// Usage in components:
const { canAccess } = useAuth();
if (canAccess('add_member')) {
  // Show add member button
}
```

#### 2.1.5 Temporary Permission System

Allows admins/dev to grant short-term elevated permissions:

```typescript
interface TemporaryPermission {
  id: string;
  userId: string;
  permission: string;
  expiresAt: string;  // ISO timestamp
  grantedBy: string;
  grantedAt: string;
}

// Usage:
await api.users.grantPermission(userId, 'record_giving', 2); // 2 hours
await api.users.revokePermission(userId, 'record_giving');
```

#### 2.1.6 Account Approval Workflow

New user registration flow:

```
SignUp Form
    ↓
api.auth.signUp(email, password, profile_data)
    ↓
Create auth user + profiles record (approval_status = 'pending')
    ↓
Send notification to admin
    ↓
User sees: "Account pending approval" message
    ↓
Admin reviews in Settings → Users → Pending
    ↓
Admin clicks Approve/Reject
    ↓
update profiles.approval_status = 'approved' or 'rejected'
    ↓
User can login (if approved) or sees rejection (if rejected)
```

#### 2.1.7 Login Issues & Root Causes

**Issue:** Generic error message for all login failures
- **Current Behavior:** All errors show "Invalid email or password. Please check your credentials"
- **Root Cause:** No differentiation between:
  - Invalid credentials (user doesn't exist)
  - Account pending approval (approval_status = 'pending')
  - Account rejected (approval_status = 'rejected')
  - Account deleted (approval_status = 'deleted')
- **Fix:** Add status check after auth success, return specific messages
- **Code Location:** `Login.tsx` line ~85 and `api.ts` auth.signIn()

**Issue:** Login by phone number not fully functional
- **Current Behavior:** Email login works, phone login partially works
- **Root Cause:** Phone identifier not properly validated in signIn logic
- **Fix:** Implement phone-to-email lookup before auth attempt
- **Code Location:** `api.ts` → auth.signIn() method

#### 2.1.8 Sign Up Form Issues

**Issue:** Sign up form and create user form have same fields
- **Current Problem:** Both request all 20+ fields (address, zone, etc.)
- **What it should be:**
  - Sign up (public): first_name, last_name, other_names, email, phone, ministry, role, password (8 fields)
  - Add system user (admin only): Same 8 fields + approval workflow
- **Fix:** Simplify both forms to minimal required fields
- **Code Location:** `SignUp.tsx` and `Settings.tsx`

---

### 2.2 Member Management System (EXPANDED)

#### 2.2.1 Overview & Purpose
Members are the core entity. The system tracks comprehensive church member information including personal details, relationships, ministries, and history.

#### 2.2.2 Complete Data Model

```typescript
interface Member {
  // Identity
  id: string;                          // UUID
  firstName: string;                   // Required
  lastName: string;                    // Required
  otherNames?: string;                 // Optional
  
  // Contact Information
  email?: string;                      // Optional, but useful
  phone: string;                       // Required, unique
  secondPhone?: string;                // Optional secondary contact
  
  // Demographics
  gender: 'male' | 'female';           // Required
  dateOfBirth: string;                 // YYYY-MM-DD format
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  
  // Location
  residenceLocation: string;           // Required, e.g., "North Kaneshie"
  digitalAddress?: string;             // Ghana digital address (optional)
  
  // Zone Assignment
  zone: 'A' | 'B' | 'F' | 'K' | 'M' | 'R';  // Required zone letter
  zoneNumber: string;                  // Format: "A01", "M15", etc.
  
  // Membership Status
  status: 'active' | 'semi-active' | 'inactive' | 'sabbatical' | 'blacklisted';
  joinDate: string;                    // YYYY-MM-DD, auto-set to today
  
  // Profile
  photo?: string;                      // Base64 encoded image
  notes?: string;                      // Any additional notes
  
  // Baptism History
  baptismInfo?: {
    dateType: 'full' | 'monthYear' | 'yearOnly';
    fullDate?: string;                 // YYYY-MM-DD (if full)
    month?: number;                    // 1-12 (if monthYear)
    year?: number;                     // YYYY (if yearOnly or others)
    previousCongregation?: string;     // Where baptized before
    roleInPreviousCongregation?: string; // e.g., "Deacon", "Nurse"
  };
  
  // Family Relationships
  familyMembers?: FamilyMember[];      // Related members
  
  // Legal Information
  legalInfo?: {
    ghanaCardNumber?: string;          // 13-digit or pattern
    ghanaCardExpiryDate?: string;      // YYYY-MM-DD
    alternativeIdType?: string;        // Passport, Driver License, etc.
    alternativeIdNumber?: string;
  };
  
  // Ministry Involvement
  ministries?: string[];               // Multiple ministry names
  
  // Audit Trail
  createdBy?: string;                  // User ID who created
  createdAt?: string;                  // ISO timestamp
  updatedBy?: string;                  // User ID who last updated
  updatedAt?: string;                  // ISO timestamp
}

interface FamilyMember {
  id: string;
  memberId: string;                    // Who this belongs to
  relationship: 'mother' | 'father' | 'spouse' | 'child' | 'sibling' | 'grandparent' | 'aunt' | 'uncle' | 'cousin' | 'other';
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone?: string;
  email?: string;
  isLinked: boolean;                   // Is this person also a member?
  linkedMemberId?: string;             // If linked, reference to Member.id
}

interface LegalInfo {
  id: string;
  memberId: string;
  ghanaCardNumber?: string;
  ghanaCardExpiryDate?: string;
  alternativeIdType?: string;
  alternativeIdNumber?: string;
}

interface BaptismInfo {
  id: string;
  memberId: string;
  dateType: 'full' | 'monthYear' | 'yearOnly';
  fullDate?: string;
  month?: number;
  year?: number;
  previousCongregation?: string;
  roleInPreviousCongregation?: string;
}
```

#### 2.2.3 Database Schema (Supabase)

```sql
-- Main members table
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  other_names VARCHAR(100),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE NOT NULL,
  second_phone VARCHAR(20),
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')) NOT NULL,
  date_of_birth DATE,
  marital_status VARCHAR(20),
  residence_location TEXT NOT NULL,
  digital_address VARCHAR(100),
  zone VARCHAR(1) CHECK (zone IN ('A', 'B', 'F', 'K', 'M', 'R')) NOT NULL,
  zone_number VARCHAR(10) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  join_date DATE DEFAULT CURRENT_DATE,
  photo_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Baptism information (one-to-one)
CREATE TABLE baptism_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID UNIQUE NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date_type VARCHAR(20) NOT NULL,
  full_date DATE,
  month INTEGER,
  year INTEGER,
  previous_congregation VARCHAR(255),
  role_in_previous_congregation VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Family members (one-to-many)
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  relationship VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  other_names VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  is_linked BOOLEAN DEFAULT FALSE,
  linked_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Legal information (one-to-one)
CREATE TABLE legal_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID UNIQUE NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ghana_card_number VARCHAR(20),
  ghana_card_expiry_date DATE,
  alternative_id_type VARCHAR(50),
  alternative_id_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Member ministries (many-to-many)
CREATE TABLE member_ministries (
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ministry_name VARCHAR(100) NOT NULL,
  assigned_date DATE DEFAULT CURRENT_DATE,
  PRIMARY KEY (member_id, ministry_name)
);

-- Indexes for performance
CREATE INDEX idx_members_zone ON members(zone);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_family_member_id ON family_members(member_id);
CREATE INDEX idx_family_linked_member ON family_members(linked_member_id);
```

#### 2.2.4 Member Status Definitions

```typescript
const MemberStatusDefinitions = {
  active: {
    label: 'Active',
    color: 'green',
    description: 'Regular member, actively participating'
  },
  'semi-active': {
    label: 'Semi-Active',
    color: 'yellow',
    description: 'Participates occasionally, not regular attendance'
  },
  inactive: {
    label: 'Inactive',
    color: 'gray',
    description: 'Member but no participation, needs follow-up'
  },
  sabbatical: {
    label: 'On Sabbatical',
    color: 'blue',
    description: 'Temporary leave, will return'
  },
  blacklisted: {
    label: 'Blacklisted',
    color: 'red',
    description: 'Removed due to discipline or other reasons'
  }
};
```

#### 2.2.5 Zone Management System

**Zone Structure:**
- Zones: A, B, F, K, M, R (6 zones total)
- Each zone has numbered members: A01, A02, ... A99, B01, etc.
- Zone numbers should auto-increment (not random)

**Current Issue:** Zone numbers are random
```
What we have:
├── Zone A: A15, A03, A42, A07 (random)

What we need:
├── Zone A: A01, A02, A03, A04 (sequential)
```

**Fix Implementation:**
```typescript
// In api.ts - members.create()
async function getNextZoneNumber(zone: string): Promise<string> {
  const { data } = await supabase
    .from('members')
    .select('zone_number')
    .eq('zone', zone)
    .order('zone_number', { ascending: false })
    .limit(1);
  
  if (!data || data.length === 0) {
    return `${zone}01`;
  }
  
  const lastNumber = parseInt(data[0].zone_number.substring(1));
  const nextNumber = (lastNumber + 1).toString().padStart(2, '0');
  return `${zone}${nextNumber}`;
}
```

#### 2.2.6 Member CRUD Operations Flow

**Add Member (AddMember.tsx):**
```
Form submission
    ↓
Validate required fields (first_name, last_name, phone, zone, residence)
    ↓
api.members.create(memberData)
    ↓
Database insert
    ↓
If success: Show toast + refresh members list
If error: Show error toast with reason
    ↓
Navigate back to members list
```

**Edit Member (EditMember.tsx):**
```
Load initial member data
    ↓
Form shows all fields pre-filled
    ↓
User makes changes
    ↓
Validate changed fields
    ↓
api.members.update(memberId, changedData)
    ↓
Database update
    ↓
Show success/error toast
    ↓
Navigate back to member profile or members list
```

**Delete Member (MemberProfile.tsx):**
```
User clicks Delete button
    ↓
Show confirmation dialog: "Are you sure? This cannot be undone."
    ↓
If confirmed:
    api.members.delete(memberId)
    ↓
    Delete CASCADE:
    ├─ family_members rows
    ├─ legal_info row
    ├─ baptism_info row
    ├─ member_ministries rows
    └─ attendance_entries rows
    ↓
    Show success toast
    ↓
    Navigate to members list
```

#### 2.2.7 Family Member System

**Problem:** Family member search not working, family tree not displaying

**Current Features:**
- Add family members with relationship types
- Link family members to existing members
- Display as tree structure (NOT WORKING)

**Required Fixes:**

1. **Search Existing Member:**
```typescript
// In AddMember.tsx - search handler
const handleSearchFamilyMember = async (searchTerm: string) => {
  const { data } = await supabase
    .from('members')
    .select('id, first_name, last_name, phone, zone')
    .or(`first_name.ilike.%${searchTerm}%, last_name.ilike.%${searchTerm}%, phone.ilike.%${searchTerm}%`)
    .limit(10);
  
  return data;
};
```

2. **Display Family Tree in Profile:**
```typescript
// In MemberProfile.tsx - add family section
function FamilySection({ member }: { member: Member }) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  
  useEffect(() => {
    // Fetch family members
    const { data } = await supabase
      .from('family_members')
      .select('*')
      .eq('member_id', member.id);
    
    setFamilyMembers(data || []);
  }, [member.id]);
  
  return (
    <Card>
      <CardHeader>Family Members</CardHeader>
      <CardContent>
        <div className="space-y-3">
          {familyMembers.map(fm => (
            <div key={fm.id} className="border-l-2 pl-4">
              <p className="font-medium">{fm.firstName} {fm.lastName}</p>
              <p className="text-sm text-gray-500">{fm.relationship}</p>
              {fm.isLinked && fm.linkedMemberId && (
                <Link to={`/members/${fm.linkedMemberId}/profile`}>
                  <Button size="sm" variant="link">
                    View Profile
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 2.2.8 Member List Features

**Current:** Search, filter by zone/status, sort implemented  
**Issues:** Need to complete implementation

**Filter Options:**
- By Zone (A, B, F, K, M, R)
- By Status (Active, Semi-active, Inactive, Sabbatical, Blacklisted)
- By Gender (Male, Female)
- By Join Date Range

**Sort Options:**
- Name (A-Z, Z-A)
- Zone (A-Z)
- Status (Active first, then alphabetical)
- Join Date (Newest, Oldest)

**Search:**
- By name (first, last, other)
- By phone number
- By email

#### 2.2.9 Export Members Functionality

**Supported Formats:** CSV, PDF, XLSX

**Export Flow:**
```typescript
// In Members.tsx
const handleExport = async (format: 'csv' | 'pdf' | 'xlsx') => {
  const exportData = filteredRecords.map(m => ({
    'First Name': m.firstName,
    'Last Name': m.lastName,
    'Phone': m.phone,
    'Email': m.email || '-',
    'Zone': m.zone + m.zoneNumber,
    'Status': m.status,
    'Join Date': m.joinDate,
    'Gender': m.gender
  }));
  
  await api.export[format]('Members', exportData);
};
```

#### 2.2.10 Known Issues & Fixes

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Delete user "uzi@church.com" fails | Orphaned records in related tables | Check for cascade delete constraints |
| Zone numbers random | No sequential logic | Implement getNextZoneNumber() function |
| Family search not working | Search handler not implemented | Add search API call in AddMember |
| Family tree not displaying | Component not fetching/rendering family | Implement FamilySection in MemberProfile |
| Edit member loses data | State not syncing with form | Implement useEffect to load data when member changes |

---

### 2.3 Visitor Management System (EXPANDED)

#### 2.3.1 Overview & Purpose
Track church visitors and convert promising prospects to members. Manage follow-up with interested visitors.

#### 2.3.2 Complete Data Model

```typescript
interface Visitor {
  id: string;
  firstName: string;                   // Required
  lastName: string;                    // Required
  otherNames?: string;
  
  email?: string;
  phone: string;                       // Required
  secondPhone?: string;
  
  gender: 'male' | 'female';
  dateOfBirth?: string;
  residenceLocation: string;           // Where they live
  
  visitDate: string;                   // Date of first visit
  serviceType: string;                 // Which service attended
  referredBy?: string;                 // Member ID or name who referred
  
  interestedInMembership: boolean;     // Flag if interested
  followUpStatus: 'pending' | 'contacted' | 'scheduled' | 'completed';
  
  potentialZone?: 'A' | 'B' | 'F' | 'K' | 'M' | 'R';
  
  convertedToMember?: boolean;
  convertedMemberId?: string;          // If converted, link to Member.id
  
  notes: string;                       // Follow-up notes
  
  createdAt: string;
  updatedAt: string;
}
```

#### 2.3.3 Database Schema

```sql
CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  other_names VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  second_phone VARCHAR(20),
  gender VARCHAR(10),
  date_of_birth DATE,
  residence_location TEXT NOT NULL,
  visit_date DATE NOT NULL,
  service_type VARCHAR(100),
  referred_by VARCHAR(255),  -- Name or Member ID attempt
  interested_in_membership BOOLEAN DEFAULT FALSE,
  follow_up_status VARCHAR(50) DEFAULT 'pending',
  potential_zone VARCHAR(1),
  converted_to_member BOOLEAN DEFAULT FALSE,
  converted_member_id UUID REFERENCES members(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_visitors_status ON visitors(follow_up_status);
CREATE INDEX idx_visitors_converted ON visitors(converted_to_member);
CREATE INDEX idx_visitors_date ON visitors(visit_date);
```

#### 2.3.4 Visitor Workflow

**Add Visitor (Visitors.tsx → AddVisitor component):**
```
Form submission
    ↓
Required: first_name, last_name, phone, visit_date, service_type
Optional: referral, interested_in_membership
    ↓
api.visitors.create(visitorData)
    ↓
Show success toast
    ↓
Refresh visitors list
```

**Convert to Member (Visitors.tsx → ConvertToMember):**
```
Admin clicks "Convert to Member"
    ↓
Show form pre-filled with visitor data
    ↓
Admin can adjust data before creating member
    ↓
api.members.create(convertedData)
    ↓
If success:
  ├─ Update visitors.converted_to_member = TRUE
  ├─ Update visitors.converted_member_id = new_member_id
  └─ Show success: "Visitor converted to member"
```

**Follow-Up Status Workflow:**
```
pending (initial)
    ↓
Admin clicks "Mark as Contacted"
    ↓
follow_up_status = 'contacted'
    ↓
Admin adds follow-up notes
    ↓
Admin can mark as "Scheduled" (scheduled next meeting)
    ↓
After meeting, mark as "Completed"
    ↓
Either convert to member or close follow-up
```

#### 2.3.5 Visitor Statistics

```typescript
function VisitorStats({ visitors }: { visitors: Visitor[] }) {
  const stats = {
    total: visitors.length,
    thisMonth: visitors.filter(v => isThisMonth(v.visitDate)).length,
    interested: visitors.filter(v => v.interestedInMembership).length,
    converted: visitors.filter(v => v.convertedToMember).length,
    pendingFollowUp: visitors.filter(v => v.followUpStatus === 'pending').length
  };
  
  return (
    <div className="grid grid-cols-5 gap-4">
      <StatCard label="Total Visitors" value={stats.total} />
      <StatCard label="This Month" value={stats.thisMonth} />
      <StatCard label="Interested" value={stats.interested} />
      <StatCard label="Converted" value={stats.converted} />
      <StatCard label="Pending Follow-up" value={stats.pendingFollowUp} />
    </div>
  );
}
```

#### 2.3.6 Known Issues & Fixes

| Issue | Fix |
|-------|-----|
| "Referred by" member matching broken | Implement search + link existing member |
| Convert to member incomplete | Complete conversion workflow |
| Visitor referral auto-link not working | Add member search and link in form |
| No follow-up task assignment | Add assign-to dropdown for follow-up owner |

---

### 2.4 Attendance Tracking System (EXPANDED)

#### 2.4.1 Overview & Purpose
Track church service attendance by member. Support multiple service types and enable bulk marking of attendance.

#### 2.4.2 Complete Data Models

```typescript
interface AttendanceRecord {
  id: string;
  date: string;                        // Service date (YYYY-MM-DD)
  serviceType: string;                 // "Sunday Main", custom service name
  startTime?: string;                  // HH:MM format
  endTime?: string;
  presentMembers: string[];            // Array of member IDs present
  absentMembers?: string[];            // Optional array of known absentees
  totalPresent: number;
  totalAbsent?: number;
  isCustomService: boolean;
  markedBy: string;                    // User ID who recorded
  markedAt: string;                    // ISO timestamp
  notes?: string;
}

interface CustomService {
  id: string;
  name: string;                        // e.g., "Prayer Night"
  description?: string;
  startDate: string;
  endDate: string;
  startTime: string;                   // HH:MM
  endTime: string;
  daysOfWeek: number[];                // 0=Sun, 1=Mon, ... 6=Sat
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

interface AttendanceEntry {
  id: string;
  attendanceRecordId: string;
  memberId: string;
  present: boolean;
}
```

#### 2.4.3 Database Schema

```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  start_time TIME,
  end_time TIME,
  total_present INTEGER DEFAULT 0,
  total_absent INTEGER DEFAULT 0,
  is_custom_service BOOLEAN DEFAULT FALSE,
  marked_by UUID,
  marked_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE attendance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  present BOOLEAN NOT NULL,
  UNIQUE(attendance_record_id, member_id)
);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL,  -- Array: [0] for Sunday
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attendance_date ON attendance_records(date);
CREATE INDEX idx_attendance_service ON attendance_records(service_type);
CREATE INDEX idx_attendance_entries ON attendance_entries(attendance_record_id);
```

#### 2.4.4 Permanent Service (Sunday Main Service)

**Not editable, always available:**
```typescript
const SUNDAY_MAIN_SERVICE = {
  name: 'Sunday Main Service',
  description: 'Every Sunday of the week [8am - 1pm]',
  startTime: '08:00',
  endTime: '13:00',
  isPermanent: true,
  daysOfWeek: [0]  // Sunday only
};
```

#### 2.4.5 Attendance Marking Flow

**Current State: BROKEN** ❌

**What should happen:**

1. **Go to Attendance → Mark Attendance:**
```
View list of members
    ↓
Initial state: all members unchecked
    ↓
Bulk actions available:
  ├─ Mark All Present
  ├─ Mark All Absent
  └─ Clear All
    ↓
Click individual checkboxes to toggle
    ↓
Fill in service details:
  ├─ Service type dropdown (Sunday Main, custom services)
  ├─ Service date picker
  └─ Optional notes
    ↓
Click "Save Attendance"
    ↓
Validation: at least 1 member must be marked
    ↓
API call: api.attendance.create(record)
    ↓
Database: create attendance_records + attendance_entries
    ↓
Show success: "Attendance recorded for X members"
    ↓
Navigate back to Attendance home
```

**Why it's broken:**
1. ❌ Save button has no onClick handler
2. ❌ No state management for marked members
3. ❌ API call not implemented in api.ts
4. ❌ Form validation missing
5. ❌ Response handling missing

#### 2.4.6 Fix Implementation

**Step 1: Update MarkAttendance.tsx**
```typescript
export function MarkAttendance({ onBack }: MarkAttendanceProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [markedPresent, setMarkedPresent] = useState<Set<string>>(new Set());
  const [serviceType, setServiceType] = useState('Sunday Main Service');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Fetch all active members
    const fetchMembers = async () => {
      const { data } = await api.members.getAll();
      setMembers(data || []);
    };
    fetchMembers();
  }, []);

  const handleToggleMember = (memberId: string) => {
    setMarkedPresent(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const handleMarkAllPresent = () => {
    setMarkedPresent(new Set(members.map(m => m.id)));
  };

  const handleClearAll = () => {
    setMarkedPresent(new Set());
  };

  const handleSave = async () => {
    if (markedPresent.size === 0) {
      toast.error('Please mark at least one member present');
      return;
    }

    setIsLoading(true);
    try {
      await api.attendance.create({
        date: serviceDate,
        serviceType,
        presentMembers: Array.from(markedPresent),
        markedBy: user?.id,
        totalPresent: markedPresent.size
      });
      
      toast.success(`Attendance recorded for ${markedPresent.size} members`);
      onBack();
    } catch (error) {
      toast.error('Failed to save attendance');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2>Mark Attendance</h2>
        <Button variant="outline" onClick={onBack}>Back</Button>
      </div>

      {/* Service Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Service Type</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sunday Main Service">Sunday Main Service</SelectItem>
                  {/* Add custom services */}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Date</Label>
              <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <div className="flex gap-2">
        <Button onClick={handleMarkAllPresent} variant="outline">Mark All Present</Button>
        <Button onClick={handleClearAll} variant="outline">Clear All</Button>
        <div className="ml-auto">Marked: {markedPresent.size}/{members.length}</div>
      </div>

      {/* Members List */}
      <div className="border rounded-lg overflow-y-auto max-h-96">
        {members.map(member => (
          <div key={member.id} className="flex items-center p-3 border-b hover:bg-gray-50">
            <Checkbox 
              checked={markedPresent.has(member.id)}
              onCheckedChange={() => handleToggleMember(member.id)}
            />
            <span className="ml-3">{member.firstName} {member.lastName}</span>
            <span className="ml-auto text-sm text-gray-500">{member.zone}{member.zoneNumber}</span>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>Cancel</Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Attendance'}
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Add to api.ts**
```typescript
attendance: {
  async create(record: {
    date: string;
    serviceType: string;
    presentMembers: string[];
    markedBy?: string;
    totalPresent: number;
    notes?: string;
  }) {
    // Create attendance record
    const { data: attendanceRecord } = await supabase
      .from('attendance_records')
      .insert({
        date: record.date,
        service_type: record.serviceType,
        total_present: record.totalPresent,
        marked_by: record.markedBy,
        notes: record.notes
      })
      .select()
      .single();

    // Create attendance entries for each member
    const entries = record.presentMembers.map(memberId => ({
      attendance_record_id: attendanceRecord.id,
      member_id: memberId,
      present: true
    }));

    await supabase.from('attendance_entries').insert(entries);

    return attendanceRecord;
  },

  async getAll() {
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .order('date', { ascending: false });
    return data;
  },

  async getByDate(date: string) {
    const { data } = await supabase
      .from('attendance_records')
      .select(`
        *,
        attendance_entries (
          member_id,
          present
        )
      `)
      .eq('date', date);
    return data;
  }
}
```

#### 2.4.7 Attendance Statistics & Reports

```typescript
function AttendanceStats({ records }: { records: AttendanceRecord[] }) {
  const totalServices = records.length;
  const averageAttendance = records.length > 0 
    ? records.reduce((sum, r) => sum + r.totalPresent, 0) / records.length
    : 0;

  const thisWeekRecords = records.filter(r => isThisWeek(r.date));
  const thisWeekAttendance = thisWeekRecords.reduce((sum, r) => sum + r.totalPresent, 0);

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="Total Services" value={totalServices} />
      <StatCard label="Average Attendance" value={Math.round(averageAttendance)} />
      <StatCard label="This Week Attendance" value={thisWeekAttendance} />
      <StatCard label="Attendance Rate" value={`${Math.round((averageAttendance / totalMembers) * 100)}%`} />
    </div>
  );
}
```

#### 2.4.8 Custom Services Management

**Create Custom Service:**
```typescript
// In Attendance.tsx or Settings.tsx
async function createCustomService(data: {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
}) {
  const { data: service } = await supabase
    .from('services')
    .insert(data)
    .select()
    .single();
  
  return service;
}
```

**List Custom Services:**
```typescript
async function getCustomServices() {
  const { data } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('name');
  
  return data;
}
```

#### 2.4.9 Known Issues & Fixes

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Save attendance does nothing | No onClick handler | Add handleSave function |
| Data not persisting | API call not implemented | Add api.attendance.create() |
| No member list shown | Members not fetched | Add useEffect to fetch members |
| Bulk actions broken | No state management | Implement markedPresent Set state |
| Validation missing | No checks before save | Add validation for selected members |

---

### 2.5 Giving & Tithes Management (EXPANDED)

#### 2.5.1 Overview & Purpose
Track church tithes, offerings, donations, thanksgiving per service. Support custom giving types and multiple payment methods.

#### 2.5.2 Complete Data Models

```typescript
interface GivingRecord {
  id: string;
  serviceName: string;                 // e.g., "Sunday Morning Service"
  serviceDate: string;
  serviceType: 'sunday_morning' | 'sunday_evening' | 'midweek' | 'special' | 'other';
  
  // Giving by type
  offerings: {
    offering: number;                  // Regular tithe
    donation: number;                  // General donation
    thanksgiving: number;              // Thanksgiving offering
    customTypes: { [key: string]: number };  // Custom types
  };
  
  totalAmount: number;                 // Sum of all offerings
  
  // Payment breakdown
  paymentBreakdown: {
    cash: number;
    mobile_money: number;
    card: number;
    bank_transfer: number;
    foreign_currency?: {
      currency: string;
      amount: number;
      ghs_equivalent: number;
    };
  };
  
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}

interface CustomGivingType {
  id: string;
  name: string;                        // e.g., "Building Fund"
  description?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

#### 2.5.3 Database Schema

```sql
CREATE TABLE giving_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name VARCHAR(255) NOT NULL,
  service_date DATE NOT NULL,
  service_type VARCHAR(50) NOT NULL,
  offering_amount DECIMAL(10,2) DEFAULT 0,
  donation_amount DECIMAL(10,2) DEFAULT 0,
  thanksgiving_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  cash DECIMAL(10,2) DEFAULT 0,
  mobile_money DECIMAL(10,2) DEFAULT 0,
  card DECIMAL(10,2) DEFAULT 0,
  bank_transfer DECIMAL(10,2) DEFAULT 0,
  foreign_currency VARCHAR(10),
  foreign_amount DECIMAL(10,2),
  ghs_equivalent DECIMAL(10,2),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE custom_giving_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE giving_custom_amounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giving_record_id UUID NOT NULL REFERENCES giving_records(id) ON DELETE CASCADE,
  custom_type_id UUID NOT NULL REFERENCES custom_giving_types(id),
  amount DECIMAL(10,2) NOT NULL
);

CREATE INDEX idx_giving_date ON giving_records(service_date);
CREATE INDEX idx_giving_service ON giving_records(service_type);
```

#### 2.5.4 Giving Record Workflow

**Record Giving (currently broken - blank page):**

**Issue Root Cause:**
- RecordGiving component exists but isn't displayed
- Missing `showRecordGiving` state in Giving component
- No state management for showing/hiding form

**Fix:**
```typescript
// In Giving.tsx
export function Giving({ onRecordGiving }: GivingProps) {
  const [records, setRecords] = useState<GivingRecord[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomGivingType[]>([]);
  const [showRecordGiving, setShowRecordGiving] = useState(false);  // ADD THIS
  const [loading, setLoading] = useState(true);
  const { user, canAccess } = useAuth();

  // Add this check before main return
  if (showRecordGiving) {
    return (
      <RecordGiving
        onBack={() => setShowRecordGiving(false)}
        onSave={async (record) => {
          setRecords(prev => [...prev, record]);
          setShowRecordGiving(false);
          onRecordGiving();
          toast.success('Giving recorded successfully');
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ... existing code ... */}
      <Button onClick={() => setShowRecordGiving(true)}>
        <Plus className="w-4 h-4 mr-2" />
        Record Service Giving
      </Button>
    </div>
  );
}
```

#### 2.5.5 Record Giving Form Flow

**Form Submission:**
```
Service selection & date
    ↓
Enter offering amounts:
├─ Offering (tithe)
├─ Donation
├─ Thanksgiving
└─ Custom types (dynamic list)
    ↓
Calculate total = sum of all
    ↓
Enter payment breakdown:
├─ Cash amount
├─ Mobile Money amount
├─ Card amount
├─ Bank Transfer amount
└─ Foreign currency (optional):
    ├─ Currency dropdown
    ├─ Foreign amount
    └─ GHS conversion rate (optional)
    ↓
Validate: payment total must equal offering total
    ↓
Optional: add notes
    ↓
Click "Save Giving"
    ↓
api.giving.create(record)
    ↓
Database insert + calculate totals
    ↓
Show success toast
    ↓
Navigate back to giving list
```

#### 2.5.6 Custom Giving Types Management

**Add Custom Type:**
```typescript
async function handleAddCustomType(name: string, description: string) {
  const { data } = await supabase
    .from('custom_giving_types')
    .insert({
      name,
      description,
      is_active: true,
      created_by: user?.id
    })
    .select()
    .single();
  
  setCustomTypes(prev => [...prev, data]);
  toast.success('Giving type created');
}
```

**Toggle Custom Type Status:**
```typescript
async function handleToggleCustomType(typeId: string, currentStatus: boolean) {
  const { data } = await supabase
    .from('custom_giving_types')
    .update({ is_active: !currentStatus })
    .eq('id', typeId)
    .select()
    .single();
  
  setCustomTypes(prev => prev.map(t => t.id === typeId ? data : t));
  toast.success(`Giving type ${!currentStatus ? 'activated' : 'deactivated'}`);
}
```

**Delete Custom Type:**
```typescript
async function handleDeleteCustomType(typeId: string) {
  const confirmed = window.confirm('Delete this giving type? This cannot be undone.');
  if (!confirmed) return;
  
  await supabase
    .from('custom_giving_types')
    .delete()
    .eq('id', typeId);
  
  setCustomTypes(prev => prev.filter(t => t.id !== typeId));
  toast.success('Giving type deleted');
}
```

#### 2.5.7 Foreign Currency Support

**Supported Currencies:**
```typescript
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' }
];

// Conversion helper
function convertToGHS(amount: number, currency: string, rate: number): number {
  return amount * rate;
}
```

#### 2.5.8 Giving Statistics & Reports

```typescript
function GivingStats({ records }: { records: GivingRecord[] }) {
  const totalGiving = records.reduce((sum, r) => sum + r.totalAmount, 0);
  
  const thisMonthGiving = records
    .filter(r => isThisMonth(r.serviceDate))
    .reduce((sum, r) => sum + r.totalAmount, 0);
  
  const thisWeekGiving = records
    .filter(r => isThisWeek(r.serviceDate))
    .reduce((sum, r) => sum + r.totalAmount, 0);

  const paymentMethodBreakdown = {
    cash: records.reduce((sum, r) => sum + r.paymentBreakdown.cash, 0),
    mobile_money: records.reduce((sum, r) => sum + r.paymentBreakdown.mobile_money, 0),
    card: records.reduce((sum, r) => sum + r.paymentBreakdown.card, 0),
    bank_transfer: records.reduce((sum, r) => sum + r.paymentBreakdown.bank_transfer, 0)
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Giving" value={formatGhanaCedis(totalGiving)} />
        <StatCard label="This Month" value={formatGhanaCedis(thisMonthGiving)} />
        <StatCard label="This Week" value={formatGhanaCedis(thisWeekGiving)} />
      </div>
      
      <Card>
        <CardHeader>Payment Method Breakdown</CardHeader>
        <CardContent>
          <BarChart data={[
            { method: 'Cash', amount: paymentMethodBreakdown.cash },
            { method: 'Mobile Money', amount: paymentMethodBreakdown.mobile_money },
            { method: 'Card', amount: paymentMethodBreakdown.card },
            { method: 'Bank Transfer', amount: paymentMethodBreakdown.bank_transfer }
          ]} />
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 2.5.9 API Integration

```typescript
// In api.ts
giving: {
  async getAll() {
    const { data } = await supabase
      .from('giving_records')
      .select('*')
      .order('service_date', { ascending: false });
    return data;
  },

  async create(record: GivingRecord) {
    const { data } = await supabase
      .from('giving_records')
      .insert({
        service_name: record.serviceName,
        service_date: record.serviceDate,
        service_type: record.serviceType,
        offering_amount: record.offerings.offering,
        donation_amount: record.offerings.donation,
        thanksgiving_amount: record.offerings.thanksgiving,
        total_amount: record.totalAmount,
        cash: record.paymentBreakdown.cash,
        mobile_money: record.paymentBreakdown.mobile_money,
        card: record.paymentBreakdown.card,
        bank_transfer: record.paymentBreakdown.bank_transfer,
        foreign_currency: record.paymentBreakdown.foreign_currency?.currency,
        foreign_amount: record.paymentBreakdown.foreign_currency?.amount,
        ghs_equivalent: record.paymentBreakdown.foreign_currency?.ghs_equivalent,
        notes: record.notes,
        created_by: user?.id
      })
      .select()
      .single();
    
    return data;
  },

  types: {
    async getAll() {
      const { data } = await supabase
        .from('custom_giving_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
      return data;
    },

    async create(type: Omit<CustomGivingType, 'id' | 'createdAt'>) {
      const { data } = await supabase
        .from('custom_giving_types')
        .insert(type)
        .select()
        .single();
      return data;
    },

    async delete(typeId: string) {
      await supabase
        .from('custom_giving_types')
        .delete()
        .eq('id', typeId);
    }
  }
}
```

#### 2.5.10 Known Issues & Fixes

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Blank page when clicking "Record Giving" | Missing state management | Add `showRecordGiving` state |
| RecordGiving component not rendering | Component exists but not displayed | Add conditional render check |
| Payment validation missing | No form validation | Add total check before save |
| Foreign currency calculation wrong | Conversion rate not stored | Use manual rate entry |

---

### 2.6 Reports & Analytics System (EXPANDED)

#### 2.6.1 Overview & Purpose
Provide comprehensive dashboard and detailed reports on attendance, giving,