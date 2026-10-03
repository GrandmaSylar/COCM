import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Plus, Receipt, RefreshCw, SearchX } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { getLocalExpenses, getLocalGivingRecords, LocalExpense, LocalGivingRecord } from '../../lib/db';
import { syncExpenses, syncGivingRecords } from '../../lib/syncEngine';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import { AmountRow, AppText, Badge, EmptyState, IconButton, Screen, SearchField, Surface } from '../../components/ui';
import { space } from '../../theme/tokens';

export default function ExpensesListScreen() {
  const router = useRouter();
  const c = useAppColors();
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [givingRecords, setGivingRecords] = useState<LocalGivingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [localExp, localGiving] = await Promise.all([
        getLocalExpenses(),
        getLocalGivingRecords()
      ]);
      setExpenses(localExp);
      setGivingRecords(localGiving);

      syncExpenses().then(() => getLocalExpenses().then(setExpenses)).catch(() => {});
      syncGivingRecords().then(() => getLocalGivingRecords().then(setGivingRecords)).catch(() => {});
    } catch (err) {
      console.error('Failed to load expenses data:', err);
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
      await Promise.all([syncExpenses(), syncGivingRecords()]);
      const [updatedExp, updatedGiving] = await Promise.all([
        getLocalExpenses(),
        getLocalGivingRecords()
      ]);
      setExpenses(updatedExp);
      setGivingRecords(updatedGiving);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return expenses.filter(e => {
      return (
        (e.form_id || '').toLowerCase().includes(s) ||
        (e.details || '').toLowerCase().includes(s) ||
        (e.service_type || '').toLowerCase().includes(s) ||
        (e.payment_method_name || '').toLowerCase().includes(s)
      );
    });
  }, [expenses, searchTerm]);

  // Group Expenses by Service Date & Service Type (matching web version)
  const groupedExpenses = useMemo(() => {
    const map = new Map<string, LocalExpense[]>();
    filteredExpenses.forEach(exp => {
      const key = `${exp.service_date}|${exp.service_type || 'General'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(exp);
    });

    return Array.from(map.entries()).map(([key, rows]) => {
      const [serviceDate, serviceType] = key.split('|');
      const subtotal = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

      // Find related giving for this service group
      const relatedGiving = givingRecords
        .filter(g => g.service_date === serviceDate && (g.service_name === serviceType || g.service_type === serviceType))
        .reduce((sum, g) => sum + (g.total_amount || 0), 0);

      const net = relatedGiving - subtotal;

      return {
        key,
        serviceDate,
        serviceType,
        subtotal,
        relatedGiving,
        net,
        rows
      };
    });
  }, [filteredExpenses, givingRecords]);

  const formatGHS = (val: number) => {
    return `GH₵ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Screen>
      <AppHeader
        title="Expenses"
        subtitle={`${expenses.length} recorded`}
        showBack
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={RefreshCw} label="Refresh" spinning={refreshing} onPress={handleRefresh} />
            <IconButton icon={Plus} label="Record expense" tone="primary" onPress={() => router.push('/expenses/record' as any)} />
          </View>
        }
      />

      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs, backgroundColor: c.background }}>
        <SearchField value={searchTerm} onChangeText={setSearchTerm} placeholder="Search form ID, details or method" />
      </View>

      {loading ? (
        <View style={{ padding: space.md }}><SkeletonList count={5} hasAvatar={false} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.md, paddingTop: space.xs, paddingBottom: space.xxl, gap: space.lg, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
        >
          {groupedExpenses.length === 0 ? (
            <EmptyState
              icon={searchTerm ? SearchX : Receipt}
              title={searchTerm ? 'No expenses match' : 'No expenses recorded'}
              message={searchTerm ? `Nothing matches "${searchTerm}".` : 'Disbursement vouchers appear here, grouped by service.'}
              action={searchTerm ? { label: 'Clear search', onPress: () => setSearchTerm('') } : { label: 'Record expense', onPress: () => router.push('/expenses/record' as any) }}
            />
          ) : (
            groupedExpenses.map(group => (
              <View key={group.key} style={{ gap: space.xs }}>
                <View style={{ paddingHorizontal: 4, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
                    <AppText variant="captionStrong" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                      {fmtDate(group.serviceDate)} · {group.serviceType}
                    </AppText>
                    <AppText variant="captionStrong" tone="danger" numeric>−{formatGHS(group.subtotal)}</AppText>
                  </View>
                  {group.relatedGiving > 0 ? (
                    <AppText variant="caption" tone="subtle" numeric>
                      Giving {formatGHS(group.relatedGiving)} · Net{' '}
                      <AppText variant="caption" tone={group.net >= 0 ? 'success' : 'danger'} numeric>{formatGHS(group.net)}</AppText>
                    </AppText>
                  ) : null}
                </View>
                <Surface padded={false}>
                  {group.rows.map((exp, i) => (
                    <View key={exp.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                      <AmountRow
                        leading={exp.form_id ? <Badge label={exp.form_id} tone="danger" /> : undefined}
                        title={exp.details}
                        subtitle={`${exp.payment_method_name || 'Payment'}${exp.reference_number ? ` · Ref ${exp.reference_number}` : ''}`}
                        amount={formatGHS(exp.amount)}
                        direction="out"
                        onPress={() => router.push(`/expenses/receipt?id=${exp.id}` as any)}
                      />
                    </View>
                  ))}
                </Surface>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
