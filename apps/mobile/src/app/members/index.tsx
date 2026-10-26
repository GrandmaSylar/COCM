import React, { useEffect, useState, useCallback } from 'react';
import { RefreshControl, FlatList, Alert, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ChevronRight,
  ChevronLeft,
  Download,
  Info,
  RefreshCw,
  SearchX,
  UserPlus,
  Users,
} from '@tamagui/lucide-icons';
import { getLocalDb, LocalMember } from '../../lib/db';
import { getOrCacheProfilePhoto } from '../../lib/photoCache';
import { syncMembers } from '../../lib/syncEngine';
import { getChurchZones } from '../../lib/options';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import {
  AppText, Badge, Chip, EmptyState, FilterChips, IconButton, PersonRow, rowPosition, Screen, SearchField, Sheet, Surface, useToast,
} from '../../components/ui';
import { memberStatusTone, statusLabel } from '../../theme/status';
import { space } from '../../theme/tokens';

const DEFAULT_ZONES = ['All', 'Zone A', 'Zone B', 'Zone F', 'Zone K', 'Zone M', 'Zone R'];

const MEMBER_STATUS_DEFINITIONS = {
  new: 'Recently registered, awaiting 4 Sunday Main Service records for evaluation',
  active: 'Present in 3-4 of last 4 Sunday Main Services',
  'semi-active': 'Present in 1-2 of last 4 Sunday Main Services',
  inactive: 'Absent from all last 4 Sunday Main Services',
  sick: 'Absent for a long period due to verified illness',
  traveled: 'Absent for a long period due to travel/relocation with notification',
  schooling: 'Absent for a long period due directly to educational reasons',
  'not baptised': 'Member has not undergone water baptism',
  blacklisted: 'Sacked or removed'
} as const;

export default function MembersScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useAppColors();
  const [members, setMembers] = useState<LocalMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<LocalMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');
  const [zoneOptions, setZoneOptions] = useState<string[]>(DEFAULT_ZONES);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'zone' | 'status'>('name');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});

  // Collapsible Accordions State
  const [statusDefsOpen, setStatusDefsOpen] = useState(false);

  // 1. Fetch Local SQLite Roster (All Members)
  const fetchLocalMembers = useCallback(async () => {
    try {
      const db = await getLocalDb();
      const rows = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');
      setMembers(rows);
      applyFiltersAndSort(rows, searchQuery, selectedZone, statusFilter, sortBy);

      // Process WhatsApp-style local avatar disk caching
      const photoMap: Record<string, string> = {};
      for (const m of rows.slice(0, 50)) {
        if (m.photo_url || m.local_photo_path) {
          const diskPath = await getOrCacheProfilePhoto(m.id, m.local_photo_path || m.photo_url);
          if (diskPath) photoMap[m.id] = diskPath;
        }
      }
      setAvatarMap(prev => ({ ...prev, ...photoMap }));

    } catch (err) {
      console.warn('Error reading SQLite members roster:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, selectedZone, statusFilter, sortBy]);

  // 2. Fetch Remote Members from Supabase
  const syncRemoteMembers = useCallback(async () => {
    try {
      await syncMembers();
      await fetchLocalMembers();
    } catch (err) {
      console.warn('Sync remote members failed, using local SQLite:', err);
    }
  }, [fetchLocalMembers]);

  useEffect(() => {
    fetchLocalMembers();
    syncRemoteMembers();
    getChurchZones()
      .then((zones: string[]) => {
        if (zones.length > 0) {
          setZoneOptions(['All', ...zones.map((z: string) => `Zone ${z}`)]);
        }
      })
      .catch((err: any) => console.warn('Error loading dynamic zones in directory:', err));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLocalMembers();
    }, [fetchLocalMembers])
  );

  const applyFiltersAndSort = (
    list: LocalMember[], 
    query: string, 
    zone: string, 
    status: string, 
    sortField: 'name' | 'zone' | 'status'
  ) => {
    let result = [...list];

    // Zone Filter
    if (zone !== 'All') {
      const zoneLetter = zone.replace('Zone ', '').trim();
      result = result.filter(m => m.zone === zoneLetter || m.zone === zone);
    }

    // Status Filter
    if (status !== 'all') {
      result = result.filter(m => m.status?.toLowerCase() === status.toLowerCase());
    }

    // Text Search
    if (query.trim() !== '') {
      const q = query.toLowerCase();
      result = result.filter(m => 
        m.name.toLowerCase().includes(q) || 
        (m.phone && m.phone.includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortField === 'name') return a.name.localeCompare(b.name);
      if (sortField === 'zone') return (a.zone || '').localeCompare(b.zone || '');
      if (sortField === 'status') return (a.status || '').localeCompare(b.status || '');
      return 0;
    });

    setFilteredMembers(result);
    setCurrentPage(1);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    applyFiltersAndSort(members, text, selectedZone, statusFilter, sortBy);
  };

  const handleZoneSelect = (zone: string) => {
    setSelectedZone(zone);
    applyFiltersAndSort(members, searchQuery, zone, statusFilter, sortBy);
  };

  const onRefresh = () => {
    setRefreshing(true);
    syncRemoteMembers();
  };

  const handleExportRoster = () => {
    Alert.alert(
      'Export Members Roster',
      `Export current roster of ${filteredMembers.length} members?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Export CSV / PDF', 
          onPress: () => toast.show({ title: 'Roster ready', message: `${filteredMembers.length} members prepared for export.` }) 
        }
      ]
    );
  };

  // Status Summary Counts
  const totalCount = members.length;
  const activeCount = members.filter(m => m.status === 'active').length;
  const newCount = members.filter(m => m.status === 'new').length;
  const inactiveCount = members.filter(m => m.status === 'inactive').length;

  // Pagination Computations
  const totalFiltered = filteredMembers.length;
  const totalPages = Math.ceil(totalFiltered / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalFiltered);
  const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

  const handleStatusSelect = (status: string) => {
    setStatusFilter(status);
    applyFiltersAndSort(members, searchQuery, selectedZone, status, sortBy);
  };

  const hasFilters = !!searchQuery || selectedZone !== 'All' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedZone('All');
    setStatusFilter('all');
    applyFiltersAndSort(members, '', 'All', 'all', sortBy);
  };

  return (
    <Screen>
      <AppHeader
        title="Members"
        subtitle={`${totalCount.toLocaleString()} registered`}
        showBack
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={RefreshCw} label="Refresh" spinning={refreshing} onPress={onRefresh} />
            <IconButton icon={Download} label="Export roster" onPress={handleExportRoster} />
            <IconButton icon={UserPlus} label="Add member" tone="primary" onPress={() => router.push('/members/add' as any)} />
          </View>
        }
      />

      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs, gap: space.sm, backgroundColor: c.background }}>
        <SearchField value={searchQuery} onChangeText={handleSearchChange} placeholder="Search name, phone or email" />
        <FilterChips
          value={statusFilter}
          onChange={handleStatusSelect}
          options={[
            { value: 'all', label: `All · ${totalCount}` },
            { value: 'active', label: `Active · ${activeCount}` },
            { value: 'new', label: `New · ${newCount}` },
            { value: 'inactive', label: `Inactive · ${inactiveCount}` },
          ]}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <View style={{ flex: 1 }}>
            <FilterChips
              value={selectedZone}
              onChange={handleZoneSelect}
              options={zoneOptions.map(z => ({ value: z, label: z === 'All' ? 'All zones' : z }))}
            />
          </View>
          <IconButton icon={Info} label="What each status means" size={36} onPress={() => setStatusDefsOpen(true)} />
        </View>
      </View>

      {loading ? (
        <View style={{ padding: space.md }}>
          <SkeletonList count={6} hasAvatar />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={paginatedMembers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.md, paddingTop: space.xs, paddingBottom: space.xxl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
          ListHeaderComponent={
            totalFiltered > 0 ? (
              <AppText variant="caption" tone="muted" style={{ paddingHorizontal: 4, paddingBottom: space.xs }}>
                {hasFilters ? `${totalFiltered} of ${totalCount} members` : `${totalCount} members`}
              </AppText>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={hasFilters ? SearchX : Users}
              title={hasFilters ? 'No members match' : 'No members yet'}
              message={searchQuery ? `Nothing matches "${searchQuery}".` : hasFilters ? 'Try a different zone or status.' : 'Register your first member to get started.'}
              action={hasFilters ? { label: 'Clear filters', onPress: clearFilters } : { label: 'Add member', onPress: () => router.push('/members/add' as any) }}
            />
          }
          renderItem={({ item, index }) => {
            const avatarUri = avatarMap[item.id] || item.local_photo_path || item.photo_url;
            let zoneNum = item.zone_number;
            if (!zoneNum && item.raw_json) {
              try { const p = JSON.parse(item.raw_json); zoneNum = p.zoneNumber || p.zone_number; } catch(e){}
            }
            const zoneLabel = zoneNum
              ? (item.zone ? `Zone ${item.zone} · ${zoneNum}` : zoneNum)
              : (item.zone ? `Zone ${item.zone}` : 'No zone');

            return (
              <PersonRow
                name={item.name}
                photoUri={avatarUri}
                position={rowPosition(index, paginatedMembers.length)}
                meta={
                  <>
                    <Badge label={zoneLabel} tone="neutral" />
                    <Badge label={statusLabel(item.status)} tone={memberStatusTone(item.status)} />
                  </>
                }
                subtitle={item.phone || undefined}
                phone={item.phone}
                onPress={() => router.push(`/members/${item.id}` as any)}
              />
            );
          }}
          ListFooterComponent={
            totalFiltered > 0 ? (
              <View style={{ gap: space.sm, paddingTop: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <IconButton icon={ChevronLeft} label="Previous page" size={40} disabled={currentPage === 1} onPress={() => setCurrentPage(p => Math.max(1, p - 1))} />
                  <AppText variant="captionStrong" tone="muted" numeric>
                    {startIndex + 1}–{endIndex} of {totalFiltered} · page {currentPage}/{totalPages}
                  </AppText>
                  <IconButton icon={ChevronRight} label="Next page" size={40} disabled={currentPage >= totalPages} onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs }}>
                  <AppText variant="caption" tone="subtle">Per page</AppText>
                  {[10, 20, 50].map((sz) => (
                    <Chip key={sz} label={String(sz)} selected={rowsPerPage === sz} onPress={() => { setRowsPerPage(sz); setCurrentPage(1); }} />
                  ))}
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Status guide */}
      <Sheet visible={statusDefsOpen} onClose={() => setStatusDefsOpen(false)} title="Member statuses" subtitle="How each status is decided">
        <Surface padded={false}>
          {Object.entries(MEMBER_STATUS_DEFINITIONS).map(([key, def], i) => (
            <View key={key} style={{ flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <View style={{ width: 104 }}>
                <Badge label={statusLabel(key)} tone={memberStatusTone(key)} />
              </View>
              <AppText variant="caption" tone="muted" style={{ flex: 1 }}>{def}</AppText>
            </View>
          ))}
        </Surface>
      </Sheet>
    </Screen>
  );
}
