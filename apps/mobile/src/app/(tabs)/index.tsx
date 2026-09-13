import React, { useEffect, useState, useCallback } from 'react';
import { RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  YStack, 
  XStack, 
  Text, 
  Card, 
  H2, 
  Paragraph, 
  Button, 
  Separator, 
  Spinner,
  ScrollView
} from 'tamagui';
import { 
  Users, 
  Calendar, 
  Banknote, 
  ChevronRight, 
  Activity, 
  RefreshCw, 
  TrendingUp, 
  UserPlus, 
  CalendarCheck, 
  UserCheck,
  PlusCircle,
  Inbox
} from '@tamagui/lucide-icons';
import { supabase } from '../../lib/supabase';
import { getLocalStats, upsertLocalMember, upsertLocalGiving, upsertLocalAttendanceEntry } from '../../lib/db';

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

      // Sync into local SQLite database
      const sqliteStats = await getLocalStats();
      if (sqliteStats.totalMembers === 0 && membersCountRes.count) {
        const { data: membersList } = await supabase.from('members').select('*').limit(50);
        if (membersList) {
          for (const m of membersList) {
            await upsertLocalMember({
              id: m.id,
              name: m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Member',
              phone: m.phone,
              email: m.email,
              photo_url: m.photo_url,
              created_at: m.created_at || new Date().toISOString()
            });
          }
        }
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

  // Full 5 Quick Actions matching the Web Application
  const quickActions = [
    {
      id: 'add-member',
      label: 'Add New Member',
      description: 'Register a new church member',
      icon: UserPlus,
      color: '#007AFF',
      route: '/members',
    },
    {
      id: 'record-attendance',
      label: 'Record Attendance',
      description: "Mark attendance for today's service",
      icon: Calendar,
      color: '#FF9500',
      route: '/attendance',
    },
    {
      id: 'record-giving',
      label: 'Record Giving',
      description: 'Add offering or tithe record',
      icon: Banknote,
      color: '#34C759',
      route: '/giving',
    },
    {
      id: 'add-visitor',
      label: 'Add Visitor',
      description: 'Register a new church visitor',
      icon: UserCheck,
      color: '#5856D6',
      route: '/visitors',
    },
    {
      id: 'mark-attendance',
      label: 'Mark Individual Attendance',
      description: 'Quick check-in for a member',
      icon: CalendarCheck,
      color: '#AF52DE',
      route: '/attendance',
    },
  ];

  if (loading && !refreshing && stats.totalMembers === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <Spinner size="large" color="#007AFF" />
        <Text color="$colorPress" marginTop="$3" fontSize={13}>Loading dashboard...</Text>
      </YStack>
    );
  }

  return (
    <ScrollView 
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16 }}
      backgroundColor="$background"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007AFF']} />
      }
    >
      <YStack space="$5">
        {/* Welcome Header */}
        <XStack justifyContent="space-between" alignItems="center">
          <YStack flex={1}>
            <H2 color="$color" fontWeight="800" fontSize={24}>
              {getGreeting()}, {userName}
            </H2>
            <Paragraph color="$colorPress" fontSize={13}>
              Here's an overview of your church's activity today.
            </Paragraph>
          </YStack>

          <TouchableOpacity 
            onPress={onRefresh} 
            disabled={refreshing}
            style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(0, 122, 255, 0.1)' }}
          >
            <RefreshCw size={18} color="#007AFF" style={refreshing ? { transform: [{ rotate: '45deg' }] } : {}} />
          </TouchableOpacity>
        </XStack>

        {/* Stats Metrics Cards */}
        <YStack space="$3">
          {/* Members Metric Card */}
          <Card 
            padding="$4" 
            borderRadius="$5" 
            backgroundColor="$cardBackground" 
            borderColor="$borderColor"
            borderWidth={1}
            elevate
            pressStyle={{ scale: 0.98 }}
            onPress={() => router.push('/people' as any)}
          >
            <XStack space="$3" alignItems="center" justifyContent="space-between">
              <XStack space="$3" alignItems="center" flex={1}>
                <YStack backgroundColor="rgba(0, 122, 255, 0.12)" p="$2.5" borderRadius="$4">
                  <Users size={24} color="#007AFF" />
                </YStack>
                <YStack>
                  <Text color="$colorPress" fontSize={12} fontWeight="600">Total Members</Text>
                  <Text color="$color" fontSize={22} fontWeight="800">{stats.totalMembers}</Text>
                </YStack>
              </XStack>
              {stats.newMembersThisMonth > 0 ? (
                <XStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$2" py="$1" borderRadius="$3" alignItems="center" space="$1">
                  <TrendingUp size={12} color="#34C759" />
                  <Text color="#34C759" fontSize={11} fontWeight="700">+{stats.newMembersThisMonth} this month</Text>
                </XStack>
              ) : null}
            </XStack>
          </Card>

          {/* Attendance Metric Card */}
          <Card 
            padding="$4" 
            borderRadius="$5" 
            backgroundColor="$cardBackground" 
            borderColor="$borderColor"
            borderWidth={1}
            elevate
            pressStyle={{ scale: 0.98 }}
            onPress={() => router.push('/operations' as any)}
          >
            <XStack space="$3" alignItems="center">
              <YStack backgroundColor="rgba(255, 149, 0, 0.12)" p="$2.5" borderRadius="$4">
                <Calendar size={24} color="#FF9500" />
              </YStack>
              <YStack>
                <Text color="$colorPress" fontSize={12} fontWeight="600">Attendance This Week</Text>
                <Text color="$color" fontSize={22} fontWeight="800">{stats.attendanceThisWeek}</Text>
              </YStack>
            </XStack>
          </Card>

          {/* Giving Metric Card */}
          <Card 
            padding="$4" 
            borderRadius="$5" 
            backgroundColor="$cardBackground" 
            borderColor="$borderColor"
            borderWidth={1}
            elevate
            pressStyle={{ scale: 0.98 }}
            onPress={() => router.push('/finances' as any)}
          >
            <XStack space="$3" alignItems="center">
              <YStack backgroundColor="rgba(52, 199, 89, 0.12)" p="$2.5" borderRadius="$4">
                <Banknote size={24} color="#34C759" />
              </YStack>
              <YStack>
                <Text color="$colorPress" fontSize={12} fontWeight="600">Giving This Month</Text>
                <Text color="$color" fontSize={22} fontWeight="800">{formatGhanaCedis(stats.givingThisMonth)}</Text>
              </YStack>
            </XStack>
          </Card>
        </YStack>

        {/* Quick Actions (Full Web Parity Suite) */}
        <YStack space="$3">
          <Text color="$color" fontSize={16} fontWeight="700">Quick Actions</Text>
          <YStack space="$2">
            {quickActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <Card 
                  key={action.id}
                  padding="$3.5" 
                  borderRadius="$4" 
                  backgroundColor="$cardBackground" 
                  borderColor="$borderColor"
                  borderWidth={1}
                  elevate
                  pressStyle={{ scale: 0.98 }}
                  onPress={() => router.push(action.route as any)}
                >
                  <XStack space="$3" alignItems="center" justifyContent="space-between">
                    <XStack space="$3" alignItems="center" flex={1}>
                      <YStack backgroundColor={`${action.color}15`} p="$2" borderRadius="$3">
                        <ActionIcon size={20} color={action.color} />
                      </YStack>
                      <YStack flex={1}>
                        <Text color="$color" fontSize={14} fontWeight="700">{action.label}</Text>
                        <Paragraph color="$colorPress" fontSize={12} numberOfLines={1}>
                          {action.description}
                        </Paragraph>
                      </YStack>
                    </XStack>
                    <ChevronRight size={18} color="#8E8E93" />
                  </XStack>
                </Card>
              );
            })}
          </YStack>
        </YStack>

        {/* Recent Activity */}
        <YStack space="$3">
          <Text color="$color" fontSize={16} fontWeight="700">Recent Activity</Text>
          {activities.length > 0 ? (
            <Card 
              borderRadius="$5" 
              backgroundColor="$cardBackground" 
              borderColor="$borderColor"
              borderWidth={1}
              elevate
            >
              <YStack>
                {activities.map((item, index) => (
                  <YStack key={item.id}>
                    {index > 0 ? <Separator borderColor="$borderColor" /> : null}
                    <XStack padding="$4" space="$3" alignItems="center">
                      <YStack backgroundColor="rgba(0, 122, 255, 0.1)" p="$2" borderRadius="$3">
                        <Activity size={16} color="#007AFF" />
                      </YStack>
                      <YStack flex={1}>
                        <Text color="$color" fontSize={13} fontWeight="600">{item.message}</Text>
                        <Text color="$colorPress" fontSize={11}>{item.time}</Text>
                      </YStack>
                    </XStack>
                  </YStack>
                ))}
              </YStack>
            </Card>
          ) : (
            <Card 
              padding="$5" 
              borderRadius="$5" 
              backgroundColor="$cardBackground" 
              borderColor="$borderColor"
              borderWidth={1}
              alignItems="center"
              justifyContent="center"
            >
              <Inbox size={32} color="#8E8E93" />
              <Text color="$color" fontSize={14} fontWeight="700" marginTop="$2">No recent activity</Text>
              <Paragraph color="$colorPress" fontSize={12} textAlign="center" marginTop="$1">
                Recent actions performed by you or your team will appear here.
              </Paragraph>
            </Card>
          )}
        </YStack>
      </YStack>
    </ScrollView>
  );
}

