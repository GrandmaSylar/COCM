import React, { useEffect, useState } from 'react';
import { RefreshControl, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
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
  Theme,
  ScrollView
} from 'tamagui';
import { Users, Calendar, Banknote, ChevronRight, Activity } from '@tamagui/lucide-icons';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

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
  const [userName, setUserName] = useState('Pastor');
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    attendanceThisWeek: 0,
    givingThisMonth: 0,
    newMembersThisMonth: 0,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      // 1. Get user details
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User';
        setUserName(name);
      }

      // 2. Fetch stats from API
      const statsResponse = await fetchApiData('/stats');
      setStats({
        totalMembers: statsResponse?.totalMembers || 0,
        attendanceThisWeek: statsResponse?.attendanceThisWeek || 0,
        givingThisMonth: statsResponse?.givingThisMonth || 0,
        newMembersThisMonth: statsResponse?.newMembersThisMonth || 0,
      });

      // 3. Fetch activity log from API
      const activityResponse = await fetchApiData('/activity-log?limit=5');
      if (activityResponse?.logs) {
        const formatted = activityResponse.logs.map((log: any) => {
          const date = new Date(log.createdAt || log.created_at);
          return {
            id: log.id,
            message: log.description || `${log.userName || 'User'} performed action`,
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
        });
        setActivities(formatted);
      } else {
        setActivities([]);
      }

    } catch (error) {
      console.error('Failed to load dashboard:', error);
      Alert.alert('Database Connection Error', 'Failed to retrieve live stats from the database server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper fetch function
  const fetchApiData = async (endpoint: string) => {
    // API endpoint fetch wrapper helper
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/server${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    if (!response.ok) throw new Error();
    return response.json();
  };

  useEffect(() => {
    fetchDashboardData();

    // Set up real-time activity log updates
    const channel = supabase.channel('mobile-activity-log')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_log' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  if (loading && !refreshing) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <Spinner size="large" color="$primary" />
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
        <YStack>
          <H2 color="$color" fontWeight="800" fontSize={26}>
            {getGreeting()}, {userName}
          </H2>
          <Paragraph color="$colorPress" fontSize={14}>
            Here's an overview of your church's activity today.
          </Paragraph>
        </YStack>

        {/* Stats Metrics Cards Slider/Grid */}
        <YStack space="$3">
          {/* Members Metric */}
          <Card 
            padding="$4" 
            borderRadius="$5" 
            backgroundColor="$cardBackground" 
            borderColor="$borderColor"
            borderWidth={1}
            elevate
            pressStyle={{ scale: 0.98 }}
            onPress={() => router.push('/members' as any)}
          >
            <XStack space="$3" alignItems="center" justifyContent="space-between">
              <XStack space="$3" alignItems="center">
                <YStack backgroundColor="rgba(0, 122, 255, 0.1)" p="$2.5" borderRadius="$4">
                  <Users size={24} color="#007AFF" />
                </YStack>
                <YStack>
                  <Text color="$colorPress" fontSize={13} fontWeight="600">Total Members</Text>
                  <Text color="$color" fontSize={22} fontWeight="800">{stats.totalMembers}</Text>
                </YStack>
              </XStack>
              {stats.newMembersThisMonth > 0 ? (
                <YStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$2" py="$1" borderRadius="$3">
                  <Text color="#34C759" fontSize={11} fontWeight="700">+{stats.newMembersThisMonth} this month</Text>
                </YStack>
              ) : null}
            </XStack>
          </Card>

          {/* Attendance Metric */}
          <Card 
            padding="$4" 
            borderRadius="$5" 
            backgroundColor="$cardBackground" 
            borderColor="$borderColor"
            borderWidth={1}
            elevate
          >
            <XStack space="$3" alignItems="center">
              <YStack backgroundColor="rgba(255, 149, 0, 0.1)" p="$2.5" borderRadius="$4">
                <Calendar size={24} color="#FF9500" />
              </YStack>
              <YStack>
                <Text color="$colorPress" fontSize={13} fontWeight="600">Attendance This Week</Text>
                <Text color="$color" fontSize={22} fontWeight="800">{stats.attendanceThisWeek}</Text>
              </YStack>
            </XStack>
          </Card>

          {/* Giving Metric */}
          <Card 
            padding="$4" 
            borderRadius="$5" 
            backgroundColor="$cardBackground" 
            borderColor="$borderColor"
            borderWidth={1}
            elevate
          >
            <XStack space="$3" alignItems="center">
              <YStack backgroundColor="rgba(52, 199, 89, 0.1)" p="$2.5" borderRadius="$4">
                <Banknote size={24} color="#34C759" />
              </YStack>
              <YStack>
                <Text color="$colorPress" fontSize={13} fontWeight="600">Giving This Month</Text>
                <Text color="$color" fontSize={22} fontWeight="800">{formatGhanaCedis(stats.givingThisMonth)}</Text>
              </YStack>
            </XStack>
          </Card>
        </YStack>

        {/* Quick Actions */}
        <YStack space="$3">
          <Text color="$color" fontSize={16} fontWeight="700">Quick Actions</Text>
          <XStack space="$2" flexWrap="wrap">
            {/* Add Member Action */}
            <Card 
              flex={1}
              minWidth={140}
              padding="$4" 
              borderRadius="$4" 
              backgroundColor="$cardBackground" 
              borderColor="$borderColor"
              borderWidth={1}
              elevate
              pressStyle={{ scale: 0.96 }}
              onPress={() => router.push('/members/add' as any)}
            >
              <YStack space="$2" alignItems="center">
                <Users size={22} color="#007AFF" />
                <Text color="$color" fontSize={13} fontWeight="700">Add Member</Text>
              </YStack>
            </Card>

            {/* Visitors Action */}
            <Card 
              flex={1}
              minWidth={140}
              padding="$4" 
              borderRadius="$4" 
              backgroundColor="$cardBackground" 
              borderColor="$borderColor"
              borderWidth={1}
              elevate
              pressStyle={{ scale: 0.96 }}
              onPress={() => router.push('/visitors' as any)}
            >
              <YStack space="$2" alignItems="center">
                <Users size={22} color="#FF9500" />
                <Text color="$color" fontSize={13} fontWeight="700">Add Visitor</Text>
              </YStack>
            </Card>
          </XStack>
        </YStack>

        {/* Recent Activity */}
        <YStack space="$3">
          <Text color="$color" fontSize={16} fontWeight="700">Recent Activity</Text>
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
                    <Activity size={18} color="#007AFF" />
                    <YStack flex={1}>
                      <Text color="$color" fontSize={13} fontWeight="600">{item.message}</Text>
                      <Text color="$colorPress" fontSize={11}>{item.time}</Text>
                    </YStack>
                  </XStack>
                </YStack>
              ))}
            </YStack>
          </Card>
        </YStack>
      </YStack>
    </ScrollView>
  );
}
