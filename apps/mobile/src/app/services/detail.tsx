import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Church } from '@tamagui/lucide-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { loadServiceSummary, refreshServiceData, ServiceSummary } from '../../lib/serviceRecords';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import { AppText, Badge, DetailRow, EmptyState, ListRow, Screen, Section } from '../../components/ui';
import { space } from '../../theme/tokens';

const ghs = (n: number) => `GH₵ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string) => {
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export default function ServiceDetailScreen() {
  const router = useRouter();
  const c = useAppColors();
  const params = useLocalSearchParams<{ date?: string; type?: string }>();
  const date = String(params.date ?? '');
  const type = String(params.type ?? '');
  const [service, setService] = useState<ServiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setService(await loadServiceSummary(date, type));
    } catch (err) {
      console.error('Failed to load service:', err);
    } finally {
      setLoading(false);
    }
  }, [date, type]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshServiceData();
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const header = <AppHeader title={service ? service.type : 'Service'} subtitle={fmtDate(date)} showBack />;

  if (loading) {
    return (
      <Screen>
        {header}
        <View style={{ padding: space.md }}><SkeletonList count={4} hasAvatar={false} /></View>
      </Screen>
    );
  }

  if (!service) {
    return (
      <Screen>
        {header}
        <View style={{ padding: space.md }}>
          <EmptyState icon={Church} title="Service not found" message="It may have been removed, or has not synced to this device yet." action={{ label: 'Back to services', onPress: () => router.back() }} />
        </View>
      </Screen>
    );
  }

  const s = service;
  const net = s.totalGiving - s.expenses;
  const sum = (pick: (g: ServiceSummary['givingRecords'][number]) => number) => s.givingRecords.reduce((n, g) => n + (pick(g) || 0), 0);
  const customTotals = new Map<string, number>();
  for (const g of s.givingRecords) {
    if (!g.custom_types) continue;
    try {
      for (const [name, amount] of Object.entries(JSON.parse(g.custom_types) as Record<string, number>)) {
        customTotals.set(name, (customTotals.get(name) || 0) + (Number(amount) || 0));
      }
    } catch {
      // Ignore a malformed custom_types value; the totals above still add up.
    }
  }
  const givingLines: [string, number][] = [
    ['Offertory', sum(g => g.offering_amount)],
    ['Thanksgiving', sum(g => g.thanksgiving_amount)],
    ['Donation', sum(g => g.donation_amount)],
    ...[...customTotals.entries()],
  ];
  const methodLines: [string, number][] = [
    ['Cash', sum(g => g.cash_amount)],
    ['Mobile money', sum(g => g.mobile_money_amount)],
    ['Card', sum(g => g.card_amount)],
    ['Bank transfer', sum(g => g.bank_transfer_amount)],
  ];

  return (
    <Screen>
      {header}
      <ScrollView
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
      >
        <Section title="Overview">
          <DetailRow label="Present" value={String(s.totalAttendance)} />
          <DetailRow label="Absent" value={String(s.absentees)} />
          <DetailRow label="Visitors" value={String(s.visitors)} />
          <DetailRow label="Total giving" value={ghs(s.totalGiving)} valueTone="success" />
          {s.expenses > 0 ? <DetailRow label="Expenses" value={ghs(s.expenses)} valueTone="danger" /> : null}
          {s.expenses > 0 ? <DetailRow label="Net giving" value={ghs(net)} valueTone="success" /> : null}
        </Section>

        {s.givingRecords.length > 0 ? (
          <Section title="Giving">
            {givingLines.filter(([, n]) => n > 0).map(([name, n]) => (
              <DetailRow key={name} label={name} value={ghs(n)} />
            ))}
            {methodLines.some(([, n]) => n > 0) ? (
              <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs }}>
                <AppText variant="captionStrong" tone="muted">PAID BY</AppText>
              </View>
            ) : null}
            {methodLines.filter(([, n]) => n > 0).map(([name, n]) => (
              <DetailRow key={name} label={name} value={ghs(n)} />
            ))}
          </Section>
        ) : null}

        {s.attendanceRecords.length > 0 ? (
          <Section title="Attendance records">
            {s.attendanceRecords.map(r => (
              <ListRow
                key={r.id}
                title={r.attendance_type === 'general' ? 'Head count' : 'Individual register'}
                subtitle={r.attendance_type === 'general' ? `${r.men_count ?? 0} men · ${r.women_count ?? 0} women · ${r.children_count ?? 0} children` : `${r.total_count} marked present`}
                value={String(r.total_count)}
              />
            ))}
          </Section>
        ) : null}

        {s.expenseRecords.length > 0 ? (
          <Section title="Expenses">
            {s.expenseRecords.map(e => (
              <ListRow key={e.id} title={e.details || e.form_id} subtitle={`${e.form_id} · ${e.payment_method_name}`} value={ghs(e.amount)} />
            ))}
          </Section>
        ) : null}

        {s.visitorRecords.length > 0 ? (
          <Section title="Visitors">
            {s.visitorRecords.map(v => (
              <ListRow key={v.id} title={v.name} subtitle={v.phone || undefined} />
            ))}
          </Section>
        ) : null}

        {s.childrenAttendance > 0 || s.childrenGiving > 0 || s.childrenVisitors > 0 ? (
          <Section title="Children's ministry">
            <DetailRow label="Present" value={String(s.childrenAttendance)} />
            <DetailRow label="Giving" value={ghs(s.childrenGiving)} valueTone="success" />
            <DetailRow label="Visitors" value={String(s.childrenVisitors)} />
          </Section>
        ) : null}

        <View style={{ alignItems: 'center' }}>
          <Badge label="Figures come from records stored on this device" tone="neutral" />
        </View>
      </ScrollView>
    </Screen>
  );
}
