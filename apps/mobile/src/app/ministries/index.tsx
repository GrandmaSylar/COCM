import React, { useEffect, useState } from 'react';
import { FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { YStack, XStack, Text, Card, Button, Spinner, Paragraph, Separator } from 'tamagui';
import { ShieldCheck, Users, ChevronRight, ChevronDown, ChevronUp, User } from '@tamagui/lucide-icons';
import { AppHeader } from '../../components/AppHeader';
import { getLocalDb, getLocalDropdownOptions, LocalMember } from '../../lib/db';

interface MinistrySummary {
  name: string;
  count: number;
  members: LocalMember[];
}

export default function MinistriesScreen() {
  const router = useRouter();
  const [ministries, setMinistries] = useState<MinistrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMinistry, setExpandedMinistry] = useState<string | null>(null);

  const loadMinistries = async () => {
    try {
      const db = await getLocalDb();
      
      // 1. Fetch predefined ministry option categories
      const options = await getLocalDropdownOptions('ministry');
      const ministryNames = options.length > 0 
        ? options.map(o => o.label)
        : ['Choir / Music', 'Protocol & Ushering', 'Media & IT', 'Prayer & Intercession', 'Evangelism & Outreach', 'Children Ministry'];

      // 2. Fetch all members from local SQLite
      const allMembers = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');

      const summaries: MinistrySummary[] = ministryNames.map(mName => {
        const assignedMembers = (allMembers || []).filter(m => {
          if (!m.ministry) return false;
          return m.ministry.toLowerCase().includes(mName.toLowerCase()) || mName.toLowerCase().includes(m.ministry.toLowerCase());
        });
        return {
          name: mName,
          count: assignedMembers.length,
          members: assignedMembers,
        };
      });

      setMinistries(summaries);
    } catch (err) {
      console.warn('Error loading ministries roster:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMinistries();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadMinistries();
  };

  const toggleExpand = (name: string) => {
    setExpandedMinistry(prev => prev === name ? null : name);
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Church Ministries"
        subtitle="Volunteer teams & departments"
        showBack
        backTitle="Operations"
      />

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color="#5856D6" />
          <Text color="$colorPress" marginTop="$2" fontSize={13}>Loading ministries roster...</Text>
        </YStack>
      ) : ministries.length > 0 ? (
        <FlatList
          style={{ flex: 1 }}
          data={ministries}
          keyExtractor={(item) => item.name}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#5856D6']} />}
          renderItem={({ item }) => {
            const isExpanded = expandedMinistry === item.name;

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
                <TouchableOpacity onPress={() => toggleExpand(item.name)} activeOpacity={0.8}>
                  <XStack space="$3" alignItems="center" justifyContent="space-between">
                    <XStack space="$3" alignItems="center" flex={1}>
                      <YStack backgroundColor="rgba(88, 86, 214, 0.12)" p="$2.5" borderRadius="$4">
                        <ShieldCheck size={24} color="#5856D6" />
                      </YStack>

                      <YStack flex={1}>
                        <Text color="$color" fontSize={16} fontWeight="700">{item.name}</Text>
                        <Paragraph color="$colorPress" fontSize={13}>
                          {item.count} Registered Volunteers
                        </Paragraph>
                      </YStack>
                    </XStack>

                    <XStack space="$2" alignItems="center">
                      <XStack backgroundColor="rgba(88, 86, 214, 0.15)" px="$2.5" py="$1" borderRadius="$3">
                        <Text color="#5856D6" fontSize={12} fontWeight="800">{item.count}</Text>
                      </XStack>
                      {isExpanded ? <ChevronUp size={18} color="$colorPress" /> : <ChevronDown size={18} color="$colorPress" />}
                    </XStack>
                  </XStack>
                </TouchableOpacity>

                {/* Expanded Member Roster for this Ministry */}
                {isExpanded && (
                  <YStack marginTop="$3" paddingTop="$3" borderTopWidth={1} borderColor="$borderColor" space="$2">
                    <Text color="$colorPress" fontSize={11} fontWeight="700" letterSpacing={0.5} textTransform="uppercase">
                      Assigned Volunteers ({item.members.length})
                    </Text>

                    {item.members.length > 0 ? (
                      item.members.map(m => (
                        <TouchableOpacity key={m.id} onPress={() => router.push(`/members/${m.id}` as any)}>
                          <XStack p="$2.5" borderRadius="$3" backgroundColor="$background" borderWidth={1} borderColor="$borderColor" justifyContent="space-between" alignItems="center">
                            <XStack space="$2" alignItems="center" flex={1}>
                              <YStack p="$1.5" borderRadius="$2" backgroundColor="rgba(88, 86, 214, 0.1)">
                                <User size={14} color="#5856D6" />
                              </YStack>
                              <YStack flex={1}>
                                <Text color="$color" fontSize={13} fontWeight="700" numberOfLines={1}>{m.name}</Text>
                                <Text color="$colorPress" fontSize={11}>{m.phone || m.role || 'Volunteer'}</Text>
                              </YStack>
                            </XStack>
                            <ChevronRight size={14} color="$colorPress" />
                          </XStack>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <YStack p="$3" alignItems="center" backgroundColor="$background" borderRadius="$3">
                        <Text color="$colorPress" fontSize={12}>No members currently assigned to this ministry.</Text>
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
          <ShieldCheck size={40} color="#8E8E93" />
          <Text color="$color" fontSize={17} fontWeight="700" marginTop="$3">No Ministries Found</Text>
        </YStack>
      )}
    </YStack>
  );
}
