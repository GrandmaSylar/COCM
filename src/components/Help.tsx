import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import {
  HelpCircle,
  Users,
  UserPlus,
  Calendar,
  Banknote,
  BarChart3,
  Settings as SettingsIcon,
  Eye,
  Edit,
  Trash2,
  Plus,
  CheckCircle2,
  Shield,
  Clock,
  AlertCircle,
  BookOpen,
  Lock,
  Unlock,
  Download,
  Search,
  Filter,
  UserCheck,
  ClipboardList,
  Church,
  Key,
  Smartphone,
  Home
} from 'lucide-react';
import { useAuth } from './AuthContext';

interface FeatureGuide {
  id: string;
  title: string;
  icon: any;
  description: string;
  steps: {
    title: string;
    description: string;
    icon: any;
    note?: string;
  }[];
  permissions: string[];
  availableFor: string[];
}

const featureGuides: FeatureGuide[] = [
  {
    id: 'dashboard',
    title: 'Dashboard & Overview',
    icon: Home,
    description: 'The Dashboard is your central hub for quick access to key metrics and frequently used actions. See a summary of your church at a glance.',
    permissions: ['view_members', 'view_attendance', 'view_giving'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'View Summary Statistics',
        description: 'The Dashboard displays key metrics: Total Members (all registered members), Attendance This Week (individual attendance count), Giving This Month (total giving amount), and New Members This Month. These cards provide a quick snapshot of church activity.',
        icon: BarChart3,
        note: 'All statistics update in real-time as new data is recorded.'
      },
      {
        title: 'Use Quick Actions',
        description: 'Quick Action buttons appear based on your permissions. Available actions include: Add New Member, Record Attendance, Record Giving, Add Visitor, and Mark Individual Attendance. Click any action to quickly navigate to that feature.',
        icon: Plus,
        note: 'Only actions you have permission to perform will be visible.'
      },
      {
        title: 'Access Navigation Menu',
        description: 'On the left sidebar, you\'ll see navigation links to all available features: Members, Visitors, Attendance, Giving, Reports, Settings, and Help. Click any link to navigate to that section.',
        icon: Home,
        note: 'On mobile, click the menu icon to expand the navigation sidebar.'
      }
    ]
  },
  {
    id: 'members',
    title: 'Member Management',
    icon: Users,
    description: 'View, add, edit, and manage church members. Members are automatically assigned a status based on their attendance at Sunday Main Services.',
    permissions: ['view_members', 'manage_members', 'edit_members'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'View Members',
        description: 'Navigate to Members from the sidebar. Use the search bar to find members by name, zone number, email, or phone. Filter by zone, status, or gender, and sort by name, zone, status, or join date.',
        icon: Eye,
        note: 'All roles can view members.'
      },
      {
        title: 'Add New Member',
        description: 'Click "Add New Member". Fill in personal details (name, gender, DOB, marital status), contact info (phone, email, residence, digital address), zone assignment, ministries, family links, baptism info, legal IDs, and optionally upload a passport photo.',
        icon: Plus,
        note: 'Requires manage_members permission (Admin/Dev by default).'
      },
      {
        title: 'View Member Profile',
        description: 'Click any member card to open their full profile. The profile shows personal info, contact details, zone, ministries, family tree with visual diagram, attendance analytics (this month percentage and chart), recent activity, baptism info, legal IDs, and notes.',
        icon: Eye,
        note: 'Linked family members who are also in the system show a "View Profile" link.'
      },
      {
        title: 'Edit / Delete Member',
        description: 'From the member profile, click "Edit" to update any information, or "Delete" to remove the member. Changes are saved immediately.',
        icon: Edit,
        note: 'Edit requires edit_members, Delete requires delete_members permission.'
      },
      {
        title: 'Member Statuses',
        description: 'Statuses are auto-calculated based on the last 4 Sunday Main Service individual attendance records: New (fewer than 4 records), Active (3-4 present), Semi-Active (1-2 present), Inactive (0 present). Sabbatical and Blacklisted are set manually.',
        icon: UserCheck,
        note: 'Only individual attendance (not general head count) affects member status.'
      },
      {
        title: 'Export Members',
        description: 'Click the Export dropdown in the Members list to download member data as CSV, Excel, or PDF.',
        icon: Download,
        note: 'Exports respect current search and filter selections.'
      }
    ]
  },
  {
    id: 'visitors',
    title: 'Visitor Management',
    icon: UserPlus,
    description: 'Register church visitors, track their interest in membership, and convert them to full members.',
    permissions: ['view_members', 'manage_members'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'View Visitors',
        description: 'Navigate to Visitors from the sidebar. See all registered visitors with their visit date, service type, contact details, and membership interest status. Search by name, phone, email, or residence. Filter by membership interest.',
        icon: Eye,
        note: 'All roles with view_members permission can see visitors.'
      },
      {
        title: 'Add Visitor',
        description: 'Click "Add Visitor". Record visitor name, contact info, gender, DOB, residence, visit date, service type, potential zone, and optionally who referred them (searchable member list). Indicate if they are interested in membership.',
        icon: Plus,
        note: 'Requires manage_members permission.'
      },
      {
        title: 'Convert Visitor to Member',
        description: 'From a visitor profile or the visitor list, click the "Convert" button (green, appears for visitors interested in membership). The visitor\'s information pre-populates the member registration form. After saving, the visitor is marked as converted.',
        icon: UserPlus,
        note: 'Requires manage_members permission. The visitor record is preserved with a "converted" flag.'
      }
    ]
  },
  {
    id: 'attendance',
    title: 'Attendance Tracking',
    icon: Calendar,
    description: 'Track attendance in two ways: Individual Attendance (per-member, affects member status) and General Attendance (head count, for church trends). Both types can be recorded for the same service.',
    permissions: ['view_attendance', 'record_attendance'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'View Attendance Records',
        description: 'Navigate to Attendance from the sidebar. Records are displayed as cards with service name, date, and count. Each card shows a type badge: "Individual" (orange) or "Head Count" (blue). Use filters to search by service name, filter by service type, or filter by attendance type.',
        icon: Eye,
        note: 'All roles can view attendance. Stats cards show Total Services, Average Attendance, and This Week.'
      },
      {
        title: 'Record General Attendance (Head Count)',
        description: 'Click "Record General Attendance". Select the service date (service type is Sunday Main Service, 8:00 AM - 1:00 PM). Enter the total head count and any notes. This records the overall number present without tracking individual members.',
        icon: ClipboardList,
        note: 'General attendance feeds church attendance trends and reports but does NOT affect individual member statuses.'
      },
      {
        title: 'Mark Individual Attendance',
        description: 'Click "Mark Individual Attendance". A list of all members appears with search and zone filter. Mark each member as Present (green check) or Absent (red X). Use bulk actions: "Mark All Present", "Mark All Absent", or "Clear All". A "Show only unmarked" filter helps track progress.',
        icon: CheckCircle2,
        note: 'Individual attendance determines member status (Active, Semi-Active, Inactive) based on the last 4 Sunday Main Services. After saving, the Absentee Review phase begins.'
      },
      {
        title: 'Absentee Review Phase',
        description: 'After marking individual attendance, you enter the Absentee Review phase for each absent member. For each absentee, you can: (1) Note if they requested permission to be absent, (2) Record the reason for absence (Sick, Travel, Work, Family Emergency, Other), (3) Add detailed reason notes, (4) Set absence dates (single date or date range), or mark "Until Further Notice". Once you\'ve reviewed the absentees, click "Save & Complete" to finish, or "Skip" to proceed without recording details.',
        icon: Users,
        note: 'Absentee Review is optional but recommended for accurate records. The information helps track member engagement and health.'
      },
      {
        title: 'View / Edit Attendance Record',
        description: 'Each record card has a View/Edit button. Within the 12-hour edit window, you can edit the record (button shows "Edit" with unlock badge and countdown). After 12 hours, the record locks (button shows "View" with lock badge). For general records, edit the head count. For individual records, search and toggle member attendance.',
        icon: Edit,
        note: 'Dev role can always edit regardless of the edit window. The countdown shows remaining time (e.g., "5h 30m remaining").'
      },
      {
        title: 'Manage Custom Services',
        description: 'Click the gear icon (Manage Services) to create custom service types beyond Sunday Main Service. Add services like Easter Revival, Youth Conference, etc., with recurring day schedules.',
        icon: SettingsIcon,
        note: 'Requires manage_services permission.'
      }
    ]
  },
  {
    id: 'absentee-review',
    title: 'Absentee Review & Follow-up',
    icon: Users,
    description: 'After marking individual attendance for a service, the Absentee Review phase helps document reasons for absences and track member engagement patterns.',
    permissions: ['record_attendance'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'Access Absentee Review',
        description: 'The Absentee Review phase appears automatically after you finish marking individual attendance and click "Save Attendance". A list of all absent members is displayed with options to record information for each.',
        icon: Eye,
        note: 'This phase is triggered only after individual attendance recording. It does not appear for general attendance (head count).'
      },
      {
        title: 'Record Absence Information',
        description: 'For each absent member, you can: (1) Check "Requested Permission" if they notified the church of their absence, (2) Select a reason (Sick, Travel, Work, Family Emergency, Other), (3) Add detailed notes about the reason, (4) Set absence start and end dates, or (5) Select "Until Further Notice" for ongoing absences. You can update multiple members and save them all at once.',
        icon: Edit,
        note: 'All fields are optional. You only need to save if you have information to record about the absences.'
      },
      {
        title: 'Filter and Search Absentees',
        description: 'Use the search bar to find specific absentees by name or zone number. Filter the list by zone to review absences by geographic area.',
        icon: Search,
        note: 'This helps manage large attendance records efficiently.'
      },
      {
        title: 'Complete or Skip Review',
        description: 'Click "Save & Complete" to save any absence information you\'ve entered and move on. Click "Skip" to skip the review and proceed without recording absence details.',
        icon: CheckCircle2,
        note: 'Skipping does not delete any information you\'ve already saved.'
      },
      {
        title: 'Understanding Absence Information',
        description: 'The "Requested Permission" flag helps distinguish between planned absences (members notified the church) and unplanned absences. The reason and date fields create a historical record that helps identify patterns and follow up with members who frequently miss services.',
        icon: BookOpen,
        note: 'This information is stored with the attendance record and can be reviewed in member profiles and reports.'
      }
    ]
  },
  {
    id: 'giving',
    title: 'Giving & Offerings',
    icon: Banknote,
    description: 'Record service giving with detailed breakdowns by giving type and payment method. Supports custom giving types and foreign currency.',
    permissions: ['view_giving', 'record_giving'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'View Giving Records',
        description: 'Navigate to Giving from the sidebar. Records are displayed as cards showing service name, date, total amount, giving breakdown (Offering, Donation, Thanksgiving, custom types), and payment method breakdown. Search by service name or notes, and filter by service type.',
        icon: Eye,
        note: 'Stats cards show Total Giving, This Month, and This Week totals in Ghana Cedis (GH₵).'
      },
      {
        title: 'Record Service Giving',
        description: 'Click "Record Service Giving". Select the service date. Enter amounts for each giving type: Offering, Donation, Thanksgiving, and any active custom giving types. Then enter the payment breakdown: Cash, Mobile Money, Card, Bank Transfer. Optionally add foreign currency with GHS equivalent. The payment total must match the giving total before saving.',
        icon: Plus,
        note: 'The "Create Custom Giving Type" button in the form navigates to the type manager. Requires record_giving permission.'
      },
      {
        title: 'View / Edit Giving Record',
        description: 'Each record card has a View/Edit button with an edit window badge. Within 3 hours of creation, you can edit giving amounts, payment breakdown, foreign currency, and notes (button shows "Edit" with unlock badge and countdown). After 3 hours, the record locks to view-only.',
        icon: Edit,
        note: 'Dev role can always edit regardless of the 3-hour window. The giving and payment totals must balance when saving edits.'
      },
      {
        title: 'Manage Custom Giving Types',
        description: 'Click "Manage Types" in the Giving page header (or "Create Custom Giving Type" from the RecordGiving form). Add new types (e.g., Special Projects, Benevolence Fund), toggle them active/inactive, or delete them. Only active types appear in the giving form.',
        icon: SettingsIcon,
        note: 'Requires manage_giving_types permission. Each type shows who created it and when.'
      },
      {
        title: 'Foreign Currency',
        description: 'When recording or editing giving, expand the Foreign Currency section. Select the currency (USD, EUR, GBP, CAD, AUD, CHF, NGN, ZAR, CNY, JPY), enter the amount, and enter the GHS equivalent. The GHS equivalent counts toward the payment total.',
        icon: Banknote,
        note: 'Foreign currency amounts are displayed with the currency symbol and GHS conversion on record cards.'
      },
      {
        title: 'Export Giving Data',
        description: 'Click the Export dropdown to download giving records as CSV, Excel, or PDF. Exports include service name, date, type, all giving amounts, payment breakdown, notes, and audit info.',
        icon: Download,
        note: 'Exports respect current search and filter selections.'
      }
    ]
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    icon: BarChart3,
    description: 'View attendance trends, giving trends, and membership growth with interactive charts and summary statistics.',
    permissions: ['view_reports'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'Access Reports',
        description: 'Navigate to Reports from the sidebar. Select a time period (This Month, This Quarter, This Year) to adjust the data range for all charts and statistics.',
        icon: Eye,
        note: 'All roles can view reports.'
      },
      {
        title: 'Summary Statistics',
        description: 'View key metrics at a glance: Total Members, Average Attendance, Total Giving (GH₵), and Growth Rate. Additional cards show monthly services held, average monthly attendance, new members, and monthly giving total.',
        icon: BarChart3,
        note: 'Statistics update based on the selected time period.'
      },
      {
        title: 'Attendance Trends',
        description: 'A line chart shows attendance numbers over time. General (head count) attendance data is preferred for trend reporting, with individual attendance as a fallback.',
        icon: Calendar
      },
      {
        title: 'Giving Trends',
        description: 'A bar chart shows giving amounts over time, helping identify patterns in church contributions.',
        icon: Banknote
      },
      {
        title: 'Membership Growth',
        description: 'A dual-line chart shows total members and new members over time, illustrating church growth.',
        icon: Users
      },
      {
        title: 'Growth Insights',
        description: 'Progress bars show Attendance Rate and Giving Participation Rate as percentages, giving a quick view of engagement levels.',
        icon: BarChart3
      }
    ]
  },
  {
    id: 'settings',
    title: 'System Settings',
    icon: SettingsIcon,
    description: 'Manage users, roles, permissions, two-factor authentication, and theme customization.',
    permissions: ['manage_settings', 'manage_users', 'manage_roles', 'manage_theme'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'User Management',
        description: 'View all system users with search and filter. Approve or reject pending sign-up requests. Create new users with name, email, phone, role, and password. Stats show total users by role.',
        icon: Users,
        note: 'Admin can manage users (except Dev accounts). Dev has full user management.'
      },
      {
        title: 'Grant Temporary Permissions',
        description: 'Select a Pastor or Elder user, click "Grant Permission", choose from available permissions, and set a duration (1 hour, 3 hours, 6 hours, 12 hours, 24 hours, 48 hours, or 1 week). The permission appears with a countdown timer and can be revoked early.',
        icon: Clock,
        note: 'Only Admin and Dev can grant permissions. Permissions auto-expire after the set duration.'
      },
      {
        title: 'Role Permissions Overview',
        description: 'View a grid showing which permissions each role has. Green indicates the role has the permission, gray means it lacks it. Dev has all permissions. Admin has most write permissions. Pastor and Elder are view-only by default.',
        icon: Shield,
        note: 'Only Dev can modify base role permissions and create custom roles.'
      },
      {
        title: 'Two-Factor Authentication (2FA)',
        description: 'In the Security tab (available to all users), choose your 2FA method: Off (password only), Email OTP (6-digit code sent to your email), or Phone SMS (6-digit code sent via SMS). Save your preference.',
        icon: Smartphone,
        note: 'When 2FA is enabled, you must enter the OTP code after your password during login.'
      },
      {
        title: 'Theme Customization',
        description: 'Dev users can customize the system appearance: primary, secondary, and accent colors using color pickers with hex values. Click "Apply Colors" to save or "Reset to Default" to restore original colors.',
        icon: SettingsIcon,
        note: 'Only Dev role can change theme colors. Changes apply to both light and dark modes.'
      }
    ]
  }
];

export function Help() {
  const { user, canAccess, isDev, isAdmin } = useAuth();

  // Filter guides based on user role and permissions
  const availableGuides = featureGuides.filter(guide => {
    if (!guide.availableFor.includes(user?.role || '')) return false;
    return guide.permissions.some(permission => canAccess(permission));
  });

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      dev: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      pastor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      elder: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      dev: 'Developer',
      admin: 'Administrator',
      pastor: 'Pastor',
      elder: 'Elder'
    };
    return labels[role as keyof typeof labels] || role;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl">Help & Guide</h1>
            <p className="text-muted-foreground">
              Learn how to use the Church Management System
            </p>
          </div>
        </div>

        {/* Current Role Info */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center gap-2 flex-wrap">
              <span>You are logged in as:</span>
              <Badge className={getRoleBadgeColor(user?.role || '')}>
                {getRoleLabel(user?.role || '')}
              </Badge>
              {isDev && (
                <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                  Supreme Access
                </Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>

      {/* Quick Start Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Quick Start
          </CardTitle>
          <CardDescription>
            Get started with the basics based on your role
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.role === 'dev' && (
            <div className="space-y-2">
              <h3 className="font-medium">Developer Role</h3>
              <p className="text-sm text-muted-foreground">
                As a Developer, you have supreme access to all features:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Full CRUD on members, visitors, attendance, and giving</li>
                <li>Create and modify user roles and permissions</li>
                <li>Customize system theme and colors</li>
                <li>Grant temporary permissions to Pastor/Elder users</li>
                <li>Override all edit windows (attendance 12h, giving 3h)</li>
                <li>Manage custom services and giving types</li>
                <li>Access all reports and analytics</li>
                <li>Approve/reject user sign-ups and manage all accounts</li>
              </ul>
            </div>
          )}

          {user?.role === 'admin' && (
            <div className="space-y-2">
              <h3 className="font-medium">Administrator Role</h3>
              <p className="text-sm text-muted-foreground">
                As an Administrator, you have full access to most operations:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Add, edit, and delete members and visitors</li>
                <li>Record general and individual attendance</li>
                <li>Record service giving and manage custom giving types</li>
                <li>Manage custom service types</li>
                <li>View and edit records within edit windows (12h attendance, 3h giving)</li>
                <li>Grant temporary permissions to Pastor/Elder roles</li>
                <li>Approve/reject user sign-ups and manage user accounts (except Dev)</li>
                <li>Export data as CSV, Excel, or PDF</li>
                <li>View all reports and analytics</li>
              </ul>
            </div>
          )}

          {user?.role === 'pastor' && (
            <div className="space-y-2">
              <h3 className="font-medium">Pastor Role</h3>
              <p className="text-sm text-muted-foreground">
                As a Pastor, you have view access to all information:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>View all member profiles, family trees, and attendance analytics</li>
                <li>View attendance records (both individual and general)</li>
                <li>View giving records and financial breakdowns</li>
                <li>Access all reports and analytics</li>
                <li>Configure your own 2FA security settings</li>
              </ul>
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  To add, edit, or delete records, you need temporary permissions granted by an Admin or Dev user.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {user?.role === 'elder' && (
            <div className="space-y-2">
              <h3 className="font-medium">Elder Role</h3>
              <p className="text-sm text-muted-foreground">
                As an Elder, you have view access to all information:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>View all member profiles, family trees, and attendance analytics</li>
                <li>View attendance records (both individual and general)</li>
                <li>View giving records and financial breakdowns</li>
                <li>Access all reports and analytics</li>
                <li>Configure your own 2FA security settings</li>
              </ul>
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  To add, edit, or delete records, you need temporary permissions granted by an Admin or Dev user.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Guides */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Guides</CardTitle>
          <CardDescription>
            Detailed step-by-step guides for each feature available to your role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {availableGuides.map((guide) => {
              const Icon = guide.icon;
              return (
                <AccordionItem key={guide.id} value={guide.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-primary" />
                      <span>{guide.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      <p className="text-sm text-muted-foreground">
                        {guide.description}
                      </p>

                      <div className="space-y-3">
                        {guide.steps.map((step, index) => {
                          const StepIcon = step.icon;
                          return (
                            <div
                              key={index}
                              className="flex gap-3 p-3 bg-muted/50 rounded-lg"
                            >
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <StepIcon className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <h4 className="font-medium text-sm">
                                  {index + 1}. {step.title}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {step.description}
                                </p>
                                {step.note && (
                                  <Alert className="mt-2">
                                    <AlertCircle className="h-3 w-3" />
                                    <AlertDescription className="text-xs">
                                      {step.note}
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Edit Windows Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Edit Windows
          </CardTitle>
          <CardDescription>
            Records can only be edited within a limited time after creation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h4 className="font-medium text-sm">Attendance Records</h4>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800">12 hours</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Attendance records can be edited within 12 hours of creation. After that, they lock to view-only. The remaining time is shown as a countdown badge on each record.
              </p>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="w-4 h-4 text-green-600" />
                <h4 className="font-medium text-sm">Giving Records</h4>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-green-100 text-green-800">3 hours</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Giving records can be edited within 3 hours of creation. After that, they lock to view-only. The remaining time is shown as a countdown badge on each record.
              </p>
            </div>
          </div>

          <Alert>
            <Unlock className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="text-sm"><strong>Badge Guide:</strong></p>
                <div className="flex flex-wrap gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs"><Unlock className="w-3 h-3 text-green-600" /> Green badge = editable, shows countdown</span>
                  <span className="flex items-center gap-1 text-xs"><Lock className="w-3 h-3 text-gray-500" /> Gray badge = locked, view-only</span>
                  <span className="flex items-center gap-1 text-xs"><Unlock className="w-3 h-3 text-purple-600" /> "Dev" badge = Dev override access</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Attendance Types Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Attendance Types
          </CardTitle>
          <CardDescription>
            Two types of attendance can be recorded for each service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-orange-100 text-orange-800">Individual</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Mark each member as Present or Absent by name. This is the attendance that:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Determines member status (Active, Semi-Active, Inactive)</li>
                <li>Shows in each member's profile attendance analytics</li>
                <li>Triggers the Absentee Review workflow</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-100 text-blue-800">Head Count</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Record the total number of people present. This attendance:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Feeds church attendance trends and reports</li>
                <li>Does NOT affect individual member statuses</li>
                <li>Is preferred for trend charts and analytics</li>
              </ul>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Both types can be recorded for the same service on the same date. They serve different purposes and are tracked separately.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Permission System Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Roles & Permissions
          </CardTitle>
          <CardDescription>
            How the role-based permission system works
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                  Developer
                </Badge>
                <Shield className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-sm">
                Supreme access to all features. Can create custom roles, modify base permissions,
                change theme colors, manage all user accounts, override edit windows, and perform all operations.
              </p>
            </div>

            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                  Administrator
                </Badge>
              </div>
              <p className="text-sm">
                Full access to view and write operations. Can manage all records, users (except Dev accounts),
                custom services, custom giving types, and grant temporary permissions to Pastor/Elder.
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                  Pastor
                </Badge>
              </div>
              <p className="text-sm">
                View-only access by default. Can view all members, attendance, giving, and reports.
                Can receive temporary write permissions from Admin or Dev users.
              </p>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  Elder
                </Badge>
              </div>
              <p className="text-sm">
                View-only access by default. Can view all members, attendance, giving, and reports.
                Can receive temporary write permissions from Admin or Dev users.
              </p>
            </div>
          </div>

          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Temporary Permissions:</strong> Admin and Dev can grant temporary permissions
              to Pastor and Elder roles. Choose from durations: 1 hour, 3 hours, 6 hours, 12 hours,
              24 hours, 48 hours, or 1 week. Permissions auto-expire and can be revoked early.
              Active temporary permissions show a countdown timer.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Currency</h4>
            <p className="text-sm text-muted-foreground">
              All financial records use Ghana Cedis (GH₵). Foreign currency contributions can be recorded with their GHS equivalent using supported currencies: USD, EUR, GBP, CAD, AUD, CHF, NGN, ZAR, CNY, JPY.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Zones</h4>
            <p className="text-sm text-muted-foreground">
              Members are organized into zones:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline">A - Abossey Okai</Badge>
              <Badge variant="outline">B - Bubiashie</Badge>
              <Badge variant="outline">F - Floating</Badge>
              <Badge variant="outline">K - Kasoa</Badge>
              <Badge variant="outline">M - Mataheko</Badge>
              <Badge variant="outline">R - Russia</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Sunday Main Service</h4>
            <p className="text-sm text-muted-foreground">
              The default service type is Sunday Main Service (8:00 AM - 1:00 PM). Custom service types can be created by users with manage_services permission.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Data Export</h4>
            <p className="text-sm text-muted-foreground">
              Members and Giving records can be exported as CSV, Excel (XLSX), or PDF. Exports respect active search filters and selections.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Two-Factor Authentication</h4>
            <p className="text-sm text-muted-foreground">
              All users can enable 2FA in Settings &gt; Security. Choose between Email OTP or Phone SMS OTP. When enabled, a 6-digit code is required after password entry during login.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Account Approval</h4>
            <p className="text-sm text-muted-foreground">
              New user sign-ups require approval from an Admin or Dev user before the account becomes active. Pending accounts can be approved or rejected in Settings &gt; Users.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
