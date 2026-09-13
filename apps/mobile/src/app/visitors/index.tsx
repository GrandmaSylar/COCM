import React, { useEffect, useState } from 'react';
import { RefreshControl, FlatList, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  YStack, 
  XStack, 
  Text, 
  Card, 
  H2, 
  Paragraph, 
  Button, 
  Spinner 
} from 'tamagui';
import { UserCheck, Plus, Phone, Calendar, Inbox } from '@tamagui/lucide-icons';
import { supabase } from '../../lib/supabase';
import { getLocalVisitors, upsertLocalVisitor } from '../../lib/db';

import { AppHeader } from '../../components/AppHeader';

interface Visitor {
  id: string;
  name: string;
  phone?: string;
  residence?: string;
  visit_date: string;
  status?: string;
}

export default function VisitorsScreen() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLocalVisitors = async () => {
    try {
      const localRows = await getLocalVisitors();
      if (localRows && localRows.length > 0) {
        const formatted = localRows.map((v) => {
          let residence = '';
          if (v.raw_json) {
            try {
              const parsed = JSON.parse(v.raw_json);
              residence = parsed.residence || '';
            } catch (e) {}
          }
          return {
            id: v.id,
            name: v.name,
            phone: v.phone || undefined,
            residence: residence || (v.potential_zone ? `Zone ${v.potential_zone}` : undefined),
            visit_date: v.visit_date,
            status: v.follow_up_status || 'New'
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
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data && !error) {
        const formatted = data.map((v: any) => ({
          id: v.id,
          name: v.name || `${v.first_name || ''} ${v.last_name || ''}`.trim() || 'Visitor',
          phone: v.phone || v.mobile,
          residence: v.residence || v.location || (v.potential_zone ? `Zone ${v.potential_zone}` : undefined),
          visit_date: v.visit_date || v.created_at || new Date().toISOString().split('T')[0],
          status: v.status || v.follow_up_status || 'New'
        }));
        setVisitors(formatted);

        // Cache to local SQLite in background
        for (const remote of data) {
          await upsertLocalVisitor({
            id: remote.id,
            name: remote.name || `${remote.first_name || ''} ${remote.last_name || ''}`.trim() || 'Visitor',
            phone: remote.phone || remote.mobile,
            email: remote.email,
            visit_date: remote.visit_date || new Date().toISOString().split('T')[0],
            potential_zone: remote.potential_zone,
            follow_up_status: remote.status || remote.follow_up_status || 'pending',
            notes: remote.notes,
            raw_json: JSON.stringify({ residence: remote.residence || remote.location }),
            created_at: remote.created_at || new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.warn('Error syncing remote visitors, using SQLite cache:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLocalVisitors();
    fetchRemoteVisitors();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRemoteVisitors();
  };

  const handleCall = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Visitors Registry"
        subtitle="First-time church guests and follow-ups"
        showBack
        backTitle="People"
        rightElement={
          <Button
            size="$3"
            backgroundColor="#34C759"
            borderRadius="$3"
            onPress={() => router.push('/visitors/add' as any)}
            icon={<Plus size={16} color="#FFFFFF" />}
            pressStyle={{ scale: 0.98 }}
          >
            <Text color="#FFFFFF" fontWeight="700" fontSize={13}>Add</Text>
          </Button>
        }
      />

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color="#34C759" />
          <Text color="$colorPress" marginTop="$2" fontSize={13}>Loading visitors registry...</Text>
        </YStack>
      ) : visitors.length > 0 ? (
        <FlatList
          data={visitors}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#34C759']} />}
          renderItem={({ item }) => (
            <Card
              marginBottom="$3"
              padding="$4"
              borderRadius="$5"
              backgroundColor="$cardBackground"
              borderColor="$borderColor"
              borderWidth={1}
              elevate
            >
              <XStack space="$3" alignItems="center" justifyContent="space-between">
                <XStack space="$3" alignItems="center" flex={1}>
                  <YStack backgroundColor="rgba(52, 199, 89, 0.12)" p="$2.5" borderRadius="$4">
                    <UserCheck size={24} color="#34C759" />
                  </YStack>
                  <YStack flex={1}>
                    <Text color="$color" fontSize={15} fontWeight="700">{item.name}</Text>
                    <XStack space="$2" marginTop="$1" alignItems="center">
                      <Calendar size={12} color="#8E8E93" />
                      <Text color="$colorPress" fontSize={12}>{item.visit_date}</Text>
                    </XStack>
                  </YStack>
                </XStack>

                {item.phone ? (
                  <TouchableOpacity
                    onPress={() => handleCall(item.phone)}
                    style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(52, 199, 89, 0.12)' }}
                  >
                    <Phone size={16} color="#34C759" />
                  </TouchableOpacity>
                ) : null}
              </XStack>
            </Card>
          )}
        />
      ) : (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
          <Inbox size={40} color="#8E8E93" />
          <Text color="$color" fontSize={16} fontWeight="700" marginTop="$3">No visitors recorded</Text>
          <Paragraph color="$colorPress" fontSize={13} textAlign="center" marginTop="$1">
            Log first-time guests using the Add Visitor button above.
          </Paragraph>
        </YStack>
      )}
    </YStack>
  );
}
