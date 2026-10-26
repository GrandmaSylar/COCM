import React, { useState, useEffect, useCallback } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  RefreshCw,
  Settings,
  TrendingUp,
  TrendingDown,
  Banknote,
  Receipt,
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import {
  getLocalGivingRecords,
  getLocalExpenses,
  LocalGivingRecord,
  LocalExpense
} from '../../lib/db';
import { syncGivingRecords, syncExpenses, syncCustomGivingTypes, syncExpensePaymentMethods } from '../../lib/syncEngine';
import { useAppColors } from '../../context/ThemeContext';
import { SkeletonList } from '../../components/Skeleton';
import { useAccess } from '../../lib/access';
import {
  AmountRow, AppText, Badge, Button, EmptyState, IconButton, Section, SegmentedControl, Surface,
} from '../../components/ui';
import { enterUp } from '../../theme/animations';
import { radius, space } from '../../theme/tokens';

export default function FinancesScreen() {
  const router = useRouter();
  const c = useAppColors();
  const [activeTab, setActiveTab] = useState<'giving' | 'expenses'>('giving');
  const { can } = useAccess();
  const canGiving = can('giving');
  const canExpenses = can('expenses');
  // With access to only one register, that register is the only view
  const visibleTab = canGiving && canExpenses ? activeTab : canGiving ? 'giving' : 'expenses';
  const [givingRecords, setGivingRecords] = useState<LocalGivingRecord[]>([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 0ms Cold Start from local SQLite
      const [localGiving, localExp] = await Promise.all([
        getLocalGivingRecords(),
        getLocalExpenses()
      ]);
      setGivingRecords(localGiving);
      setExpenses(localExp);

      // Background Sync
      syncGivingRecords().then(() => getLocalGivingRecords().then(setGivingRecords)).catch(() => {});
      syncExpenses().then(() => getLocalExpenses().then(setExpenses)).catch(() => {});
      syncCustomGivingTypes().catch(() => {});
      syncExpensePaymentMethods().catch(() => {});
    } catch (err) {
      console.error('Failed to load finance data:', err);
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
      await Promise.all([
        syncGivingRecords(),
        syncExpenses(),
        syncCustomGivingTypes(),
        syncExpensePaymentMethods()
      ]);
      const [updatedGiving, updatedExp] = await Promise.all([
        getLocalGivingRecords(),
        getLocalExpenses()
      ]);
      setGivingRecords(updatedGiving);
      setExpenses(updatedExp);
    } finally {
      setRefreshing(false);
    }
  };

  // Compute Total Financial Metrics
  const totalIncome = givingRecords.reduce((sum, g) => sum + (g.total_amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netBalance = totalIncome - totalExpenses;

  const formatGHS = (val: number) => {
    return `GH₵ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
    >
      <Animated.View entering={enterUp()} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="display" accessibilityRole="header">Finances</AppText>
          <AppText variant="body" tone="muted">Giving, offerings and expenses.</AppText>
        </View>
        <IconButton icon={RefreshCw} label="Refresh finances" spinning={refreshing} onPress={handleRefresh} />
      </Animated.View>

      {/* Net summary (needs both registers) */}
      {canGiving && canExpenses ? (
        <Animated.View entering={enterUp(40)}>
          <Surface style={{ gap: space.md }}>
            <View style={{ gap: 4 }}>
              <AppText variant="captionStrong" tone="muted">Net balance · all records</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <AppText variant="display" numeric tone={netBalance >= 0 ? 'success' : 'danger'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flexShrink: 1 }}>
                  {formatGHS(netBalance)}
                </AppText>
                {netBalance >= 0 ? <TrendingUp size={22} color={c.success.text} /> : <TrendingDown size={22} color={c.danger.text} />}
              </View>
              <AppText variant="caption" tone={netBalance >= 0 ? 'success' : 'danger'}>
                {netBalance >= 0 ? 'Surplus' : 'Deficit'}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', borderRadius: radius.md, backgroundColor: c.surfaceMuted }}>
              <View style={{ flex: 1, padding: space.sm, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ArrowUpRight size={14} color={c.success.text} />
                  <AppText variant="caption" tone="muted">Giving</AppText>
                </View>
                <AppText variant="bodyStrong" tone="success" numeric numberOfLines={1} adjustsFontSizeToFit>{formatGHS(totalIncome)}</AppText>
              </View>
              <View style={{ width: 1, backgroundColor: c.border, marginVertical: space.xs }} />
              <View style={{ flex: 1, padding: space.sm, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ArrowDownRight size={14} color={c.danger.text} />
                  <AppText variant="caption" tone="muted">Expenses</AppText>
                </View>
                <AppText variant="bodyStrong" tone="danger" numeric numberOfLines={1} adjustsFontSizeToFit>{formatGHS(totalExpenses)}</AppText>
              </View>
            </View>
          </Surface>
        </Animated.View>
      ) : null}

      {/* Actions */}
      <Animated.View entering={enterUp(80)} style={{ flexDirection: 'row', gap: space.xs }}>
        {canGiving ? <Button label="Record giving" icon={Plus} variant="soft" flex={1} onPress={() => router.push('/giving/record' as any)} /> : null}
        {canExpenses ? <Button label="Record expense" icon={Plus} variant="secondary" flex={1} onPress={() => router.push('/expenses/record' as any)} /> : null}
        {canGiving ? <IconButton icon={Settings} label="Giving types" size={48} onPress={() => router.push('/giving/types' as any)} /> : null}
      </Animated.View>

      {canGiving && canExpenses ? (
        <SegmentedControl
          accessibilityLabel="Register"
          value={visibleTab}
          onChange={setActiveTab}
          options={[
            { value: 'giving', label: `Giving · ${givingRecords.length}` },
            { value: 'expenses', label: `Expenses · ${expenses.length}` },
          ]}
        />
      ) : null}

      {/* Giving */}
      {visibleTab === 'giving' ? (
        loading ? (
          <SkeletonList count={4} hasAvatar={false} />
        ) : givingRecords.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No giving recorded yet"
            message="Offerings, tithes and thanksgiving appear here."
            action={{ label: 'Record giving', onPress: () => router.push('/giving/record' as any) }}
          />
        ) : (
          <Section>
            {givingRecords.map(item => {
              const parts = [
                item.offering_amount > 0 ? `Offertory ${formatGHS(item.offering_amount)}` : null,
                item.thanksgiving_amount > 0 ? `Thanksgiving ${formatGHS(item.thanksgiving_amount)}` : null,
              ].filter(Boolean);
              return (
                <AmountRow
                  key={item.id}
                  title={item.service_name || item.service_type || 'Sunday Service'}
                  subtitle={item.service_date}
                  detail={parts.length ? parts.join(' · ') : undefined}
                  amount={formatGHS(item.total_amount)}
                  direction="in"
                  onPress={() => router.push(`/giving?id=${item.id}` as any)}
                />
              );
            })}
          </Section>
        )
      ) : null}

      {/* Expenses */}
      {visibleTab === 'expenses' ? (
        loading ? (
          <SkeletonList count={4} hasAvatar={false} />
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses recorded yet"
            message="Disbursement vouchers appear here."
            action={{ label: 'Record expense', onPress: () => router.push('/expenses/record' as any) }}
          />
        ) : (
          <Section>
            {expenses.map(exp => (
              <AmountRow
                key={exp.id}
                leading={exp.form_id ? <Badge label={exp.form_id} tone="danger" /> : undefined}
                title={exp.details}
                subtitle={[exp.service_date, exp.service_type, exp.payment_method_name].filter(Boolean).join(' · ')}
                amount={formatGHS(exp.amount)}
                direction="out"
                onPress={() => router.push(`/expenses/receipt?id=${exp.id}` as any)}
              />
            ))}
          </Section>
        )
      ) : null}
    </ScrollView>
  );
}
