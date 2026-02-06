import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  Users, 
  Calendar, 
  DollarSign, 
  BarChart3, 
  Settings, 
  Shield,
  UserCheck,
  Coins,
  BookOpen
} from 'lucide-react';

export function DemoGuide() {
  const features = [
    {
      module: 'Dashboard',
      icon: BookOpen,
      description: 'Overview of church statistics and quick actions',
      demoPoints: [
        'View summary cards with key metrics',
        'Access quick actions for common tasks',
        'See recent activity feed'
      ],
      allRoles: true
    },
    {
      module: 'Members',
      icon: Users,
      description: 'Comprehensive member management system',
      demoPoints: [
        'Browse member directory with search and filters',
        'View detailed member profiles with attendance/giving history',
        'Add new members with complete information forms'
      ],
      roles: ['admin', 'pastor']
    },
    {
      module: 'Attendance',
      icon: Calendar,
      description: 'Service attendance tracking and reporting',
      demoPoints: [
        'Record attendance for different service types',
        'View attendance trends and statistics',
        'Mark individual members present'
      ],
      roles: ['admin', 'pastor']
    },
    {
      module: 'Giving',
      icon: DollarSign,
      description: 'Financial contributions management',
      demoPoints: [
        'Record tithes, offerings, and donations',
        'Track payment methods (cash, mobile money, card, bank)',
        'View giving history and financial reports'
      ],
      roles: ['admin', 'finance']
    },
    {
      module: 'Reports',
      icon: BarChart3,
      description: 'Analytics and insights dashboard',
      demoPoints: [
        'Interactive charts for attendance and giving trends',
        'Membership growth analytics',
        'Key performance indicators and metrics'
      ],
      allRoles: true
    },
    {
      module: 'Settings',
      icon: Settings,
      description: 'User management and system configuration',
      demoPoints: [
        'Manage system users and their roles',
        'View role-based permissions',
        'Add new users with different access levels'
      ],
      roles: ['admin']
    }
  ];

  const roleInfo = [
    {
      role: 'Developer',
      color: 'bg-purple-100 text-purple-800',
      icon: Shield,
      description: 'Supreme access - Role management & theme customization',
      permissions: ['All Permissions', 'Create Custom Roles', 'Assign Roles', 'Customize Theme Colors']
    },
    {
      role: 'Administrator',
      color: 'bg-red-100 text-red-800',
      icon: Shield,
      description: 'Full access - Can grant temporary permissions',
      permissions: ['Manage Users', 'Manage Members', 'Record Attendance', 'Manage Giving', 'Grant Temporary Permissions', 'View Reports', 'System Settings']
    },
    {
      role: 'Pastor',
      color: 'bg-blue-100 text-blue-800',
      icon: UserCheck,
      description: 'View-only by default - Admin can grant temporary write access',
      permissions: ['View Members', 'View Attendance', 'View Giving', 'View Reports', 'Manage Giving Types (with permission)']
    },
    {
      role: 'Elder',
      color: 'bg-green-100 text-green-800',
      icon: UserCheck,
      description: 'View-only by default - Admin can grant limited temporary access',
      permissions: ['View Members', 'View Attendance', 'View Giving', 'View Reports']
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1>Demo Guide</h1>
        <p className="text-muted-foreground">
          Explore the Church Management System features and role-based access
        </p>
      </div>

      {/* Role Information */}
      <div>
        <h2 className="mb-4">User Roles & Permissions</h2>
        <p className="text-sm text-muted-foreground mb-4">
          The system features a flexible permission system where Admin can grant temporary permissions to Pastor and Elder roles, and Dev can manage all roles and customize themes.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roleInfo.map((role) => {
            const Icon = role.icon;
            return (
              <Card key={role.role}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="w-5 h-5" />
                    {role.role}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {role.permissions.map((permission) => (
                      <Badge key={permission} variant="outline" className="text-xs mr-1 mb-1">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Feature Overview */}
      <div>
        <h2 className="mb-4">System Features</h2>
        <div className="space-y-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.module}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{feature.module}</h3>
                        {feature.allRoles ? (
                          <Badge variant="outline" className="text-xs">All Roles</Badge>
                        ) : (
                          <div className="flex gap-1">
                            {feature.roles?.map((role) => (
                              <Badge 
                                key={role} 
                                variant="outline" 
                                className={`text-xs ${
                                  role === 'admin' ? 'bg-red-50 text-red-700' :
                                  role === 'pastor' ? 'bg-blue-50 text-blue-700' :
                                  'bg-green-50 text-green-700'
                                }`}
                              >
                                {role === 'admin' ? 'Admin' : role === 'pastor' ? 'Pastor' : 'Finance'}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{feature.description}</p>
                      <div className="space-y-1">
                        {feature.demoPoints.map((point, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                            <span className="text-muted-foreground">{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Demo Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-xs font-medium text-accent-foreground flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-medium text-sm">Switch User Roles</p>
              <p className="text-xs text-muted-foreground">Use the role switcher in the sidebar to experience different permission levels</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-xs font-medium text-accent-foreground flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-medium text-sm">Explore All Features</p>
              <p className="text-xs text-muted-foreground">Navigate through all modules using the sidebar or bottom navigation on mobile</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-xs font-medium text-accent-foreground flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-medium text-sm">Try Interactive Features</p>
              <p className="text-xs text-muted-foreground">Fill out forms, view member profiles, and test all interactive elements</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-xs font-medium text-accent-foreground flex-shrink-0">
              4
            </div>
            <div>
              <p className="font-medium text-sm">Mobile Responsive</p>
              <p className="text-xs text-muted-foreground">Try resizing your browser or use mobile view to see the responsive design</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}