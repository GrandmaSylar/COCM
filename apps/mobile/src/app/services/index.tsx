import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { CalendarPlus, Church } from '@tamagui/lucide-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  loadCachedServiceSetups,
  loadCachedServicesOverview,
  loadServiceSetups,
  loadServicesOverview,
  ServiceDateSummary,
} from '../../lib/serviceRecords';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import { FeaturedCard, monthLabel, serviceHref, SetupCard, StatsBar, TimelineRow } from '../../components/ServiceParts';
import { AppText, Badge, Button, EmptyState, IconButton, Screen, Section, Surface } from '../../components/ui';
import { space } from '../../theme/tokens';

export default function ServicesScreen() {
  const router = useRouter();
  const c = useAppColors();
  const [today, setToday] = useState<ServiceDateSummary[]>([]);
  const [past, setPast] = useState<ServiceDateSummary[]>([]);
  const [setups, setSetups] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offline, setOffline] = useState(false);
  const everLoaded = useRef(false);

  const fetchAll = useCallback(async () => {
    const [overview, setupResult] = await Promise.all([loadServicesOverview(1), loadServiceSetups()]);
    if (overview) {
      setToday(overview.today);
      setPast(overview.records);
      setTotal(overview.total);
      setPage(1);
    }
    setSetups(setupResult.setups);
    setOffline(!overview || overview.stale);
  }, []);

  // Show the cached copy straight away, then refresh from the server.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!everLoaded.current) {
          const [cachedOverview, cachedSetups] = await Promise.all([loadCachedServicesOverview(), loadCachedServiceSetups()]);
          if (active && cachedOverview) {
            setToday(cachedOverview.today);
            setPast(cachedOverview.records);
            setTotal(cachedOverview.total);
            setSetups(cachedSetups ?? []);
            setLoading(false);
          }
        }
        try {
          await fetchAll();
        } finally {
          if (active) {
            setLoading(false);
            everLoaded.current = true;
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [fetchAll])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await loadServicesOverview(page + 1);
      if (next) {
        setPast(prev => [...prev, ...next.records]);
        setTotal(next.total);
        setPage(next.page);
      }
    } catch {
      // Offline or a failed page: keep what is shown; the button stays so it can be retried.
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = (() => {
    const map = new Map<string, ServiceDateSummary[]>();
    for (const r of past) {
      if (!r.serviceDate) continue;
      const key = r.serviceDate.slice(0, 7);
      map.set(key, [...(map.get(key) || []), r]);
    }
    return [...map.entries()];
  })();

  const todayIsToday = today[0]?.serviceDate === new Date().toISOString().split('T')[0];
  const open = (date: string, type?: string) => router.push(serviceHref(date, type));
  const setupRoute = (setup?: any) => router.push((setup ? `/services/setup?id=${encodeURIComponent(setup.id)}` : '/services/setup') as any);

  return (
    <Screen>
      <AppHeader
        title="Services"
        subtitle="Attendance and giving by service"
        showBack
        rightElement={<IconButton icon={CalendarPlus} label="Service setup" tone="primary" onPress={() => setupRoute()} />}
      />
      {loading ? (
        <View style={{ padding: space.md }}><SkeletonList count={5} hasAvatar={false} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.lg, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
        >
          {offline ? (
            <View style={{ alignItems: 'flex-start' }}>
              <Badge label="Offline: showing the last saved copy" tone="warning" />
            </View>
          ) : null}

          <StatsBar records={past} total={total} />

          <Section title="Service setups">
            {setups.length === 0 ? (
              <View style={{ padding: space.md }}>
                <AppText variant="caption" tone="muted" align="center">No service setups yet.</AppText>
              </View>
            ) : (
              <View style={{ gap: space.sm, padding: space.sm }}>
                {setups.map(s => <SetupCard key={s.id} setup={s} onPress={() => setupRoute(s)} />)}
              </View>
            )}
          </Section>

          {today.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <AppText variant="captionStrong" tone="muted" style={{ paddingHorizontal: 4 }}>
                {(todayIsToday ? "Today's service" : 'Latest service').toUpperCase()}
              </AppText>
              {today.map(sr => (
                <FeaturedCard key={`${sr.serviceDate}_${sr.serviceType || 'NA'}`} sr={sr} onPress={() => open(sr.serviceDate, sr.serviceType)} />
              ))}
            </View>
          ) : null}

          <View style={{ gap: space.sm }}>
            <AppText variant="captionStrong" tone="muted" style={{ paddingHorizontal: 4 }}>ALL SERVICES</AppText>
            {groups.length === 0 ? (
              <EmptyState
                icon={Church}
                title="No service records yet"
                message={offline ? 'Connect once to load your services; they are then available offline.' : 'Services appear here once attendance or giving has been recorded for a date.'}
              />
            ) : (
              groups.map(([key, items]) => (
                <View key={key} style={{ gap: 4 }}>
                  <AppText variant="captionStrong" tone="muted" style={{ paddingHorizontal: 4 }}>{monthLabel(key)}</AppText>
                  <Surface padded={false} style={{ overflow: 'hidden' }}>
                    {items.map((sr, i) => (
                      <TimelineRow key={`${sr.serviceDate}_${sr.serviceType || 'NA'}`} sr={sr} last={i === items.length - 1} onPress={() => open(sr.serviceDate, sr.serviceType)} />
                    ))}
                  </Surface>
                </View>
              ))
            )}
            {page * 15 < total ? (
              <View style={{ alignItems: 'center', paddingTop: space.sm }}>
                <Button label={loadingMore ? 'Loading…' : 'Load more'} variant="secondary" loading={loadingMore} onPress={loadMore} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
