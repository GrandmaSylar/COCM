import React, { useEffect, useState } from 'react';
import { Linking, Alert, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Award, Baby, Edit3, Phone, Trash2, Users } from '@tamagui/lucide-icons';
import { getLocalChildById, deleteLocalChild, getLocalChildParents, upsertLocalChild } from '../../lib/db';
import { api } from '../../lib/api';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonProfile } from '../../components/Skeleton';
import {
  AppText, Avatar, Badge, DetailRow, EmptyState, IconButton, ListRow, QuickAction, Screen, Section, Surface, useToast,
} from '../../components/ui';
import { enterUp } from '../../theme/animations';
import { memberStatusTone, statusLabel } from '../../theme/status';
import { space } from '../../theme/tokens';

interface ChildParent {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone?: string;
  relationship: string;
  isLinked?: boolean;
  linkedMemberId?: string;
}

interface FullChildData {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  status: 'active' | 'inactive';
  zone?: string;
  phone?: string;
  secondPhone?: string;
  email?: string;
  residenceLocation?: string;
  digitalAddress?: string;
  hometown?: string;
  joinDate?: string;
  notes?: string;
  photo?: string;
  parents: ChildParent[];
}

export default function ChildProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const c = useAppColors();

  const [childData, setChildData] = useState<FullChildData | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceStats, setAttendanceStats] = useState<{
    totalServices: number;
    totalPresent: number;
    percentage: number;
    records: Array<{ date: string; serviceType: string; status: 'present' | 'absent' }>;
  }>({
    totalServices: 0,
    totalPresent: 0,
    percentage: 0,
    records: []
  });

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  useEffect(() => {
    if (!id) return;

    const loadChildProfile = async () => {
      try {
        // 1. Load from local SQLite for 0ms visual rendering
        const local = await getLocalChildById(id);
        const localParents = await getLocalChildParents(id);

        let initial: FullChildData | null = null;
        if (local && local.raw_json) {
          try {
            const parsed = JSON.parse(local.raw_json);
            initial = {
              id: parsed.id || local.id,
              firstName: parsed.firstName || parsed.first_name || local.name?.split(' ')[0] || 'Child',
              lastName: parsed.lastName || parsed.last_name || local.name?.split(' ').slice(1).join(' ') || '',
              otherNames: parsed.otherNames || parsed.other_names,
              dateOfBirth: parsed.dateOfBirth || parsed.date_of_birth || local.date_of_birth,
              gender: (parsed.gender || local.gender || 'male') as any,
              status: (parsed.status || local.status || 'active') as any,
              zone: parsed.zone || local.zone,
              phone: parsed.phone || parsed.primary_phone,
              secondPhone: parsed.secondPhone || parsed.second_phone,
              email: parsed.email,
              residenceLocation: parsed.residenceLocation || parsed.residence_location,
              digitalAddress: parsed.digitalAddress || parsed.digital_address,
              hometown: parsed.hometown,
              joinDate: parsed.joinDate || parsed.created_at || local.created_at,
              notes: parsed.notes,
              photo: parsed.photo || parsed.photo_url,
              parents: (parsed.parents || []).map((p: any) => ({
                id: p.id,
                firstName: p.firstName || p.first_name || '',
                lastName: p.lastName || p.last_name || '',
                otherNames: p.otherNames || p.other_names,
                phone: p.phone,
                relationship: p.relationship || 'Guardian',
                isLinked: !!p.isLinked || !!p.is_linked,
                linkedMemberId: p.linkedMemberId || p.linked_member_id
              }))
            };
          } catch (e) {
            console.warn('Failed parsing local child raw_json:', e);
          }
        }

        if (!initial && local) {
          const nameParts = (local.name || 'Child').split(' ');
          initial = {
            id: local.id,
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || '',
            dateOfBirth: local.date_of_birth,
            gender: (local.gender || 'male') as any,
            status: (local.status || 'active') as any,
            zone: local.zone,
            joinDate: local.created_at,
            parents: localParents.map((lp) => ({
              id: lp.id,
              firstName: lp.first_name,
              lastName: lp.last_name,
              otherNames: lp.other_names,
              phone: lp.phone,
              relationship: lp.relationship,
              isLinked: !!lp.is_linked,
              linkedMemberId: lp.linked_member_id
            }))
          };
        }

        if (initial) {
          setChildData(initial);
          setLoading(false);
        }

        // 2. Fetch fresh details from Server API
        try {
          const remote = await api.children.members.getById(id);
          if (remote && remote.id) {
            const fresh: FullChildData = {
              id: remote.id,
              firstName: remote.firstName || '',
              lastName: remote.lastName || '',
              otherNames: remote.otherNames,
              dateOfBirth: remote.dateOfBirth || initial?.dateOfBirth || '2015-01-01',
              gender: remote.gender || 'male',
              status: remote.status || 'active',
              zone: remote.zone,
              phone: remote.phone,
              secondPhone: remote.secondPhone,
              email: remote.email,
              residenceLocation: remote.residenceLocation,
              digitalAddress: remote.digitalAddress,
              hometown: remote.hometown,
              joinDate: remote.joinDate || remote.createdAt,
              notes: remote.notes,
              photo: remote.photo || remote.photoUrl,
              parents: (remote.parents || []).map((p: any) => ({
                id: p.id,
                firstName: p.firstName || p.first_name || '',
                lastName: p.lastName || p.last_name || '',
                otherNames: p.otherNames || p.other_names,
                phone: p.phone,
                relationship: p.relationship || 'Guardian',
                isLinked: !!p.isLinked || !!p.is_linked,
                linkedMemberId: p.linkedMemberId || p.linked_member_id
              }))
            };

            setChildData(fresh);

            // Update SQLite cache
            await upsertLocalChild({
              id: fresh.id,
              name: `${fresh.firstName} ${fresh.lastName}`.trim(),
              date_of_birth: fresh.dateOfBirth,
              gender: fresh.gender,
              zone: fresh.zone,
              status: fresh.status,
              guardian_name: fresh.parents[0] ? `${fresh.parents[0].firstName} ${fresh.parents[0].lastName}` : undefined,
              guardian_phone: fresh.parents[0]?.phone,
              raw_json: JSON.stringify(fresh),
              created_at: fresh.joinDate || new Date().toISOString()
            });
          }

          // Fetch attendance history
          const historyRes = await api.children.members.getAttendanceHistory(id);
          if (historyRes && historyRes.summary) {
            setAttendanceStats({
              totalServices: historyRes.summary.totalServices || 0,
              totalPresent: historyRes.summary.totalPresent || 0,
              percentage: historyRes.summary.percentage || 0,
              records: historyRes.records || []
            });
          }
        } catch (serverErr) {
          console.warn('Server fetch error for child, using SQLite:', serverErr);
        }
      } catch (err) {
        console.warn('Error in loadChildProfile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadChildProfile();
  }, [id]);

  const handleCall = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleDeleteChild = () => {
    if (!childData) return;
    Alert.alert(
      'Delete child record?',
      `${childData.firstName} ${childData.lastName} will be permanently removed. This can’t be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLocalChild(childData.id);
              await api.children.members.delete(childData.id);
              toast.show({ title: 'Child record deleted' });
              router.back();
            } catch (err) {
              toast.show({ title: 'Couldn’t delete child record', tone: 'error' });
            }
          }
        }
      ]
    );
  };

  // Same flow as the web app: open Add Member pre-filled from this child; the child
  // record is removed once the member is saved (adult-only fields such as baptism
  // details are completed there).
  const handlePromoteToMember = () => {
    if (!childData) return;
    router.push(`/members/add?fromChildId=${childData.id}` as any);
  };

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Child" showBack />
        <SkeletonProfile />
      </Screen>
    );
  }

  if (!childData) {
    return (
      <Screen>
        <AppHeader title="Child" showBack />
        <EmptyState
          icon={Baby}
          title="Child not found"
          message="This child record couldn’t be found or has been removed."
          action={{ label: 'Back to children', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const age = calculateAge(childData.dateOfBirth);
  const name = `${childData.firstName} ${childData.lastName}`;
  const metaLine = [
    age !== null ? `${age} yrs` : null,
    childData.gender === 'male' ? 'Boy' : childData.gender === 'female' ? 'Girl' : null,
  ].filter(Boolean).join(' · ');

  return (
    <Screen>
      <AppHeader
        title={name}
        subtitle="Child profile"
        showBack
        rightElement={<IconButton icon={Edit3} label="Edit child" tone="primary" onPress={() => router.push(`/children/edit/${childData.id}` as any)} />}
      />

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}>
        <Animated.View entering={enterUp()} style={{ alignItems: 'center', gap: space.sm, paddingTop: space.xs }}>
          <Avatar name={name} uri={childData.photo} size={96} />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <AppText variant="title" align="center" selectable>{name}</AppText>
            {childData.otherNames ? <AppText variant="caption" tone="muted">{childData.otherNames}</AppText> : null}
            {metaLine ? <AppText variant="caption" tone="muted">{metaLine}</AppText> : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            <Badge label={statusLabel(childData.status)} tone={memberStatusTone(childData.status)} />
            {childData.zone ? <Badge label={`Zone ${childData.zone}`} tone="neutral" /> : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.sm }}>
            <QuickAction icon={Edit3} label="Edit" onPress={() => router.push(`/children/edit/${childData.id}` as any)} />
            <QuickAction icon={Award} label="Promote" onPress={handlePromoteToMember} />
            <QuickAction icon={Trash2} label="Delete" tone="danger" onPress={handleDeleteChild} />
          </View>
        </Animated.View>

        <Animated.View entering={enterUp(40)} style={{ gap: space.xl }}>
          <Section title="Attendance">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.success.soft, alignItems: 'center', justifyContent: 'center' }}>
                <AppText variant="headline" tone="success" numeric>{attendanceStats.percentage}%</AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">Attended {attendanceStats.totalPresent} of {attendanceStats.totalServices}</AppText>
                <AppText variant="caption" tone="muted">Recorded services</AppText>
              </View>
            </View>
          </Section>

          <Section title="Parents & guardians">
            {childData.parents && childData.parents.length > 0 ? (
              childData.parents.map(p => (
                <ListRow
                  key={p.id}
                  title={`${p.firstName} ${p.lastName}`}
                  subtitle={`${p.relationship.charAt(0).toUpperCase() + p.relationship.slice(1)}${p.phone ? ` · ${p.phone}` : ''}`}
                  onPress={p.isLinked && p.linkedMemberId ? () => router.push(`/members/${p.linkedMemberId}` as any) : undefined}
                  chevron={!!(p.isLinked && p.linkedMemberId)}
                  right={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {p.isLinked ? <Badge label="Member" tone="success" /> : null}
                      {p.phone ? <IconButton icon={Phone} label={`Call ${p.firstName}`} tone="primary" size={36} onPress={() => handleCall(p.phone)} /> : null}
                    </View>
                  }
                />
              ))
            ) : (
              <EmptyState
                icon={Users}
                title="No parents linked"
                action={{ label: 'Add parents', onPress: () => router.push(`/children/edit/${childData.id}` as any) }}
              />
            )}
          </Section>

          <Section title="Details">
            <DetailRow label="Date of birth" value={formatDate(childData.dateOfBirth)} />
            {childData.phone ? <DetailRow label="Phone" value={childData.phone} onPress={() => handleCall(childData.phone)} /> : null}
            {childData.email ? <DetailRow label="Email" value={childData.email} /> : null}
            <DetailRow label="Residence" value={childData.residenceLocation} />
            {childData.digitalAddress ? <DetailRow label="Digital address" value={childData.digitalAddress} /> : null}
            {childData.hometown ? <DetailRow label="Hometown" value={childData.hometown} /> : null}
            <DetailRow label="Enrolled" value={formatDate(childData.joinDate)} />
          </Section>

          {childData.notes ? (
            <Section title="Notes" bare>
              <Surface><AppText variant="body" tone="muted" selectable>{childData.notes}</AppText></Surface>
            </Section>
          ) : null}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}
