import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterUp } from '../../theme/animations';
import {
  RefreshCw, Users, Calendar, Banknote, TrendingUp, TrendingDown, Download, Baby, CalendarRange,
} from '@tamagui/lucide-icons';
import * as FileSystem from 'expo-file-system/legacy';
import {
  getLocalMembers,
  getLocalGivingRecords,
  getLocalExpenses,
  getLocalAttendanceRecords,
  getLocalChildren,
  getLocalChildVisitors,
  LocalMember,
  LocalGivingRecord,
  LocalExpense,
  LocalAttendanceRecord,
  LocalChild
} from '../../lib/db';
import { syncGivingRecords, syncExpenses, syncAttendanceRecords, syncChildren } from '../../lib/syncEngine';
import { useThemeContext } from '../../context/ThemeContext';
import { SkeletonReports } from '../../components/Skeleton';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { AppHeader } from '../../components/AppHeader';
import {
  AppText, Button, FilterChips, IconButton, ProgressBar, Screen, Section, SegmentedControl, Sheet, StatTile, Surface, useToast,
} from '../../components/ui';
import { space } from '../../theme/tokens';

export default function ReportsScreen() {
  const toast = useToast();
  const { colors: c } = useThemeContext();

  const [selectedScope, setSelectedScope] = useState<'main' | 'children' | 'combined'>('main');
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year' | 'all' | 'custom'>('year');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [members, setMembers] = useState<LocalMember[]>([]);
  const [children, setChildren] = useState<LocalChild[]>([]);
  const [childVisitorsCount, setChildVisitorsCount] = useState(0);
  const [giving, setGiving] = useState<LocalGivingRecord[]>([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [attendance, setAttendance] = useState<LocalAttendanceRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c, cv, g, e, a] = await Promise.all([
        getLocalMembers(),
        getLocalChildren(),
        getLocalChildVisitors(),
        getLocalGivingRecords(),
        getLocalExpenses(),
        getLocalAttendanceRecords()
      ]);
      setMembers(m);
      setChildren(c);
      setChildVisitorsCount(cv.length);
      setGiving(g);
      setExpenses(e);
      setAttendance(a);

      // Background refresh
      syncGivingRecords().then(() => getLocalGivingRecords().then(setGiving)).catch(() => {});
      syncExpenses().then(() => getLocalExpenses().then(setExpenses)).catch(() => {});
      syncAttendanceRecords().then(() => getLocalAttendanceRecords().then(setAttendance)).catch(() => {});
      syncChildren().then(() => {
        getLocalChildren().then(setChildren);
        getLocalChildVisitors().then(v => setChildVisitorsCount(v.length));
      }).catch(() => {});
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
      await Promise.all([syncGivingRecords(), syncExpenses(), syncAttendanceRecords(), syncChildren()]);
      const [m, c, cv, g, e, a] = await Promise.all([
        getLocalMembers(),
        getLocalChildren(),
        getLocalChildVisitors(),
        getLocalGivingRecords(),
        getLocalExpenses(),
        getLocalAttendanceRecords()
      ]);
      setMembers(m);
      setChildren(c);
      setChildVisitorsCount(cv.length);
      setGiving(g);
      setExpenses(e);
      setAttendance(a);
    } finally {
      setRefreshing(false);
    }
  };

  // Compute Metrics based on scope and period
  const metrics = useMemo(() => {
    const now = new Date();
    let periodStart = new Date(0);
    let periodEnd = new Date(8640000000000000);

    if (selectedPeriod === 'month') {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (selectedPeriod === 'quarter') {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (selectedPeriod === 'year') {
      periodStart = new Date(now.getFullYear(), 0, 1);
    } else if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      periodStart = new Date(customStartDate);
      periodEnd = new Date(customEndDate);
      periodEnd.setHours(23, 59, 59);
    }

    const filteredGiving = giving.filter(g => {
      const d = new Date(g.service_date);
      return d >= periodStart && d <= periodEnd;
    });
    const filteredExpenses = expenses.filter(e => {
      const d = new Date(e.service_date);
      return d >= periodStart && d <= periodEnd;
    });
    const filteredAttendance = attendance.filter(a => {
      const d = new Date(a.date);
      return d >= periodStart && d <= periodEnd;
    });

    // Financial sums
    const totalGiving = filteredGiving.reduce((sum, g) => sum + (g.total_amount || 0), 0);
    const offeringTotal = filteredGiving.reduce((sum, g) => sum + (g.offering_amount || 0), 0);
    const thanksgivingTotal = filteredGiving.reduce((sum, g) => sum + (g.thanksgiving_amount || 0), 0);
    const donationTotal = filteredGiving.reduce((sum, g) => sum + (g.donation_amount || 0), 0);
    const tithesTotal = filteredGiving.reduce((sum, g) => sum + ((g as any).tithes_amount || 0), 0);

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netBalance = totalGiving - totalExpenses;

    // Attendance averages
    const totalAttCount = filteredAttendance.reduce((sum, a) => sum + (a.total_count || 0), 0);
    const avgAttendance = filteredAttendance.length > 0 ? Math.round(totalAttCount / filteredAttendance.length) : 0;

    // Demographics (Adult Members)
    const activeMembers = members.filter(m => (m.status || '').toLowerCase() === 'active').length;
    const semiActiveMembers = members.filter(m => (m.status || '').toLowerCase() === 'semi-active').length;
    const inactiveMembers = members.filter(m => (m.status || '').toLowerCase() === 'inactive').length;
    const newMembers = members.filter(m => (m.status || '').toLowerCase() === 'new').length;
    const sickMembers = members.filter(m => ['sick', 'traveled', 'schooling'].includes((m.status || '').toLowerCase())).length;

    const maleMembers = members.filter(m => (m as any).gender?.toLowerCase() === 'male' || (m as any).gender?.toLowerCase() === 'm').length;
    const femaleMembers = members.filter(m => (m as any).gender?.toLowerCase() === 'female' || (m as any).gender?.toLowerCase() === 'f').length;

    // Marital Status
    const singleMembers = members.filter(m => (m as any).marital_status?.toLowerCase() === 'single').length;
    const marriedMembers = members.filter(m => (m as any).marital_status?.toLowerCase() === 'married').length;
    const divorcedMembers = members.filter(m => (m as any).marital_status?.toLowerCase() === 'divorced').length;
    const widowedMembers = members.filter(m => (m as any).marital_status?.toLowerCase() === 'widowed').length;

    // Zones breakdown
    const zoneCounts: Record<string, number> = {};
    members.forEach(m => {
      const z = m.zone || 'Unassigned';
      zoneCounts[z] = (zoneCounts[z] || 0) + 1;
    });

    // Children stats
    const totalChildrenCount = children.length;
    const childrenActive = children.filter(c => (c.status || '').toLowerCase() === 'active').length;
    const childrenWithGuardian = children.filter(c => c.guardian_name && c.guardian_name.trim().length > 0).length;
    const guardianMatchRate = totalChildrenCount > 0 ? Math.round((childrenWithGuardian / totalChildrenCount) * 100) : 0;

    return {
      totalGiving,
      offeringTotal,
      thanksgivingTotal,
      donationTotal,
      tithesTotal,
      totalExpenses,
      netBalance,
      avgAttendance,
      servicesCount: filteredAttendance.length,
      totalMembers: members.length,
      activeMembers,
      semiActiveMembers,
      inactiveMembers,
      newMembers,
      sickMembers,
      maleMembers,
      femaleMembers,
      singleMembers,
      marriedMembers,
      divorcedMembers,
      widowedMembers,
      zoneCounts,
      totalChildrenCount,
      childrenActive,
      childVisitorsCount,
      guardianMatchRate
    };
  }, [members, children, childVisitorsCount, giving, expenses, attendance, selectedPeriod, customStartDate, customEndDate]);

  const formatGHS = (val: number) => {
    return `GH₵ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPercent = (part: number, total: number) => {
    if (!total || total === 0) return 0;
    return Math.round((part / total) * 100);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const csvData = [
        'Metric,Value',
        `Scope,${selectedScope.toUpperCase()}`,
        `Period,${selectedPeriod.toUpperCase()}`,
        `Total Members,${metrics.totalMembers}`,
        `Active Members,${metrics.activeMembers}`,
        `Semi-Active Members,${metrics.semiActiveMembers}`,
        `Inactive Members,${metrics.inactiveMembers}`,
        `Average Attendance,${metrics.avgAttendance}`,
        `Total Giving (GHS),${metrics.totalGiving}`,
        `Total Expenses (GHS),${metrics.totalExpenses}`,
        `Net Balance (GHS),${metrics.netBalance}`,
        `Children Members,${metrics.totalChildrenCount}`,
        `Children Guardian Match Rate,${metrics.guardianMatchRate}%`,
      ].join('\n');

      const fileUri = `${FileSystem.documentDirectory}church_report_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvData, { encoding: FileSystem.EncodingType.UTF8 });
      toast.show({ title: 'Report exported', message: fileUri, duration: 5000 });
    } catch (err: any) {
      toast.show({ title: 'Export failed', message: err?.message, tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const formatRange = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '…';

  const scopeTotal = selectedScope === 'children'
    ? metrics.totalChildrenCount
    : selectedScope === 'combined'
      ? metrics.totalMembers + metrics.totalChildrenCount
      : metrics.totalMembers;

  const revenue = [
    { label: 'Sunday main offering', amount: metrics.offeringTotal },
    { label: 'Member tithes', amount: metrics.tithesTotal },
    { label: 'Thanksgiving & offertory', amount: metrics.thanksgivingTotal },
    { label: 'Donations & special funds', amount: metrics.donationTotal },
  ];

  const statusRows = [
    { label: 'Active', count: metrics.activeMembers, color: c.success.base },
    { label: 'Semi-active', count: metrics.semiActiveMembers, color: c.warning.base },
    { label: 'Inactive / on leave', count: metrics.inactiveMembers, color: c.danger.base },
    { label: 'Sick / traveled / schooling', count: metrics.sickMembers, color: c.info.base },
    { label: 'New converts / visitors', count: metrics.newMembers, color: c.primary.base },
  ];

  const genderTotal = metrics.maleMembers + metrics.femaleMembers;
  const malePct = getPercent(metrics.maleMembers, metrics.totalMembers);
  const femalePct = getPercent(metrics.femaleMembers, metrics.totalMembers);

  return (
    <Screen>
      <AppHeader
        title="Reports"
        subtitle="Attendance, giving, expenses & membership"
        showBack
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={RefreshCw} label="Refresh data" spinning={refreshing} onPress={handleRefresh} />
            <IconButton icon={Download} label="Export summary as CSV" busy={exporting} onPress={handleExportCSV} />
          </View>
        }
      />

      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs, gap: space.sm, backgroundColor: c.background }}>
        <SegmentedControl
          accessibilityLabel="Report scope"
          value={selectedScope}
          onChange={setSelectedScope}
          options={[
            { value: 'main', label: 'Main church' },
            { value: 'children', label: 'Children' },
            { value: 'combined', label: 'Combined' },
          ]}
        />
        <FilterChips
          value={selectedPeriod}
          onChange={p => { setSelectedPeriod(p); if (p === 'custom') setShowDatePicker(true); }}
          options={[
            { value: 'month', label: 'This month' },
            { value: 'quarter', label: 'Last 3 months' },
            { value: 'year', label: 'This year' },
            { value: 'all', label: 'All time' },
            {
              value: 'custom',
              label: selectedPeriod === 'custom' && customStartDate && customEndDate
                ? `${formatRange(customStartDate)} – ${formatRange(customEndDate)}`
                : 'Custom range',
              icon: CalendarRange,
            },
          ]}
        />
      </View>

      {loading ? (
        <View style={{ padding: space.md }}><SkeletonReports /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
        >
          {/* Summary tiles */}
          <Animated.View entering={enterUp()} style={{ gap: space.xs }}>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              <StatTile
                label={selectedScope === 'children' ? 'Children' : 'Members'}
                value={scopeTotal.toLocaleString()}
                icon={Users}
                footnote={`${metrics.activeMembers} active · ${getPercent(metrics.activeMembers, metrics.totalMembers)}%`}
                footnoteTone="success"
              />
              <StatTile
                label="Avg attendance"
                value={metrics.avgAttendance.toLocaleString()}
                icon={Calendar}
                tone="warning"
                footnote={`${metrics.servicesCount} recorded ${metrics.servicesCount === 1 ? 'service' : 'services'}`}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              <StatTile
                label="Total giving"
                value={formatGHS(metrics.totalGiving)}
                icon={Banknote}
                tone="success"
                footnote="Tithes + offerings"
              />
              <StatTile
                label="Net balance"
                value={formatGHS(metrics.netBalance)}
                valueTone={metrics.netBalance >= 0 ? 'success' : 'danger'}
                icon={metrics.netBalance >= 0 ? TrendingUp : TrendingDown}
                tone={metrics.netBalance >= 0 ? 'success' : 'danger'}
                footnote={`After ${formatGHS(metrics.totalExpenses)} expenses`}
              />
            </View>
          </Animated.View>

          {/* Revenue breakdown */}
          <Animated.View entering={enterUp(60)}>
            <Section title="Revenue breakdown" bare>
              <Surface style={{ gap: space.md }}>
                {revenue.map((item, i) => {
                  const pct = getPercent(item.amount, metrics.totalGiving);
                  return (
                    <View key={item.label} style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <AppText variant="bodyMedium" style={{ flex: 1 }}>{item.label}</AppText>
                        <AppText variant="bodyStrong" numeric>{formatGHS(item.amount)}</AppText>
                        <AppText variant="caption" tone="muted" numeric style={{ width: 36, textAlign: 'right' }}>{pct}%</AppText>
                      </View>
                      <ProgressBar percent={pct} color={c.chart[i]} />
                    </View>
                  );
                })}
              </Surface>
            </Section>
          </Animated.View>

          {/* Membership */}
          <Animated.View entering={enterUp(120)}>
            <Section title="Membership" bare>
              <Surface style={{ gap: space.lg }}>
                <View style={{ gap: space.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="captionStrong" color={c.chart[1]}>Male · {metrics.maleMembers} ({malePct}%)</AppText>
                    <AppText variant="captionStrong" color={c.chart[3]}>Female · {metrics.femaleMembers} ({femalePct}%)</AppText>
                  </View>
                  <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: c.surfaceMuted }}>
                    {genderTotal > 0 ? (
                      <>
                        <View style={{ flex: metrics.maleMembers, backgroundColor: c.chart[1] }} />
                        <View style={{ width: 2 }} />
                        <View style={{ flex: metrics.femaleMembers, backgroundColor: c.chart[3] }} />
                      </>
                    ) : null}
                  </View>
                </View>

                <View style={{ gap: 2 }}>
                  {statusRows.map(st => (
                    <View key={st.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: st.color }} />
                      <AppText variant="bodyMedium" style={{ flex: 1 }}>{st.label}</AppText>
                      <AppText variant="bodyStrong" numeric>{st.count}</AppText>
                      <AppText variant="caption" tone="muted" numeric style={{ width: 36, textAlign: 'right' }}>
                        {getPercent(st.count, metrics.totalMembers)}%
                      </AppText>
                    </View>
                  ))}
                </View>
              </Surface>
            </Section>
          </Animated.View>

          {/* Children ministry */}
          {selectedScope === 'children' || selectedScope === 'combined' ? (
            <Animated.View entering={enterUp(180)}>
              <Section title="Children's ministry" bare>
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <StatTile label="Registered children" value={String(metrics.totalChildrenCount)} icon={Baby} tone="warning" />
                  <StatTile label="Child visitors" value={String(metrics.childVisitorsCount)} icon={Users} tone="success" />
                </View>
                <Surface style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <AppText variant="bodyMedium" style={{ flex: 1 }}>Parent / guardian match rate</AppText>
                    <AppText variant="headline" tone="primary" numeric>{metrics.guardianMatchRate}%</AppText>
                  </View>
                  <ProgressBar percent={metrics.guardianMatchRate} color={c.primary.base} />
                </Surface>
              </Section>
            </Animated.View>
          ) : null}
        </ScrollView>
      )}

      {/* Custom date range */}
      <Sheet
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        title="Custom date range"
        subtitle="Giving, expenses and attendance are filtered to this range"
        footer={
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <Button label="Cancel" variant="secondary" flex={1} onPress={() => setShowDatePicker(false)} />
            <Button label="Apply range" flex={1} onPress={() => setShowDatePicker(false)} />
          </View>
        }
      >
        <NativeDatePicker label="Start date" value={customStartDate} onChange={setCustomStartDate} />
        <NativeDatePicker label="End date" value={customEndDate} onChange={setCustomEndDate} />
      </Sheet>
    </Screen>
  );
}
