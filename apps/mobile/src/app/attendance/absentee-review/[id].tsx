import React, { useState, useEffect } from 'react';
import { ScrollView, TouchableOpacity, Alert as RNAlert } from 'react-native';
import { YStack, XStack, Text, Card, Button, Input, Spinner, Checkbox } from 'tamagui';
import { ArrowLeft, UserX, Check, Save, ShieldAlert } from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { enqueueSyncTask } from '../../../lib/syncEngine';

const REASONS = ['Sick', 'Traveled', 'Schooling', 'Work', 'Family Emergency', 'Other'];

export default function AbsenteeReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      await enqueueSyncTask('POST', `/attendance/${id}/absentees`, syncPayload);

      RNAlert.alert('Absentee Review Complete', 'Absentees and member leave statuses updated successfully!', [
        { text: 'OK', onPress: () => router.push('/attendance' as any) }
      ]);
    } catch (err) {
      console.error('Failed to save absentee records:', err);
      RNAlert.alert('Error', 'Failed to save absentee review.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'left', 'right']}>
      <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <XStack px="$4" py="$3" alignItems="center" space="$2" borderBottomWidth={1} borderColor="$borderColor">
        <TouchableOpacity onPress={() => router.back()}>
          <YStack p="$2" borderRadius="$3" backgroundColor="$borderColor" opacity={0.8}>
            <ArrowLeft size={18} color="$color" />
          </YStack>
        </TouchableOpacity>
        <YStack flex={1}>
          <Text color="$color" fontSize={18} fontWeight="800">Absentee Review</Text>
          <Text color="$colorPress" fontSize={12}>{serviceType} - {absentMembers.length} Absentees</Text>
        </YStack>
      </XStack>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <YStack space="$4">

          {/* Info Banner */}
          <Card p="$3.5" borderRadius="$4" borderWidth={1} borderColor="rgba(255, 59, 48, 0.3)" backgroundColor="rgba(255, 59, 48, 0.05)">
            <XStack space="$2.5" alignItems="center">
              <ShieldAlert size={20} color="#FF3B30" />
              <Text color="$color" fontSize={12} flex={1}>
                Select absence reasons for un-marked members. Marking <Text fontWeight="800">Sick</Text>, <Text fontWeight="800">Traveled</Text>, or <Text fontWeight="800">Schooling</Text> will update the member's official leave status and protect them from inactive flags.
              </Text>
            </XStack>
          </Card>

          {loading ? (
            <Spinner size="large" color="#FF9500" py="$6" />
          ) : absentMembers.length === 0 ? (
            <Card p="$6" borderRadius="$4" borderWidth={1} borderColor="$borderColor" alignItems="center">
              <Text color="$color" fontSize={15} fontWeight="800" marginBottom="$1">100% Full Attendance!</Text>
              <Text color="$colorPress" fontSize={12}>No absent members to review for this session.</Text>
              <Button backgroundColor="#FF9500" onPress={() => router.push('/attendance' as any)} marginTop="$4">
                <Text color="white" fontWeight="800">Return to Dashboard</Text>
              </Button>
            </Card>
          ) : (
            <>
              {absentMembers.map(member => {
                const info = absenteeMap[member.id] || { reason: '', requestedPermission: false, notes: '' };

                return (
                  <Card key={member.id} p="$3.5" borderRadius="$4" borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
                    <YStack space="$2.5">
                      <XStack justifyContent="space-between" alignItems="center">
                        <XStack space="$2" alignItems="center">
                          <YStack p="$1.5" borderRadius="$2" backgroundColor="rgba(255, 59, 48, 0.1)">
                            <UserX size={16} color="#FF3B30" />
                          </YStack>
                          <YStack>
                            <Text color="$color" fontSize={14} fontWeight="800">{member.name}</Text>
                            {member.zone && <Text color="$colorPress" fontSize={11}>Zone: {member.zone} ({member.zone_number})</Text>}
                          </YStack>
                        </XStack>

                        {member.status && (
                          <XStack backgroundColor="rgba(142, 142, 147, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                            <Text color="$colorPress" fontSize={10} fontWeight="700">{member.status}</Text>
                          </XStack>
                        )}
                      </XStack>

                      {/* Reason Pills */}
                      <YStack space="$1">
                        <Text color="$colorPress" fontSize={10} fontWeight="700" textTransform="uppercase">Select Absence Reason</Text>
                        <XStack flexWrap="wrap" space="$1">
                          {REASONS.map(r => {
                            const isSelected = info.reason === r;
                            return (
                              <TouchableOpacity key={r} onPress={() => handleReasonSelect(member.id, r)}>
                                <YStack
                                  px="$2.5"
                                  py="$1"
                                  borderRadius="$3"
                                  borderWidth={1}
                                  borderColor={isSelected ? '#FF9500' : '$borderColor'}
                                  backgroundColor={isSelected ? 'rgba(255, 149, 0, 0.15)' : '$background'}
                                  marginBottom="$1"
                                >
                                  <Text color={isSelected ? '#FF9500' : '$color'} fontSize={11} fontWeight={isSelected ? '800' : '500'}>
                                    {r}
                                  </Text>
                                </YStack>
                              </TouchableOpacity>
                            );
                          })}
                        </XStack>
                      </YStack>

                      {/* Notes */}
                      <Input
                        placeholder="Optional notes regarding absence..."
                        value={info.notes}
                        onChangeText={text => handleNotesChange(member.id, text)}
                        backgroundColor="$background"
                        borderColor="$borderColor"
                        fontSize={12}
                        size="$2"
                      />
                    </YStack>
                  </Card>
                );
              })}

              <Button backgroundColor="#FF9500" onPress={handleSaveAbsentees} disabled={saving} size="$4" marginTop="$3">
                {saving ? <Spinner color="white" /> : (
                  <XStack space="$2" alignItems="center">
                    <Save size={18} color="white" />
                    <Text color="white" fontWeight="800" fontSize={14}>Complete Absentee Review</Text>
                  </XStack>
                )}
              </Button>
            </>
          )}

        </YStack>
      </ScrollView>
    </YStack>
    </SafeAreaView>
  );
}
