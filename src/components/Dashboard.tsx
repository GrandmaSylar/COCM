import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { EmptyState } from './EmptyState';
import { Users, Calendar, Banknote, Plus, TrendingUp, UserPlus, ChevronRight, RefreshCw, LayoutDashboard } from 'lucide-react';
import { useAuth } from './AuthContext';
import { formatGhanaCedis } from './ui/utils';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useCachedData } from '../hooks/useCachedData';
import { useTutorial } from './TutorialContext';
import { supabase } from '../utils/supabase/client';

interface DashboardProps {
  onNavigate: (page: string) => void;
  onQuickAction: (action: string) => void;
}

export function Dashboard({ onNavigate, onQuickAction }: DashboardProps) {
  const { user, canAccess, hasTabAccess } = useAuth();
  const { startTutorial, hasSeenTutorial } = useTutorial();

  // Widget visibility gating for custom role users
  const SYSTEM_ROLES = ['dev', 'admin', 'pastor', 'elder'];
  const isCustomRoleUser = !!user && !SYSTEM_ROLES.includes(user.role);
  
  const visibleWidgets = isCustomRoleUser && user?.customRoleDefinition
    ? new Set(user.customRoleDefinition.dashboard_widgets)
    : isCustomRoleUser 
      ? new Set<string>() // treat missing as empty widget set for non-system roles
      : null;

  const isWidgetVisible = (widgetId: string): boolean => {
    if (!isCustomRoleUser) return true; // system role — always show all
    return visibleWidgets!.has(widgetId);
  };


  useEffect(() => {
    if (!user) return;

    // Check if user is "freshly created" (e.g. within last 24 hours)
    const isNewUser = user.createdAt 
        ? (Date.now() - new Date(user.createdAt).getTime()) < 24 * 60 * 60 * 1000 
        : false;

    // Check if user has access to at least one restricted tab
    // (Restricted tabs are those explicitly granted in tabAccess)
    const hasRestrictedAccess = user.tabAccess && user.tabAccess.length > 0;

    const timer = setTimeout(() => {
        if (isNewUser && hasRestrictedAccess && !hasSeenTutorial('dashboard')) {
            startTutorial('dashboard');
        }
    }, 1000);
    return () => clearTimeout(timer);
  }, [user, hasSeenTutorial, startTutorial]);

  const { data: statsData, loading, refresh } = useCachedData(
    'dashboard-stats',
    () => api.stats.getDashboard(),
    { duration: 2 * 60 * 1000 } // 2 minutes
  );
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

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
      icon: Banknote,
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

  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchRecentActivity = async () => {
      try {
        const data = await api.activityLog.getAll({ limit: 5 });
        if (data?.logs) {
          const formatted = data.logs.map((log: any) => {
            const date = new Date(log.createdAt);
            const today = new Date();
            const isToday = date.getDate() === today.getDate() && 
                            date.getMonth() === today.getMonth() && 
                            date.getFullYear() === today.getFullYear();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return {
              id: log.id,
              message: log.description || `${log.userName} performed ${log.action}`,
              time: isToday ? timeStr : `${date.toLocaleDateString()} ${timeStr}`
            };
          });
          setRecentActivity(formatted);
        }
      } catch (err) {
        console.error('Failed to fetch recent activity:', err);
      }
    };

    fetchRecentActivity();

    // Subscribe to realtime updates for recent activity
    const channel = supabase.channel('dashboard-activity-log')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_log' },
        () => {
          fetchRecentActivity();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const timeOfDay = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Welcome Header Skeleton */}
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-xl" />
            <Skeleton className="h-4 w-96 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>

        {/* Quick Actions Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-7 w-40 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {timeOfDay}, <span className="text-gradient">{user?.name}</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Here's an overview of your church's activity today.
          </p>
        </div>
        <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={refreshing}
            className="hidden sm:flex hover:bg-primary/5 hover:text-primary transition-colors border-primary/20"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* Summary Cards */}
      <div id="dashboard-stats" className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
        {/* Members Card */}
        {isWidgetVisible('widget_total_members') && (
        <div onClick={() => onNavigate('members')} className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-blue-500/30 via-blue-500/15 to-transparent border border-blue-500/25 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-30 transition-opacity">
                <Users className="w-24 h-24 text-blue-600" />
            </div>
            <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 text-blue-600 group-hover:scale-110 transition-transform duration-300">
                    <Users className="w-6 h-6" />
                </div>
                <div className="text-4xl font-bold tracking-tighter text-foreground mb-1 group-hover:translate-x-1 transition-transform">
                    {stats.totalMembers}
                </div>
                <div className="text-sm font-medium text-muted-foreground">Total Members</div>
                {stats.newMembersThisMonth > 0 && (
                  <div className="mt-3 inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +{stats.newMembersThisMonth} this month
                  </div>
                )}
            </div>
        </div>
        )}

        {/* Attendance Card */}
        {isWidgetVisible('widget_attendance_week') && (
        <div onClick={() => onNavigate('attendance')} className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-amber-500/30 via-amber-500/15 to-transparent border border-amber-500/25 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/25 hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-30 transition-opacity">
                <Calendar className="w-24 h-24 text-amber-600" />
            </div>
            <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4 text-amber-600 group-hover:scale-110 transition-transform duration-300">
                    <Calendar className="w-6 h-6" />
                </div>
                <div className="text-4xl font-bold tracking-tighter text-foreground mb-1 group-hover:translate-x-1 transition-transform">
                    {stats.attendanceThisWeek}
                </div>
                <div className="text-sm font-medium text-muted-foreground">Attendance This Week</div>
            </div>
        </div>
        )}

        {/* Giving Card */}
        {isWidgetVisible('widget_giving_month') && (
        <div onClick={() => onNavigate('giving')} className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-emerald-500/30 via-emerald-500/15 to-transparent border border-emerald-500/25 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-30 transition-opacity">
                <Banknote className="w-24 h-24 text-emerald-600" />
            </div>
            <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 text-emerald-600 group-hover:scale-110 transition-transform duration-300">
                    <Banknote className="w-6 h-6" />
                </div>
                <div className="text-4xl font-bold tracking-tighter text-foreground mb-1 group-hover:translate-x-1 transition-transform">
                    {formatGhanaCedis(stats.givingThisMonth)}
                </div>
                <div className="text-sm font-medium text-muted-foreground">Giving This Month</div>
            </div>
        </div>
        )}
      </div>

      {/* Quick Actions */}
      {isWidgetVisible('widget_quick_actions') && (
      <div id="dashboard-quick-actions" className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-xl font-semibold mb-5 flex items-center text-foreground/90">
            Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filteredQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onQuickAction(action.id)}
                className="group flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:bg-accent/50 hover:border-primary/20 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 text-left relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform duration-300 z-10 shadow-sm">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0 z-10">
                  <div className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">{action.label}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate group-hover:text-muted-foreground/80">
                    {action.description}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 z-10" />
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Empty state for custom role users with no widgets configured */}
      {isCustomRoleUser && visibleWidgets!.size === 0 && (
        <EmptyState
          title="No dashboard widgets configured"
          description="No dashboard widgets are configured for your role."
          icon={LayoutDashboard}
          className="border border-border/50 rounded-2xl bg-card/50 backdrop-blur-sm py-8"
        />
      )}

      {/* Recent Activity */}
      <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-xl font-semibold mb-5 text-foreground/90">Recent Activity</h2>
          {recentActivity.length > 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm">
              {recentActivity.map((activity, index) => (
                <div
                  key={activity.id}
                  className={`p-5 flex items-start gap-4 hover:bg-accent/30 transition-colors ${
                    index !== recentActivity.length - 1 ? 'border-b border-border/50' : ''
                  }`}
                >
                  <div className="w-2.5 h-2.5 bg-primary rounded-full mt-2 flex-shrink-0 shadow-sm shadow-primary/50" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{activity.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState 
                title="No recent activity" 
                description="Recent actions performed by you or your team will appear here." 
                icon={TrendingUp}
                className="border border-border/50 rounded-2xl bg-card/50 backdrop-blur-sm py-8"
            />
          )}
      </div>
    </div>
  );
}
