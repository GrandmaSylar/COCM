import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Users, Calendar, DollarSign, Plus, TrendingUp, UserPlus, ChevronRight } from 'lucide-react';
import { useAuth } from './AuthContext';
import { formatGhanaCedis } from './ui/utils';
import { useState } from 'react';
import { api } from '../services/api';
import { useCachedData } from '../hooks/useCachedData';

interface DashboardProps {
  onNavigate: (page: string) => void;
  onQuickAction: (action: string) => void;
}

export function Dashboard({ onNavigate, onQuickAction }: DashboardProps) {
  const { user, canAccess, hasTabAccess } = useAuth();

  const { data: statsData, loading } = useCachedData(
    'dashboard-stats',
    () => api.stats.getDashboard(),
    { duration: 2 * 60 * 1000 } // 2 minutes
  );

  const stats = {
    totalMembers: statsData?.totalMembers || 0,
    attendanceThisWeek: statsData?.attendanceThisWeek || 0,
    givingThisMonth: statsData?.givingThisMonth || 0,
    newMembersThisMonth: statsData?.newMembersThisMonth || 0,
  };

  const quickActions = [
    {
      id: 'add-member',
      label: 'Add New Member',
      icon: Users,
      description: 'Register a new church member',
      permission: 'manage_members',
      tab: 'members'
    },
    {
      id: 'record-attendance',
      label: 'Record Attendance',
      icon: Calendar,
      description: 'Mark attendance for today\'s service',
      permission: 'record_attendance',
      tab: 'attendance'
    },
    {
      id: 'record-giving',
      label: 'Record Giving',
      icon: DollarSign,
      description: 'Add offering or donation record',
      permission: 'record_giving',
      tab: 'giving'
    },
    {
      id: 'add-visitor',
      label: 'Add Visitor',
      icon: Users,
      description: 'Register a new church visitor',
      permission: 'manage_members',
      tab: 'visitors'
    },
    {
      id: 'mark-attendance',
      label: 'Mark Individual Attendance',
      icon: Calendar,
      description: 'Quick attendance marking for a member',
      permission: 'record_attendance',
      tab: 'attendance'
    }
  ];

  const filteredQuickActions = quickActions.filter(action =>
    canAccess(action.permission) && hasTabAccess(action.tab)
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
      <div className="mb-2">
        <h1 className="text-2xl font-semibold mb-1">Welcome back, {user?.name}!</h1>
        <p className="text-muted-foreground">
          Here's what's happening in your church today.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
        <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-sm overflow-hidden" onClick={() => onNavigate('members')}>
          <CardContent className="p-0">
            <div className="flex items-stretch">
              <div className="w-2 bg-secondary" />
              <div className="flex-1 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Total Members</span>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight">{stats.totalMembers}</div>
                {stats.newMembersThisMonth > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +{stats.newMembersThisMonth} new this month
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-sm overflow-hidden" onClick={() => onNavigate('attendance')}>
          <CardContent className="p-0">
            <div className="flex items-stretch">
              <div className="w-2 bg-amber-500" />
              <div className="flex-1 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">This Week's Attendance</span>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight">{stats.attendanceThisWeek}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-sm overflow-hidden" onClick={() => onNavigate('giving')}>
          <CardContent className="p-0">
            <div className="flex items-stretch">
              <div className="w-2 bg-emerald-500" />
              <div className="flex-1 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">Monthly Giving</span>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight">{formatGhanaCedis(stats.givingThisMonth)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
          {filteredQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onQuickAction(action.id)}
                className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-secondary/30 hover:border-secondary hover:bg-secondary/5 transition-all hover:shadow-sm group text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-secondary/15 to-secondary/5 group-hover:from-secondary/25 group-hover:to-secondary/10 flex items-center justify-center transition-colors shrink-0">
                  <Icon className="w-5 h-5 text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{action.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {action.description}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <Card className="shadow-sm">
            <CardContent className="p-0">
              {recentActivity.map((activity, index) => (
                <div
                  key={activity.id}
                  className={`p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors ${
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