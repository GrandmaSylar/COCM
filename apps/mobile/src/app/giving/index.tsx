import React, { useState, useEffect, useCallback } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Banknote, Plus, SearchX, Settings } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { getLocalGivingRecords, LocalGivingRecord } from '../../lib/db';
import { syncGivingRecords } from '../../lib/syncEngine';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import { AmountRow, AppText, EmptyState, IconButton, Screen, SearchField } from '../../components/ui';
import { radius, space } from '../../theme/tokens';

export default function GivingHistoryScreen() {
  const router = useRouter();
  const c = useAppColors();
  const [records, setRecords] = useState<LocalGivingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cached = await getLocalGivingRecords();
      setRecords(cached);

      syncGivingRecords().then(() => getLocalGivingRecords().then(setRecords)).catch(() => {});
    } catch (err) {
      console.error('Failed to load giving records:', err);
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
      await syncGivingRecords();
      const updated = await getLocalGivingRecords();
      setRecords(updated);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredRecords = records.filter(r => {
    const s = searchTerm.toLowerCase();
    return (
      (r.service_name || '').toLowerCase().includes(s) ||
      (r.service_type || '').toLowerCase().includes(s) ||
      (r.notes || '').toLowerCase().includes(s) ||
      (r.service_date || '').toLowerCase().includes(s)
    );
  });

  const formatGHS = (val: number) => {
    return `GH₵ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };
  const total = filteredRecords.reduce((sum, r) => sum + (r.total_amount || 0), 0);

  return (
    <Screen>
      <AppHeader
        title="Giving"
        subtitle={`${records.length} recorded services`}
        showBack
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={Settings} label="Giving types" onPress={() => router.push('/giving/types' as any)} />
            <IconButton icon={Plus} label="Record giving" tone="primary" onPress={() => router.push('/giving/record' as any)} />
          </View>
        }
      />

      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs, backgroundColor: c.background }}>
        <SearchField value={searchTerm} onChangeText={setSearchTerm} placeholder="Search service, date or notes" />
      </View>

      {loading ? (
        <View style={{ padding: space.md }}><SkeletonList count={5} hasAvatar={false} /></View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: space.md, paddingTop: space.xs, paddingBottom: space.xxl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
          ListHeaderComponent={
            filteredRecords.length ? (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: space.xs }}>
                <AppText variant="caption" tone="muted">{filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'}</AppText>
                <AppText variant="captionStrong" tone="success" numeric>{formatGHS(total)}</AppText>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon={searchTerm ? SearchX : Banknote}
              title={searchTerm ? 'No records match' : 'No giving recorded yet'}
              message={searchTerm ? `Nothing matches "${searchTerm}".` : 'Record offerings after each service.'}
              action={searchTerm ? { label: 'Clear search', onPress: () => setSearchTerm('') } : { label: 'Record giving', onPress: () => router.push('/giving/record' as any) }}
            />
          }
          renderItem={({ item: r, index }) => {
            const categories = [
              r.offering_amount > 0 ? `Offertory ${formatGHS(r.offering_amount)}` : null,
              r.thanksgiving_amount > 0 ? `Thanksgiving ${formatGHS(r.thanksgiving_amount)}` : null,
              r.donation_amount > 0 ? `Donation ${formatGHS(r.donation_amount)}` : null,
            ].filter(Boolean).join(' · ');
            const methods = [
              r.cash_amount > 0 ? `Cash ${formatGHS(r.cash_amount)}` : null,
              r.mobile_money_amount > 0 ? `MoMo ${formatGHS(r.mobile_money_amount)}` : null,
              r.bank_transfer_amount > 0 ? `Bank ${formatGHS(r.bank_transfer_amount)}` : null,
            ].filter(Boolean).join(' · ');
            const first = index === 0;
            const last = index === filteredRecords.length - 1;
            return (
              <View
                style={{
                  backgroundColor: c.surface, borderColor: c.border,
                  borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopWidth: first ? 1 : 0,
                  borderTopLeftRadius: first ? radius.lg : 0, borderTopRightRadius: first ? radius.lg : 0,
                  borderBottomLeftRadius: last ? radius.lg : 0, borderBottomRightRadius: last ? radius.lg : 0,
                }}
              >
                <AmountRow
                  title={r.service_name || r.service_type || 'Sunday Service'}
                  subtitle={fmtDate(r.service_date)}
                  detail={[categories, methods].filter(Boolean).join('\n') || undefined}
                  amount={formatGHS(r.total_amount)}
                  direction="in"
                />
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
