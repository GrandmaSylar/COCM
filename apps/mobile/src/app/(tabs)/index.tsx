import React, { useEffect, useState, useCallback } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Users,
  Calendar,
  Banknote,
  Activity,
  RefreshCw,
  UserPlus,
  CalendarCheck,
  UserCheck,
  Inbox,
} from '@tamagui/lucide-icons';
import { supabase } from '../../lib/supabase';
import { getLocalStats } from '../../lib/db';
import { syncMembers } from '../../lib/syncEngine';
import { useAccess } from '../../lib/access';
import { useAppColors } from '../../context/ThemeContext';
import { SkeletonDashboard } from '../../components/Skeleton';
import {
  AppText, Button, EmptyState, IconButton, IconWell, ListRow, PressableScale, Section, StatTile,
} from '../../components/ui';
import { enterUp } from '../../theme/animations';
import { radius, space } from '../../theme/tokens';

const STATS_CACHE_KEY = '@cocm_mobile_dashboard_stats';
const ACTIVITY_CACHE_KEY = '@cocm_mobile_dashboard_activities';

interface Stats {
  totalMembers: number;
  attendanceThisWeek: number;
  givingThisMonth: number;
  newMembersThisMonth: number;
}

interface ActivityItem {
  id: string;
  message: string;
  time: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const c = useAppColors();
  const { can, canRoute } = useAccess();
  const [userName, setUserName] = useState('Leader');
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    attendanceThisWeek: 0,
    givingThisMonth: 0,
    newMembersThisMonth: 0,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Instant 0ms Embedded SQLite & Storage Load
  useEffect(() => {
    const loadLocalDbStats = async () => {
      try {
        const localStats = await getLocalStats();
        if (localStats.totalMembers > 0 || localStats.givingThisMonth > 0) {
          setStats(localStats);
        }

        const cachedActivitiesStr = await AsyncStorage.getItem(ACTIVITY_CACHE_KEY);
        if (cachedActivitiesStr) {
          setActivities(JSON.parse(cachedActivitiesStr));
        }
      } catch (err) {
        console.warn('Failed reading embedded SQLite stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLocalDbStats();
  }, []);

  // 2. Direct Supabase Query & SQLite Seeding Engine
  const fetchDashboardData = useCallback(async () => {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Leader';
        setUserName(name);
      }

      // Compute Date Boundaries
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const dayOfWeek = now.getDay();
      const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const firstDayOfWeek = new Date(now.setDate(diffToMonday));
      firstDayOfWeek.setHours(0, 0, 0, 0);
      const firstDayOfWeekIso = firstDayOfWeek.toISOString();

      // Query Database Tables directly for resilience & accuracy
      const [membersCountRes, newMembersRes, givingRes, attendanceRes, activityLogRes] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }),
        supabase.from('members').select('id', { count: 'exact', head: true }).gte('created_at', firstDayOfMonth),
        supabase.from('giving_records').select('amount').gte('date', firstDayOfMonth.split('T')[0]),
        supabase.from('attendance_entries').select('id', { count: 'exact', head: true }).gte('created_at', firstDayOfWeekIso),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(5)
      ]);

      // Calculate total giving sum
      const totalGiving = givingRes.data 
        ? givingRes.data.reduce((sum, item: any) => sum + (Number(item.amount) || 0), 0)
        : 0;

      const newStats: Stats = {
        totalMembers: membersCountRes.count || 0,
        newMembersThisMonth: newMembersRes.count || 0,
        attendanceThisWeek: attendanceRes.count || 0,
        givingThisMonth: totalGiving,
      };

      setStats(newStats);
      AsyncStorage.setItem(STATS_CACHE_KEY, JSON.stringify(newStats)).catch(() => {});

      // Seed the local SQLite roster on first run (normally done by the startup sync)
      const sqliteStats = await getLocalStats();
      if (sqliteStats.totalMembers === 0 && membersCountRes.count) {
        await syncMembers();
      }

      // Process Activity Logs
      if (activityLogRes.data) {
        const formatted: ActivityItem[] = activityLogRes.data.map((log: any) => {
          const date = new Date(log.created_at || log.createdAt);
          const isToday = date.toDateString() === new Date().toDateString();
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return {
            id: log.id || Math.random().toString(),
            message: log.description || `${log.user_name || log.userName || 'User'} performed action`,
            time: isToday ? timeStr : `${date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })} ${timeStr}`,
          };
        });
        setActivities(formatted);
        AsyncStorage.setItem(ACTIVITY_CACHE_KEY, JSON.stringify(formatted)).catch(() => {});
      }

    } catch (error) {
      console.error('Failed to update live dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial Sync & Real-time Subscription Listener
  useEffect(() => {
    fetchDashboardData();

    const channel = supabase.channel('mobile-realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'giving_records' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_entries' }, () => fetchDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good morning';
    if (hrs < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatGhanaCedis = (value: number) => {
    return `GH₵ ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Same 5 quick actions as the web app; each opens the screen that does the job
  const allQuickActions = [
    { id: 'add-member', label: 'Add member', icon: UserPlus, route: '/members/add' },
    { id: 'record-attendance', label: 'Record attendance', icon: Calendar, route: '/attendance' },
    { id: 'record-giving', label: 'Record giving', icon: Banknote, route: '/giving/record' },
    { id: 'add-visitor', label: 'Add visitor', icon: UserCheck, route: '/visitors/add' },
    { id: 'mark-attendance', label: 'Check in a member', icon: CalendarCheck, route: '/attendance' },
  ];
  const quickActions = allQuickActions.filter(action => canRoute(action.route));

  if (loading && !refreshing && stats.totalMembers === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <SkeletonDashboard />
      </View>
    );
  }

  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
    >
      {/* Greeting */}
      <Animated.View entering={enterUp()} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="muted">{getGreeting()} · {today}</AppText>
          <AppText variant="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} accessibilityRole="header">
            {userName}
          </AppText>
        </View>
        <IconButton icon={RefreshCw} label="Refresh dashboard" spinning={refreshing} onPress={onRefresh} />
      </Animated.View>

      {/* Key figures */}
      {can('members') || can('attendance') || can('giving') ? (
        <Animated.View entering={enterUp(40)} style={{ gap: space.xs }}>
          {can('members') || can('attendance') ? (
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {can('members') ? (
                <StatTile
                  label="Members"
                  value={stats.totalMembers.toLocaleString()}
                  icon={Users}
                  footnote={stats.newMembersThisMonth > 0 ? `+${stats.newMembersThisMonth} this month` : 'No new members this month'}
                  footnoteTone={stats.newMembersThisMonth > 0 ? 'success' : 'muted'}
                  onPress={() => router.push('/people' as any)}
                />
              ) : null}
              {can('attendance') ? (
                <StatTile
                  label="Attendance"
                  value={stats.attendanceThisWeek.toLocaleString()}
                  icon={Calendar}
                  tone="warning"
                  footnote="Check-ins this week"
                  onPress={() => router.push('/operations' as any)}
                />
              ) : null}
            </View>
          ) : null}
          {can('giving') ? (
            <StatTile
              label="Giving this month"
              value={formatGhanaCedis(stats.givingThisMonth)}
              icon={Banknote}
              tone="success"
              footnote={new Date().toLocaleDateString([], { month: 'long', year: 'numeric' })}
              onPress={() => router.push('/finances' as any)}
            />
          ) : null}
        </Animated.View>
      ) : null}

      {/* Quick actions */}
      {quickActions.length > 0 ? (
        <Animated.View entering={enterUp(80)}>
          <Section title="Quick actions" bare>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {quickActions.map((action, i) => {
                const fullWidth = quickActions.length % 2 === 1 && i === quickActions.length - 1;
                return (
                  <PressableScale
                    key={action.id}
                    onPress={() => router.push(action.route as any)}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    style={{
                      width: fullWidth ? '100%' : '48.8%',
                      flexDirection: fullWidth ? 'row' : 'column',
                      alignItems: fullWidth ? 'center' : 'flex-start',
                      gap: space.sm,
                      padding: space.md,
                      minHeight: fullWidth ? 64 : 100,
                      borderRadius: radius.lg,
                      backgroundColor: c.surface,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <IconWell icon={action.icon} tone="primary" size={38} />
                    <AppText variant="bodyStrong" numberOfLines={2} style={fullWidth ? { flex: 1 } : undefined}>
                      {action.label}
                    </AppText>
                  </PressableScale>
                );
              })}
            </View>
          </Section>
        </Animated.View>
      ) : null}

      {/* Recent activity */}
      <Animated.View entering={enterUp(120)}>
        <Section
          title="Recent activity"
          action={canRoute('/logs') && activities.length > 0 ? (
            <Button label="See all" variant="ghost" size="sm" onPress={() => router.push('/logs' as any)} />
          ) : undefined}
        >
          {activities.length > 0 ? (
            activities.map(item => (
              <ListRow key={item.id} icon={Activity} iconTone="neutral" title={item.message} subtitle={item.time} />
            ))
          ) : (
            <EmptyState
              icon={Inbox}
              title="No recent activity"
              message="Actions taken by you or your team appear here."
            />
          )}
        </Section>
      </Animated.View>
    </ScrollView>
  );
}
