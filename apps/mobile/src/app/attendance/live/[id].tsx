import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, TouchableOpacity, Alert as RNAlert, TextInput } from 'react-native';
import { YStack, XStack, Text, Card, Button, Spinner } from 'tamagui';
import { ArrowLeft, Search, UserCheck, UserX, Check, Lock, X, Users, AlertTriangle } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getLocalDb,
  getLocalAttendanceRecordById,
  upsertLocalAttendanceRecord,
  upsertLocalAttendanceEntry,
  removeLocalAttendanceEntry,
  LocalMember,
  LocalAttendanceRecord
} from '../../../lib/db';
import { enqueueSyncTask } from '../../../lib/syncEngine';
import { supabase } from '../../../lib/supabase';
import { generateUUID } from '../../../lib/uuid';
import { api } from '../../../lib/api';

export default function LiveAttendanceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [sessionRecord, setSessionRecord] = useState<LocalAttendanceRecord | null>(null);
  const [members, setMembers] = useState<LocalMember[]>([]);
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'all' | 'present' | 'absent'>('all');
  const [selectedZone, setSelectedZone] = useState<string>('all');

  const [finalizing, setFinalizing] = useState(false);

  // Load session data & members
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const rec = await getLocalAttendanceRecordById(id);
      if (rec) setSessionRecord(rec);

      const db = await getLocalDb();

      // Fetch present entry IDs directly from Supabase DB (online state)
      const { data: serverEntries, error: entriesErr } = await supabase
        .from('attendance_entries')
        .select('member_id')
        .eq('attendance_record_id', id);

      if (!entriesErr && serverEntries) {
        const pSet = new Set(serverEntries.map(r => r.member_id));
        setPresentIds(pSet);

        for (const mId of pSet) {
          await upsertLocalAttendanceEntry({
            id: generateUUID(),
            attendance_record_id: id,
            member_id: mId,
            created_at: new Date().toISOString()
          });
        }
      } else {
        // Fallback to local SQLite if offline
        const presentRows = await db.getAllAsync<{ member_id: string }>(
          `SELECT member_id FROM attendance_entries WHERE attendance_record_id = ?`,
          [id]
        );
        setPresentIds(new Set(presentRows.map(r => r.member_id)));
      }

      // Load active members
      const allMembers = await db.getAllAsync<LocalMember>(
        `SELECT * FROM members WHERE status NOT IN ('blacklisted', 'not baptised') ORDER BY name ASC`
      );
      setMembers(allMembers);
    } catch (err) {
      console.error('Failed to load live session:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime Supabase Broadcast & DB Changes Subscription
  useEffect(() => {
    if (!id) return;

    const channel = supabase.channel(`attendance-live-${id}`, {
      config: { broadcast: { self: false } }
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'attendance_entries',
      filter: `attendance_record_id=eq.${id}`
    }, (payload: any) => {
      if (payload.new && payload.new.member_id) {
        setPresentIds(prev => new Set([...prev, payload.new.member_id]));
      }
    })
    .on('broadcast', { event: 'member_toggle' }, (payload) => {
      const { memberId, isPresent } = payload.payload;
      setPresentIds(prev => {
        const next = new Set(prev);
        if (isPresent) next.add(memberId);
        else next.delete(memberId);
        return next;
      });
    })
    .on('broadcast', { event: 'unmark' }, (payload) => {
      const { memberId } = payload.payload;
      setPresentIds(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    })
    .on('broadcast', { event: 'session_finalized' }, () => {
      RNAlert.alert('Session Finalized', 'Navigating to Absentee Review...', [
        { text: 'OK', onPress: () => router.push(`/attendance/absentee-review/${id}` as any) }
      ]);
    })
    .on('broadcast', { event: 'session_cancelled' }, () => {
      RNAlert.alert('Session Cancelled', 'The attendance session has been cancelled by the initiator.', [
        { text: 'OK', onPress: () => router.push('/attendance' as any) }
      ]);
    })
    .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // 1-Tap Toggle Member Presence
  const toggleCheckIn = async (memberId: string) => {
    if (!id) return;
    const isCurrentlyPresent = presentIds.has(memberId);
    const nextState = !isCurrentlyPresent;

    // Optimistic state update
    setPresentIds(prev => {
      const next = new Set(prev);
      if (nextState) next.add(memberId);
      else next.delete(memberId);
      return next;
    });

    try {
      if (nextState) {
        const entryId = generateUUID();
        await upsertLocalAttendanceEntry({
          id: entryId,
          attendance_record_id: id,
          member_id: memberId,
          created_at: new Date().toISOString()
        });

        // Insert to Supabase DB (triggers postgres_changes INSERT for cross-device updates)
        const { error } = await supabase.from('attendance_entries').insert({
          attendance_record_id: id,
          member_id: memberId
        });

        if (error) {
          console.error('Supabase insert entry error:', error);
          setPresentIds(prev => {
            const next = new Set(prev);
            next.delete(memberId);
            return next;
          });
          await removeLocalAttendanceEntry(id, memberId);
        }
      } else {
        await removeLocalAttendanceEntry(id, memberId);

        const { error } = await supabase.from('attendance_entries')
          .delete()
          .eq('attendance_record_id', id)
          .eq('member_id', memberId);

        if (error) {
          console.error('Supabase delete entry error:', error);
          setPresentIds(prev => new Set([...prev, memberId]));
          return;
        }

        // Broadcast unmark to other devices
        const channel = supabase.channel(`attendance-live-${id}`);
        channel.send({
          type: 'broadcast',
          event: 'unmark',
          payload: { memberId }
        });
      }
    } catch (err) {
      console.error('Failed to toggle check-in:', err);
      loadData();
    }
  };

  // Filtered members list
  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (m.zone_number && m.zone_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesZone = selectedZone === 'all' || m.zone === selectedZone;
    const isPresent = presentIds.has(m.id);

    if (!matchesSearch || !matchesZone) return false;

    if (selectedTab === 'present') return isPresent;
    if (selectedTab === 'absent') return !isPresent;
    return true;
  });

  // Finalize Session
  const handleFinalize = async () => {
    if (!id) return;
    setFinalizing(true);
    try {
      const total = presentIds.size;
      const rec = await getLocalAttendanceRecordById(id);
      if (rec) {
        await upsertLocalAttendanceRecord({
          ...rec,
          total_count: total,
          status: 'finalized'
        });
      }

      try {
        await api.attendance.finalize(id);
      } catch (e) {
        console.warn('Backend finalize call warning:', e);
      }

      // Broadcast finalized event to other co-markers
      const channel = supabase.channel(`attendance-live-${id}`);
      channel.send({
        type: 'broadcast',
        event: 'session_finalized',
        payload: { totalPresent: total }
      });

      router.push(`/attendance/absentee-review/${id}` as any);
    } catch (err) {
      console.error('Failed to finalize session:', err);
      RNAlert.alert('Error', 'Failed to finalize session.');
    } finally {
      setFinalizing(false);
    }
  };

  // Cancel Session
  const handleCancelSession = async () => {
    if (!id) return;
    RNAlert.alert(
      'Cancel Live Session',
      'Are you sure you want to cancel this live session? All recorded check-ins will be deleted.',
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Cancel on backend
              await api.attendance.cancelSession(id).catch(e => console.warn('Cancel session server call:', e));
              
              // 2. Broadcast cancellation to other devices
              const channel = supabase.channel(`attendance-live-${id}`);
              channel.send({
                type: 'broadcast',
                event: 'session_cancelled',
                payload: {}
              });

              // 3. Purge from local SQLite
              const db = await getLocalDb();
              await db.runAsync(`DELETE FROM attendance_entries WHERE attendance_record_id = ?`, [id]);
              await db.runAsync(`DELETE FROM attendance_records WHERE id = ?`, [id]);

            } catch (err) {
              console.error('Failed to cancel session:', err);
            } finally {
              router.push('/attendance' as any);
            }
          }
        }
      ]
    );
  };

  const totalPresent = presentIds.size;
  const totalAbsent = members.length - totalPresent;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'bottom', 'left', 'right']}>
      <YStack flex={1} backgroundColor="$background">
      {/* Navigation Header */}
      <XStack px="$4" py="$3" alignItems="center" justifyContent="space-between" borderBottomWidth={1} borderColor="$borderColor">
        <XStack space="$2" alignItems="center" flex={1}>
          <TouchableOpacity onPress={() => router.back()}>
            <YStack p="$2" borderRadius="$3" backgroundColor="$borderColor" opacity={0.8}>
              <ArrowLeft size={18} color="$color" />
            </YStack>
          </TouchableOpacity>
          <YStack flex={1}>
            <XStack space="$2" alignItems="center">
              <Text color="$color" fontSize={16} fontWeight="800" numberOfLines={1}>
                {sessionRecord?.service_type || 'Live Service'}
              </Text>
              <XStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                <Text color="#34C759" fontSize={10} fontWeight="800">LIVE</Text>
              </XStack>
            </XStack>
            <Text color="$colorPress" fontSize={11}>{totalPresent} Present • {totalAbsent} Absent</Text>
          </YStack>
        </XStack>

        <TouchableOpacity onPress={handleCancelSession}>
          <YStack p="$2" borderRadius="$3" backgroundColor="rgba(255, 59, 48, 0.1)">
            <X size={18} color="#FF3B30" />
          </YStack>
        </TouchableOpacity>
      </XStack>

      {/* Main Container */}
      <YStack flex={1} p="$3" space="$3">

        {/* Counter Summary Banner */}
        <Card p="$3" borderRadius="$4" borderWidth={1} borderColor="rgba(52, 199, 89, 0.3)" backgroundColor="rgba(52, 199, 89, 0.05)">
          <XStack justifyContent="space-around" alignItems="center">
            <YStack alignItems="center">
              <Text color="#34C759" fontSize={22} fontWeight="900">{totalPresent}</Text>
              <Text color="$colorPress" fontSize={11} fontWeight="700">PRESENT</Text>
            </YStack>

            <YStack height={30} width={1} backgroundColor="$borderColor" />

            <YStack alignItems="center">
              <Text color="#FF3B30" fontSize={22} fontWeight="900">{totalAbsent}</Text>
              <Text color="$colorPress" fontSize={11} fontWeight="700">ABSENT</Text>
            </YStack>

            <YStack height={30} width={1} backgroundColor="$borderColor" />

            <YStack alignItems="center">
              <Text color="$color" fontSize={22} fontWeight="900">{members.length}</Text>
              <Text color="$colorPress" fontSize={11} fontWeight="700">TOTAL</Text>
            </YStack>
          </XStack>
        </Card>

        {/* Search Input */}
        <XStack px="$3" py="$2" borderRadius="$3" borderWidth={1} borderColor="$borderColor" backgroundColor="$background" alignItems="center" space="$2">
          <Search size={16} color="#8E8E93" />
          <TextInput
            placeholder="Search member by name or zone number..."
            placeholderTextColor="#8E8E93"
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={() => {
              if (filteredMembers.length === 1) {
                toggleCheckIn(filteredMembers[0].id);
                setSearchTerm('');
              }
            }}
            style={{ flex: 1, color: '#FFFFFF', fontSize: 13 }}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <X size={14} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </XStack>

        {/* Tab & Zone Filters */}
        <XStack justifyContent="space-between" alignItems="center">
          <XStack space="$1">
            {(['all', 'present', 'absent'] as const).map(tab => {
              const isSelected = selectedTab === tab;
              return (
                <TouchableOpacity key={tab} onPress={() => setSelectedTab(tab)}>
                  <YStack
                    px="$2.5"
                    py="$1"
                    borderRadius="$3"
                    borderWidth={1}
                    borderColor={isSelected ? '#FF9500' : '$borderColor'}
                    backgroundColor={isSelected ? 'rgba(255, 149, 0, 0.15)' : '$background'}
                  >
                    <Text color={isSelected ? '#FF9500' : '$colorPress'} fontSize={11} fontWeight={isSelected ? '800' : '600'} textTransform="uppercase">
                      {tab} ({tab === 'all' ? members.length : tab === 'present' ? totalPresent : totalAbsent})
                    </Text>
                  </YStack>
                </TouchableOpacity>
              );
            })}
          </XStack>

          {/* Zone Selector Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
            {['all', 'A', 'B', 'F', 'K', 'M', 'R'].map(z => {
              const isSelected = selectedZone === z;
              return (
                <TouchableOpacity key={z} onPress={() => setSelectedZone(z)}>
                  <YStack
                    px="$2"
                    py="$1"
                    borderRadius="$2"
                    backgroundColor={isSelected ? '#AF52DE' : 'rgba(142, 142, 147, 0.1)'}
                  >
                    <Text color={isSelected ? 'white' : '$colorPress'} fontSize={10} fontWeight="800">
                      {z === 'all' ? 'All Zones' : `Zone ${z}`}
                    </Text>
                  </YStack>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </XStack>

        {/* Member Roster List */}
        {loading ? (
          <Spinner size="large" color="#FF9500" py="$6" />
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
            <YStack space="$2">
              {filteredMembers.length === 0 ? (
                <Card p="$4" borderRadius="$4" borderWidth={1} borderColor="$borderColor" alignItems="center">
                  <Text color="$colorPress" fontSize={12}>No members match your search filter.</Text>
                </Card>
              ) : (
                filteredMembers.map(m => {
                  const isPresent = presentIds.has(m.id);

                  return (
                    <TouchableOpacity key={m.id} onPress={() => toggleCheckIn(m.id)}>
                      <Card
                        p="$3"
                        borderRadius="$4"
                        borderWidth={1.5}
                        borderColor={isPresent ? '#34C759' : '$borderColor'}
                        backgroundColor={isPresent ? 'rgba(52, 199, 89, 0.08)' : '$background'}
                      >
                        <XStack justifyContent="space-between" alignItems="center">
                          <XStack space="$2.5" alignItems="center" flex={1}>
                            <YStack
                              p="$2"
                              borderRadius="$3"
                              backgroundColor={isPresent ? '#34C759' : 'rgba(142, 142, 147, 0.15)'}
                            >
                              {isPresent ? <Check size={18} color="white" /> : <UserCheck size={18} color="#8E8E93" />}
                            </YStack>

                            <YStack flex={1}>
                              <Text color="$color" fontSize={14} fontWeight="800">{m.name}</Text>
                              <Text color="$colorPress" fontSize={11}>
                                Zone: {m.zone || 'N/A'} ({m.zone_number || 'N/A'})
                              </Text>
                            </YStack>
                          </XStack>

                          <XStack backgroundColor={isPresent ? '#34C759' : 'rgba(142, 142, 147, 0.2)'} px="$3" py="$1.5" borderRadius="$3">
                            <Text color={isPresent ? 'white' : '$color'} fontSize={11} fontWeight="800">
                              {isPresent ? 'PRESENT' : 'MARK'}
                            </Text>
                          </XStack>
                        </XStack>
                      </Card>
                    </TouchableOpacity>
                  );
                })
              )}
            </YStack>
          </ScrollView>
        )}

      </YStack>

      {/* Floating Finalize Bar */}
      <YStack px="$4" py="$3" borderTopWidth={1} borderColor="$borderColor" backgroundColor="$background">
        <Button backgroundColor="#FF9500" size="$4" onPress={handleFinalize} disabled={finalizing}>
          {finalizing ? <Spinner color="white" /> : (
            <XStack space="$2" alignItems="center">
              <Check size={18} color="white" />
              <Text color="white" fontWeight="800" fontSize={14}>
                Finalize Attendance ({totalPresent} Present)
              </Text>
            </XStack>
          )}
        </Button>
      </YStack>
    </YStack>
    </SafeAreaView>
  );
}
