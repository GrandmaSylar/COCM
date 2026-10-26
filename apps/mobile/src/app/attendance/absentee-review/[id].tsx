import React, { useState, useEffect } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { PartyPopper, ShieldAlert } from '@tamagui/lucide-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getLocalDb,
  getLocalAttendanceRecordById,
  saveLocalAbsenteeRecords,
  recalculateMemberStatusesLocal,
  LocalMember,
  LocalAbsenteeRecord
} from '../../../lib/db';
import { generateUUID } from '../../../lib/uuid';
import { pushOrQueue } from '../../../lib/syncEngine';
import { useAppColors } from '../../../context/ThemeContext';
import { AppHeader } from '../../../components/AppHeader';
import { SkeletonList } from '../../../components/Skeleton';
import { AppText, Avatar, Badge, ChoiceChips, EmptyState, SaveBar, Screen, Surface, TextField, useToast } from '../../../components/ui';
import { memberStatusTone, statusLabel } from '../../../theme/status';
import { radius, space } from '../../../theme/tokens';

const REASONS = ['Sick', 'Traveled', 'Schooling', 'Work', 'Family Emergency', 'Other'];

export default function AbsenteeReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const c = useAppColors();
  const [serviceType, setServiceType] = useState('Service');
  const [absentMembers, setAbsentMembers] = useState<LocalMember[]>([]);
  
  // Absentee Form Data: memberId -> { reason, requestedPermission, notes }
  const [absenteeMap, setAbsenteeMap] = useState<Record<string, { reason: string; requestedPermission: boolean; notes: string }>>({});

  useEffect(() => {
    async function loadAbsentees() {
      if (!id) return;
      setLoading(true);
      try {
        const rec = await getLocalAttendanceRecordById(id);
        if (rec) setServiceType(rec.service_type);

        const db = await getLocalDb();

        // Get present member IDs for this record
        const presentRows = await db.getAllAsync<{ member_id: string }>(
          `SELECT member_id FROM attendance_entries WHERE attendance_record_id = ?`,
          [id]
        );
        const presentSet = new Set(presentRows.map(r => r.member_id));

        // Get active members not marked present
        const allMembers = await db.getAllAsync<LocalMember>(
          `SELECT * FROM members WHERE status NOT IN ('blacklisted', 'not baptised') ORDER BY name ASC`
        );
        const absent = allMembers.filter(m => !presentSet.has(m.id));

        setAbsentMembers(absent);

        // Initialize absentee map
        const initialMap: Record<string, { reason: string; requestedPermission: boolean; notes: string }> = {};
        for (const m of absent) {
          initialMap[m.id] = { reason: '', requestedPermission: false, notes: '' };
        }
        setAbsenteeMap(initialMap);
      } catch (err) {
        console.error('Failed to load absentees:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAbsentees();
  }, [id]);

  const handleReasonSelect = (memberId: string, reason: string) => {
    setAbsenteeMap(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        reason: prev[memberId]?.reason === reason ? '' : reason
      }
    }));
  };

  const handleNotesChange = (memberId: string, notes: string) => {
    setAbsenteeMap(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        notes
      }
    }));
  };

  const handleSaveAbsentees = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const recordsToSave: LocalAbsenteeRecord[] = [];
      const syncPayload: any[] = [];

      for (const m of absentMembers) {
        const info = absenteeMap[m.id];
        if (!info) continue;

        const rec: LocalAbsenteeRecord = {
          id: generateUUID(),
          attendance_record_id: id,
          member_id: m.id,
          requested_permission: info.requestedPermission ? 1 : 0,
          reason: info.reason || undefined,
          reason_notes: info.notes || undefined,
          absence_start_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
        };

        recordsToSave.push(rec);
        syncPayload.push({
          memberId: m.id,
          requestedPermission: info.requestedPermission,
          reason: info.reason || null,
          reasonNotes: info.notes || null,
          memberStatus: info.reason ? (info.reason === 'Sick' ? 'sick' : info.reason === 'Traveled' ? 'traveled' : info.reason === 'Schooling' ? 'schooling' : null) : null
        });
      }

      await saveLocalAbsenteeRecords(recordsToSave);
      await recalculateMemberStatusesLocal();
      await pushOrQueue('POST', `/attendance/${id}/absentees`, syncPayload);

      toast.show({ title: 'Absentee review saved', message: 'Member leave statuses updated.' });
      router.dismissTo('/attendance' as any);
    } catch (err) {
      console.error('Failed to save absentee records:', err);
      toast.show({ title: 'Couldn’t save absentee review', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const withReason = Object.values(absenteeMap).filter(v => v.reason).length;

  return (
    <Screen>
      <AppHeader title="Absentee review" subtitle={`${serviceType} · ${absentMembers.length} absent`} showBack />

      {loading ? (
        <View style={{ padding: space.md }}><SkeletonList count={5} hasAvatar /></View>
      ) : absentMembers.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          tone="success"
          title="Everyone was present"
          message="No absent members to review for this session."
          action={{ label: 'Back to attendance', onPress: () => router.dismissTo('/attendance' as any) }}
        />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <FlatList
            data={absentMembers}
            keyExtractor={m => m.id}
            extraData={absenteeMap}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: space.md, paddingBottom: space.lg, gap: space.xs }}
            ListHeaderComponent={
              <View style={{ flexDirection: 'row', gap: 10, padding: space.sm, borderRadius: radius.md, backgroundColor: c.warning.soft, marginBottom: space.xs }}>
                <ShieldAlert size={18} color={c.warning.text} />
                <AppText variant="caption" color={c.warning.text} style={{ flex: 1 }}>
                  Choosing Sick, Traveled or Schooling updates the member’s leave status so they aren’t flagged inactive.
                </AppText>
              </View>
            }
            renderItem={({ item: member }) => {
              const info = absenteeMap[member.id] || { reason: '', requestedPermission: false, notes: '' };
              return (
                <Surface style={{ gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Avatar name={member.name} uri={member.local_photo_path || member.photo_url} size={40} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>{member.name}</AppText>
                      {member.zone ? <AppText variant="caption" tone="muted">Zone {member.zone}{member.zone_number ? ` · ${member.zone_number}` : ''}</AppText> : null}
                    </View>
                    {member.status ? <Badge label={statusLabel(member.status)} tone={memberStatusTone(member.status)} /> : null}
                  </View>
                  <ChoiceChips options={REASONS} value={info.reason} onChange={r => handleReasonSelect(member.id, r)} />
                  <TextField
                    placeholder="Notes (optional)"
                    value={info.notes}
                    onChangeText={text => handleNotesChange(member.id, text)}
                    accessibilityLabel={`Notes for ${member.name}`}
                  />
                </Surface>
              );
            }}
          />
          <SaveBar
            label={saving ? 'Saving…' : 'Complete review'}
            loading={saving}
            onPress={handleSaveAbsentees}
            progress={absentMembers.length ? Math.round((withReason / absentMembers.length) * 100) : 0}
            hint={`${withReason} of ${absentMembers.length} with a reason`}
          />
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
