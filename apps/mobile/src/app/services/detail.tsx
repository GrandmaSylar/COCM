import React, { useCallback, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, RefreshControl, ScrollView, View } from 'react-native';
import { Church } from '@tamagui/lucide-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { loadCachedServiceDetail, loadServiceDetail, ServiceDateDetail } from '../../lib/serviceRecords';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import {
  ChildrenSection,
  ExpenseList,
  fmtDate,
  GivingBreakdown,
  hasChildrenData,
  OverviewSection,
  PeopleSection,
  SetupSection,
} from '../../components/ServiceParts';
import { AppText, Badge, EmptyState, FilterChips, Screen } from '../../components/ui';
import { space } from '../../theme/tokens';

type SectionId = 'overview' | 'setup' | 'finances' | 'people' | 'children';

export default function ServiceDetailScreen() {
  const router = useRouter();
  const c = useAppColors();
  const params = useLocalSearchParams<{ date?: string; type?: string }>();
  const date = String(params.date ?? '');
  const type = String(params.type ?? '');
  const [detail, setDetail] = useState<ServiceDateDetail | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState<SectionId>('overview');
  const scroller = useRef<any>(null);
  const offsets = useRef<Partial<Record<SectionId, number>>>({});

  const load = useCallback(async () => {
    const result = await loadServiceDetail(date, type);
    setDetail(result?.detail ?? null);
    setStale(result?.stale ?? false);
  }, [date, type]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const cached = await loadCachedServiceDetail(date, type);
        if (alive && cached) {
          setDetail(cached);
          setStale(true);
          setLoading(false);
        }
        try {
          await load();
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [date, type, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y + 80;
    let best: SectionId = 'overview';
    for (const [id, top] of Object.entries(offsets.current) as [SectionId, number][]) {
      if (top <= y) best = id;
    }
    setActive(prev => (prev === best ? prev : best));
  };

  const goTo = (id: SectionId) => {
    setActive(id);
    scroller.current?.scrollTo({ y: Math.max(0, (offsets.current[id] ?? 0) - 56), animated: true });
  };

  const header = (
    <AppHeader
      title="Service detail"
      subtitle={detail ? `${fmtDate(detail.serviceDate, 'long')}${detail.serviceTypes?.length ? ` — ${detail.serviceTypes.join(', ')}` : ''}` : fmtDate(date, 'long')}
      showBack
    />
  );

  if (loading && !detail) {
    return (
      <Screen>
        {header}
        <View style={{ padding: space.md }}><SkeletonList count={4} hasAvatar={false} /></View>
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen>
        {header}
        <View style={{ padding: space.md }}>
          <EmptyState
            icon={Church}
            title="Service not available"
            message="It could not be loaded. Open it once while online and it will be available offline afterwards."
            action={{ label: 'Back to services', onPress: () => router.back() }}
          />
        </View>
      </Screen>
    );
  }

  const hasSetup = !!detail.serviceSetup;
  const hasChildren = hasChildrenData(detail);
  const pills: { value: SectionId; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    ...(hasSetup ? [{ value: 'setup' as SectionId, label: 'Setup' }] : []),
    { value: 'finances', label: 'Finances' },
    { value: 'people', label: 'People' },
    ...(hasChildren ? [{ value: 'children' as SectionId, label: 'Children' }] : []),
  ];

  const section = (id: SectionId, title: string, body: React.ReactNode) => (
    <View onLayout={e => { offsets.current[id] = e.nativeEvent.layout.y; }} style={{ gap: space.sm }}>
      <AppText variant="headline" accessibilityRole="header">{title}</AppText>
      {body}
    </View>
  );

  return (
    <Screen>
      {header}
      <View style={{ backgroundColor: c.background, paddingTop: space.xs }}>
        <FilterChips options={pills} value={active} onChange={goTo} />
      </View>
      <ScrollView
        ref={scroller}
        onScroll={onScroll}
        scrollEventThrottle={64}
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
      >
        {stale ? (
          <View style={{ alignItems: 'flex-start' }}>
            <Badge label="Offline: showing the last saved copy" tone="warning" />
          </View>
        ) : null}

        {section('overview', 'Overview', <OverviewSection sr={detail} />)}
        {hasSetup ? section('setup', 'Service setup', <SetupSection setup={detail.serviceSetup} />) : null}
        {section('finances', 'Finances', (
          <View style={{ gap: space.md }}>
            <GivingBreakdown sr={detail} />
            <ExpenseList expenses={detail.expenses ?? []} />
          </View>
        ))}
        {section('people', 'People', (
          <PeopleSection
            sr={detail}
            onViewMember={id => router.push(`/members/${id}` as any)}
            onConvertVisitor={v => router.push(`/members/add?fromVisitorId=${encodeURIComponent(v.id)}` as any)}
          />
        ))}
        {hasChildren ? section('children', 'Children', <ChildrenSection sr={detail} />) : null}
      </ScrollView>
    </Screen>
  );
}
