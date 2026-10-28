import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { EmptyState, Group, GroupRow, IconTile, LargeTitle } from './ui/ios';
import { PullToRefresh } from './ui/ios-gestures';
import { Users, Calendar, Banknote, TrendingUp, ChevronRight, RefreshCw, LayoutDashboard, Lock } from 'lucide-react';
import { useAuth } from './AuthContext';
import { formatGhanaCedis } from './ui/utils';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useCachedData } from '../hooks/useCachedData';
import { useTutorial } from './TutorialContext';
import { supabase } from '@cms/shared';

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
    isWidgetVisible('widget_quick_actions') && canAccess(action.permission) && hasTabAccess(action.tab)
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
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const statTiles = [
    {
      id: 'widget_total_members',
      tab: 'members',
      icon: Users,
      tone: 'info' as const,
      label: 'Total Members',
      value: String(stats.totalMembers),
      extra: stats.newMembersThisMonth > 0 ? `+${stats.newMembersThisMonth} this month` : null,
    },
    {
      id: 'widget_attendance_week',
      tab: 'attendance',
      icon: Calendar,
      tone: 'warning' as const,
      label: 'Attendance This Week',
      value: String(stats.attendanceThisWeek),
      extra: null,
    },
    {
      id: 'widget_giving_month',
      tab: 'giving',
      icon: Banknote,
      tone: 'success' as const,
      label: 'Giving This Month',
      value: formatGhanaCedis(stats.givingThisMonth),
      extra: null,
    },
  ].filter((tile) => isWidgetVisible(tile.id));

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6 pb-6">
        <LargeTitle
          title={
            <>
              {timeOfDay}, <span className="text-primary-text">{user?.name}</span>
            </>
          }
          subtitle="Here's an overview of your church's activity today."
          actions={
            <Button variant="soft" size="sm" onClick={handleRefresh} disabled={refreshing} className="hidden sm:inline-flex">
              <RefreshCw className={`mr-2 size-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        {statTiles.length > 0 && (
          <div id="dashboard-stats" className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {statTiles.map((tile) => {
              const allowed = hasTabAccess(tile.tab);
              const body = (
                <>
                  <div className="flex items-start justify-between">
                    <IconTile icon={tile.icon} tone={tile.tone} />
                    {allowed ? (
                      <ChevronRight className="size-4 text-muted-foreground/60" />
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3" />
                        Restricted
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-[32px] font-bold leading-none tracking-tight tabular-nums">{allowed ? tile.value : '—'}</div>
                  <div className="mt-1 text-[15px] text-muted-foreground">{tile.label}</div>
                  {allowed && tile.extra ? (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-text">
                      <TrendingUp className="size-3" />
                      {tile.extra}
                    </div>
                  ) : null}
                </>
              );
              return allowed ? (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => onNavigate(tile.tab)}
                  className="rounded-xl bg-card p-4 text-left transition-colors active:bg-accent"
                >
                  {body}
                </button>
              ) : (
                <div key={tile.id} className="rounded-xl bg-card p-4">
                  {body}
                </div>
              );
            })}
          </div>
        )}

        {isWidgetVisible('widget_quick_actions') && filteredQuickActions.length > 0 && (
          <div id="dashboard-quick-actions">
            <Group title="Quick Actions">
              {filteredQuickActions.map((action) => (
                <GroupRow
                  key={action.id}
                  icon={action.icon}
                  iconTone="primary"
                  title={action.label}
                  subtitle={action.description}
                  onClick={() => onQuickAction(action.id)}
                />
              ))}
            </Group>
          </div>
        )}

        {/* Empty state for custom role users with no widgets configured */}
        {isCustomRoleUser && visibleWidgets!.size === 0 && (
          <Group>
            <EmptyState icon={LayoutDashboard} title="No dashboard widgets configured" description="No dashboard widgets are configured for your role." />
          </Group>
        )}

        <Group title="Recent Activity">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => <GroupRow key={activity.id} title={activity.message} subtitle={activity.time} className="[&_span:first-child]:whitespace-normal" />)
          ) : (
            <EmptyState icon={TrendingUp} title="No recent activity" description="Recent actions performed by you or your team will appear here." className="py-8" />
          )}
        </Group>
      </div>
    </PullToRefresh>
  );
}
