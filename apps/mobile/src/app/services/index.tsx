import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Banknote, Church, SearchX, UserMinus, UserPlus, Users, Receipt } from '@tamagui/lucide-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { loadServiceSummaries, refreshServiceData, ServiceSummary } from '../../lib/serviceRecords';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import { AppText, Badge, EmptyState, ListRow, PressableScale, Screen, SearchField, Section, StatTile } from '../../components/ui';
import { space } from '../../theme/tokens';

const ghs = (n: number) => `GH₵ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string, long = false) => {
  const date = new Date(d);
  return isNaN(date.getTime())
    ? d
    : date.toLocaleDateString([], long
        ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
        : { weekday: 'short', day: 'numeric', month: 'short' });
};

const monthLabel = (d: string) => {
  const date = new Date(d);
  return isNaN(date.getTime()) ? 'Other' : date.toLocaleDateString([], { month: 'long', year: 'numeric' });
};

export const serviceHref = (s: Pick<ServiceSummary, 'date' | 'type'>) =>
  `/services/detail?date=${encodeURIComponent(s.date)}&type=${encodeURIComponent(s.type)}` as any;

export default function ServicesScreen() {
  const router = useRouter();
  const c = useAppColors();
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setServices(await loadServiceSummaries());
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Show what is stored right away, then pull fresh records and re-read.
  useFocusEffect(
    useCallback(() => {
      load();
      refreshServiceData().then(load).catch(() => {});
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

  const latest = services[0];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(s => s.type.toLowerCase().includes(q) || s.date.includes(q) || fmtDate(s.date, true).toLowerCase().includes(q));
  }, [services, search]);

  const groups = useMemo(() => {
    const map = new Map<string, ServiceSummary[]>();
    for (const s of filtered) {
      const label = monthLabel(s.date);
      map.set(label, [...(map.get(label) || []), s]);
    }
    return [...map.entries()];
  }, [filtered]);

  const avgAttendance = services.length ? Math.round(services.reduce((n, s) => n + s.totalAttendance, 0) / services.length) : 0;
  const totalGiving = services.reduce((n, s) => n + s.totalGiving, 0);

  return (
    <Screen>
      <AppHeader title="Services" subtitle="Attendance and giving by service" showBack />
      {loading ? (
        <View style={{ padding: space.md }}><SkeletonList count={5} hasAvatar={false} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
          keyboardShouldPersistTaps="handled"
        >
          {services.length === 0 ? (
            <EmptyState
              icon={Church}
              title="No services yet"
              message="Services appear here once attendance or giving has been recorded for a date."
            />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <StatTile label="Services" value={String(services.length)} icon={Church} tone="info" />
                <StatTile label="Avg attendance" value={String(avgAttendance)} icon={Users} tone="warning" />
              </View>
              <StatTile label="Total giving" value={ghs(totalGiving)} icon={Banknote} tone="success" valueTone="success" />

              {latest && !search ? (
                <Section title="Latest service">
                  <PressableScale onPress={() => router.push(serviceHref(latest))} accessibilityRole="button" accessibilityLabel={`${latest.type}, ${fmtDate(latest.date, true)}`}>
                    <View style={{ padding: space.md, gap: space.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                        <AppText variant="bodyStrong">{fmtDate(latest.date, true)}</AppText>
                        <Badge label={latest.type} tone="primary" />
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm }}>
                        {[
                          { icon: Users, label: String(latest.totalAttendance), note: 'present', color: c.primary.base },
                          { icon: Banknote, label: ghs(latest.totalGiving), note: '', color: c.success.base },
                          { icon: UserMinus, label: String(latest.absentees), note: 'absent', color: c.warning.base },
                          { icon: UserPlus, label: String(latest.visitors), note: 'visitors', color: c.info.base },
                          ...(latest.expenses > 0 ? [{ icon: Receipt, label: ghs(latest.expenses), note: 'expenses', color: c.danger.base }] : []),
                        ].map((item, i) => (
                          <View key={i} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <item.icon size={16} color={item.color} />
                            <AppText variant="bodyMedium" numeric>{item.label}</AppText>
                            {item.note ? <AppText variant="caption" tone="muted">{item.note}</AppText> : null}
                          </View>
                        ))}
                      </View>
                      {latest.expenses > 0 ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.border }}>
                          <AppText variant="caption" tone="muted">Net giving (after expenses)</AppText>
                          <AppText variant="captionStrong" tone="success" numeric>{ghs(latest.totalGiving - latest.expenses)}</AppText>
                        </View>
                      ) : null}
                    </View>
                  </PressableScale>
                </Section>
              ) : null}

              <SearchField value={search} onChangeText={setSearch} placeholder="Search by date or service type" />

              {groups.length === 0 ? (
                <EmptyState icon={SearchX} title="No services match" message={`Nothing matches "${search}".`} action={{ label: 'Clear search', onPress: () => setSearch('') }} />
              ) : (
                groups.map(([label, items]) => (
                  <Section key={label} title={label}>
                    {items.map(s => (
                      <ListRow
                        key={s.key}
                        title={fmtDate(s.date)}
                        subtitle={`${s.type} · ${s.totalAttendance} present`}
                        value={ghs(s.totalGiving)}
                        onPress={() => router.push(serviceHref(s))}
                        chevron
                      />
                    ))}
                  </Section>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
