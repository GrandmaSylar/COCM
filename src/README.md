# Church Management System (ChMS) MVP
## Church of Christ, Mataheko Congregation (CoC.M)

A comprehensive church management system built with React and TypeScript, designed with a mobile-first approach to help church staff efficiently manage members, track attendance, handle giving records, and generate reports.

---

## 🚀 Features Overview

### 1. **Authentication System**
- **Login**: Secure authentication for church staff
- **Sign Up**: New user registration (controlled by admin permissions)
- **Forgot Password**: Password recovery functionality
- **Role-based Access Control**: Different permission levels for different user types

### 2. **Dashboard**
- **Quick Actions**: Fast access to common tasks (Add Member, Record Attendance, Mark Individual Attendance, Record Giving, Add Visitor)
- **Statistics Overview**: Key metrics and insights at a glance
- **Recent Activity**: Latest system activities and updates
- **Navigation Hub**: Central access point to all system modules

### 3. **Member Management**
- **Member Registration**: Comprehensive member data collection including:
  - Personal details (first name, last name, other names)
  - Contact information (phone numbers, email)
  - Demographics (date of birth, residence location)
  - Zone assignment (A-F zones: Abossey Okai, Bubiashie, Floating, Kasoa, Mataheko, Russia)
  - Unique zone numbers
  - Optional passport-size photo upload
  - Member status tracking
- **Member Profiles**: Detailed view of individual member information
- **Member Status Management**: Track member engagement levels
- **Member Directory**: Searchable and filterable member list

### 4. **Attendance Tracking**
Two complementary attendance systems:

#### **Bulk Attendance Recording**
- Record attendance for entire services
- Service type selection (Sunday Main Service or custom temporary services)
- Date and time tracking
- Attendance count recording
- Service-specific notes

#### **Individual Attendance Marking**
- Mark attendance for specific members
- Member search and selection
- Individual attendance history
- Detailed attendance analytics per member

### 5. **Visitor Management**
- **Visitor Registration**: Capture visitor information during services
- **Visitor Profiles**: Detailed visitor information management
- **Visitor-to-Member Conversion**: Seamless process to convert visitors to members
- **Visitor Tracking**: Monitor visitor engagement and return visits
- **Follow-up Management**: Track visitor outreach efforts

### 6. **Giving & Tithes Management**
- **Multiple Giving Types**:
  - Offering
  - Donation
  - Thanksgiving
  - Custom types (manageable by Admin and Pastor)
- **Currency**: Ghana Cedis (GHS) support
- **Giving Records**: Detailed financial contribution tracking
- **Anonymous Giving**: Option for anonymous contributions
- **Receipt Generation**: Digital giving receipts

### 7. **Reports & Analytics**
- **Member Reports**: Membership statistics and trends
- **Attendance Reports**: Service attendance analysis
- **Giving Reports**: Financial contribution summaries
- **Zone Reports**: Zone-wise member distribution and activity
- **Custom Date Ranges**: Flexible reporting periods

### 8. **Settings & Administration**
- **User Management**: Add and manage system users
- **Permission Controls**: Role-based permission assignment
- **System Configuration**: General system settings
- **Data Export**: Export functionality for reports and records

### 9. **Demo Guide**
- **System Tutorial**: Interactive guide for new users
- **Feature Walkthrough**: Comprehensive system overview
- **Best Practices**: Recommended usage patterns

---

## 👥 User Roles & Permissions

### **Permission System Overview**
The ChMS uses a sophisticated role-based access control (RBAC) system with support for temporary permissions. This ensures secure and flexible access management for different staff roles.

### **Role Hierarchy**

#### **1. Dev (Developer)** - Supreme Access
- **All Permissions**: Complete, unrestricted access to all system features
- **Role Management**: 
  - Create custom roles with specific permission sets
  - Assign roles to users permanently or temporarily
  - Unassign roles from any account
  - Modify role permissions system-wide
- **Theme Customization**: 
  - Change system theme colors (primary, secondary, accent)
  - Theme changes apply globally to both light and dark modes
- **User Management**: Full control over all user accounts
- **System Administration**: Complete system control and configuration
- **Emergency Access**: Override capabilities for system maintenance
- **Technical Management**: Database access, system debugging, technical configurations
- **Audit Controls**: Full system audit and logging access

#### **2. Admin (Administrator)** - Full Operational Access
- **Full CRUD Access**: Complete access to view, create, edit, and delete all data
- **User Management**: Create, edit, and manage user accounts (except Dev accounts)
- **Permission Grants**: 
  - Grant temporary permissions to Pastor and Elder accounts for limited time periods
  - Revoke temporary permissions at any time
  - Available durations: 1hr, 3hr, 6hr, 12hr, 24hr, 48hr, 1 week
- **System Configuration**: Modify system settings and configurations
- **Data Management**: Full operations on members, attendance, giving, visitors, and reports
- **Custom Giving Types**: Create and manage custom giving categories
- **Service Management**: Create and manage both permanent and temporary services
- **Zone Management**: Full zone administration capabilities

**Default Permissions:**
- `manage_users`, `manage_members`, `view_members`, `edit_members`, `delete_members`
- `manage_attendance`, `view_attendance`, `record_attendance`
- `manage_giving`, `view_giving`, `record_giving`, `manage_giving_types`
- `view_reports`, `manage_settings`, `manage_services`, `grant_permissions`

#### **3. Pastor** - View-Only by Default
- **Default Access**: Read-only access to all member and church data
- **Temporary Permissions**: Can be granted write/manage permissions by Admin for limited time
- **Available Temporary Permissions:**
  - Member management (add, edit, delete)
  - Attendance recording
  - Giving management and custom type creation
  - Service management
- **Spiritual Oversight**: Access to member spiritual information and notes
- **Reports Access**: Full access to all reports and analytics
- **Custom Giving Types**: Can manage when granted temporary permission

**Default Permissions:**
- `view_members`, `view_attendance`, `view_giving`, `view_reports`, `manage_giving_types`

#### **4. Elder** - View-Only by Default
- **Default Access**: Read-only access to member and basic church data
- **Temporary Permissions**: Can be granted limited write permissions by Admin
- **Available Temporary Permissions:**
  - Basic member editing
  - Attendance recording
  - Giving recording
- **Zone Oversight**: May have enhanced access to their assigned zone data
- **Basic Reports**: Access to standard reports and member information
- **Limited Service Access**: Basic attendance and member information access

**Default Permissions:**
- `view_members`, `view_attendance`, `view_giving`, `view_reports`

---

### **Temporary Permission System**

#### **How It Works**
1. **Admin or Dev** can grant temporary permissions to Pastor or Elder accounts
2. Permissions are time-limited (1 hour to 1 week)
3. Permissions automatically expire after the specified duration
4. Expired permissions are cleaned up automatically
5. Admin/Dev can manually revoke permissions before expiration

#### **Use Cases**
- Grant Pastor temporary member editing access for a special registration drive
- Allow Elder to record attendance during their service oversight shift
- Provide temporary giving management access during special events
- Emergency access grants during staff shortages

#### **Granting Permissions**
1. Navigate to Settings → Users & Permissions
2. Select the target user (Pastor or Elder)
3. Click "Grant Permission"
4. Choose the specific permission to grant
5. Select duration (1hr, 3hr, 6hr, 12hr, 24hr, 48hr, or 1 week)
6. Confirm the grant

#### **Monitoring Permissions**
- Active temporary permissions are displayed on each user's card
- Shows time remaining before expiration
- Color-coded for easy visibility
- Can be revoked instantly if needed

---

### **Theme Customization (Dev Only)**

Developers can customize the visual theme of the entire system:
- **Primary Color**: Main brand color used throughout the interface
- **Secondary Color**: Supporting color for accents and highlights  
- **Accent Color**: Call-to-action and emphasis color
- Colors apply to both light and dark modes automatically
- System adjusts contrast and brightness for optimal visibility
- Changes are saved and persist across all user sessions
- Can be reset to default theme at any time

---

## 🗄️ MongoDB Database Structure

### **Collections Overview**

#### **1. users**
```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  hashedPassword: String,
  role: String, // 'admin', 'pastor', 'elder', 'dev'
  permissions: {
    canCreate: Boolean,
    canEdit: Boolean,
    canDelete: Boolean,
    canManageUsers: Boolean,
    canManageSettings: Boolean,
    modules: [String] // specific module permissions
  },
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    zone: String
  },
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date,
  lastLogin: Date
}
```

#### **2. members**
```javascript
{
  _id: ObjectId,
  memberNumber: String, // Auto-generated unique identifier
  firstName: String,
  lastName: String,
  otherNames: String,
  dateOfBirth: Date,
  phoneNumbers: {
    primary: String,
    secondary: String
  },
  email: String,
  residence: {
    address: String,
    city: String,
    region: String
  },
  zone: {
    code: String, // 'A', 'B', 'F', 'K', 'M', 'R'
    name: String, // 'Abossey Okai', 'Bubiashie', 'Floating', 'Kasoa', 'Mataheko', 'Russia'
    number: String // Unique zone number
  },
  status: String, // 'Active', 'Semi-Active', 'Inactive', 'Sabbatical', 'Blacklisted'
  photo: {
    url: String,
    filename: String,
    uploadDate: Date
  },
  joinDate: Date,
  baptismDate: Date,
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  notes: String,
  createdBy: ObjectId, // Reference to users collection
  createdAt: Date,
  updatedAt: Date
}
```

#### **3. visitors**
```javascript
{
  _id: ObjectId,
  firstName: String,
  lastName: String,
  phoneNumbers: {
    primary: String,
    secondary: String
  },
  email: String,
  residence: {
    address: String,
    city: String,
    region: String
  },
  firstVisitDate: Date,
  lastVisitDate: Date,
  visitCount: Number,
  referredBy: String,
  interests: [String],
  followUpStatus: String, // 'Pending', 'Contacted', 'Converted', 'Lost'
  notes: String,
  convertedToMember: {
    isConverted: Boolean,
    convertedDate: Date,
    memberId: ObjectId // Reference to members collection
  },
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### **4. attendance**
```javascript
{
  _id: ObjectId,
  type: String, // 'bulk' or 'individual'
  serviceDetails: {
    serviceType: String, // 'Sunday Main Service' or custom
    serviceName: String,
    date: Date,
    startTime: String,
    endTime: String
  },
  // For bulk attendance
  totalAttendance: {
    men: Number,
    women: Number,
    children: Number,
    visitors: Number,
    total: Number
  },
  // For individual attendance
  memberId: ObjectId, // Reference to members collection
  memberName: String,
  zone: String,
  status: String, // 'Present', 'Absent', 'Late'
  notes: String,
  weather: String,
  specialEvents: [String],
  recordedBy: ObjectId,
  createdAt: Date
}
```

#### **5. giving**
```javascript
{
  _id: ObjectId,
  amount: Number,
  currency: String, // 'GHS'
  givingType: String, // 'Offering', 'Donation', 'Thanksgiving', or custom
  customType: String, // For custom giving types
  date: Date,
  serviceDetails: {
    serviceType: String,
    serviceName: String
  },
  donor: {
    isAnonymous: Boolean,
    memberId: ObjectId, // Reference to members collection if not anonymous
    visitorId: ObjectId, // Reference to visitors collection if visitor
    name: String // For anonymous or visitor donations
  },
  method: String, // 'Cash', 'Mobile Money', 'Bank Transfer', 'Check'
  reference: String, // Transaction reference if applicable
  notes: String,
  receiptGenerated: Boolean,
  receiptNumber: String,
  recordedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### **6. services**
```javascript
{
  _id: ObjectId,
  name: String,
  type: String, // 'permanent' or 'temporary'
  description: String,
  schedule: {
    dayOfWeek: Number, // 0-6 (Sunday = 0)
    startTime: String,
    endTime: String,
    frequency: String // 'Weekly', 'Monthly', 'One-time'
  },
  isActive: Boolean,
  createdBy: ObjectId,
  createdAt: Date,
  endDate: Date // For temporary services
}
```

#### **7. zones**
```javascript
{
  _id: ObjectId,
  code: String, // 'A', 'B', 'F', 'K', 'M', 'R'
  name: String, // Full zone names
  description: String,
  leader: {
    memberId: ObjectId,
    name: String
  },
  boundaries: String,
  memberCount: Number,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### **8. givingTypes**
```javascript
{
  _id: ObjectId,
  name: String,
  type: String, // 'default' or 'custom'
  description: String,
  isActive: Boolean,
  createdBy: ObjectId,
  createdAt: Date
}
```

#### **9. systemLogs**
```javascript
{
  _id: ObjectId,
  action: String,
  module: String,
  userId: ObjectId,
  userRole: String,
  details: Object, // Specific action details
  ipAddress: String,
  timestamp: Date
}
```

### **Member Status Definitions**
- **Active**: Regular attendance and participation in church activities
- **Semi-Active**: Occasional attendance, limited participation
- **Inactive**: No recent attendance or participation
- **Sabbatical**: Temporary leave from active participation
- **Blacklisted**: Disciplinary status requiring special attention

---

## 📁 Project Directory Structure

```
├── App.tsx                          # Main application component and routing
├── Attributions.md                  # Third-party library attributions
├── README.md                        # This documentation file
├── components/                      # React components directory
│   ├── AddMember.tsx               # Member registration form
│   ├── Attendance.tsx              # Attendance management dashboard
│   ├── AuthContext.tsx             # Authentication context provider
│   ├── Dashboard.tsx               # Main dashboard component
│   ├── DemoGuide.tsx              # Interactive system tutorial
│   ├── ForgotPassword.tsx         # Password recovery component
│   ├── Giving.tsx                 # Giving/tithes management
│   ├── Layout.tsx                 # Main application layout wrapper
│   ├── Login.tsx                  # User authentication form
│   ├── MarkAttendance.tsx         # Individual member attendance marking
│   ├── MemberProfile.tsx          # Individual member details view
│   ├── Members.tsx                # Member directory and management
│   ├── Reports.tsx                # Reports and analytics dashboard
│   ├── Settings.tsx               # System settings and user management
│   ├── SignUp.tsx                 # New user registration form
│   ├── ThemeContext.tsx           # Theme management context
│   ├── Visitors.tsx               # Visitor management system
│   ├── figma/                     # Figma-specific components
│   │   └── ImageWithFallback.tsx  # Image component with fallback handling
│   └── ui/                        # Reusable UI components (shadcn/ui)
│       ├── accordion.tsx          # Collapsible content sections
│       ├── alert-dialog.tsx       # Modal confirmation dialogs
│       ├── alert.tsx              # Notification alerts
│       ├── aspect-ratio.tsx       # Aspect ratio container
│       ├── avatar.tsx             # User avatar component
│       ├── badge.tsx              # Status badges and labels
│       ├── breadcrumb.tsx         # Navigation breadcrumbs
│       ├── button.tsx             # Button component with variants
│       ├── calendar.tsx           # Date picker calendar
│       ├── card.tsx               # Content card containers
│       ├── carousel.tsx           # Image/content carousel
│       ├── chart.tsx              # Data visualization charts
│       ├── checkbox.tsx           # Checkbox input component
│       ├── collapsible.tsx        # Expandable content sections
│       ├── command.tsx            # Command palette interface
│       ├── context-menu.tsx       # Right-click context menus
│       ├── dialog.tsx             # Modal dialog windows
│       ├── drawer.tsx             # Slide-out panels
│       ├── dropdown-menu.tsx      # Dropdown menu components
│       ├── form.tsx               # Form validation and handling
│       ├── hover-card.tsx         # Hover preview cards
│       ├── input-otp.tsx          # One-time password input
│       ├── input.tsx              # Text input components
│       ├── label.tsx              # Form field labels
│       ├── menubar.tsx            # Horizontal menu bar
│       ├── navigation-menu.tsx    # Navigation menu system
│       ├── pagination.tsx         # Page navigation controls
│       ├── popover.tsx            # Floating content containers
│       ├── progress.tsx           # Progress indicator bars
│       ├── radio-group.tsx        # Radio button groups
│       ├── resizable.tsx          # Resizable panel layouts
│       ├── scroll-area.tsx        # Custom scrollable areas
│       ├── select.tsx             # Dropdown selection inputs
│       ├── separator.tsx          # Visual content separators
│       ├── sheet.tsx              # Side panel overlays
│       ├── sidebar.tsx            # Application sidebar
│       ├── skeleton.tsx           # Loading placeholder skeletons
│       ├── slider.tsx             # Range slider inputs
│       ├── sonner.tsx             # Toast notification system
│       ├── switch.tsx             # Toggle switch components
│       ├── table.tsx              # Data table components
│       ├── tabs.tsx               # Tabbed content sections
│       ├── textarea.tsx           # Multi-line text inputs
│       ├── toggle-group.tsx       # Grouped toggle buttons
│       ├── toggle.tsx             # Toggle button components
│       ├── tooltip.tsx            # Hover tooltips
│       ├── use-mobile.ts          # Mobile detection hook
│       └── utils.ts               # Utility functions
├── guidelines/                     # Project documentation
│   └── Guidelines.md              # Development guidelines and standards
└── styles/                        # Styling and design system
    └── globals.css                # Global CSS with Tailwind v4 configuration
```

---

## 🛠️ Technical Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **State Management**: React Context API
- **Icons**: Lucide React
- **Notifications**: Sonner
- **Database**: MongoDB (recommended)
- **Authentication**: JWT-based (recommended)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB database
- Modern web browser

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables
4. Set up MongoDB collections using the schema above
5. Run the development server: `npm run dev`

---

## 📊 Key Features Summary

### Mobile-First Design
- Responsive design optimized for mobile devices
- Touch-friendly interface elements
- Progressive Web App capabilities

### Data Security
- Role-based access control
- Secure authentication system
- Audit logging for all actions

### Scalability
- Modular component architecture
- Efficient data structures
- Optimized for church growth

### User Experience
- Intuitive navigation
- Quick action shortcuts
- Comprehensive search and filtering

---

## 📝 Notes

- This is an MVP (Minimum Viable Product) designed for the Church of Christ, Mataheko Congregation
- The system uses Ghana Cedis (GHS) as the primary currency
- All datetime handling should consider Ghana timezone (GMT+0)
- The system is designed to be offline-capable where possible
- Regular data backups are recommended for production deployment

---

For technical support or feature requests, please contact the development team.