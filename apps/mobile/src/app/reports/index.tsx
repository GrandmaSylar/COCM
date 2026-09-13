import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { YStack, XStack, Text, Card, Spinner } from 'tamagui';
import { ArrowLeft, RefreshCw, Users, Calendar, Banknote, TrendingUp, TrendingDown, Award, PieChart, BarChart3, ChevronRight } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  getLocalMembers, 
  getLocalGivingRecords, 
  getLocalExpenses, 
  getLocalAttendanceRecords,
  LocalMember,
  LocalGivingRecord,
  LocalExpense,
  LocalAttendanceRecord
} from '../../lib/db';
import { syncGivingRecords, syncExpenses, syncAttendanceRecords } from '../../lib/syncEngine';
import { useThemeContext } from '../../context/ThemeContext';

export default function ReportsScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useThemeContext();

  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year' | 'all'>('year');
  const [members, setMembers] = useState<LocalMember[]>([]);
  const [giving, setGiving] = useState<LocalGivingRecord[]>([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [attendance, setAttendance] = useState<LocalAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, g, e, a] = await Promise.all([
        getLocalMembers(),
        getLocalGivingRecords(),
        getLocalExpenses(),
        getLocalAttendanceRecords()
      ]);
      setMembers(m);
      setGiving(g);
      setExpenses(e);
      setAttendance(a);

      // Background refresh
      syncGivingRecords().then(() => getLocalGivingRecords().then(setGiving)).catch(() => {});
      syncExpenses().then(() => getLocalExpenses().then(setExpenses)).catch(() => {});
      syncAttendanceRecords().then(() => getLocalAttendanceRecords().then(setAttendance)).catch(() => {});
    } catch (err) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([syncGivingRecords(), syncExpenses(), syncAttendanceRecords()]);
      const [m, g, e, a] = await Promise.all([
        getLocalMembers(),
        getLocalGivingRecords(),
        getLocalExpenses(),
        getLocalAttendanceRecords()
      ]);
      setMembers(m);
      setGiving(g);
      setExpenses(e);
      setAttendance(a);
    } finally {
      setRefreshing(false);
    }
  };

  // Compute Metrics based on selected period
  const filteredData = useMemo(() => {
    const now = new Date();
    let periodStart = new Date(0);

    if (selectedPeriod === 'month') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (selectedPeriod === 'quarter') {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (selectedPeriod === 'year') {
      periodStart = new Date(now.getFullYear(), 0, 1);
    }

    const filteredGiving = giving.filter(g => new Date(g.service_date) >= periodStart);
    const filteredExpenses = expenses.filter(e => new Date(e.service_date) >= periodStart);
    const filteredAttendance = attendance.filter(a => new Date(a.date) >= periodStart);

    const totalGiving = filteredGiving.reduce((sum, g) => sum + (g.total_amount || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netBalance = totalGiving - totalExpenses;

    const totalAttCount = filteredAttendance.reduce((sum, a) => sum + (a.total_count || 0), 0);
    const avgAttendance = filteredAttendance.length > 0 ? Math.round(totalAttCount / filteredAttendance.length) : 0;

    // Status breakdown
    const activeMembers = members.filter(m => (m.status || '').toLowerCase() === 'active').length;
    const semiActiveMembers = members.filter(m => (m.status || '').toLowerCase() === 'semi-active').length;
    const inactiveMembers = members.filter(m => (m.status || '').toLowerCase() === 'inactive').length;
    const newMembers = members.filter(m => (m.status || '').toLowerCase() === 'new').length;

    // Gender breakdown
    const maleMembers = members.filter(m => (m as any).gender?.toLowerCase() === 'male' || (m as any).gender?.toLowerCase() === 'm').length;
    const femaleMembers = members.filter(m => (m as any).gender?.toLowerCase() === 'female' || (m as any).gender?.toLowerCase() === 'f').length;

    // Financial categories
    const offeringTotal = filteredGiving.reduce((sum, g) => sum + (g.offering_amount || 0), 0);
    const thanksgivingTotal = filteredGiving.reduce((sum, g) => sum + (g.thanksgiving_amount || 0), 0);
    const donationTotal = filteredGiving.reduce((sum, g) => sum + (g.donation_amount || 0), 0);

    return {
      totalGiving,
      totalExpenses,
      netBalance,
      avgAttendance,
      servicesCount: filteredAttendance.length,
      activeMembers,
      semiActiveMembers,
      inactiveMembers,
      newMembers,
      maleMembers,
      femaleMembers,
      offeringTotal,
      thanksgivingTotal,
      donationTotal
    };
  }, [members, giving, expenses, attendance, selectedPeriod]);

  const formatGHS = (val: number) => {
    return `GH₵ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPercent = (part: number, total: number) => {
    if (!total || total === 0) return 0;
    return Math.round((part / total) * 100);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={themeColors.statusBarStyle} backgroundColor={themeColors.background} animated />
      <YStack flex={1} backgroundColor={themeColors.background}>
        {/* Header */}
        <XStack px="$4" py="$3" alignItems="center" justifyContent="space-between" borderBottomWidth={1} borderColor={themeColors.borderColor}>
          <XStack space="$2" alignItems="center">
            <TouchableOpacity onPress={() => router.back()}>
              <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
                <ArrowLeft size={18} color={themeColors.text} />
              </YStack>
            </TouchableOpacity>
            <YStack>
              <Text color={themeColors.text} fontSize={18} fontWeight="900">Reports & Analytics</Text>
              <Text color={themeColors.textMuted} fontSize={11}>Congregation, attendance & financial summaries</Text>
            </YStack>
          </XStack>

          <TouchableOpacity onPress={handleRefresh}>
            <YStack p="$2" borderRadius="$3" backgroundColor={themeColors.borderColor} opacity={0.8}>
              <RefreshCw size={18} color={themeColors.text} className={refreshing ? 'animate-spin' : ''} />
            </YStack>
          </TouchableOpacity>
        </XStack>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
          }
        >
          <YStack space="$4">

            {/* Time Period Filter Chips */}
            <XStack backgroundColor={isDark ? '#1C1C1E' : '#E5E5EA'} p="$1" borderRadius="$4">
              {(['month', 'quarter', 'year', 'all'] as const).map((p) => {
                const isSelected = selectedPeriod === p;
                const labels: Record<string, string> = {
                  month: 'This Month',
                  quarter: 'This Quarter',
                  year: 'This Year',
                  all: 'All Time'
                };
                return (
                  <TouchableOpacity key={p} style={{ flex: 1 }} onPress={() => setSelectedPeriod(p)}>
                    <YStack
                      py="$2"
                      borderRadius="$3"
                      backgroundColor={isSelected ? (isDark ? '#2C2C2E' : '#FFFFFF') : 'transparent'}
                      alignItems="center"
                    >
                      <Text
                        color={isSelected ? themeColors.text : themeColors.textMuted}
                        fontSize={12}
                        fontWeight={isSelected ? '800' : '600'}
                      >
                        {labels[p]}
                      </Text>
                    </YStack>
                  </TouchableOpacity>
                );
              })}
            </XStack>

            {loading ? (
              <Spinner size="large" color="#007AFF" py="$8" />
            ) : (
              <>
                {/* Net Financial Summary Banner */}
                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                  <YStack space="$3">
                    <Text color={themeColors.textMuted} fontSize={11} fontWeight="800" textTransform="uppercase" letterSpacing={0.5}>
                      PERIOD NET FINANCIAL SUMMARY
                    </Text>

                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack>
                        <Text color={themeColors.text} fontSize={26} fontWeight="900">
                          {formatGHS(filteredData.netBalance)}
                        </Text>
                        <Text color={filteredData.netBalance >= 0 ? '#34C759' : '#FF3B30'} fontSize={12} fontWeight="800">
                          {filteredData.netBalance >= 0 ? 'Surplus Balance' : 'Deficit Balance'}
                        </Text>
                      </YStack>

                      <YStack p="$3" borderRadius="$4" backgroundColor={filteredData.netBalance >= 0 ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)'}>
                        {filteredData.netBalance >= 0 ? <TrendingUp size={24} color="#34C759" /> : <TrendingDown size={24} color="#FF3B30" />}
                      </YStack>
                    </XStack>

                    <XStack height={1} backgroundColor={themeColors.borderColor} my="$1" />

                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack flex={1}>
                        <Text color={themeColors.textMuted} fontSize={10} fontWeight="700">INCOME GIVING</Text>
                        <Text color="#34C759" fontSize={14} fontWeight="800">{formatGHS(filteredData.totalGiving)}</Text>
                      </YStack>
                      <YStack height={20} width={1} backgroundColor={themeColors.borderColor} mx="$2" />
                      <YStack flex={1}>
                        <Text color={themeColors.textMuted} fontSize={10} fontWeight="700">EXPENSES</Text>
                        <Text color="#FF3B30" fontSize={14} fontWeight="800">{formatGHS(filteredData.totalExpenses)}</Text>
                      </YStack>
                    </XStack>
                  </YStack>
                </Card>

                {/* Key Metrics Grid */}
                <XStack space="$3">
                  <Card flex={1} p="$3.5" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                    <YStack space="$1.5">
                      <XStack space="$2" alignItems="center">
                        <YStack p="$1.5" borderRadius="$2" backgroundColor="rgba(0, 122, 255, 0.15)">
                          <Users size={16} color="#007AFF" />
                        </YStack>
                        <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">MEMBERS</Text>
                      </XStack>
                      <Text color={themeColors.text} fontSize={22} fontWeight="900">{members.length}</Text>
                      <Text color="#34C759" fontSize={11} fontWeight="700">{filteredData.activeMembers} Active</Text>
                    </YStack>
                  </Card>

                  <Card flex={1} p="$3.5" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                    <YStack space="$1.5">
                      <XStack space="$2" alignItems="center">
                        <YStack p="$1.5" borderRadius="$2" backgroundColor="rgba(255, 149, 0, 0.15)">
                          <Calendar size={16} color="#FF9500" />
                        </YStack>
                        <Text color={themeColors.textMuted} fontSize={11} fontWeight="700">AVG ATTENDANCE</Text>
                      </XStack>
                      <Text color={themeColors.text} fontSize={22} fontWeight="900">{filteredData.avgAttendance}</Text>
                      <Text color={themeColors.textMuted} fontSize={11}>{filteredData.servicesCount} Services</Text>
                    </YStack>
                  </Card>
                </XStack>

                {/* Member Status Demographics Breakdown */}
                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                  <YStack space="$3">
                    <Text color={themeColors.text} fontSize={15} fontWeight="800">Member Status Distribution</Text>

                    <YStack space="$2">
                      <YStack space="$1">
                        <XStack justifyContent="space-between">
                          <Text color={themeColors.text} fontSize={12} fontWeight="700">Active ({filteredData.activeMembers})</Text>
                          <Text color={themeColors.textMuted} fontSize={12}>{getPercent(filteredData.activeMembers, members.length)}%</Text>
                        </XStack>
                        <XStack height={8} borderRadius={4} backgroundColor={themeColors.borderColor} overflow="hidden">
                          <YStack height="100%" width={`${getPercent(filteredData.activeMembers, members.length)}%`} backgroundColor="#34C759" />
                        </XStack>
                      </YStack>

                      <YStack space="$1">
                        <XStack justifyContent="space-between">
                          <Text color={themeColors.text} fontSize={12} fontWeight="700">Semi-Active ({filteredData.semiActiveMembers})</Text>
                          <Text color={themeColors.textMuted} fontSize={12}>{getPercent(filteredData.semiActiveMembers, members.length)}%</Text>
                        </XStack>
                        <XStack height={8} borderRadius={4} backgroundColor={themeColors.borderColor} overflow="hidden">
                          <YStack height="100%" width={`${getPercent(filteredData.semiActiveMembers, members.length)}%`} backgroundColor="#FF9500" />
                        </XStack>
                      </YStack>

                      <YStack space="$1">
                        <XStack justifyContent="space-between">
                          <Text color={themeColors.text} fontSize={12} fontWeight="700">Inactive ({filteredData.inactiveMembers})</Text>
                          <Text color={themeColors.textMuted} fontSize={12}>{getPercent(filteredData.inactiveMembers, members.length)}%</Text>
                        </XStack>
                        <XStack height={8} borderRadius={4} backgroundColor={themeColors.borderColor} overflow="hidden">
                          <YStack height="100%" width={`${getPercent(filteredData.inactiveMembers, members.length)}%`} backgroundColor="#FF3B30" />
                        </XStack>
                      </YStack>

                      {filteredData.newMembers > 0 && (
                        <YStack space="$1">
                          <XStack justifyContent="space-between">
                            <Text color={themeColors.text} fontSize={12} fontWeight="700">New Members ({filteredData.newMembers})</Text>
                            <Text color={themeColors.textMuted} fontSize={12}>{getPercent(filteredData.newMembers, members.length)}%</Text>
                          </XStack>
                          <XStack height={8} borderRadius={4} backgroundColor={themeColors.borderColor} overflow="hidden">
                            <YStack height="100%" width={`${getPercent(filteredData.newMembers, members.length)}%`} backgroundColor="#007AFF" />
                          </XStack>
                        </YStack>
                      )}
                    </YStack>
                  </YStack>
                </Card>

                {/* Offering Categories Breakdown */}
                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor={themeColors.borderColor} backgroundColor={themeColors.cardBackground}>
                  <YStack space="$3">
                    <Text color={themeColors.text} fontSize={15} fontWeight="800">Giving Categories Breakdown</Text>

                    <YStack space="$2">
                      <XStack justifyContent="space-between" alignItems="center" p="$2.5" borderRadius="$3" backgroundColor={themeColors.borderColor}>
                        <XStack space="$2" alignItems="center">
                          <YStack width={10} height={10} borderRadius={5} backgroundColor="#34C759" />
                          <Text color={themeColors.text} fontSize={13} fontWeight="700">Standard Offertory</Text>
                        </XStack>
                        <Text color={themeColors.text} fontSize={13} fontWeight="800">{formatGHS(filteredData.offeringTotal)}</Text>
                      </XStack>

                      <XStack justifyContent="space-between" alignItems="center" p="$2.5" borderRadius="$3" backgroundColor={themeColors.borderColor}>
                        <XStack space="$2" alignItems="center">
                          <YStack width={10} height={10} borderRadius={5} backgroundColor="#FF9500" />
                          <Text color={themeColors.text} fontSize={13} fontWeight="700">Thanksgiving Offering</Text>
                        </XStack>
                        <Text color={themeColors.text} fontSize={13} fontWeight="800">{formatGHS(filteredData.thanksgivingTotal)}</Text>
                      </XStack>

                      <XStack justifyContent="space-between" alignItems="center" p="$2.5" borderRadius="$3" backgroundColor={themeColors.borderColor}>
                        <XStack space="$2" alignItems="center">
                          <YStack width={10} height={10} borderRadius={5} backgroundColor="#007AFF" />
                          <Text color={themeColors.text} fontSize={13} fontWeight="700">Donations & Seed</Text>
                        </XStack>
                        <Text color={themeColors.text} fontSize={13} fontWeight="800">{formatGHS(filteredData.donationTotal)}</Text>
                      </XStack>
                    </YStack>
                  </YStack>
                </Card>
              </>
            )}

          </YStack>
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
