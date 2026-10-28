import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, FlatList, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { RefreshCw, SearchX, UserCheck, UserPlus } from '@tamagui/lucide-icons';
import { getLocalVisitors } from '../../lib/db';
import { syncVisitors } from '../../lib/syncEngine';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import { Badge, Button, EmptyState, IconButton, PersonRow, rowPosition, Screen, SearchField } from '../../components/ui';
import { useAccess } from '../../lib/access';
import { space } from '../../theme/tokens';

interface Visitor {
  id: string;
  name: string;
  phone?: string;
  residence?: string;
  visit_date: string;
  status?: string;
  converted: boolean;
}

export default function VisitorsScreen() {
  const router = useRouter();
  const c = useAppColors();
  const { can } = useAccess();
  // Converting creates a member, so it needs the same access as adding one (the web checks manage_members).
  const canConvert = can('members');
  const [search, setSearch] = useState('');
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLocalVisitors = async () => {
    try {
      const localRows = await getLocalVisitors();
      if (localRows) {
        const formatted = localRows.map((v) => {
          let residence = '';
          let converted = (v.follow_up_status || '').toLowerCase() === 'converted';
          if (v.raw_json) {
            try {
              const parsed = JSON.parse(v.raw_json);
              residence = parsed.residence || '';
              if (parsed.convertedToMember) converted = true;
            } catch (e) {}
          }
          return {
            id: v.id,
            name: v.name,
            phone: v.phone || undefined,
            residence: residence || (v.potential_zone ? `Zone ${v.potential_zone}` : undefined),
            visit_date: v.visit_date,
            status: v.follow_up_status || 'New',
            converted,
          };
        });
        setVisitors(formatted);
        setLoading(false);
      }
    } catch (err) {
      console.warn('Error reading SQLite visitors:', err);
    }
  };

  const fetchRemoteVisitors = async () => {
    try {
      // Pull into SQLite (keeps visitors still waiting in the outbox), then render from SQLite
      await syncVisitors();
      await loadLocalVisitors();
    } catch (err) {
      console.warn('Error syncing remote visitors, using SQLite cache:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRemoteVisitors();
  }, []);

  // Re-read SQLite whenever the screen is shown again, so a visitor converted on the next screen updates here.
  useFocusEffect(
    useCallback(() => {
      loadLocalVisitors();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRemoteVisitors();
  };

  const q = search.trim().toLowerCase();
  const shown = q
    ? visitors.filter(v => v.name.toLowerCase().includes(q) || (v.phone || '').includes(q) || (v.residence || '').toLowerCase().includes(q))
    : visitors;

  const followUpTone = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending' || s === 'new') return 'warning' as const;
    if (s.includes('contact') || s.includes('done') || s === 'completed') return 'success' as const;
    return 'neutral' as const;
  };

  const formatVisit = (d: string) => {
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Screen>
      <AppHeader
        title="Visitors"
        subtitle={`${visitors.length} recorded`}
        showBack
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={RefreshCw} label="Refresh" spinning={refreshing} onPress={onRefresh} />
            <IconButton icon={UserPlus} label="Add visitor" tone="primary" onPress={() => router.push('/visitors/add' as any)} />
          </View>
        }
      />

      {visitors.length > 0 ? (
        <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs, backgroundColor: c.background }}>
          <SearchField value={search} onChangeText={setSearch} placeholder="Search name, phone or area" />
        </View>
      ) : null}

      {loading ? (
        <View style={{ padding: space.md }}>
          <SkeletonList count={5} hasAvatar />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.md, paddingTop: space.xs, paddingBottom: space.xxl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
          ListEmptyComponent={
            q ? (
              <EmptyState icon={SearchX} title="No visitors match" message={`Nothing matches "${search}".`} action={{ label: 'Clear search', onPress: () => setSearch('') }} />
            ) : (
              <EmptyState icon={UserCheck} title="No visitors yet" message="Log first-time guests so they can be followed up." action={{ label: 'Add visitor', onPress: () => router.push('/visitors/add' as any) }} />
            )
          }
          renderItem={({ item, index }) => (
            <PersonRow
              name={item.name}
              position={rowPosition(index, shown.length)}
              dimmed={item.converted}
              meta={
                item.converted ? (
                  <Badge label="Converted to member" tone="neutral" icon={UserCheck} />
                ) : (
                  <Badge label={item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'New'} tone={followUpTone(item.status)} />
                )
              }
              footer={
                !item.converted && canConvert ? (
                  <Button
                    label="Convert to member"
                    variant="secondary"
                    size="sm"
                    icon={UserPlus}
                    accessibilityLabel={`Convert ${item.name} to a member`}
                    onPress={() => router.push(`/members/add?fromVisitorId=${encodeURIComponent(item.id)}` as any)}
                  />
                ) : undefined
              }
              subtitle={[`Visited ${formatVisit(item.visit_date)}`, item.residence].filter(Boolean).join(' · ')}
              phone={item.phone}
            />
          )}
        />
      )}
    </Screen>
  );
}
