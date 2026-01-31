import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Users, Calendar, DollarSign, Plus } from 'lucide-react';
import { useAuth } from './AuthContext';
import { formatGhanaCedis } from './ui/utils';
import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface DashboardProps {
  onNavigate: (page: string) => void;
  onQuickAction: (action: string) => void;
}

export function Dashboard({ onNavigate, onQuickAction }: DashboardProps) {
  const { user, canAccess } = useAuth();
  const [stats, setStats] = useState({
    totalMembers: 0,
    attendanceThisWeek: 0,
    givingThisMonth: 0,
    newMembersThisMonth: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.stats.getDashboard();
        setStats({
          totalMembers: data.totalMembers || 0,
          attendanceThisWeek: data.attendanceThisWeek || 0,
          givingThisMonth: data.givingThisMonth || 0,
          newMembersThisMonth: data.newMembersThisMonth || 0
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

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

  const recentActivity: any[] = [];

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Welcome Header Skeleton */}
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="w-4 h-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions Skeleton */}
        <div>
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity Skeleton */}
        <div>
          <Skeleton className="h-6 w-32 mb-4" />
          <Card>
            <CardContent className="p-4 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="w-2 h-2 rounded-full mt-2" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('giving')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">Monthly Giving</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatGhanaCedis(stats.givingThisMonth)}</div>
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
      {recentActivity.length > 0 && (
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
      )}
    </div>
  );
}