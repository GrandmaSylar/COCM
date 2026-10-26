import React, { useState, useEffect, useCallback } from 'react';
import { Alert as RNAlert, FlatList, View } from 'react-native';
import { Check, SearchX, UserCheck, X } from '@tamagui/lucide-icons';
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
import { supabase } from '../../../lib/supabase';
import { generateUUID } from '../../../lib/uuid';
import { api } from '../../../lib/api';
import { getChurchZones } from '../../../lib/options';
import { useAppColors } from '../../../context/ThemeContext';
import { AppHeader } from '../../../components/AppHeader';
import { SkeletonList } from '../../../components/Skeleton';
import {
  AppText, Avatar, EmptyState, FilterChips, IconButton, PressableScale, SaveBar, Screen, SearchField, SegmentedControl, useToast,
} from '../../../components/ui';
import { radius, space } from '../../../theme/tokens';

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
  const c = useAppColors();
  const toast = useToast();

  // Configured church zones (falls back to the previous fixed list)
  const [zones, setZones] = useState<string[]>(['A', 'B', 'F', 'K', 'M', 'R']);
  useEffect(() => {
    getChurchZones().then(z => { if (z.length) setZones(z); }).catch(() => {});
  }, []);

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
      toast.show({ title: 'Couldn’t finalize session', tone: 'error' });
    } finally {
      setFinalizing(false);
    }
  };

  // Cancel Session
  const handleCancelSession = async () => {
    if (!id) return;
    RNAlert.alert(
      'Cancel this session?',
      'All check-ins recorded in this session will be deleted on every device.',
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
    <Screen>
      <AppHeader
        title={sessionRecord?.service_type || 'Live service'}
        subtitle={`Live check-in · ${totalPresent} present`}
        showBack
        rightElement={<IconButton icon={X} label="Cancel session" tone="danger" onPress={handleCancelSession} />}
      />

      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, gap: space.sm, backgroundColor: c.background }}>
        <View style={{ flexDirection: 'row', borderRadius: radius.md, backgroundColor: c.surfaceMuted, paddingVertical: space.sm }}>
          {[
            { label: 'Present', value: totalPresent, tone: 'success' as const },
            { label: 'Not yet', value: totalAbsent, tone: 'muted' as const },
            { label: 'Total', value: members.length, tone: 'default' as const },
          ].map((m, i) => (
            <View key={m.label} style={{ flex: 1, alignItems: 'center', gap: 2, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.border }}>
              <AppText variant="title" tone={m.tone} numeric>{m.value}</AppText>
              <AppText variant="caption" tone="muted">{m.label}</AppText>
            </View>
          ))}
        </View>

        <SearchField
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Name or zone number (Enter checks in a single match)"
          onSubmitEditing={() => {
            if (filteredMembers.length === 1) {
              toggleCheckIn(filteredMembers[0].id);
              setSearchTerm('');
            }
          }}
        />
        <SegmentedControl
          accessibilityLabel="Show"
          value={selectedTab}
          onChange={setSelectedTab}
          options={[
            { value: 'all', label: `All · ${members.length}` },
            { value: 'present', label: `Present · ${totalPresent}` },
            { value: 'absent', label: `Not yet · ${totalAbsent}` },
          ]}
        />
        <FilterChips
          value={selectedZone}
          onChange={setSelectedZone}
          options={['all', ...zones].map(z => ({ value: z, label: z === 'all' ? 'All zones' : `Zone ${z}` }))}
        />
      </View>

      {loading ? (
        <View style={{ padding: space.md }}><SkeletonList count={6} hasAvatar /></View>
      ) : (
        <FlatList
          data={filteredMembers}
          keyExtractor={m => m.id}
          extraData={presentIds}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.md, paddingBottom: space.lg, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState icon={SearchX} title="No members match" message="Try a different name, zone or filter." />}
          renderItem={({ item: m, index }) => {
            const isPresent = presentIds.has(m.id);
            const first = index === 0;
            const last = index === filteredMembers.length - 1;
            return (
              <PressableScale
                onPress={() => toggleCheckIn(m.id)}
                haptics={isPresent ? 'light' : 'success'}
                scaleTo={0.985}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isPresent }}
                accessibilityLabel={`${m.name}, ${isPresent ? 'present' : 'not checked in'}`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: space.sm,
                  paddingHorizontal: space.md, paddingVertical: 10, minHeight: 64,
                  backgroundColor: isPresent ? c.success.soft : c.surface,
                  borderColor: c.border, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopWidth: first ? 1 : 0,
                  borderTopLeftRadius: first ? radius.lg : 0, borderTopRightRadius: first ? radius.lg : 0,
                  borderBottomLeftRadius: last ? radius.lg : 0, borderBottomRightRadius: last ? radius.lg : 0,
                }}
              >
                <Avatar name={m.name} uri={m.local_photo_path || m.photo_url} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>{m.name}</AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {m.zone ? `Zone ${m.zone}` : 'No zone'}{m.zone_number ? ` · ${m.zone_number}` : ''}
                  </AppText>
                </View>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.pill,
                    backgroundColor: isPresent ? c.success.base : c.surfaceMuted,
                  }}
                >
                  {isPresent ? <Check size={16} color={c.success.on} /> : <UserCheck size={16} color={c.textMuted} />}
                  <AppText variant="captionStrong" color={isPresent ? c.success.on : c.text}>{isPresent ? 'Present' : 'Check in'}</AppText>
                </View>
              </PressableScale>
            );
          }}
        />
      )}

      <SaveBar
        label={finalizing ? 'Finalizing…' : `Finalize · ${totalPresent} present`}
        loading={finalizing}
        onPress={handleFinalize}
        progress={members.length ? Math.round((totalPresent / members.length) * 100) : 0}
        hint={`${totalPresent} of ${members.length}`}
      />
    </Screen>
  );
}
