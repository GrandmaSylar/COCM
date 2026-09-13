import React, { useEffect, useState } from 'react';
import { FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Card, Button, Spinner, Paragraph, Separator } from 'tamagui';
import { MapPin, Users, ChevronRight, ChevronDown, ChevronUp, User, Home } from '@tamagui/lucide-icons';
import { AppHeader } from '../../components/AppHeader';
import { getLocalDb, getLocalZones, LocalMember, LocalZone } from '../../lib/db';

interface ZoneSummary {
  code: string;
  name: string;
  count: number;
  members: LocalMember[];
}

export default function ZonesScreen() {
  const router = useRouter();
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);

  const loadZones = async () => {
    try {
      const db = await getLocalDb();

      // 1. Fetch zones from SQLite
      const zoneRows = await getLocalZones();
      const zoneCodes = zoneRows.length > 0
        ? zoneRows.map(z => z.code || z.name)
        : ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Floating'];

      // 2. Fetch all members from local SQLite
      const allMembers = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');

      const summaries: ZoneSummary[] = zoneCodes.map(zCode => {
        const assignedMembers = (allMembers || []).filter(m => {
          if (!m.zone) return zCode === 'Floating' || zCode === 'Unassigned';
          return m.zone.toLowerCase() === zCode.toLowerCase() || m.zone.toLowerCase() === zCode.replace('Zone ', '').toLowerCase();
        });
        return {
          code: zCode,
          name: zCode.startsWith('Zone') ? zCode : `Zone ${zCode}`,
          count: assignedMembers.length,
          members: assignedMembers,
        };
      });

      setZones(summaries);
    } catch (err) {
      console.warn('Error loading zones roster:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadZones();
  };

  const toggleExpand = (code: string) => {
    setExpandedZone(prev => prev === code ? null : code);
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Zones Cell Groups"
        subtitle="Geographic care cell directories"
        showBack
        backTitle="Operations"
      />

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color="#AF52DE" />
          <Text color="$colorPress" marginTop="$2" fontSize={13}>Loading zones roster...</Text>
        </YStack>
      ) : zones.length > 0 ? (
        <FlatList
          style={{ flex: 1 }}
          data={zones}
          keyExtractor={(item) => item.code}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#AF52DE']} />}
          renderItem={({ item }) => {
            const isExpanded = expandedZone === item.code;

            return (
              <Card
                marginBottom="$3"
                padding="$4"
                borderRadius="$5"
                backgroundColor="$cardBackground"
                borderColor="$borderColor"
                borderWidth={1}
                elevate
              >
                <TouchableOpacity onPress={() => toggleExpand(item.code)} activeOpacity={0.8}>
                  <XStack space="$3" alignItems="center" justifyContent="space-between">
                    <XStack space="$3" alignItems="center" flex={1}>
                      <YStack backgroundColor="rgba(175, 82, 222, 0.12)" p="$2.5" borderRadius="$4">
                        <MapPin size={24} color="#AF52DE" />
                      </YStack>

                      <YStack flex={1}>
                        <Text color="$color" fontSize={16} fontWeight="700">{item.name}</Text>
                        <Paragraph color="$colorPress" fontSize={13}>
                          {item.count} Assigned Church Members
                        </Paragraph>
                      </YStack>
                    </XStack>

                    <XStack space="$2" alignItems="center">
                      <XStack backgroundColor="rgba(175, 82, 222, 0.15)" px="$2.5" py="$1" borderRadius="$3">
                        <Text color="#AF52DE" fontSize={12} fontWeight="800">{item.count}</Text>
                      </XStack>
                      {isExpanded ? <ChevronUp size={18} color="$colorPress" /> : <ChevronDown size={18} color="$colorPress" />}
                    </XStack>
                  </XStack>
                </TouchableOpacity>

                {/* Expanded Member Roster for this Zone */}
                {isExpanded && (
                  <YStack marginTop="$3" paddingTop="$3" borderTopWidth={1} borderColor="$borderColor" space="$2">
                    <Text color="$colorPress" fontSize={11} fontWeight="700" letterSpacing={0.5} textTransform="uppercase">
                      Zone Members ({item.members.length})
                    </Text>

                    {item.members.length > 0 ? (
                      item.members.map(m => (
                        <TouchableOpacity key={m.id} onPress={() => router.push(`/members/${m.id}` as any)}>
                          <XStack p="$2.5" borderRadius="$3" backgroundColor="$background" borderWidth={1} borderColor="$borderColor" justifyContent="space-between" alignItems="center">
                            <XStack space="$2" alignItems="center" flex={1}>
                              <YStack p="$1.5" borderRadius="$2" backgroundColor="rgba(175, 82, 222, 0.1)">
                                <User size={14} color="#AF52DE" />
                              </YStack>
                              <YStack flex={1}>
                                <Text color="$color" fontSize={13} fontWeight="700" numberOfLines={1}>{m.name}</Text>
                                <Text color="$colorPress" fontSize={11}>{m.phone || m.role || 'Member'}</Text>
                              </YStack>
                            </XStack>
                            <ChevronRight size={14} color="$colorPress" />
                          </XStack>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <YStack p="$3" alignItems="center" backgroundColor="$background" borderRadius="$3">
                        <Text color="$colorPress" fontSize={12}>No members currently assigned to this zone.</Text>
                      </YStack>
                    )}
                  </YStack>
                )}
              </Card>
            );
          }}
        />
      ) : (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
          <MapPin size={40} color="#8E8E93" />
          <Text color="$color" fontSize={17} fontWeight="700" marginTop="$3">No Zones Found</Text>
        </YStack>
      )}
    </YStack>
  );
}
