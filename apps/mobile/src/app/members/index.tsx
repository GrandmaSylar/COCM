import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshControl, TouchableOpacity, Image, Linking, FlatList, NativeSyntheticEvent, NativeScrollEvent, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  YStack, 
  XStack, 
  Text, 
  Card, 
  H2, 
  Paragraph, 
  Input, 
  Button, 
  Spinner,
  ScrollView,
  Separator
} from 'tamagui';
import { 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  User,
  Inbox,
  UserPlus,
  Eye,
  Info,
  BarChart3,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight
} from '@tamagui/lucide-icons';
import { getLocalDb, upsertLocalMember, LocalMember } from '../../lib/db';
import { getOrCacheProfilePhoto } from '../../lib/photoCache';
import { supabase } from '../../lib/supabase';
import { getChurchZones } from '../../lib/options';
import { AppHeader } from '../../components/AppHeader';

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

  // Header Scroll Collapse State
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});

  // Collapsible Accordions State
  const [statusDefsOpen, setStatusDefsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

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
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && !error) {
        for (const m of data) {
          await upsertLocalMember({
            id: m.id,
            name: m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Member',
            phone: m.phone || m.primary_phone,
            email: m.email,
            role: m.role || m.position,
            zone: m.zone,
            ministry: m.ministry,
            photo_url: m.photo_url || m.photo,
            status: m.status || 'active',
            created_at: m.created_at || new Date().toISOString()
          });
        }
        await fetchLocalMembers();
      }
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
          onPress: () => Alert.alert('Success', 'Roster summary prepared for export.') 
        }
      ]
    );
  };

  // Smooth scroll collapse listener
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const yOffset = event.nativeEvent.contentOffset.y;
    if (yOffset > 80 && !isHeaderCollapsed) {
      setIsHeaderCollapsed(true);
    } else if (yOffset <= 15 && isHeaderCollapsed) {
      setIsHeaderCollapsed(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return '#34C759';
      case 'new': return '#007AFF';
      case 'semi-active': return '#FF9500';
      case 'inactive': return '#8E8E93';
      case 'sick': return '#FF3B30';
      default: return '#34C759';
    }
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

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Members Directory"
        subtitle={`${totalCount} Registered Congregation Members`}
        showBack
        backTitle="People"
        rightElement={
          <XStack space="$2" alignItems="center">
            <TouchableOpacity onPress={onRefresh} style={{ padding: 7, borderRadius: 8, backgroundColor: 'rgba(0, 122, 255, 0.12)' }}>
              <RefreshCw size={16} color="#007AFF" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleExportRoster} style={{ padding: 7, borderRadius: 8, backgroundColor: 'rgba(52, 199, 89, 0.12)' }}>
              <Download size={16} color="#34C759" />
            </TouchableOpacity>
            
            <Button
              size="$3"
              backgroundColor="#007AFF"
              borderRadius="$3"
              onPress={() => router.push('/members/add' as any)}
              icon={<Plus size={14} color="#FFFFFF" />}
              pressStyle={{ scale: 0.98 }}
            >
              <Text color="#FFFFFF" fontWeight="700" fontSize={12}>+ Add Member</Text>
            </Button>
          </XStack>
        }
      />

      {/* Header Controls */}
      <YStack space="$3" padding="$3.5">
        {/* Collapsible 1: Status Definitions Accordion */}
        <Card borderRadius="$3" backgroundColor="rgba(0, 122, 255, 0.06)" borderColor="rgba(0, 122, 255, 0.2)" borderWidth={1}>
          <TouchableOpacity onPress={() => setStatusDefsOpen(!statusDefsOpen)} style={{ padding: 10 }}>
            <XStack justifyContent="space-between" alignItems="center">
              <XStack space="$2" alignItems="center">
                <Info size={14} color="#007AFF" />
                <Text color="$color" fontSize={12} fontWeight="700">Status Definitions</Text>
              </XStack>
              {statusDefsOpen ? <ChevronUp size={14} color="#007AFF" /> : <ChevronDown size={14} color="#007AFF" />}
            </XStack>
          </TouchableOpacity>

          {statusDefsOpen && (
            <YStack padding="$3" borderTopWidth={1} borderColor="rgba(0, 122, 255, 0.12)" space="$2">
              {Object.entries(MEMBER_STATUS_DEFINITIONS).map(([key, def]) => (
                <YStack key={key}>
                  <Text color="#007AFF" fontSize={11} fontWeight="700">{key.toUpperCase()}:</Text>
                  <Text color="$colorPress" fontSize={11}>{def}</Text>
                </YStack>
              ))}
            </YStack>
          )}
        </Card>

        {/* Collapsible 2: Member Statistics Accordion */}
        <Card borderRadius="$3" backgroundColor="rgba(52, 199, 89, 0.06)" borderColor="rgba(52, 199, 89, 0.2)" borderWidth={1}>
          <TouchableOpacity onPress={() => setStatsOpen(!statsOpen)} style={{ padding: 10 }}>
            <XStack justifyContent="space-between" alignItems="center">
              <XStack space="$2" alignItems="center">
                <BarChart3 size={14} color="#34C759" />
                <Text color="$color" fontSize={12} fontWeight="700">Statistics ({totalCount})</Text>
              </XStack>
              {statsOpen ? <ChevronUp size={14} color="#34C759" /> : <ChevronDown size={14} color="#34C759" />}
            </XStack>
          </TouchableOpacity>

          {statsOpen && (
            <XStack padding="$2.5" borderTopWidth={1} borderColor="rgba(52, 199, 89, 0.12)" justifyContent="space-around">
              <YStack alignItems="center">
                <Text color="#34C759" fontSize={16} fontWeight="800">{activeCount}</Text>
                <Text color="$colorPress" fontSize={10}>Active</Text>
              </YStack>
              <YStack alignItems="center">
                <Text color="#007AFF" fontSize={16} fontWeight="800">{newCount}</Text>
                <Text color="$colorPress" fontSize={10}>New</Text>
              </YStack>
              <YStack alignItems="center">
                <Text color="#8E8E93" fontSize={16} fontWeight="800">{inactiveCount}</Text>
                <Text color="$colorPress" fontSize={10}>Inactive</Text>
              </YStack>
            </XStack>
          )}
        </Card>

        {/* Search Bar */}
        <YStack position="relative" justifyContent="center">
          <Input
            placeholder="Search name, zone, phone..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            backgroundColor="$background"
            borderColor="$borderColor"
            borderRadius="$4"
            paddingLeft="$8"
            fontSize={13}
            height={38}
          />
          <YStack position="absolute" left={10} zIndex={10}>
            <Search size={15} color="#8E8E93" />
          </YStack>
        </YStack>

        {/* Zone Quick Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack space="$1.5">
            {zoneOptions.map((zone) => {
              const active = selectedZone === zone;
              return (
                <TouchableOpacity
                  key={zone}
                  onPress={() => handleZoneSelect(zone)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                    backgroundColor: active ? '#007AFF' : 'rgba(142, 142, 147, 0.12)',
                  }}
                >
                  <Text color={active ? '#FFFFFF' : '$color'} fontSize={11} fontWeight={active ? '700' : '600'}>
                    {zone}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </XStack>
        </ScrollView>
      </YStack>

      {/* Member Roster List */}
      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color="#007AFF" />
          <Text color="$colorPress" marginTop="$2" fontSize={13}>Loading members roster ({totalCount} Total)...</Text>
        </YStack>
      ) : paginatedMembers.length > 0 ? (
        <FlatList
          style={{ flex: 1 }}
          data={paginatedMembers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007AFF']} />}
          renderItem={({ item }) => {
            const avatarUri = avatarMap[item.id] || item.local_photo_path || item.photo_url;
            const statusColor = getStatusColor(item.status);
            const zoneLabel = item.zone ? `Zone ${item.zone}` : 'Floating';

            return (
              <Card
                marginBottom="$2.5"
                padding="$3.5"
                borderRadius="$4"
                backgroundColor="$cardBackground"
                borderColor="$borderColor"
                borderWidth={1}
                elevate
                pressStyle={{ scale: 0.98 }}
                onPress={() => router.push(`/members/${item.id}` as any)}
              >
                <XStack space="$3" alignItems="center" justifyContent="space-between">
                  {/* Avatar */}
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                    />
                  ) : (
                    <YStack width={44} height={44} borderRadius={22} backgroundColor="rgba(0, 122, 255, 0.12)" justifyContent="center" alignItems="center">
                      <User size={22} color="#007AFF" />
                    </YStack>
                  )}

                  {/* Member Details */}
                  <YStack flex={1} space="$1">
                    <Text color="$color" fontSize={15} fontWeight="700" numberOfLines={1}>{item.name}</Text>
                    
                    <XStack space="$1.5" alignItems="center" flexWrap="wrap">
                      <XStack backgroundColor="rgba(0, 122, 255, 0.12)" px="$2" py="$0.5" borderRadius="$2">
                        <Text color="#007AFF" fontSize={10} fontWeight="700">{zoneLabel}</Text>
                      </XStack>
                      <XStack backgroundColor={`${statusColor}20`} px="$2" py="$0.5" borderRadius="$2">
                        <Text color={statusColor} fontSize={10} fontWeight="700">{(item.status || 'active').toLowerCase()}</Text>
                      </XStack>
                    </XStack>

                    {item.phone ? (
                      <XStack space="$1" alignItems="center">
                        <Phone size={11} color="#8E8E93" />
                        <Text color="$colorPress" fontSize={11}>{item.phone}</Text>
                      </XStack>
                    ) : null}
                  </YStack>

                  {/* Actions / Right Chevron */}
                  <XStack space="$2" alignItems="center">
                    {item.phone ? (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                        <YStack p="$2" borderRadius="$3" backgroundColor="rgba(52, 199, 89, 0.12)">
                          <Phone size={15} color="#34C759" />
                        </YStack>
                      </TouchableOpacity>
                    ) : null}
                    <ChevronRight size={18} color="#8E8E93" />
                  </XStack>
                </XStack>
              </Card>
            );
          }}
          ListFooterComponent={
            totalFiltered > 0 ? (
              <XStack justifyContent="space-between" alignItems="center" paddingTop="$2" borderTopWidth={1} borderColor="$borderColor">
                <XStack space="$1" alignItems="center">
                  <Text color="$colorPress" fontSize={11}>Per page:</Text>
                  {[10, 20, 50].map((sz) => {
                    const active = rowsPerPage === sz;
                    return (
                      <TouchableOpacity 
                        key={sz} 
                        onPress={() => { setRowsPerPage(sz); setCurrentPage(1); }}
                        style={{
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: active ? '#007AFF' : 'rgba(142, 142, 147, 0.12)',
                        }}
                      >
                        <Text color={active ? '#FFFFFF' : '$color'} fontSize={11} fontWeight={active ? '700' : '600'}>{sz}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </XStack>

                <XStack space="$2" alignItems="center">
                  <Text color="$colorPress" fontSize={11}>{startIndex + 1}-{endIndex} of {totalFiltered}</Text>
                  <TouchableOpacity disabled={currentPage === 1} onPress={() => setCurrentPage(p => Math.max(1, p - 1))}>
                    <YStack p="$1.5" borderRadius="$2" backgroundColor={currentPage === 1 ? '$borderColor' : '#007AFF'}>
                      <ChevronLeft size={14} color="#FFFFFF" />
                    </YStack>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={currentPage >= totalPages} onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                    <YStack p="$1.5" borderRadius="$2" backgroundColor={currentPage >= totalPages ? '$borderColor' : '#007AFF'}>
                      <ChevronRight size={14} color="#FFFFFF" />
                    </YStack>
                  </TouchableOpacity>
                </XStack>
              </XStack>
            ) : null
          }
        />
      ) : (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
          <Inbox size={40} color="#8E8E93" />
          <Text color="$color" fontSize={16} fontWeight="700" marginTop="$3">No members found</Text>
          <Paragraph color="$colorPress" fontSize={13} textAlign="center" marginTop="$1">
            {searchQuery ? `No results matching "${searchQuery}"` : 'Register your first member using the Add button above.'}
          </Paragraph>
        </YStack>
      )}
    </YStack>
  );
}
