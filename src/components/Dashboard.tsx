import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Users, Calendar, DollarSign, Plus, TrendingUp } from 'lucide-react';
import { useAuth } from './AuthContext';
import { formatGhanaCedis } from './ui/utils';

interface DashboardProps {
  onNavigate: (page: string) => void;
  onQuickAction: (action: string) => void;
}

export function Dashboard({ onNavigate, onQuickAction }: DashboardProps) {
  const { user, canAccess } = useAuth();

  // Mock data - in real app, this would come from API
  const stats = {
    totalMembers: 355,
    attendanceThisWeek: 187,
    givingThisMonth: 38500.00, // Ghana Cedis amount
    newMembersThisMonth: 12
  };

  const quickActions = [
    {
      id: 'add-member',
      label: 'Add New Member',
      icon: Users,
      description: 'Register a new church member',
      permission: 'manage_members'
    },
    {
      id: 'record-attendance',
      label: 'Record Attendance',
      icon: Calendar,
      description: 'Mark attendance for today\'s service',
      permission: 'record_attendance'
    },
    {
      id: 'record-giving',
      label: 'Record Giving',
      icon: DollarSign,
      description: 'Add offering or donation record',
      permission: 'record_giving'
    },
    {
      id: 'add-visitor',
      label: 'Add Visitor',
      icon: Users,
      description: 'Register a new church visitor',
      permission: 'manage_members'
    },
    {
      id: 'mark-attendance',
      label: 'Mark Individual Attendance',
      icon: Calendar,
      description: 'Quick attendance marking for a member',
      permission: 'record_attendance'
    }
  ];

  const filteredQuickActions = quickActions.filter(action =>
    canAccess(action.permission)
  );

  const recentActivity = [
    { id: 1, type: 'member', message: 'Akosua Adjei registered as new member', time: '2 hours ago' },
    { id: 2, type: 'attendance', message: 'Sunday Service attendance recorded (187 present)', time: '1 day ago' },
    { id: 3, type: 'giving', message: 'Sunday Morning Service giving recorded (GH₵ 11,000.00 total)', time: '1 day ago' },
    { id: 4, type: 'member', message: 'Yaw Boateng updated contact information', time: '2 days ago' },
    { id: 5, type: 'giving', message: 'Midweek Service giving recorded (GH₵ 3,800.00 total)', time: '3 days ago' },
    { id: 6, type: 'attendance', message: 'Midweek Bible Study attendance recorded (95 present)', time: '4 days ago' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="mb-2">Welcome back, {user?.name}!</h1>
        <p className="text-muted-foreground">
          Here's what's happening in your church today.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('members')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Members</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.newMembersThisMonth} new this month
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('attendance')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">This Week's Attendance</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attendanceThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              54.7% of total members
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('giving')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Monthly Giving</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatGhanaCedis(stats.givingThisMonth)}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3 inline mr-1" />
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('reports')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Growth Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+2.3%</div>
            <p className="text-xs text-muted-foreground">
              Monthly growth
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <Button
                    variant="outline"
                    className="w-full h-auto p-4 flex flex-col items-center gap-3"
                    onClick={() => onQuickAction(action.id)}
                  >
                    <Icon className="w-8 h-8 text-primary" />
                    <div className="text-center">
                      <div className="font-medium">{action.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {action.description}
                      </div>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="mb-4">Recent Activity</h2>
        <Card>
          <CardContent className="p-0">
            {recentActivity.map((activity, index) => (
              <div
                key={activity.id}
                className={`p-4 flex items-start gap-3 ${
                  index !== recentActivity.length - 1 ? 'border-b' : ''
                }`}
              >
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm">{activity.message}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}