import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { 
  HelpCircle, 
  Users, 
  UserPlus, 
  Calendar, 
  DollarSign, 
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
  Video,
  FileText
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
    id: 'members',
    title: 'Member Management',
    icon: Users,
    description: 'Learn how to view, add, edit, and manage church members.',
    permissions: ['view_members', 'manage_members', 'edit_members'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'View Members',
        description: 'Navigate to the Members section from the sidebar. You can search, filter by zone, and view detailed member information.',
        icon: Eye,
        note: 'All roles can view members by default.'
      },
      {
        title: 'Add New Member',
        description: 'Click the "Add Member" button. Fill in member details including personal info, contact, zone, ministries, and family members. Upload a passport-size photo if available.',
        icon: Plus,
        note: 'Only Admin and Dev roles can add members by default. Others need temporary permission.'
      },
      {
        title: 'Edit Member',
        description: 'Open a member profile and click the "Edit" button. Update any information and save changes.',
        icon: Edit,
        note: 'Only Admin and Dev roles can edit members by default. Others need temporary permission.'
      },
      {
        title: 'View Member Profile',
        description: 'Click on any member card to view their complete profile including contact info, ministries, family members, and attendance history.',
        icon: Eye,
        note: 'All roles can view detailed profiles.'
      }
    ]
  },
  {
    id: 'visitors',
    title: 'Visitor Management',
    icon: UserPlus,
    description: 'Track church visitors and convert them to members.',
    permissions: ['view_members', 'manage_members'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'View Visitors',
        description: 'Navigate to the Visitors section to see all church visitors, their visit dates, and follow-up status.',
        icon: Eye,
        note: 'All roles with member view permissions can see visitors.'
      },
      {
        title: 'Add Visitor',
        description: 'Click "Add Visitor" button. Record visitor information including contact details, visit date, service type, and potential zone.',
        icon: Plus,
        note: 'Admin and Dev can add visitors. Others need temporary permission.'
      },
      {
        title: 'Convert to Member',
        description: 'From a visitor profile, click "Convert to Member". The visitor\'s information will pre-populate the member registration form.',
        icon: UserPlus,
        note: 'Requires manage_members permission.'
      }
    ]
  },
  {
    id: 'attendance',
    title: 'Attendance Tracking',
    icon: Calendar,
    description: 'Record and track member attendance for services.',
    permissions: ['view_attendance', 'record_attendance'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'View Attendance',
        description: 'Navigate to Attendance to see attendance records, statistics, and trends over time.',
        icon: Eye,
        note: 'All roles can view attendance records.'
      },
      {
        title: 'Record Attendance',
        description: 'Click "Record Attendance". Select service date, type, and mark present/absent for each member. You can also bulk mark zones.',
        icon: Plus,
        note: 'Only Admin and Dev can record attendance by default.'
      },
      {
        title: 'Mark Individual Attendance',
        description: 'Use "Mark Attendance" for quick individual attendance recording. Search for member and mark their attendance.',
        icon: CheckCircle2,
        note: 'Requires record_attendance permission.'
      }
    ]
  },
  {
    id: 'giving',
    title: 'Giving & Tithes',
    icon: DollarSign,
    description: 'Record and manage tithes, offerings, and donations.',
    permissions: ['view_giving', 'record_giving'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'View Giving Records',
        description: 'Navigate to Giving to see all tithes, offerings, and donation records. Filter by type, date, or member.',
        icon: Eye,
        note: 'All roles can view giving records.'
      },
      {
        title: 'Record Giving',
        description: 'Click "Record Giving". Select member, giving type (Offering/Tithe/Donation/Thanksgiving/Custom), enter amount in Ghana Cedis, and add notes.',
        icon: Plus,
        note: 'Only Admin and Dev can record giving by default.'
      },
      {
        title: 'View Giving Statistics',
        description: 'View total giving by type, monthly trends, and top contributors.',
        icon: BarChart3,
        note: 'Available in the Giving section and Reports.'
      }
    ]
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    icon: BarChart3,
    description: 'View comprehensive reports and analytics.',
    permissions: ['view_reports'],
    availableFor: ['dev', 'admin', 'pastor', 'elder'],
    steps: [
      {
        title: 'Access Reports',
        description: 'Navigate to Reports from the sidebar to access all available reports and analytics.',
        icon: Eye,
        note: 'All roles can view reports.'
      },
      {
        title: 'Membership Reports',
        description: 'View total members, growth trends, member distribution by zone, and demographics.',
        icon: Users,
        note: 'Shows active, inactive, and sabbatical members.'
      },
      {
        title: 'Attendance Reports',
        description: 'Analyze attendance trends, service-wise statistics, and member attendance patterns.',
        icon: Calendar,
        note: 'Includes weekly, monthly, and yearly comparisons.'
      },
      {
        title: 'Financial Reports',
        description: 'Review giving statistics, income trends, and contribution analysis by type and member.',
        icon: DollarSign,
        note: 'All amounts in Ghana Cedis (GHS).'
      }
    ]
  },
  {
    id: 'settings',
    title: 'System Settings',
    icon: SettingsIcon,
    description: 'Manage users, roles, permissions, and system configuration.',
    permissions: ['manage_settings', 'manage_users', 'manage_roles', 'manage_theme'],
    availableFor: ['dev', 'admin'],
    steps: [
      {
        title: 'User Management',
        description: 'Add, edit, or deactivate system users. Assign roles and manage user access.',
        icon: Users,
        note: 'Admin can manage users. Dev has supreme access.'
      },
      {
        title: 'Role & Permission Management',
        description: 'View and modify role permissions. Grant temporary permissions to users for specific tasks.',
        icon: Shield,
        note: 'Only Dev can modify role permissions and create custom roles.'
      },
      {
        title: 'Grant Temporary Permissions',
        description: 'Admin and Dev can grant temporary permissions to Pastor/Elder roles. Set duration in hours.',
        icon: Clock,
        note: 'Permissions automatically expire after the set duration.'
      },
      {
        title: 'Theme Customization',
        description: 'Dev can customize system colors including primary, secondary, accent, background, and foreground colors.',
        icon: SettingsIcon,
        note: 'Only Dev role can change theme colors.'
      }
    ]
  }
];

export function Help() {
  const { user, canAccess, isDev, isAdmin } = useAuth();
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  // Filter guides based on user role and permissions
  const availableGuides = featureGuides.filter(guide => {
    // Check if user's role is in availableFor
    if (!guide.availableFor.includes(user?.role || '')) return false;
    
    // Check if user has at least one required permission
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
                As a Developer, you have supreme access to all features. You can:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Manage all aspects of the system</li>
                <li>Create and modify user roles</li>
                <li>Customize system theme and colors</li>
                <li>Grant temporary permissions to other users</li>
                <li>Access all reports and analytics</li>
                <li>Perform all CRUD operations on members, visitors, attendance, and giving</li>
              </ul>
            </div>
          )}
          
          {user?.role === 'admin' && (
            <div className="space-y-2">
              <h3 className="font-medium">Administrator Role</h3>
              <p className="text-sm text-muted-foreground">
                As an Administrator, you have full access to view and write operations. You can:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Manage members, visitors, attendance, and giving records</li>
                <li>View all reports and analytics</li>
                <li>Grant temporary permissions to Pastor and Elder roles</li>
                <li>Manage system users (except Dev role modifications)</li>
                <li>Configure services and giving types</li>
              </ul>
            </div>
          )}
          
          {user?.role === 'pastor' && (
            <div className="space-y-2">
              <h3 className="font-medium">Pastor Role</h3>
              <p className="text-sm text-muted-foreground">
                As a Pastor, you can view all information by default. You can:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>View all member records and profiles</li>
                <li>View attendance records and statistics</li>
                <li>View giving records and financial reports</li>
                <li>Access all system reports</li>
                <li>Request temporary permissions from Admin/Dev for write operations</li>
              </ul>
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  To add, edit, or delete records, you need temporary permissions from an Admin or Dev user.
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          {user?.role === 'elder' && (
            <div className="space-y-2">
              <h3 className="font-medium">Elder Role</h3>
              <p className="text-sm text-muted-foreground">
                As an Elder, you can view all information by default. You can:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>View all member records and profiles</li>
                <li>View attendance records and statistics</li>
                <li>View giving records and financial reports</li>
                <li>Access all system reports</li>
                <li>Request temporary permissions from Admin/Dev for write operations</li>
              </ul>
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  To add, edit, or delete records, you need temporary permissions from an Admin or Dev user.
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

      {/* Permission System Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Understanding Permissions
          </CardTitle>
          <CardDescription>
            How the permission system works
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
                Supreme access to all features. Can create custom roles, modify permissions, 
                change theme colors, and perform all operations.
              </p>
            </div>

            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                  Administrator
                </Badge>
              </div>
              <p className="text-sm">
                Full access to view and write operations. Can manage all records, users (except Dev), 
                and grant temporary permissions to Pastor/Elder.
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
                Can request temporary permissions for write operations.
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
                Can request temporary permissions for write operations.
              </p>
            </div>
          </div>

          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Temporary Permissions:</strong> Admin and Dev can grant temporary permissions 
              to Pastor and Elder roles. These permissions expire after the set duration (e.g., 24 hours, 7 days) 
              and are automatically removed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Important Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Currency</h4>
            <p className="text-sm text-muted-foreground">
              All financial records use Ghana Cedis (GHS) as the currency.
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
            <h4 className="font-medium text-sm">Service Types</h4>
            <p className="text-sm text-muted-foreground">
              Track attendance for different service types including Sunday Service, Mid-Week Service, 
              Bible Study, Prayer Meeting, and Special Events.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
